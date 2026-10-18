import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { data } from "../tests/browser/fixtures";
import type { Investigation, Task } from "../src/domain/types";
import type { WorkspaceSnapshot } from "../src/domain/workspace";

const origin = new URL(process.env.SMOKE_URL || "http://localhost:3000").origin;
const csv = (rows: Record<string, string>[]) =>
  [
    Object.keys(rows[0]).join(","),
    ...rows.map((row) =>
      Object.values(row)
        .map((value) => `"${value.replaceAll('"', '""')}"`)
        .join(","),
    ),
  ].join("\n");
const files = {
  orders: csv(
    data.orders.map((o) => ({
      order_id: o.id,
      customer_id: o.customerId,
      marca: o.brand,
      data_pedido: o.orderedAt,
      valor: o.value,
      sku: o.sku,
      descricao_produto: o.product,
      qtd_itens: String(o.quantity),
      brinde_no_pedido: o.gift ? "True" : "False",
      tipo_excecao: o.exception,
      status: o.status,
      transportadora: o.carrier,
      uf: o.state,
      cidade: o.city,
      data_prometida: o.promisedAt,
      data_entrega: o.deliveredAt || "",
      maquina: o.machine,
      turno: o.shift,
      cd: o.dc,
      lote_produto: o.lot,
      data_abertura_excecao: o.openedAt,
    })),
  ),
  customers: csv(
    data.customers.map((c) => ({
      customer_id: c.id,
      n_pedidos: String(c.orders),
      receita_acumulada: c.revenue,
      data_primeiro_pedido: c.firstOrder,
      n_contatos_atendimento: String(c.contacts),
    })),
  ),
  carriers: csv(
    data.carriers.map((c) => ({
      transportadora: c.name,
      uf_atendida: c.state,
      sla_contratado_dias_uteis: String(c.sla),
      custo_medio_frete: c.freight,
    })),
  ),
};
class Demo {
  private cookie = "";
  async fetch(route: string, body?: unknown, method = body ? "POST" : "GET") {
    const response = await fetch(`${origin}${route}`, {
      method,
      headers: {
        cookie: this.cookie,
        origin,
        "content-type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(65000),
    });
    const cookie = response.headers
      .getSetCookie()
      .find(
        (c) =>
          c.startsWith("operations_demo=") &&
          !c.startsWith("operations_demo=;"),
      );
    if (cookie) this.cookie = cookie.split(";")[0];
    return response;
  }
  async json<T = Record<string, unknown>>(
    route: string,
    body?: unknown,
    method?: string,
  ): Promise<T> {
    const response = await this.fetch(route, body, method);
    assert.equal(response.status, 200, `HTTP ${route}: ${response.status}`);
    return response.json() as Promise<T>;
  }
  async run(type: Investigation["type"], target: string) {
    const input = { type, target, requestId: randomUUID() };
    const response = await this.fetch("/api/investigations", input);
    assert.equal(
      response.status,
      200,
      `Iniciar ${type}: HTTP ${response.status}`,
    );
    const lines = (await response.text())
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
    const run = lines.findLast((item) => item.investigation)?.investigation as
      Investigation | undefined;
    assert.ok(run, `Sem resultado para ${type}`);
    assert.equal(run.status, "completed", run.summary);
    const replay = await this.json<{ investigation: Investigation }>(
      "/api/investigations",
      input,
    );
    assert.equal(replay.investigation.id, run.id);
    return run;
  }
}
async function main() {
  const own = new Demo(),
    other = new Demo();
  await own.json("/api/session");
  await other.json("/api/session");
  const standard = await own.json<{
    source: string;
    orders: number;
    importedAt: string;
  }>("/api/data");
  try {
    await own.json("/api/data", { mode: "preview", files });
    await own.json("/api/data", { mode: "commit", files });
    let snapshot = await own.json<WorkspaceSnapshot>("/api/workspace");
    assert.equal(snapshot.summary.totalCount, data.orders.length);
    assert.equal(snapshot.tasks.length, 0);
    const orderRun = await own.run("order", "UI-A");
    snapshot = await own.json<WorkspaceSnapshot>("/api/workspace");
    const task = snapshot.tasks.find((t) => orderRun.taskIds.includes(t.id))!;
    assert.equal(task.kind, "revisao_cadastral");
    const evidence =
      "Referência sintética da verificação cadastral no teste de implantação.";
    await own.json(
      "/api/tasks",
      {
        id: task.id,
        status: "concluida",
        execution: {
          note: "Endereço sintético conferido e correção registrada para validação técnica.",
          evidence,
        },
        resolution: {
          type: "endereco_corrigido",
          evidence,
          evidenceTaskId: task.id,
          executionTaskId: task.id,
        },
      },
      "PATCH",
    );
    snapshot = await own.json<WorkspaceSnapshot>("/api/workspace");
    assert.equal(snapshot.financial.resolvedCount, 1);
    assert.equal(
      snapshot.orders.find((o) => o.id === "UI-A")?.resolution?.outcome
        ?.executionTaskId,
      task.id,
    );
    await own.json(
      "/api/orders",
      {
        action: "reopen",
        orderId: "UI-A",
        note: "Reabertura sintética para validar o início de uma nova etapa.",
      },
      "PATCH",
    );
    snapshot = await own.json<WorkspaceSnapshot>("/api/workspace");
    assert.equal(snapshot.financial.resolvedCount, 0);
    const invalid = await own.fetch(
      "/api/orders",
      {
        action: "resolve",
        orderId: "UI-A",
        note: "Tentativa de reutilizar execução anterior no teste.",
        outcome: {
          type: "endereco_corrigido",
          evidence,
          executionTaskId: task.id,
        },
      },
      "PATCH",
    );
    assert.equal(invalid.status, 409);
    console.log(
      "Publicado: agente de pedido, idempotência, encerramento e reabertura persistidos: OK",
    );
    const recurrence = await own.run("recurrences", "base");
    assert.ok(recurrence.recurrenceReview);
    assert.ok(recurrence.consultedInsightIds?.length);
    snapshot = await own.json<WorkspaceSnapshot>("/api/workspace");
    const process = snapshot.tasks.find(
      (t) => recurrence.taskIds.includes(t.id) && t.scope === "process",
    );
    if (process) {
      const evidenceIds = process.affectedOrderIds!.slice(0, 2);
      const progress = await own.json<Task>(
        "/api/tasks",
        {
          id: process.id,
          action: "save_process_progress",
          expectedUpdatedAt: process.updatedAt,
          progress: {
            observations:
              "Conferência sintética de referências para validar persistência.",
            nextStep: "",
            evidenceIds,
          },
        },
        "PATCH",
      );
      await own.json(
        "/api/tasks",
        {
          id: process.id,
          status: "concluida",
          expectedUpdatedAt: progress.updatedAt,
          conclusion: {
            outcome: "inconclusiva",
            observations:
              "Verificação técnica sintética; não representa conclusão real sobre a operação.",
            evidenceIds,
          },
        },
        "PATCH",
      );
    }
    const daily = await own.run("daily", "day");
    assert.ok(daily.planId);
    const persisted = await own.json<WorkspaceSnapshot>("/api/workspace");
    assert.ok(persisted.runs.some((run) => run.id === recurrence.id));
    assert.equal(persisted.day.plan?.id, daily.planId);
    const isolated = await other.json<WorkspaceSnapshot>("/api/workspace");
    assert.equal(isolated.tasks.length, 0);
    assert.equal(isolated.runs.length, 0);
    console.log("Publicado: recorrências, cobertura, plano e isolamento: OK");
  } finally {
    await own.json("/api/session", {});
    const restored = await own.json<{
      source: string;
      orders: number;
      importedAt: string;
    }>("/api/data");
    assert.equal(restored.source, "administrator");
    assert.equal(restored.orders, standard.orders);
    assert.equal(restored.importedAt, standard.importedAt);
    const state = await own.json<WorkspaceSnapshot>("/api/workspace");
    assert.equal(state.tasks.length, 0);
    assert.equal(state.runs.length, 0);
    console.log(
      "Publicado: reinício restaura a base padrão e limpa a nova sessão: OK",
    );
  }
}
void main().catch((error) => {
  console.error(
    error instanceof assert.AssertionError
      ? error.message
      : "Não foi possível concluir a verificação publicada.",
  );
  process.exitCode = 1;
});
