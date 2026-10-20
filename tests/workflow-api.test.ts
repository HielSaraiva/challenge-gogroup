import { pendingWork } from "@/domain/pending-work";
import { POST as investigationPOST } from "@/app/api/investigations/route";
import {
  currentCaseTasks,
  reopenedWithoutTask,
  ordersNeedingInvestigation,
} from "@/domain/case-cycle";
import { financialReport, usedDailyCapacity } from "@/domain/operations";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import {
  createSession,
  getSession,
  saveSessionDataset,
  upsertTask,
} from "@/server/store";
import { executeTool, type AgentContext } from "@/server/agent";
import { GET as queueGET } from "@/app/api/queue/route";
import { PATCH as taskPATCH } from "@/app/api/tasks/route";
import { PATCH as orderPATCH } from "@/app/api/orders/route";
import { GET as operationsGET } from "@/app/api/operations/route";
import type { Dataset, Task } from "@/domain/types";
import { sessionDataset } from "@/domain/cases";
import { awaitingResultOrders } from "@/domain/task-resolution";
let sessionId = "";
vi.mock("@/server/http", async (original) => ({
  ...(await original<typeof import("@/server/http")>()),
  session: async () => ({
    id: sessionId,
    state: (await getSession(sessionId))!,
  }),
}));
const data: Dataset = {
  importedAt: "2026-09-30T10:00:00Z",
  sourceRows: 2,
  customers: [
    {
      id: "SYN-C",
      orders: 2,
      revenue: "200.00",
      firstOrder: "2026-09-01",
      contacts: 0,
    },
  ],
  carriers: [
    { name: "Transportadora sintética", state: "SP", sla: 3, freight: "12.00" },
  ],
  orders: ["SYN-A", "SYN-B"].map((id) => ({
    id,
    customerId: "SYN-C",
    brand: "Marca sintética",
    orderedAt: "2026-09-01",
    value: "100.00",
    sku: "SYN",
    product: "Produto sintético",
    quantity: 1,
    gift: false,
    exception: "endereco_divergente",
    sourceStatuses: ["aberta"],
    status: "aberta",
    carrier: "Transportadora sintética",
    state: "SP",
    city: "Cidade sintética",
    promisedAt: "2026-09-08",
    deliveredAt: null,
    machine: "",
    shift: "manhã",
    dc: "CD-SYN",
    lot: "L-SYN",
    openedAt: "2026-09-09",
    issues: [],
  })),
};
const request = (path: string, body: unknown) =>
  new Request(`http://localhost:3000/api/${path}`, {
    method: "PATCH",
    headers: {
      origin: "http://localhost:3000",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
const context = (mode: AgentContext["mode"]): AgentContext => ({
  sessionId,
  runId: randomUUID(),
  data,
  mode,
  allowedIds: new Set(data.orders.map((o) => o.id)),
  consulted: new Set(),
  simulated: new Set(),
  evidence: new Set(),
});
beforeEach(async () => {
  sessionId = randomUUID();
  await createSession(sessionId);
  await saveSessionDataset(sessionId, data);
});
describe("fluxo persistido pelos endpoints", () => {
  const newTask = (patch: Partial<Task> = {}): Task => ({
    id: randomUUID(),
    investigationId: randomUUID(),
    orderId: "SYN-A",
    kind: "revisao_cadastral",
    title: "Conferir endereço",
    justification: "Validar o endereço antes de liberar o atendimento",
    evidenceIds: ["SYN-A"],
    area: "Atendimento",
    dueAt: "2026-10-01",
    status: "aberta",
    createdAt: "2026-09-30T10:00:00Z",
    updatedAt: "2026-09-30T10:00:00Z",
    idempotencyKey: randomUUID(),
    ...patch,
  });
  const execution = {
    note: "Endereço conferido e correção registrada no sistema",
    evidence: "Chamado sintético com confirmação da correção cadastral",
  };
  it("salva e retoma o progresso da recorrência sem encerrar pedidos ou remover a pendência", async () => {
    const task = newTask({
      scope: "process",
      kind: "melhoria_processo",
      affectedOrderIds: ["SYN-A", "SYN-B"],
      evidenceIds: ["SYN-A", "SYN-B"],
    });
    await upsertTask(sessionId, task);
    const progress = {
      observations: "Conferência parcial dos registros sintéticos",
      nextStep: "Consultar a área responsável antes de concluir a causa.",
      evidenceIds: ["SYN-A"],
    };
    const response = await taskPATCH(
      request("tasks", {
        id: task.id,
        action: "save_process_progress",
        progress,
        expectedUpdatedAt: task.updatedAt,
      }),
    );
    expect(response.status).toBe(200);
    const saved = await response.json();
    expect(saved.status).toBe("aberta");
    expect(saved.conclusion).toBeUndefined();
    let state = (await getSession(sessionId))!;
    expect(state.tasks[0].processProgress).toMatchObject(progress);
    expect(
      pendingWork(data.orders, state.tasks).some(
        (item) => item.kind === "process",
      ),
    ).toBe(true);
    expect(
      financialReport(sessionDataset(data, state), state).resolvedCount,
    ).toBe(0);
    const stale = await taskPATCH(
      request("tasks", {
        id: task.id,
        action: "save_process_progress",
        progress: {
          ...progress,
          observations:
            "Alteração de outra tela que não pode sobrescrever o progresso",
        },
        expectedUpdatedAt: task.updatedAt,
      }),
    );
    expect(stale.status).toBe(409);
    const conclusion = {
      outcome: "inconclusiva",
      observations:
        "Os registros conferidos ainda não permitem confirmar a hipótese.",
      nextStep: "Consultar os registros de origem com a área responsável.",
      evidenceIds: ["SYN-A", "SYN-B"],
    };
    const missingVersion = await taskPATCH(
      request("tasks", { id: task.id, status: "concluida", conclusion }),
    );
    expect(missingVersion.status).toBe(409);
    const staleClose = await taskPATCH(
      request("tasks", {
        id: task.id,
        status: "concluida",
        conclusion,
        expectedUpdatedAt: task.updatedAt,
      }),
    );
    expect(staleClose.status).toBe(409);
    const finished = await taskPATCH(
      request("tasks", {
        id: task.id,
        status: "concluida",
        conclusion,
        expectedUpdatedAt: saved.updatedAt,
      }),
    );
    expect(finished.status).toBe(200);
    state = (await getSession(sessionId))!;
    expect(state.tasks[0].conclusion).toMatchObject(conclusion);
    expect(
      pendingWork(data.orders, state.tasks).some(
        (item) => item.kind === "process",
      ),
    ).toBe(false);
    expect(
      financialReport(sessionDataset(data, state), state).resolvedCount,
    ).toBe(0);
    const afterConclusion = await taskPATCH(
      request("tasks", {
        id: task.id,
        action: "save_process_progress",
        progress,
        expectedUpdatedAt: state.tasks[0].updatedAt,
      }),
    );
    expect(afterConclusion.status).toBe(409);
  });
  it("aceita progresso parcial, mas impede referências externas e uso em tarefa individual", async () => {
    const task = newTask({
      scope: "process",
      kind: "melhoria_processo",
      affectedOrderIds: ["SYN-A", "SYN-B"],
    });
    await upsertTask(sessionId, task);
    const partial = { observations: "", nextStep: "", evidenceIds: [] };
    let response = await taskPATCH(
      request("tasks", {
        id: task.id,
        action: "save_process_progress",
        progress: { ...partial, evidenceIds: ["SYN-OTHER"] },
        expectedUpdatedAt: task.updatedAt,
      }),
    );
    expect(response.status).toBe(409);
    response = await taskPATCH(
      request("tasks", {
        id: task.id,
        action: "save_process_progress",
        progress: { ...partial, evidenceIds: ["SYN-A", "SYN-A"] },
        expectedUpdatedAt: task.updatedAt,
      }),
    );
    expect(response.status).toBe(409);
    response = await taskPATCH(
      request("tasks", {
        id: task.id,
        action: "save_process_progress",
        progress: partial,
        expectedUpdatedAt: task.updatedAt,
      }),
    );
    expect(response.status).toBe(200);
    const single = newTask();
    await upsertTask(sessionId, single);
    response = await taskPATCH(
      request("tasks", {
        id: single.id,
        action: "save_process_progress",
        progress: partial,
        expectedUpdatedAt: single.updatedAt,
      }),
    );
    expect(response.status).toBe(409);
    const state = (await getSession(sessionId))!;
    expect(
      state.tasks.find((item) => item.id === single.id)?.processProgress,
    ).toBeUndefined();
  });
  it("reabre em nova etapa, preserva histórico e recusa evidência do atendimento anterior", async () => {
    const original = newTask();
    await upsertTask(sessionId, original);
    const resolution = {
      type: "endereco_corrigido",
      evidence: execution.evidence,
      evidenceTaskId: original.id,
    };
    expect(
      (
        await taskPATCH(
          request("tasks", {
            id: original.id,
            status: "concluida",
            execution,
            resolution,
          }),
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await orderPATCH(
          request("orders", {
            action: "reopen",
            orderId: "SYN-A",
            note: "O endereço voltou a apresentar divergência",
          }),
        )
      ).status,
    ).toBe(200);
    let state = (await getSession(sessionId))!;
    let effective = sessionDataset(data, state);
    expect(currentCaseTasks(effective.orders[0], state.tasks)).toEqual([]);
    expect(
      reopenedWithoutTask(effective.orders, state.tasks).map(
        (order) => order.id,
      ),
    ).toEqual(["SYN-A"]);
    expect(awaitingResultOrders(effective.orders, state.tasks)).toEqual([]);
    expect(financialReport(effective, state).resolvedCount).toBe(0);
    expect(usedDailyCapacity(effective)).toBe(1);
    const historyLength = state.cases!["SYN-A"].history.length;
    expect(
      (
        await orderPATCH(
          request("orders", {
            action: "reopen",
            orderId: "SYN-A",
            note: "Segunda tentativa de reabertura duplicada",
          }),
        )
      ).status,
    ).toBe(409);
    expect((await getSession(sessionId))!.cases!["SYN-A"].history).toHaveLength(
      historyLength,
    );
    expect(
      (
        await taskPATCH(
          request("tasks", { id: original.id, status: "concluida", execution }),
        )
      ).status,
    ).toBe(409);
    const newContext = { ...context("order"), data: effective };
    await executeTool("consultar_pedido", { orderId: "SYN-A" }, newContext);
    const args = {
      orderId: "SYN-A",
      kind: "revisao_cadastral",
      title: "Conferir novamente o endereço",
      justification:
        "Investigar a nova divergência registrada após reabrir o pedido.",
      evidenceIds: ["SYN-A"],
    };
    const fresh = (await executeTool("criar_tarefa", args, newContext)) as Task;
    const repeated = (await executeTool(
      "criar_tarefa",
      args,
      newContext,
    )) as Task;
    expect(repeated.id).toBe(fresh.id);
    expect(fresh.id).not.toBe(original.id);
    state = (await getSession(sessionId))!;
    effective = sessionDataset(data, state);
    expect(reopenedWithoutTask(effective.orders, state.tasks)).toEqual([]);
    expect(
      (
        await taskPATCH(
          request("tasks", { id: fresh.id, status: "concluida", execution }),
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await orderPATCH(
          request("orders", {
            action: "resolve",
            orderId: "SYN-A",
            note: execution.note,
            outcome: resolution,
          }),
        )
      ).status,
    ).toBe(409);
    expect(
      (await getSession(sessionId))!.cases!["SYN-A"].resolution,
    ).toBeUndefined();
    expect(
      (
        await orderPATCH(
          request("orders", {
            action: "resolve",
            orderId: "SYN-A",
            note: execution.note,
            outcome: { ...resolution, evidenceTaskId: fresh.id },
          }),
        )
      ).status,
    ).toBe(200);
    state = (await getSession(sessionId))!;
    effective = sessionDataset(data, state);
    expect(state.tasks).toHaveLength(2);
    expect(state.cases!["SYN-A"].history.map((event) => event.action)).toEqual([
      "resolve",
      "reopen",
      "resolve",
    ]);
    expect(financialReport(effective, state).resolvedCount).toBe(1);
    expect(usedDailyCapacity(effective)).toBe(2);
    expect(reopenedWithoutTask(effective.orders, state.tasks)).toEqual([]);
  });
  it("separa aprovação, despacho e recebimento do reenvio", async () => {
    await saveSessionDataset(sessionId, {
      ...data,
      orders: data.orders.map((order) => ({
        ...order,
        exception: "item_faltante",
      })),
    });
    const proposal = newTask({
      kind: "proposta_reenvio",
      status: "pendente_aprovacao",
    });
    await upsertTask(sessionId, proposal);
    const outcome = {
      type: "item_reenviado",
      receiptConfirmed: true,
      evidence: "Comprovante sintético do recebimento do item",
    };
    expect(
      (
        await taskPATCH(
          request("tasks", {
            id: proposal.id,
            status: "concluida",
            execution: { ...execution, stage: "received" },
            resolution: outcome,
          }),
        )
      ).status,
    ).toBe(409);
    expect(
      (
        await taskPATCH(
          request("tasks", { id: proposal.id, status: "aprovada", execution }),
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await taskPATCH(
          request("tasks", { id: proposal.id, status: "aprovada" }),
        )
      ).status,
    ).toBe(200);
    expect((await getSession(sessionId))!.tasks[0].approval?.at).toBeTruthy();
    expect(
      (
        await taskPATCH(
          request("tasks", {
            id: proposal.id,
            status: "concluida",
            execution: { ...execution, stage: "dispatched" },
            resolution: outcome,
          }),
        )
      ).status,
    ).toBe(409);
    expect((await getSession(sessionId))!.tasks[0].execution).toBeUndefined();
    expect(
      (
        await taskPATCH(
          request("tasks", {
            id: proposal.id,
            status: "concluida",
            execution: { ...execution, stage: "dispatched" },
          }),
        )
      ).status,
    ).toBe(200);
    let state = (await getSession(sessionId))!;
    const effective = sessionDataset(
      {
        ...data,
        orders: data.orders.map((order) => ({
          ...order,
          exception: "item_faltante",
        })),
      },
      state,
    );
    expect(awaitingResultOrders(effective.orders, state.tasks)).toHaveLength(1);
    expect(
      (
        await orderPATCH(
          request("orders", {
            action: "resolve",
            orderId: "SYN-A",
            note: execution.note,
            outcome: { ...outcome, receiptConfirmed: false },
          }),
        )
      ).status,
    ).toBe(409);
    expect(
      (
        await orderPATCH(
          request("orders", {
            action: "resolve",
            orderId: "SYN-A",
            note: execution.note,
            outcome: {
              ...outcome,
              evidence: execution.evidence,
              evidenceTaskId: proposal.id,
            },
          }),
        )
      ).status,
    ).toBe(409);
    expect(
      (
        await orderPATCH(
          request("orders", {
            action: "resolve",
            orderId: "SYN-A",
            note: execution.note,
            outcome,
          }),
        )
      ).status,
    ).toBe(200);
    state = (await getSession(sessionId))!;
    expect(state.tasks[0].execution?.stage).toBe("dispatched");
    expect(state.cases!["SYN-A"].resolution?.outcome?.receiptConfirmed).toBe(
      true,
    );
    expect(
      (
        await taskPATCH(
          request("tasks", { id: proposal.id, status: "concluida", execution }),
        )
      ).status,
    ).toBe(409);
  });
  it("registra motivo da rejeição e permite outra proposta sem duplicar a nova tentativa", async () => {
    const dataset = {
      ...data,
      orders: data.orders.map((order) => ({
        ...order,
        exception: "item_faltante",
      })),
    };
    await saveSessionDataset(sessionId, dataset);
    const ctx = { ...context("order"), data: dataset };
    await executeTool("consultar_pedido", { orderId: "SYN-A" }, ctx);
    await executeTool(
      "simular_tratativa",
      { orderId: "SYN-A", action: "reenvio" },
      ctx,
    );
    const args = {
      orderId: "SYN-A",
      kind: "proposta_reenvio",
      title: "Reenviar o item faltante",
      justification:
        "Avaliar o reenvio do item que não foi recebido pelo cliente.",
      evidenceIds: ["SYN-A"],
    };
    const proposal = (await executeTool("criar_tarefa", args, ctx)) as Task;
    expect(
      (
        await taskPATCH(
          request("tasks", { id: proposal.id, status: "rejeitada" }),
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await taskPATCH(
          request("tasks", {
            id: proposal.id,
            status: "rejeitada",
            rejection: {
              note: "Produto indisponível; avaliar solução alternativa",
            },
          }),
        )
      ).status,
    ).toBe(200);
    const state = (await getSession(sessionId))!;
    expect(state.tasks[0].rejection?.note).toContain("Produto indisponível");
    expect(
      ordersNeedingInvestigation(
        sessionDataset(dataset, state).orders,
        state.tasks,
      ),
    ).toHaveLength(1);
    const next = (await executeTool("criar_tarefa", args, ctx)) as Task;
    expect(next.id).not.toBe(proposal.id);
    const duplicate = (await executeTool("criar_tarefa", args, ctx)) as Task;
    expect(duplicate.id).toBe(next.id);
    expect((await getSession(sessionId))!.tasks).toHaveLength(2);
  });
  it("confirmar status conclui a revisão sem duplicar formulários e exige uma tratativa real", async () => {
    const dataset = {
      ...data,
      orders: data.orders.map((order) => ({
        ...order,
        status: "status_divergente",
        sourceStatuses: ["aberta", "em_analise"],
      })),
    };
    await saveSessionDataset(sessionId, dataset);
    const review = newTask({ kind: "revisao_status" });
    await upsertTask(sessionId, review);
    expect(
      (
        await taskPATCH(
          request("tasks", { id: review.id, status: "concluida", execution }),
        )
      ).status,
    ).toBe(409);
    expect(
      (
        await orderPATCH(
          request("orders", {
            action: "review_status",
            orderId: "SYN-A",
            status: "em_analise",
            note: "Status conferido no registro sintético da origem",
          }),
        )
      ).status,
    ).toBe(200);
    const state = (await getSession(sessionId))!;
    expect(state.tasks[0].status).toBe("concluida");
    expect(state.tasks[0].execution?.evidence).toContain("Em análise");
    expect(
      ordersNeedingInvestigation(
        sessionDataset(dataset, state).orders,
        state.tasks,
      ),
    ).toHaveLength(1);
    expect(
      (
        await orderPATCH(
          request("orders", {
            action: "resolve",
            orderId: "SYN-A",
            note: execution.note,
            outcome: {
              type: "endereco_corrigido",
              evidence: execution.evidence,
            },
          }),
        )
      ).status,
    ).toBe(409);
  });
  it.each([
    ["atraso_entrega", "investigacao_logistica", "entrega_confirmada"],
    ["extravio", "investigacao_logistica", "entrega_confirmada"],
    ["rastreio_parado", "investigacao_logistica", "entrega_confirmada"],
    ["devolvido_transportadora", "revisao_cadastral", "entrega_confirmada"],
    ["avaria_transporte", "inspecao_lote", "item_reenviado"],
    ["vazamento_produto", "inspecao_lote", "item_reenviado"],
    ["item_faltante", "revisao_separacao", "item_reenviado"],
    ["falha_personalizacao", "manutencao_personalizacao", "item_reenviado"],
    ["endereco_divergente", "revisao_cadastral", "endereco_corrigido"],
    ["pagamento_pendente", "revisao_pagamento", "pagamento_regularizado"],
    ["ruptura_pos_venda", "revisao_estoque", "estoque_regularizado"],
  ] as const)(
    "mantém execução, resolução e reabertura coerentes para %s",
    async (exception, kind, type) => {
      await saveSessionDataset(sessionId, {
        ...data,
        orders: data.orders.map((order) => ({ ...order, exception })),
      });
      const resolution = {
        type,
        evidence: "Referência sintética que comprova o resultado final",
        ...(type === "item_reenviado" ? { receiptConfirmed: true } : {}),
      };
      for (let cycle = 0; cycle < 2; cycle++) {
        const task = newTask({ kind, createdAt: new Date().toISOString() });
        await upsertTask(sessionId, task);
        expect(
          (
            await taskPATCH(
              request("tasks", {
                id: task.id,
                status: "concluida",
                execution,
                resolution,
              }),
            )
          ).status,
        ).toBe(200);
        if (cycle === 0)
          expect(
            (
              await orderPATCH(
                request("orders", {
                  action: "reopen",
                  orderId: "SYN-A",
                  note: "Nova ocorrência confirmada após o encerramento",
                }),
              )
            ).status,
          ).toBe(200);
      }
      const state = (await getSession(sessionId))!;
      expect(
        state.cases!["SYN-A"].history.map((event) => event.action),
      ).toEqual(["resolve", "reopen", "resolve"]);
      expect(state.tasks).toHaveLength(2);
      expect(state.tasks.every((task) => task.status === "concluida")).toBe(
        true,
      );
    },
  );
  it.each(["proposta_reenvio", "proposta_reembolso"] as const)(
    "exige nova aprovação e execução de %s após reabrir",
    async (kind) => {
      await saveSessionDataset(sessionId, {
        ...data,
        orders: data.orders.map((order) => ({
          ...order,
          exception: "item_faltante",
        })),
      });
      for (let cycle = 0; cycle < 2; cycle++) {
        const task = newTask({
          kind,
          status: "pendente_aprovacao",
          createdAt: new Date().toISOString(),
        });
        await upsertTask(sessionId, task);
        const performed = {
          ...execution,
          ...(kind === "proposta_reenvio"
            ? { stage: "received" as const }
            : {}),
        };
        const resolution =
          kind === "proposta_reenvio"
            ? {
                type: "item_reenviado",
                evidence: execution.evidence,
                evidenceTaskId: task.id,
                receiptConfirmed: true,
              }
            : {
                type: "reembolso_registrado",
                evidence: execution.evidence,
                evidenceTaskId: task.id,
                refund: "50.00",
              };
        expect(
          (
            await taskPATCH(
              request("tasks", {
                id: task.id,
                status: "concluida",
                execution: performed,
                resolution,
              }),
            )
          ).status,
        ).toBe(409);
        expect(
          (
            await taskPATCH(
              request("tasks", { id: task.id, status: "aprovada" }),
            )
          ).status,
        ).toBe(200);
        if (kind === "proposta_reembolso") {
          expect(
            (
              await taskPATCH(
                request("tasks", {
                  id: task.id,
                  status: "concluida",
                  execution: performed,
                  resolution: { ...resolution, refund: "101.00" },
                }),
              )
            ).status,
          ).toBe(409);
          expect(
            (await getSession(sessionId))!.tasks.find(
              (item) => item.id === task.id,
            )?.execution,
          ).toBeUndefined();
        }
        expect(
          (
            await taskPATCH(
              request("tasks", {
                id: task.id,
                status: "concluida",
                execution: performed,
                resolution,
              }),
            )
          ).status,
        ).toBe(200);
        if (!cycle)
          expect(
            (
              await orderPATCH(
                request("orders", {
                  action: "reopen",
                  orderId: "SYN-A",
                  note: "Reabertura para avaliar nova ocorrência da pendência",
                }),
              )
            ).status,
          ).toBe(200);
      }
      const state = (await getSession(sessionId))!;
      expect(state.tasks).toHaveLength(2);
      expect(
        state.tasks.every(
          (task) => task.status === "concluida" && task.approval?.at,
        ),
      ).toBe(true);
      expect(state.cases!["SYN-A"].history).toHaveLength(3);
    },
  );
  it("lista só pendências, agrega tarefas por pedido e mantém a próxima ação", async () => {
    const first = newTask();
    const second = newTask();
    const process = newTask({
      scope: "process",
      kind: "melhoria_processo",
      insightId: "sinal",
      status: "concluida",
      conclusion: {
        outcome: "inconclusiva",
        observations: "Conclusão documentada na amostra sintética",
        evidenceIds: ["SYN-A", "SYN-B"],
        nextStep: "Verificar outra hipótese antes de mudar a operação",
      },
    });
    let items = pendingWork(data.orders, [first, second, process]);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      kind: "order",
      phase: "execution",
      tasks: [first, second],
    });
    expect(
      pendingWork(data.orders, [{ ...first, status: "rejeitada" }])[0],
    ).toMatchObject({ phase: "investigate" });
    expect(
      pendingWork(data.orders, [
        { ...first, status: "concluida", execution },
      ])[0],
    ).toMatchObject({ phase: "result" });
    expect(
      pendingWork(data.orders, [
        {
          ...first,
          status: "concluida",
          execution: { ...execution, stage: "dispatched" },
        },
      ])[0],
    ).toMatchObject({ phase: "receipt" });
    expect(
      pendingWork(
        data.orders.map((order) => ({
          ...order,
          resolution: {
            note: execution.note,
            resolvedAt: new Date().toISOString(),
          },
        })),
        [first, second, process],
      ),
    ).toEqual([]);
  });
  it("abrir uma recorrência já criada reutiliza o registro sem iniciar outra execução de IA", async () => {
    const task = newTask({
      scope: "process",
      kind: "melhoria_processo",
      insightId: "sinal-testado",
    });
    await upsertTask(sessionId, task);
    for (let click = 0; click < 2; click++) {
      const response = await investigationPOST(
        new Request("http://localhost:3000/api/investigations", {
          method: "POST",
          headers: {
            origin: "http://localhost:3000",
            "content-type": "application/json",
          },
          body: JSON.stringify({
            type: "pattern",
            target: task.insightId,
            requestId: randomUUID(),
          }),
        }),
      );
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ taskId: task.id, reused: true });
    }
    const state = (await getSession(sessionId))!;
    expect(state.tasks).toHaveLength(1);
    expect(state.investigations).toHaveLength(0);
  });
  it("registra execução sem encerrar e mantém pedido aguardando resultado", async () => {
    const task = newTask();
    await upsertTask(sessionId, task);
    expect(
      (
        await taskPATCH(
          request("tasks", { id: task.id, status: "concluida", execution }),
        )
      ).status,
    ).toBe(200);
    const state = (await getSession(sessionId))!;
    expect(state.tasks[0].status).toBe("concluida");
    expect(state.cases?.["SYN-A"]?.resolution).toBeUndefined();
    expect(
      awaitingResultOrders(sessionDataset(data, state).orders, state.tasks).map(
        (order) => order.id,
      ),
    ).toEqual(["SYN-A"]);
    const response = await orderPATCH(
      request("orders", {
        action: "resolve",
        orderId: "SYN-A",
        note: execution.note,
        outcome: {
          type: "endereco_corrigido",
          evidence: execution.evidence,
          evidenceTaskId: task.id,
        },
      }),
    );
    expect(response.status).toBe(200);
    const closed = (await getSession(sessionId))!;
    expect(
      awaitingResultOrders(sessionDataset(data, closed).orders, closed.tasks),
    ).toEqual([]);
  });
  it.each(["junto", "depois"])(
    "permite registrar resultado %s após consumir a referência de planejamento",
    async (path) => {
      const history = [
        {
          id: randomUUID(),
          action: "resolve" as const,
          note: "Encerramento sintético já documentado",
          at: "2026-09-30T10:00:00Z",
        },
      ];
      const source = {
        ...data,
        orders: [
          ...data.orders,
          ...Array.from({ length: 150 }, (_, i) => ({
            ...data.orders[1],
            id: `CAP-${i}`,
            caseHistory: history,
            resolution: { note: history[0].note, resolvedAt: history[0].at },
          })),
        ],
      };
      await saveSessionDataset(sessionId, source);
      const task = newTask(
        path === "depois" ? { status: "concluida", execution } : {},
      );
      await upsertTask(sessionId, task);
      const outcome = {
        type: "endereco_corrigido",
        evidence: execution.evidence,
        executionTaskId: task.id,
      };
      const response =
        path === "junto"
          ? await taskPATCH(
              request("tasks", {
                id: task.id,
                status: "concluida",
                execution,
                resolution: outcome,
              }),
            )
          : await orderPATCH(
              request("orders", {
                action: "resolve",
                orderId: task.orderId,
                note: execution.note,
                outcome,
              }),
            );
      expect(response.status).toBe(200);
      const state = (await getSession(sessionId))!;
      const effective = sessionDataset(source, state);
      expect(usedDailyCapacity(effective)).toBe(151);
      expect(
        state.cases![task.orderId].resolution?.outcome?.executionTaskId,
      ).toBe(task.id);
      const capacity = await (
        await operationsGET(new Request("http://localhost:3000/api/operations"))
      ).json();
      expect(capacity.availableCapacity).toBe(0);
    },
  );
  it("salva execução e resultado juntos, vinculando a evidência sem duplicar formulário", async () => {
    const task = newTask();
    await upsertTask(sessionId, task);
    const response = await taskPATCH(
      request("tasks", {
        id: task.id,
        status: "concluida",
        execution,
        resolution: {
          type: "endereco_corrigido",
          evidence: execution.evidence,
          evidenceTaskId: task.id,
        },
      }),
    );
    expect(response.status).toBe(200);
    const state = (await getSession(sessionId))!;
    expect(state.tasks[0].execution?.note).toBe(execution.note);
    expect(state.cases?.["SYN-A"].resolution?.outcome).toMatchObject({
      evidenceTaskId: task.id,
      evidence: execution.evidence,
    });
    expect(state.cases?.["SYN-A"].history).toHaveLength(1);
  });
  it.each([
    [
      "resultado incompatível",
      {
        type: "reembolso_registrado",
        refund: "50.00",
        evidence: execution.evidence,
      },
    ],
    [
      "referência de evidência inválida",
      {
        type: "endereco_corrigido",
        evidence: execution.evidence,
        evidenceTaskId: "outra-tarefa",
      },
    ],
  ])(
    "rejeita %s sem concluir parcialmente a tarefa",
    async (_label, resolution) => {
      const task = newTask();
      await upsertTask(sessionId, task);
      const response = await taskPATCH(
        request("tasks", {
          id: task.id,
          status: "concluida",
          execution,
          resolution,
        }),
      );
      expect(response.status).toBe(409);
      const state = (await getSession(sessionId))!;
      expect(state.tasks[0].status).toBe("aberta");
      expect(state.tasks[0].execution).toBeUndefined();
      expect(state.cases?.["SYN-A"]).toBeUndefined();
    },
  );
  it("não permite encerrar com aprovação pendente ou outras tarefas abertas", async () => {
    const task = newTask();
    await upsertTask(sessionId, task);
    await upsertTask(sessionId, newTask());
    const response = await taskPATCH(
      request("tasks", {
        id: task.id,
        status: "concluida",
        execution,
        resolution: {
          type: "endereco_corrigido",
          evidence: execution.evidence,
        },
      }),
    );
    expect(response.status).toBe(409);
    expect(
      (await getSession(sessionId))!.tasks.every(
        (task) => task.status === "aberta",
      ),
    ).toBe(true);
  });
  it("não converte proposta sem aprovação em execução com encerramento", async () => {
    const task = newTask({ status: "pendente_aprovacao" });
    await upsertTask(sessionId, task);
    expect(
      (
        await taskPATCH(
          request("tasks", {
            id: task.id,
            status: "concluida",
            execution,
            resolution: {
              type: "endereco_corrigido",
              evidence: execution.evidence,
            },
          }),
        )
      ).status,
    ).toBe(409);
    expect((await getSession(sessionId))!.tasks[0].status).toBe(
      "pendente_aprovacao",
    );
  });
  it("exibe plano somente após as ferramentas e exige execução e resultado no encerramento", async () => {
    expect(await (await queueGET()).json()).toMatchObject({
      status: "not_prepared",
      orders: [],
    });
    const ctx = context("daily");
    await executeTool("consultar_diagnostico", {}, ctx);
    await executeTool(
      "comparar_estrategias",
      {
        strategy: "urgencia",
        reason:
          "Priorizar a espera das pendências e preservar a clareza do encaminhamento.",
      },
      ctx,
    );
    await executeTool(
      "registrar_plano_dia",
      {
        briefing:
          "Organizar a confirmação dos endereços com as referências disponíveis na amostra.",
        priorityAreas: ["Atendimento"],
        instructions: [
          {
            area: "Atendimento",
            firstOrderId: "SYN-A",
            justification:
              "Conferir primeiro a divergência de endereço registrada neste caso da amostra.",
            nextStep:
              "Consultar o cadastro original e encaminhar a confirmação dos dados ao responsável.",
          },
        ],
      },
      ctx,
    );
    const before = await (await queueGET()).json();
    expect(before.status).toBe("ready");
    expect(before.orders).toHaveLength(2);
    const orderCtx = context("order");
    await executeTool("consultar_pedido", { orderId: "SYN-A" }, orderCtx);
    const task = (await executeTool(
      "criar_tarefa",
      {
        orderId: "SYN-A",
        kind: "revisao_cadastral",
        title: "Confirmar endereço do pedido",
        justification:
          "Conferir a referência cadastral antes de liberar o encaminhamento.",
        evidenceIds: ["SYN-A"],
      },
      orderCtx,
    )) as Task;
    expect(
      (await taskPATCH(request("tasks", { id: task.id, status: "concluida" })))
        .status,
    ).toBe(400);
    expect(
      (
        await taskPATCH(
          request("tasks", {
            id: task.id,
            status: "concluida",
            execution: {
              note: "Endereço confirmado e atualizado na origem",
              evidence: "Registro sintético de confirmação cadastral",
            },
          }),
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await orderPATCH(
          request("orders", {
            action: "resolve",
            orderId: "SYN-A",
            note: "Tratativa cadastral concluída",
          }),
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await orderPATCH(
          request("orders", {
            action: "resolve",
            orderId: "SYN-A",
            note: "Tratativa cadastral concluída",
            outcome: {
              type: "entrega_confirmada",
              evidence: "Referência sintética incompatível",
            },
          }),
        )
      ).status,
    ).toBe(409);
    expect(
      (
        await orderPATCH(
          request("orders", {
            action: "resolve",
            orderId: "SYN-A",
            note: "Tratativa cadastral concluída",
            outcome: {
              type: "endereco_corrigido",
              evidence: "Registro sintético do endereço confirmado",
            },
          }),
        )
      ).status,
    ).toBe(200);
    const after = await (await queueGET()).json();
    expect(after.orders.map((o: { id: string }) => o.id)).toEqual(["SYN-B"]);
    expect(after.completed).toBe(1);
    expect(after.plan.comparison).toEqual(before.plan.comparison);
    const report = await (
      await operationsGET(new Request("http://localhost:3000/api/operations"))
    ).json();
    expect(report.financial.unmeasured).toBe(1);
    expect(report.financial.declaredCosts.count).toBe(0);
    const first = sessionId;
    sessionId = randomUUID();
    await createSession(sessionId);
    await saveSessionDataset(sessionId, data);
    expect((await (await queueGET()).json()).status).toBe("not_prepared");
    expect((await getSession(sessionId))!.tasks).toHaveLength(0);
    expect((await getSession(first))!.tasks).toHaveLength(1);
  });
  it("documenta investigação com referências válidas sem resolver os pedidos", async () => {
    const task: Task = {
      id: randomUUID(),
      investigationId: randomUUID(),
      orderId: "SYN-A",
      kind: "melhoria_processo",
      scope: "process",
      affectedOrderIds: ["SYN-A", "SYN-B"],
      title: "Conferir recorrência cadastral",
      justification: "Validar o fluxo de cadastro com a equipe responsável.",
      evidenceIds: ["SYN-A", "SYN-B"],
      area: "Atendimento",
      dueAt: "2026-10-02",
      status: "aberta",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      idempotencyKey: randomUUID(),
    };
    await upsertTask(sessionId, task);
    expect(
      (
        await taskPATCH(
          request("tasks", {
            id: task.id,
            status: "concluida",
            expectedUpdatedAt: task.updatedAt,
          }),
        )
      ).status,
    ).toBe(400);
    const conclusion = {
      outcome: "inconclusiva",
      observations:
        "Amostra conferida; ainda faltam registros da origem para validar o fluxo.",
      nextStep: "Solicitar histórico do cadastro para a área responsável",
      evidenceIds: ["SYN-A", "SYN-A"],
    };
    expect(
      (
        await taskPATCH(
          request("tasks", {
            id: task.id,
            status: "concluida",
            conclusion,
            expectedUpdatedAt: task.updatedAt,
          }),
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await taskPATCH(
          request("tasks", {
            id: task.id,
            status: "concluida",
            conclusion: { ...conclusion, evidenceIds: ["SYN-A", "SYN-B"] },
            expectedUpdatedAt: task.updatedAt,
          }),
        )
      ).status,
    ).toBe(200);
    expect((await getSession(sessionId))!.cases || {}).toEqual({});
  });
  it("permite documentar um legado, sem preencher evidências automaticamente", async () => {
    const task: Task = {
      id: randomUUID(),
      investigationId: randomUUID(),
      orderId: "SYN-A",
      kind: "revisao_cadastral",
      title: "Registro legado",
      justification: "Registro anterior ao novo contrato",
      evidenceIds: ["SYN-A"],
      area: "Atendimento",
      dueAt: "2026-10-01",
      status: "concluida",
      createdAt: "",
      updatedAt: "",
      idempotencyKey: randomUUID(),
    };
    await upsertTask(sessionId, task);
    expect((await getSession(sessionId))!.tasks[0].execution).toBeUndefined();
    expect(
      (
        await taskPATCH(
          request("tasks", {
            id: task.id,
            status: "concluida",
            execution: {
              note: "Execução antiga conferida pelo operador",
              evidence:
                "Referência sintética conferida para documentar o legado",
            },
          }),
        )
      ).status,
    ).toBe(200);
    expect(
      (await getSession(sessionId))!.tasks[0].execution?.evidence,
    ).toContain("Referência");
  });
});
