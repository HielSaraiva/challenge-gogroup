import { currentCaseTasks, latestReopen } from "@/domain/case-cycle";
import {
  completedTask,
  rejectionSchema,
  statusReviewTaskPatch,
} from "@/domain/task-results";
import { prepareTaskResolution } from "@/domain/task-resolution";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { and, eq, gt, lt, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import path from "node:path";
import * as schema from "./schema";
import type {
  CaseRecord,
  DailyPlan,
  Dataset,
  Investigation,
  SessionState,
  Task,
} from "@/domain/types";

export class AppError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
function db() {
  if (!process.env.DATABASE_URL)
    throw new AppError("Configure DATABASE_URL no servidor.", 503);
  return drizzle(neon(process.env.DATABASE_URL), { schema });
}
function localAllowed() {
  if (
    process.env.VERCEL ||
    (process.env.NODE_ENV === "production" && process.env.LOCAL_DEMO !== "true")
  )
    throw new AppError(
      "Banco de dados não configurado. Configure DATABASE_URL.",
      503,
    );
}
const localPath = (name: string) =>
  path.join(
    process.env.NODE_ENV === "test" && process.env.OPERATIONS_TEST_DIRECTORY
      ? process.env.OPERATIONS_TEST_DIRECTORY
      : path.join(process.cwd(), ".local"),
    name,
  );
async function readLocal<T>(name: string, fallback?: T): Promise<T> {
  localAllowed();
  try {
    return JSON.parse(await readFile(localPath(name), "utf8"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    if (fallback !== undefined) return fallback;
    throw new AppError(
      "Base ainda não importada. Execute o comando import:data.",
      503,
    );
  }
}
async function writeLocal(name: string, payload: unknown) {
  localAllowed();
  await mkdir(localPath(""), { recursive: true });
  const temp = localPath(`${name}.${randomUUID()}.tmp`);
  await writeFile(temp, JSON.stringify(payload), "utf8");
  await rename(temp, localPath(name));
}
// Serializa o modo local num processo. Produção usa operações atômicas no Postgres.
let pending: Promise<unknown> = Promise.resolve();
function locked<T>(fn: () => Promise<T>): Promise<T> {
  const next = pending.then(fn, fn);
  pending = next.catch(() => {});
  return next;
}
export async function saveDataset(data: Dataset) {
  if (!process.env.DATABASE_URL) return writeLocal("dataset.json", data);
  await db()
    .insert(schema.datasets)
    .values({ id: "operations", payload: data })
    .onConflictDoUpdate({ target: schema.datasets.id, set: { payload: data } });
}
export async function getDataset(state?: SessionState): Promise<Dataset> {
  if (state?.importedDataset) return state.importedDataset;
  if (!process.env.DATABASE_URL) return readLocal<Dataset>("dataset.json");
  const [row] = await db()
    .select()
    .from(schema.datasets)
    .where(eq(schema.datasets.id, "operations"));
  if (!row) throw new AppError("Base ainda não importada.", 503);
  return row.payload;
}
// Session uploads never replace the administrator's shared source dataset.
export async function saveSessionDataset(sessionId: string, data: Dataset) {
  const save = async () => {
    const state = await getSession(sessionId);
    if (!state) throw new AppError("Sessão expirada.", 401);
    if (
      state.tasks.length ||
      state.investigations.length ||
      Object.keys(state.cases || {}).length
    )
      throw new AppError(
        "Esta demonstração já tem tratativas. Reinicie a demonstração antes de trocar a base.",
        409,
      );
    state.importedDataset = data;
    if (!process.env.DATABASE_URL)
      return writeLocal(`session-${sessionId}.json`, state);
    await db()
      .update(schema.sessions)
      .set({ payload: state })
      .where(eq(schema.sessions.id, sessionId));
  };
  return process.env.DATABASE_URL ? save() : locked(save);
}
export function emptySession(): SessionState {
  return {
    tasks: [],
    investigations: [],
    expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
  };
}
export async function createSession(id: string) {
  const state = emptySession();
  if (!process.env.DATABASE_URL)
    await locked(() => writeLocal(`session-${id}.json`, state));
  else {
    const database = db();
    await database
      .delete(schema.sessions)
      .where(lt(schema.sessions.expiresAt, new Date()));
    await database
      .delete(schema.counters)
      .where(lt(schema.counters.expiresAt, new Date()));
    await database
      .insert(schema.sessions)
      .values({ id, payload: state, expiresAt: new Date(state.expiresAt) });
  }
  return state;
}
function reconcileStatusReviews(state: SessionState): SessionState {
  return {
    ...state,
    tasks: state.tasks.map((task) => {
      const record = state.cases?.[task.orderId];
      if (
        task.scope === "process" ||
        task.kind !== "revisao_status" ||
        task.status !== "aberta" ||
        !record?.statusReview ||
        record.statusReview.reviewedAt < task.createdAt
      )
        return task;
      const reopened = latestReopen(record.history);
      if (
        reopened &&
        (task.createdAt < reopened.at ||
          record.statusReview.reviewedAt < reopened.at)
      )
        return task;
      return { ...task, ...statusReviewTaskPatch(record, true) };
    }),
  };
}
export async function getSession(id: string): Promise<SessionState | null> {
  if (!process.env.DATABASE_URL) {
    const state = await readLocal<SessionState | null>(
      `session-${id}.json`,
      null,
    );
    return state && new Date(state.expiresAt).getTime() > Date.now()
      ? reconcileStatusReviews(state)
      : null;
  }
  const [row] = await db()
    .select()
    .from(schema.sessions)
    .where(
      and(
        eq(schema.sessions.id, id),
        gt(schema.sessions.expiresAt, new Date()),
      ),
    );
  if (!row) return null;
  const tasks = await db()
    .select()
    .from(schema.taskRecords)
    .where(eq(schema.taskRecords.sessionId, id));
  const cases = await db()
    .select()
    .from(schema.caseRecords)
    .where(eq(schema.caseRecords.sessionId, id));
  const plans = await db()
    .select()
    .from(schema.dailyPlans)
    .where(eq(schema.dailyPlans.sessionId, id));
  return reconcileStatusReviews({
    ...row.payload,
    tasks: tasks.map((t) => t.payload),
    cases: Object.fromEntries(cases.map((c) => [c.orderId, c.payload])),
    plans: plans.map((plan) => plan.payload),
  });
}
export async function saveInvestigation(sessionId: string, run: Investigation) {
  if (!process.env.DATABASE_URL)
    return locked(async () => {
      const state = await getSession(sessionId);
      if (!state) throw new AppError("Sessão expirada.", 401);
      state.investigations = [
        ...state.investigations.filter((r) => r.id !== run.id),
        run,
      ];
      await writeLocal(`session-${sessionId}.json`, state);
    });
  // Substitui apenas a execução atual, sem sobrescrever investigações concorrentes.
  await db()
    .update(schema.sessions)
    .set({
      payload: sql`jsonb_set(${schema.sessions.payload}, '{investigations}', coalesce((select jsonb_agg(item) from jsonb_array_elements(${schema.sessions.payload}->'investigations') item where item->>'id' <> ${run.id}), '[]'::jsonb) || ${JSON.stringify([run])}::jsonb)`,
    })
    .where(eq(schema.sessions.id, sessionId));
}
export async function upsertTask(sessionId: string, task: Task): Promise<Task> {
  if (!process.env.DATABASE_URL)
    return locked(async () => {
      const state = await getSession(sessionId);
      if (!state) throw new AppError("Sessão expirada.", 401);
      const previous = state.tasks.find(
        (t) => t.idempotencyKey === task.idempotencyKey,
      );
      if (previous) return previous;
      state.tasks.push(task);
      await writeLocal(`session-${sessionId}.json`, state);
      return task;
    });
  const database = db();
  await database
    .insert(schema.taskRecords)
    .values({ sessionId, key: task.idempotencyKey, payload: task })
    .onConflictDoNothing();
  const [row] = await database
    .select()
    .from(schema.taskRecords)
    .where(
      and(
        eq(schema.taskRecords.sessionId, sessionId),
        eq(schema.taskRecords.key, task.idempotencyKey),
      ),
    );
  return row.payload;
}
export async function completeTaskAndResolve(
  sessionId: string,
  taskId: string,
  execution: import("@/domain/types").TaskExecution,
  outcome: import("@/domain/types").ResolutionOutcome,
) {
  const save = async () => {
    const state = await getSession(sessionId);
    if (!state) throw new AppError("Sessão expirada.", 401);
    const data = await getDataset(state);
    let prepared;
    try {
      prepared = prepareTaskResolution(
        data,
        state,
        taskId,
        execution,
        outcome,
        randomUUID(),
      );
    } catch (error) {
      throw new AppError((error as Error).message, 409);
    }
    const { previous, task, record } = prepared;
    if (!process.env.DATABASE_URL) {
      state.tasks = state.tasks.map((item) =>
        item.id === task.id ? task : item,
      );
      state.cases = { ...state.cases, [record.orderId]: record };
      await writeLocal(`session-${sessionId}.json`, state);
    } else {
      // One SQL statement: a failed case/version check rolls back the task too.
      try {
        await db().execute(sql`
          WITH updated_task AS (
            UPDATE demo_tasks SET payload = ${JSON.stringify(task)}::jsonb
            WHERE session_id = ${sessionId} AND key = ${previous.idempotencyKey}
              AND payload->>'status' = ${previous.status}
              AND payload->>'updatedAt' = ${previous.updatedAt}
            RETURNING session_id
          ), saved_case AS (
            INSERT INTO demo_cases (session_id, order_id, version, payload)
            SELECT session_id, ${record.orderId}, ${record.version}, ${JSON.stringify(record)}::jsonb
            FROM updated_task WHERE true
            ON CONFLICT (session_id, order_id) DO UPDATE
              SET version = EXCLUDED.version, payload = EXCLUDED.payload
              WHERE demo_cases.version = ${record.version - 1}
            RETURNING order_id
          )
          SELECT 1 / count(*)::integer AS committed FROM saved_case
        `);
      } catch (error) {
        const code =
          (error as { code?: string; cause?: { code?: string } }).cause?.code ||
          (error as { code?: string }).code;
        if (code === "22012")
          throw new AppError(
            "O pedido ou a tarefa mudou. Atualize antes de confirmar novamente.",
            409,
          );
        throw error;
      }
    }
    return { task, record };
  };
  return process.env.DATABASE_URL ? save() : locked(save);
}
export async function updateTask(
  sessionId: string,
  id: string,
  status: Task["status"],
  execution?: import("@/domain/types").TaskExecution,
  conclusion?: import("@/domain/types").ProcessConclusion,
  rejection?: { note: string },
) {
  const rejectionRecord =
    status === "rejeitada"
      ? { ...rejectionSchema.parse(rejection), at: new Date().toISOString() }
      : undefined;
  const allowed = (previous: Task) =>
    previous.status === "pendente_aprovacao"
      ? ["aprovada", "rejeitada"].includes(status)
      : (["aberta", "aprovada"].includes(previous.status) ||
          (previous.status === "concluida" &&
            (previous.scope === "process"
              ? !previous.conclusion
              : !previous.execution))) &&
        status === "concluida";
  if (!process.env.DATABASE_URL)
    return locked(async () => {
      const state = await getSession(sessionId);
      const task = state?.tasks.find((t) => t.id === id);
      if (!state || !task) throw new AppError("Tarefa não encontrada.", 404);
      if (!allowed(task))
        throw new AppError("Transição de tarefa inválida.", 409);
      if (status === "concluida") {
        try {
          Object.assign(task, completedTask(task, execution, conclusion));
        } catch {
          throw new AppError(
            "Registre a execução e evidência ou a conclusão com dois pedidos relacionados.",
          );
        }
      }
      if (rejectionRecord) task.rejection = rejectionRecord;
      if (status === "aprovada")
        task.approval = { at: new Date().toISOString() };
      task.status = status;
      task.updatedAt = new Date().toISOString();
      await writeLocal(`session-${sessionId}.json`, state);
      return task;
    });
  const database = db();
  const records = await database
    .select()
    .from(schema.taskRecords)
    .where(eq(schema.taskRecords.sessionId, sessionId));
  const record = records.find((t) => t.payload.id === id);
  if (!record) throw new AppError("Tarefa não encontrada.", 404);
  if (!allowed(record.payload))
    throw new AppError("Transição de tarefa inválida.", 409);
  let result = {};
  if (status === "concluida") {
    try {
      result = completedTask(record.payload, execution, conclusion);
    } catch {
      throw new AppError(
        "Registre a execução e evidência ou a conclusão com dois pedidos relacionados.",
      );
    }
  }
  const task = {
    ...record.payload,
    ...result,
    ...(rejectionRecord ? { rejection: rejectionRecord } : {}),
    ...(status === "aprovada"
      ? { approval: { at: new Date().toISOString() } }
      : {}),
    status,
    updatedAt: new Date().toISOString(),
  };
  const updated = await database
    .update(schema.taskRecords)
    .set({ payload: task })
    .where(
      and(
        eq(schema.taskRecords.sessionId, sessionId),
        eq(schema.taskRecords.key, record.key),
        sql`${schema.taskRecords.payload}->>'status' = ${record.payload.status}`,
      ),
    )
    .returning();
  if (!updated.length)
    throw new AppError("A tarefa foi alterada. Atualize a página.", 409);
  return task;
}
export async function consumeLimit(key: string, limit: number): Promise<void> {
  const id = `${new Date().toISOString().slice(0, 10)}:${key}`;
  if (!process.env.DATABASE_URL)
    return locked(async () => {
      const counts = await readLocal<Record<string, number>>("usage.json", {});
      if ((counts[id] || 0) >= limit)
        throw new AppError(
          "Limite diário de investigações atingido. Tente novamente amanhã.",
          429,
        );
      counts[id] = (counts[id] || 0) + 1;
      await writeLocal("usage.json", counts);
    });
  const rows = await db()
    .insert(schema.counters)
    .values({ id, used: 1, expiresAt: new Date(Date.now() + 2 * 86400000) })
    .onConflictDoUpdate({
      target: schema.counters.id,
      set: { used: sql`${schema.counters.used} + 1` },
      setWhere: lt(schema.counters.used, limit),
    })
    .returning();
  if (!rows.length)
    throw new AppError("Limite diário de investigações atingido.", 429);
}
export async function saveCase(sessionId: string, record: CaseRecord) {
  const reviewPatch = statusReviewTaskPatch(record);
  if (!process.env.DATABASE_URL)
    return locked(async () => {
      const state = await getSession(sessionId);
      if (!state) throw new AppError("Sessão expirada.", 401);
      if ((state.cases?.[record.orderId]?.version || 0) !== record.version - 1)
        throw new AppError("O pedido foi alterado. Atualize os dados.", 409);
      state.cases = { ...state.cases, [record.orderId]: record };
      if (reviewPatch) {
        const current = new Set(
          currentCaseTasks(
            { id: record.orderId, caseHistory: record.history },
            state.tasks,
          ).map((task) => task.id),
        );
        state.tasks = state.tasks.map((task) =>
          current.has(task.id) &&
          task.kind === "revisao_status" &&
          task.status === "aberta"
            ? { ...task, ...reviewPatch }
            : task,
        );
      }
      await writeLocal(`session-${sessionId}.json`, state);
    });
  const database = db();
  if (reviewPatch) {
    try {
      await database.execute(sql`
        WITH saved_case AS (
          INSERT INTO demo_cases (session_id, order_id, version, payload)
          VALUES (${sessionId}, ${record.orderId}, ${record.version}, ${JSON.stringify(record)}::jsonb)
          ON CONFLICT (session_id, order_id) DO UPDATE
            SET version = EXCLUDED.version, payload = EXCLUDED.payload
            WHERE demo_cases.version = ${record.version - 1}
          RETURNING session_id, order_id
        ), updated_tasks AS (
          UPDATE demo_tasks SET payload = payload || ${JSON.stringify(reviewPatch)}::jsonb
          FROM saved_case
          WHERE demo_tasks.session_id = saved_case.session_id
            AND payload->>'orderId' = saved_case.order_id
            AND payload->>'kind' = 'revisao_status'
            AND payload->>'status' = 'aberta'
            AND COALESCE(payload->>'createdAt', '') >= ${latestReopen(record.history)?.at || ""}
          RETURNING key
        ) SELECT 1 / count(*)::integer AS committed FROM saved_case
      `);
    } catch (error) {
      const code =
        (error as { code?: string; cause?: { code?: string } }).cause?.code ||
        (error as { code?: string }).code;
      if (code === "22012")
        throw new AppError("O pedido foi alterado. Atualize os dados.", 409);
      throw error;
    }
    return;
  }
  const result = await database
    .insert(schema.caseRecords)
    .values({
      sessionId,
      orderId: record.orderId,
      version: record.version,
      payload: record,
    })
    .onConflictDoUpdate({
      target: [schema.caseRecords.sessionId, schema.caseRecords.orderId],
      set: { version: record.version, payload: record },
      setWhere: eq(schema.caseRecords.version, record.version - 1),
    })
    .returning();
  if (!result.length)
    throw new AppError("O pedido foi alterado. Atualize os dados.", 409);
}
export async function upsertDailyPlan(
  sessionId: string,
  plan: DailyPlan,
): Promise<DailyPlan> {
  if (!process.env.DATABASE_URL)
    return locked(async () => {
      const state = await getSession(sessionId);
      if (!state) throw new AppError("Sessão expirada.", 401);
      const existing = state.plans?.find(
        (previous) => previous.idempotencyKey === plan.idempotencyKey,
      );
      if (existing) return existing;
      state.plans = [...(state.plans || []), plan];
      await writeLocal(`session-${sessionId}.json`, state);
      return plan;
    });
  const database = db();
  await database
    .insert(schema.dailyPlans)
    .values({ sessionId, key: plan.idempotencyKey, payload: plan })
    .onConflictDoNothing();
  const [row] = await database
    .select()
    .from(schema.dailyPlans)
    .where(
      and(
        eq(schema.dailyPlans.sessionId, sessionId),
        eq(schema.dailyPlans.key, plan.idempotencyKey),
      ),
    );
  return row.payload;
}
export async function acquireAgentLease(
  sessionId: string,
): Promise<() => Promise<void>> {
  const key = `lease:${sessionId}`;
  const until = new Date(Date.now() + 60000);
  if (!process.env.DATABASE_URL) {
    await locked(async () => {
      const leases = await readLocal<Record<string, string>>("leases.json", {});
      if (leases[key] && new Date(leases[key]).getTime() > Date.now())
        throw new AppError(
          "Uma investigação já está em andamento nesta sessão. Aguarde sua conclusão.",
          409,
        );
      leases[key] = until.toISOString();
      await writeLocal("leases.json", leases);
    });
    return () =>
      locked(async () => {
        const leases = await readLocal<Record<string, string>>(
          "leases.json",
          {},
        );
        if (leases[key] === until.toISOString()) {
          delete leases[key];
          await writeLocal("leases.json", leases);
        }
      });
  }
  const database = db();
  const claimed = await database
    .insert(schema.counters)
    .values({ id: key, used: 1, expiresAt: until })
    .onConflictDoUpdate({
      target: schema.counters.id,
      set: { expiresAt: until },
      setWhere: lt(schema.counters.expiresAt, new Date()),
    })
    .returning();
  if (!claimed.length)
    throw new AppError(
      "Uma investigação já está em andamento nesta sessão. Aguarde sua conclusão.",
      409,
    );
  return async () => {
    await database
      .delete(schema.counters)
      .where(
        and(eq(schema.counters.id, key), eq(schema.counters.expiresAt, until)),
      );
  };
}
