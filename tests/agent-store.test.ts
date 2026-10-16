import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { rm } from "node:fs/promises";
import {
  executeTool,
  investigate,
  type AgentContext,
  type AgentCompletion,
} from "@/server/agent";
import { createSession, getSession, updateTask } from "@/server/store";
import type { Dataset, Order } from "@/domain/types";
const order: Order = {
  id: "TEST-1",
  customerId: "C1",
  brand: "Teste",
  orderedAt: "2026-09-01",
  value: "100.00",
  sku: "S1",
  product: "Produto teste",
  quantity: 1,
  gift: false,
  exception: "atraso_entrega",
  sourceStatuses: ["aberta"],
  status: "aberta",
  carrier: "Teste",
  state: "SP",
  city: "Teste",
  promisedAt: "2026-09-04",
  deliveredAt: null,
  machine: "",
  shift: "manhã",
  dc: "CD1",
  lot: "TEST",
  openedAt: "2026-09-08",
  issues: [],
};
const data: Dataset = {
  orders: [order],
  customers: [
    {
      id: "C1",
      orders: 2,
      revenue: "1600",
      firstOrder: "2025-01-01",
      contacts: 1,
    },
  ],
  carriers: [{ name: "Teste", state: "SP", sla: 3, freight: "12.00" }],
  importedAt: "",
  sourceRows: 1,
};
const ids = [
  randomUUID().replaceAll("-", ""),
  randomUUID().replaceAll("-", ""),
];
const context = (dataset = data): AgentContext => ({
  sessionId: ids[0],
  runId: randomUUID(),
  data: dataset,
  allowedIds: new Set(["TEST-1"]),
  consulted: new Set(),
  simulated: new Set(),
  evidence: new Set(),
});
const args = {
  orderId: "TEST-1",
  kind: "investigacao_logistica",
  title: "Investigar entrega atrasada",
  justification: "Solicitar verificação do atraso com evidências do pedido.",
  evidenceIds: ["TEST-1"],
};
beforeAll(async () => {
  process.env.LOCAL_DEMO = "true";
  await createSession(ids[0]);
  await createSession(ids[1]);
});
afterAll(async () => {
  for (const id of ids) await rm(`.local/session-${id}.json`, { force: true });
});
describe("ferramentas controladas e persistência", () => {
  it("exige consulta e impede evidência inventada", async () => {
    const ctx = context();
    await expect(executeTool("criar_tarefa", args, ctx)).rejects.toThrow(
      "consultar",
    );
    await executeTool("consultar_pedido", { orderId: "TEST-1" }, ctx);
    await expect(
      executeTool(
        "criar_tarefa",
        { ...args, evidenceIds: ["TEST-1", "inventado"] },
        ctx,
      ),
    ).rejects.toThrow("evidências");
    await expect(
      executeTool("consultar_pedido", { orderId: "OUTRO" }, ctx),
    ).rejects.toThrow("escopo");
    await expect(executeTool("executar_pagamento", {}, ctx)).rejects.toThrow(
      "desconhecida",
    );
  });
  it("persiste, deduplica e isola tarefas", async () => {
    const ctx = context();
    await executeTool("consultar_pedido", { orderId: "TEST-1" }, ctx);
    const first = (await executeTool("criar_tarefa", args, ctx)) as {
      id: string;
    };
    const second = (await executeTool("criar_tarefa", args, ctx)) as {
      id: string;
    };
    expect(first.id).toBe(second.id);
    expect((await getSession(ids[0]))!.tasks.length).toBe(1);
    expect((await getSession(ids[1]))!.tasks.length).toBe(0);
    await expect(updateTask(ids[1], first.id, "concluida")).rejects.toThrow(
      "encontrada",
    );
    await updateTask(ids[0], first.id, "concluida");
    expect((await getSession(ids[0]))!.tasks[0].status).toBe("concluida");
  });
  it("bloqueia ação que dependa de status conflitante", async () => {
    const ctx = context({
      ...data,
      orders: [{ ...order, status: "status_divergente" }],
    });
    await executeTool("consultar_pedido", { orderId: "TEST-1" }, ctx);
    await expect(executeTool("criar_tarefa", args, ctx)).rejects.toThrow(
      "conflito",
    );
  });
  it("exige simulação e aprovação para proposta financeira", async () => {
    const ctx = context();
    await executeTool("consultar_pedido", { orderId: "TEST-1" }, ctx);
    const financialArgs = { ...args, kind: "proposta_reembolso" };
    await expect(
      executeTool("criar_tarefa", financialArgs, ctx),
    ).rejects.toThrow("Simule");
    await executeTool(
      "simular_tratativa",
      { orderId: "TEST-1", action: "reembolso" },
      ctx,
    );
    const task = (await executeTool("criar_tarefa", financialArgs, ctx)) as {
      id: string;
      status: string;
    };
    expect(task.status).toBe("pendente_aprovacao");
    await expect(updateTask(ids[0], task.id, "concluida")).rejects.toThrow(
      "inválida",
    );
    await updateTask(ids[0], task.id, "aprovada");
    expect((await updateTask(ids[0], task.id, "concluida")).status).toBe(
      "concluida",
    );
    await expect(updateTask(ids[0], task.id, "concluida")).rejects.toThrow(
      "inválida",
    );
  });
});
describe("ciclo do agente", () => {
  it("executa consulta, ação e conclusão via tool calling", async () => {
    let n = 0;
    const mock: AgentCompletion = async () => {
      const steps = [
        {
          name: "consultar_pedido",
          arguments: JSON.stringify({ orderId: "TEST-1" }),
        },
        { name: "criar_tarefa", arguments: JSON.stringify(args) },
      ];
      const step = steps[n++];
      return {
        choices: [
          {
            message: step
              ? {
                  content: null,
                  tool_calls: [
                    { id: randomUUID(), type: "function", function: step },
                  ],
                }
              : {
                  content:
                    "Encaminhamento registrado. Nenhuma receita recuperada foi contabilizada.",
                },
          },
        ],
      };
    };
    const run = await investigate(
      { type: "order", target: "TEST-1", requestId: randomUUID() },
      ids[0],
      data,
      () => {},
      mock,
    );
    expect(run.status).toBe("completed");
    expect(run.taskIds.length).toBe(1);
    expect(
      run.events.some((e) => e.tool === "criar_tarefa" && e.state === "ok"),
    ).toBe(true);
  });
  it("preserva execução parcial quando o provedor falha", async () => {
    const mock: AgentCompletion = async () => {
      throw new Error("provider unavailable");
    };
    const run = await investigate(
      { type: "order", target: "TEST-1", requestId: randomUUID() },
      ids[0],
      data,
      () => {},
      mock,
    );
    expect(run.status).toBe("failed");
    expect(
      (await getSession(ids[0]))!.investigations.some((r) => r.id === run.id),
    ).toBe(true);
    expect(run.summary).not.toContain("provider unavailable");
  });
});
