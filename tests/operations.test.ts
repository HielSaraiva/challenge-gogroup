import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { rm } from "node:fs/promises";
import { queue, insights } from "@/domain/analytics";
import { financialReport, workstreams } from "@/domain/operations";
import { transitionCase, sessionDataset } from "@/domain/cases";
import {
  executeTool,
  investigate,
  type AgentContext,
  type AgentCompletion,
} from "@/server/agent";
import { createSession, getSession } from "@/server/store";
import type { Dataset, Order, Task, DailyPlan } from "@/domain/types";
const baseOrder: Order = {
  id: "SYNTHETIC-CASE",
  customerId: "SYNTHETIC-CUSTOMER",
  brand: "Marca fictícia",
  orderedAt: "2026-09-01",
  value: "100.00",
  sku: "SYNTHETIC-SKU",
  product: "Produto fictício",
  quantity: 1,
  gift: false,
  exception: "atraso_entrega",
  sourceStatuses: ["aberta"],
  status: "aberta",
  carrier: "Operador fictício",
  state: "SP",
  city: "Cidade fictícia",
  promisedAt: "2026-09-08",
  deliveredAt: null,
  machine: "TEST-MACHINE-A",
  shift: "manhã",
  dc: "TEST-DC-A",
  lot: "TEST-LOT",
  openedAt: "2026-09-09",
  issues: [],
};
const data: Dataset = {
  orders: [baseOrder],
  customers: [
    {
      id: baseOrder.customerId,
      orders: 2,
      revenue: "200.00",
      firstOrder: "2025-01-01",
      contacts: 1,
    },
  ],
  carriers: [
    { name: baseOrder.carrier, state: "SP", sla: 3, freight: "12.00" },
  ],
  sourceRows: 1,
  importedAt: "2026-09-30T12:00:00Z",
};
const sessionId = randomUUID().replaceAll("-", "");
const context = (
  dataset = data,
  mode: AgentContext["mode"] = "daily",
): AgentContext => ({
  sessionId,
  runId: randomUUID(),
  data: dataset,
  allowedIds: new Set(dataset.orders.map((order) => order.id)),
  consulted: new Set(),
  simulated: new Set(),
  evidence: new Set(),
  consultedInsights: new Set(),
  mode,
});
const completed: Task = {
  id: randomUUID(),
  investigationId: randomUUID(),
  orderId: baseOrder.id,
  kind: "investigacao_logistica",
  title: "Verificar pedido fictício",
  justification: "Validar evidência de teste",
  evidenceIds: [baseOrder.id],
  area: "Logística",
  dueAt: "2026-10-01",
  status: "concluida",
  createdAt: "",
  updatedAt: "",
  idempotencyKey: "synthetic",
};
beforeAll(async () => {
  process.env.LOCAL_DEMO = "true";
  await createSession(sessionId);
});
afterAll(async () => {
  await rm(`.local/session-${sessionId}.json`, { force: true });
});
describe("capacidade e equidade operacional", () => {
  it("não repõe capacidade ao encerrar ou reabrir casos", () => {
    const resolved = {
      ...baseOrder,
      resolution: {
        note: "Concluído no teste",
        resolvedAt: "2026-10-01T12:00:00Z",
      },
      caseHistory: [
        {
          id: randomUUID(),
          action: "resolve" as const,
          note: "Teste",
          at: "2026-10-01T12:00:00Z",
        },
      ],
    };
    const many = {
      ...data,
      orders: [
        resolved,
        ...Array.from({ length: 200 }, (_, i) => ({
          ...baseOrder,
          id: `TEST-${i}`,
        })),
      ],
    };
    expect(queue(many).availableCapacity).toBe(149);
    expect(queue(many).orders).toHaveLength(149);
    expect(
      queue({
        ...many,
        orders: [
          { ...resolved, resolution: undefined },
          ...many.orders.slice(1),
        ],
      }).availableCapacity,
    ).toBe(149);
    expect(
      queue({
        ...data,
        orders: [
          {
            ...baseOrder,
            caseHistory: Array.from({ length: 150 }, () => ({
              id: randomUUID(),
              action: "resolve" as const,
              note: "Teste",
              at: "",
            })),
          },
        ],
      }).orders,
    ).toHaveLength(0);
  });
  it("reserva vagas aos antigos e não duplica a seleção", () => {
    const many = {
      ...data,
      orders: Array.from({ length: 200 }, (_, i) => ({
        ...baseOrder,
        id: `ITEM-${String(i).padStart(3, "0")}`,
        value: i < 35 ? "1.00" : "300.00",
        openedAt: i < 35 ? "2026-08-05" : "2026-09-20",
      })),
    };
    const selected = queue(many);
    expect(selected.oldestReserved).toBe(30);
    expect(
      selected.orders.filter((order) => order.value === "1.00"),
    ).toHaveLength(30);
    expect(new Set(selected.orders.map((order) => order.id)).size).toBe(150);
    expect(selected.fifo.count).toBe(selected.prioritized.count);
  });
});
describe("plano e ferramentas do agente", () => {
  it("exige consulta e cobre exatamente as áreas calculadas", async () => {
    const ctx = context();
    const args = {
      briefing:
        "Verificar pendências logísticas e organizar o atendimento por prioridade.",
      priorityAreas: ["Logística"],
      instructions: [
        {
          area: "Logística",
          nextStep:
            "Verificar os rastreios e registrar o encaminhamento de cada pendência.",
        },
      ],
    };
    await expect(executeTool("registrar_plano_dia", args, ctx)).rejects.toThrow(
      "Consulte",
    );
    await executeTool("consultar_fila", {}, ctx);
    await expect(
      executeTool(
        "registrar_plano_dia",
        { ...args, priorityAreas: ["Inventada"] },
        ctx,
      ),
    ).rejects.toThrow("área");
    const plan = (await executeTool(
      "registrar_plano_dia",
      args,
      ctx,
    )) as DailyPlan;
    expect(plan.selectedOrderIds).toEqual([baseOrder.id]);
    expect(plan.workstreams.map((stream) => stream.area)).toEqual(
      workstreams(data).map((stream) => stream.area),
    );
    const replay = (await executeTool(
      "registrar_plano_dia",
      args,
      ctx,
    )) as DailyPlan;
    expect(replay.id).toBe(plan.id);
    expect((await getSession(sessionId))!.plans).toHaveLength(1);
    await expect(
      executeTool(
        "registrar_plano_dia",
        {
          ...args,
          briefing: "Recuperamos R$ 9999 hoje e tratamos 300 pedidos.",
        },
        ctx,
      ),
    ).rejects.toThrow("qualitativa");
  });
  it("um chat sem efeito útil não conclui o plano", async () => {
    const mock: AgentCompletion = async () => ({
      choices: [
        {
          message: {
            content: "Plano preparado com sucesso, sem chamar ferramentas.",
          },
        },
      ],
    });
    const run = await investigate(
      { type: "daily", target: "day", requestId: randomUUID() },
      sessionId,
      data,
      () => {},
      mock,
    );
    expect(run.status).toBe("failed");
    expect(run.planId).toBeUndefined();
  });
  it("conclui o ciclo diário apenas após persistir um plano válido", async () => {
    let step = 0;
    const mock: AgentCompletion = async () => ({
      choices: [
        {
          message: {
            tool_calls: [
              {
                id: randomUUID(),
                type: "function",
                function:
                  step++ === 0
                    ? { name: "consultar_fila", arguments: "{}" }
                    : {
                        name: "registrar_plano_dia",
                        arguments: JSON.stringify({
                          briefing:
                            "Organizar a frente logística e validar as pendências antes do encaminhamento.",
                          priorityAreas: ["Logística"],
                          instructions: [
                            {
                              area: "Logística",
                              nextStep:
                                "Consultar rastreio e registrar evidências para cada tratativa pendente.",
                            },
                          ],
                        }),
                      },
              },
            ],
          },
        },
      ],
    });
    const run = await investigate(
      { type: "daily", target: "day", requestId: randomUUID() },
      sessionId,
      data,
      () => {},
      mock,
    );
    expect(run.status).toBe("completed");
    expect(run.planId).toBeTruthy();
    expect(run.taskIds).toHaveLength(0);
  });
});
describe("causas e ações de processo", () => {
  it("não transforma coincidência entre pagamento e transportadora em causa operacional", () => {
    const unrelated = {
      ...data,
      orders: Array.from({ length: 40 }, (_, i) => ({
        ...baseOrder,
        id: `PAYMENT-TEST-${i}`,
        exception: i < 20 ? "pagamento_pendente" : "item_faltante",
        carrier:
          i < 20 ? "Transportadora fictícia A" : "Transportadora fictícia B",
      })),
    };
    expect(
      insights(unrelated).some(
        (signal) => signal.exception === "pagamento_pendente",
      ),
    ).toBe(false);
  });
  const grouped = {
    ...data,
    orders: Array.from({ length: 60 }, (_, i) => ({
      ...baseOrder,
      id: `SYNTHETIC-${i}`,
      exception: i < 20 ? "falha_personalizacao" : "item_faltante",
      machine: i < 22 ? "TEST-MACHINE-A" : "TEST-MACHINE-B",
    })),
  };
  it("identifica associação com comparação, sem alegar taxa de falha", () => {
    const insight = insights(grouped).find(
      (signal) =>
        signal.exception === "falha_personalizacao" &&
        signal.dimension === "machine",
    )!;
    expect(insight.count).toBe(20);
    expect(insight.baselineShare).toBeCloseTo(22 / 60);
    expect(insight.enrichment).toBeGreaterThan(2);
    expect(insight.scope).toBe("process");
  });
  it("exige consulta e evidências distintas para criar ação de processo", async () => {
    const signal = insights(grouped).find(
      (signal) =>
        signal.exception === "falha_personalizacao" &&
        signal.dimension === "machine",
    )!;
    const ctx = context(grouped, "pattern");
    ctx.patternId = signal.id;
    const args = {
      insightId: signal.id,
      title: "Auditar o fluxo de personalização",
      justification:
        "Validar se há falha recorrente de configuração ou revisão de arte na máquina.",
      nextStep:
        "Comparar registros de manutenção e produção com os demais equipamentos antes de alterar o processo.",
      evidenceIds: signal.evidenceIds.slice(0, 2),
    };
    await expect(executeTool("criar_acao_processo", args, ctx)).rejects.toThrow(
      "Consulte",
    );
    await executeTool("consultar_padroes", { insightId: signal.id }, ctx);
    await expect(
      executeTool(
        "criar_acao_processo",
        { ...args, evidenceIds: [args.evidenceIds[0], args.evidenceIds[0]] },
        ctx,
      ),
    ).rejects.toThrow("distintos");
    const task = (await executeTool("criar_acao_processo", args, ctx)) as Task;
    expect(task.scope).toBe("process");
    expect(task.affectedOrderIds).toHaveLength(20);
    await expect(
      executeTool("consultar_padroes", { insightId: "outro" }, ctx),
    ).rejects.toThrow("escopo");
    expect(() =>
      transitionCase(
        { ...baseOrder, id: task.orderId },
        undefined,
        [{ ...task, status: "concluida" }],
        {
          action: "resolve",
          orderId: task.orderId,
          note: "Tentativa de fechamento indevido",
        },
        randomUUID(),
        new Date().toISOString(),
      ),
    ).toThrow("Conclua");
  });
});
describe("dinheiro declarado e comprovado", () => {
  it("não transforma encerramento ou aprovação em receita recuperada", () => {
    const record = transitionCase(
      baseOrder,
      undefined,
      [completed],
      {
        action: "resolve",
        orderId: baseOrder.id,
        note: "Concluído sem evidência financeira",
      },
      randomUUID(),
      new Date().toISOString(),
    );
    const state = {
      tasks: [completed],
      investigations: [],
      expiresAt: "",
      cases: { [baseOrder.id]: record },
    };
    const report = financialReport(sessionDataset(data, state), state);
    expect(report.verifiedRecovery).toBe("0.00");
    expect(report.declaredRetained).toBe("0.00");
    expect(report.closedExposure).toBe(report.baselineExposure);
  });
  it("registra evidência e desconta custos sem atribuir causalidade", () => {
    const record = transitionCase(
      baseOrder,
      undefined,
      [completed],
      {
        action: "resolve",
        orderId: baseOrder.id,
        note: "Resultado declarado pelo operador",
        financial: {
          retained: "80.00",
          refunded: "0",
          cost: "12.50",
          evidence: "Comprovante fictício de resolução do teste",
        },
      },
      randomUUID(),
      new Date().toISOString(),
    );
    const state = {
      tasks: [completed],
      investigations: [],
      expiresAt: "",
      cases: { [baseOrder.id]: record },
    };
    const report = financialReport(sessionDataset(data, state), state);
    expect(report.declaredBalance).toBe("67.50");
    expect(report.verifiedRecovery).toBe("0.00");
    expect(record.history[0].financial?.source).toBe("operator_demo");
    expect(() =>
      transitionCase(
        baseOrder,
        undefined,
        [completed],
        {
          action: "resolve",
          orderId: baseOrder.id,
          note: "Registro inválido de valores",
          financial: {
            retained: "200.00",
            refunded: "0",
            cost: "0",
            evidence: "Evidência fictícia para validação",
          },
        },
        randomUUID(),
        new Date().toISOString(),
      ),
    ).toThrow("exceder");
    expect(() =>
      transitionCase(
        baseOrder,
        undefined,
        [completed],
        {
          action: "resolve",
          orderId: baseOrder.id,
          note: "Registro inválido de valores",
          financial: {
            retained: "40.00",
            refunded: "60.00",
            cost: "0",
            evidence: "Evidência fictícia para validação",
          },
        },
        randomUUID(),
        new Date().toISOString(),
      ),
    ).toThrow("dois");
  });
});
