import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { and, eq, gt, lt, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import path from "node:path";
import * as schema from "./schema";
import type { Dataset, Investigation, SessionState, Task } from "@/domain/types";

export class AppError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
function db() {
  if (!process.env.DATABASE_URL) throw new AppError("Configure DATABASE_URL no servidor.", 503);
  return drizzle(neon(process.env.DATABASE_URL), { schema });
}
function localAllowed() {
  if (process.env.VERCEL || (process.env.NODE_ENV === "production" && process.env.LOCAL_DEMO !== "true")) throw new AppError("Banco de dados não configurado. Configure DATABASE_URL.", 503);
}
const localPath = (name: string) => path.join(process.cwd(), ".local", name);
async function readLocal<T>(name: string, fallback?: T): Promise<T> {
  localAllowed();
  try { return JSON.parse(await readFile(localPath(name), "utf8")); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; if (fallback !== undefined) return fallback; throw new AppError("Base ainda não importada. Execute o comando import:data.", 503); }
}
async function writeLocal(name: string, payload: unknown) {
  localAllowed(); await mkdir(localPath(""), { recursive: true });
  const temp = localPath(`${name}.${randomUUID()}.tmp`);
  await writeFile(temp, JSON.stringify(payload), "utf8"); await rename(temp, localPath(name));
}
// Serializa o modo local num processo. Produção usa operações atômicas no Postgres.
let pending: Promise<unknown> = Promise.resolve();
function locked<T>(fn: () => Promise<T>): Promise<T> { const next = pending.then(fn, fn); pending = next.catch(() => {}); return next; }
export async function saveDataset(data: Dataset) {
  if (!process.env.DATABASE_URL) return writeLocal("dataset.json", data);
  await db().insert(schema.datasets).values({ id: "operations", payload: data }).onConflictDoUpdate({ target: schema.datasets.id, set: { payload: data } });
}
export async function getDataset(): Promise<Dataset> {
  if (!process.env.DATABASE_URL) return readLocal<Dataset>("dataset.json");
  const [row] = await db().select().from(schema.datasets).where(eq(schema.datasets.id, "operations"));
  if (!row) throw new AppError("Base ainda não importada.", 503);
  return row.payload;
}
export function emptySession(): SessionState {
  return { tasks: [], investigations: [], expiresAt: new Date(Date.now() + 7 * 86400000).toISOString() };
}
export async function createSession(id: string) {
  const state = emptySession();
  if (!process.env.DATABASE_URL) await locked(() => writeLocal(`session-${id}.json`, state));
  else {
    const database = db();
    await database.delete(schema.sessions).where(lt(schema.sessions.expiresAt, new Date()));
    await database.delete(schema.counters).where(lt(schema.counters.expiresAt, new Date()));
    await database.insert(schema.sessions).values({ id, payload: state, expiresAt: new Date(state.expiresAt) });
  }
  return state;
}
export async function getSession(id: string): Promise<SessionState | null> {
  if (!process.env.DATABASE_URL) {
    const state = await readLocal<SessionState | null>(`session-${id}.json`, null);
    return state && new Date(state.expiresAt).getTime() > Date.now() ? state : null;
  }
  const [row] = await db().select().from(schema.sessions).where(and(eq(schema.sessions.id, id), gt(schema.sessions.expiresAt, new Date())));
  if (!row) return null;
  const tasks = await db().select().from(schema.taskRecords).where(eq(schema.taskRecords.sessionId, id));
  return { ...row.payload, tasks: tasks.map(t => t.payload) };
}
export async function saveInvestigation(sessionId: string, run: Investigation) {
  if (!process.env.DATABASE_URL) return locked(async () => {
    const state = await getSession(sessionId); if (!state) throw new AppError("Sessão expirada.", 401);
    state.investigations = [...state.investigations.filter(r => r.id !== run.id), run];
    await writeLocal(`session-${sessionId}.json`, state);
  });
  // Substitui apenas a execução atual, sem sobrescrever investigações concorrentes.
  await db().update(schema.sessions).set({ payload: sql`jsonb_set(${schema.sessions.payload}, '{investigations}', coalesce((select jsonb_agg(item) from jsonb_array_elements(${schema.sessions.payload}->'investigations') item where item->>'id' <> ${run.id}), '[]'::jsonb) || ${JSON.stringify([run])}::jsonb)` }).where(eq(schema.sessions.id, sessionId));
}
export async function upsertTask(sessionId: string, task: Task): Promise<Task> {
  if (!process.env.DATABASE_URL) return locked(async () => {
    const state = await getSession(sessionId); if (!state) throw new AppError("Sessão expirada.", 401);
    const previous = state.tasks.find(t => t.idempotencyKey === task.idempotencyKey);
    if (previous) return previous;
    state.tasks.push(task); await writeLocal(`session-${sessionId}.json`, state); return task;
  });
  const database = db();
  await database.insert(schema.taskRecords).values({ sessionId, key: task.idempotencyKey, payload: task }).onConflictDoNothing();
  const [row] = await database.select().from(schema.taskRecords).where(and(eq(schema.taskRecords.sessionId, sessionId), eq(schema.taskRecords.key, task.idempotencyKey)));
  return row.payload;
}
export async function updateTask(sessionId: string, id: string, status: Task["status"]) {
  const allowed = (previous: Task) => previous.status === "pendente_aprovacao" ? ["aprovada", "rejeitada"].includes(status) : previous.status === "aberta" && status === "concluida";
  if (!process.env.DATABASE_URL) return locked(async () => {
    const state = await getSession(sessionId); const task = state?.tasks.find(t => t.id === id);
    if (!state || !task) throw new AppError("Tarefa não encontrada.", 404);
    if (!allowed(task)) throw new AppError("Transição de tarefa inválida.", 409);
    task.status = status; task.updatedAt = new Date().toISOString();
    await writeLocal(`session-${sessionId}.json`, state); return task;
  });
  const database = db();
  const records = await database.select().from(schema.taskRecords).where(eq(schema.taskRecords.sessionId, sessionId));
  const record = records.find(t => t.payload.id === id);
  if (!record) throw new AppError("Tarefa não encontrada.", 404);
  if (!allowed(record.payload)) throw new AppError("Transição de tarefa inválida.", 409);
  const task = { ...record.payload, status, updatedAt: new Date().toISOString() };
  const updated = await database.update(schema.taskRecords).set({ payload: task }).where(and(eq(schema.taskRecords.sessionId, sessionId), eq(schema.taskRecords.key, record.key), sql`${schema.taskRecords.payload}->>'status' = ${record.payload.status}`)).returning();
  if (!updated.length) throw new AppError("A tarefa foi alterada. Atualize a página.", 409);
  return task;
}
export async function consumeLimit(key: string, limit: number): Promise<void> {
  const id = `${new Date().toISOString().slice(0, 10)}:${key}`;
  if (!process.env.DATABASE_URL) return locked(async () => {
    const counts = await readLocal<Record<string, number>>("usage.json", {});
    if ((counts[id] || 0) >= limit) throw new AppError("Limite diário de investigações atingido. Tente novamente amanhã.", 429);
    counts[id] = (counts[id] || 0) + 1; await writeLocal("usage.json", counts);
  });
  const rows = await db().insert(schema.counters).values({ id, used: 1, expiresAt: new Date(Date.now() + 2 * 86400000) }).onConflictDoUpdate({ target: schema.counters.id, set: { used: sql`${schema.counters.used} + 1` }, setWhere: lt(schema.counters.used, limit) }).returning();
  if (!rows.length) throw new AppError("Limite diário de investigações atingido.", 429);
}
