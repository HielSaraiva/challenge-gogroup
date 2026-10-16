import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { rm } from "node:fs/promises";
import { queue, insights } from "@/domain/analytics";
import { financialReport, workstreams } from "@/domain/operations";
import { planQueue } from "@/domain/planning";
import { completedTask } from "@/domain/task-results";
import {
  caseActionSchema,
  transitionCase,
  sessionDataset,
} from "@/domain/cases";
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
  execution: {
    note: "Execução documentada no teste",
    evidence: "Comprovante sintético conferido",
  },
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
  it("permite escolher outro pedido consultado sem alterar a seleção pelas regras", async () => {
    const dataset = {
      ...data,
      orders: [
        { ...baseOrder, id: "SYNTHETIC-FIRST", value: "900.00" },
        { ...baseOrder, id: "SYNTHETIC-SECOND", value: "10.00" },
      ],
    };
    const before = queue(dataset).orders.map((order) => order.id);
    const ctx = context(dataset);
    await executeTool("consultar_diagnostico", {}, ctx);
    await executeTool(
      "comparar_estrategias",
      {
        strategy: "equilibrada",
        reason:
          "Equilibrar o atendimento das pendências com o histórico dos clientes.",
      },
      ctx,
    );
    const plan = (await executeTool(
      "registrar_plano_dia",
      {
        briefing:
          "Validar as pendências e organizar o encaminhamento com evidências da amostra.",
        priorityAreas: ["Logística"],
        instructions: [
          {
            area: "Logística",
            firstOrderId: "SYNTHETIC-SECOND",
            justification:
              "Começar pela verificação do rastreio deste caso antes de definir a tratativa.",
            nextStep:
              "Consultar a ocorrência e registrar a evidência necessária ao encaminhamento.",
          },
        ],
      },
      ctx,
    )) as DailyPlan;
    expect(plan.workstreams[0].agentDecision!.firstOrderId).toBe(
      "SYNTHETIC-SECOND",
    );
    expect(plan.selectedOrderIds).toEqual(before);
    expect(queue(dataset).orders.map((order) => order.id)).toEqual(before);
    const bad = {
      ...ctx,
      evidence: new Set<string>(),
    };
    await expect(
      executeTool(
        "registrar_plano_dia",
        {
          briefing:
            "Validar pendências logísticas e organizar o encaminhamento da seleção.",
          priorityAreas: ["Logística"],
          instructions: [
            {
              area: "Logística",
              firstOrderId: "SYNTHETIC-SECOND",
              justification:
                "Verificar este caso por evidência documentada no pedido.",
              nextStep:
                "Conferir rastreio antes de definir o encaminhamento do pedido.",
            },
          ],
        },
        bad,
      ),
    ).rejects.toThrow("amostra consultada");
  });
  it("respeita a estratégia escolhida pelo usuário", async () => {
    const ctx = context();
    ctx.requestedStrategy = "urgencia";
    await executeTool("consultar_diagnostico", {}, ctx);
    await expect(
      executeTool(
        "comparar_estrategias",
        {
          strategy: "equilibrada",
          reason:
            "Equilibrar o atendimento das pendências com o histórico dos clientes.",
        },
        ctx,
      ),
    ).rejects.toThrow("O usuário escolheu a estratégia urgencia");
    expect(ctx.compared).not.toBe(true);
    await executeTool(
      "comparar_estrategias",
      {
        strategy: "urgencia",
        reason:
          "Priorizar a espera prolongada conforme o foco escolhido pela equipe.",
      },
      ctx,
    );
    expect(ctx.strategy).toBe("urgencia");
    expect(ctx.weights).toEqual(STRATEGIES.urgencia.weights);
  });
  it("exige consulta e cobre exatamente as áreas calculadas", async () => {
    const ctx = context();
    const args = {
      briefing:
        "Verificar pendências logísticas e organizar o atendimento por prioridade.",
      priorityAreas: ["Logística"],
      instructions: [
        {
          area: "Logística",
          firstOrderId: baseOrder.id,
          justification:
            "Começar pelo caso com pendência logística documentada na amostra.",
          nextStep:
            "Verificar os rastreios e registrar o encaminhamento de cada pendência.",
        },
      ],
    };
    await expect(executeTool("registrar_plano_dia", args, ctx)).rejects.toThrow(
      "Consulte",
    );
    await executeTool("consultar_diagnostico", {}, ctx);
    await executeTool(
      "comparar_estrategias",
      {
        strategy: "equilibrada",
        reason:
          "Equilibrar o atendimento das pendências com o histórico dos clientes.",
      },
      ctx,
    );
    await expect(
      executeTool(
        "registrar_plano_dia",
        { ...args, priorityAreas: ["Inventada"] },
        ctx,
      ),
    ).rejects.toThrow("Área não permitida nos destaques: Inventada.");
    await expect(
      executeTool(
        "registrar_plano_dia",
        {
          ...args,
          instructions: [
            { ...args.instructions[0], firstOrderId: "PEDIDO-INVENTADO" },
          ],
        },
        ctx,
      ),
    ).rejects.toThrow("amostra consultada");
    const plan = (await executeTool(
      "registrar_plano_dia",
      args,
      ctx,
    )) as DailyPlan;
    expect(plan.selectedOrderIds).toEqual([baseOrder.id]);
    expect(plan.workstreams[0].agentDecision).toEqual({
      firstOrderId: baseOrder.id,
      justification: args.instructions[0].justification,
    });
    expect(plan.selectedOrderIds).toEqual(
      queue(data).orders.map((order) => order.id),
    );
    expect(plan.workstreams.map((stream) => stream.area)).toEqual(
      workstreams(data).map((stream) => stream.area),
    );
    const replay = (await executeTool(
      "registrar_plano_dia",
      args,
      ctx,
    )) as DailyPlan;
    expect(replay.id).toBe(plan.id);
    expect(
      (await getSession(sessionId))!.plans!.filter(
        (saved) => saved.idempotencyKey === plan.idempotencyKey,
      ),
    ).toHaveLength(1);
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
                    ? { name: "consultar_diagnostico", arguments: "{}" }
                    : step === 2
                      ? {
                          name: "comparar_estrategias",
                          arguments: JSON.stringify({
                            strategy: "equilibrada",
                            reason:
                              "Equilibrar urgência e relacionamento conforme as alternativas consultadas.",
                          }),
                        }
                      : {
                          name: "registrar_plano_dia",
                          arguments: JSON.stringify({
                            briefing:
                              "Organizar a frente logística e validar as pendências antes do encaminhamento.",
                            priorityAreas: ["Logística"],
                            instructions: [
                              {
                                area: "Logística",
                                firstOrderId: baseOrder.id,
                                justification:
                                  "Verificar este caso logístico com evidência de atraso na amostra.",
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
          outcome: {
            type: "entrega_confirmada",
            evidence: "Comprovante sintético de entrega",
          },
          orderId: task.orderId,
          note: "Tentativa de fechamento indevido",
        },
        randomUUID(),
        new Date().toISOString(),
      ),
    ).toThrow("Conclua");
  });
});
describe("resultados operacionais e financeiros", () => {
  it("mantém custo desconhecido separado de zero e não inventa recuperação", () => {
    const record = transitionCase(
      baseOrder,
      undefined,
      [completed],
      {
        action: "resolve",
        orderId: baseOrder.id,
        note: "Entrega confirmada com evidência",
        outcome: {
          type: "entrega_confirmada",
          evidence: "Comprovante sintético de entrega",
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
    expect(report.resolvedCount).toBe(1);
    expect(report.unmeasured).toBe(1);
    expect(report.declaredCosts.count).toBe(0);
    expect(record.resolution?.outcome?.cost).toBeUndefined();
    expect(report.treatedValue).toBe(baseOrder.value);
  });
  it("exige reembolso positivo dentro do valor do pedido", () => {
    const close = (refund: string) =>
      transitionCase(
        baseOrder,
        undefined,
        [completed],
        {
          action: "resolve",
          orderId: baseOrder.id,
          note: "Reembolso registrado na origem",
          outcome: {
            type: "reembolso_registrado",
            evidence: "Comprovante sintético de reembolso",
            refund,
          },
        },
        randomUUID(),
        new Date().toISOString(),
      );
    expect(() => close("200.00")).toThrow("exceder");
    expect(() => close("0")).toThrow("positivo");
    expect(close("80.00").resolution?.outcome?.refund).toBe("80.00");
  });
});

describe("contratos do plano orientado pelo agente", () => {
  it("não apresenta seleção antes da execução e distingue estados", () => {
    const state = { tasks: [], investigations: [], expiresAt: "" };
    expect(planQueue(data, state)).toMatchObject({
      status: "not_prepared",
      orders: [],
      plan: null,
    });
    const run = {
      id: randomUUID(),
      type: "daily" as const,
      target: "day",
      status: "running" as const,
      summary: "",
      events: [],
      taskIds: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    expect(planQueue(data, { ...state, investigations: [run] }).status).toBe(
      "preparing",
    );
    expect(
      planQueue(data, {
        ...state,
        investigations: [
          { ...run, status: "failed", summary: "Limite de uso do provedor" },
        ],
      }).status,
    ).toBe("failed");
  });
  it("exige diagnóstico e comparação reais antes do registro", async () => {
    const ctx = context();
    await expect(
      executeTool(
        "comparar_estrategias",
        {
          strategy: "urgencia",
          reason:
            "Conferir pendências antigas antes de organizar encaminhamentos.",
        },
        ctx,
      ),
    ).rejects.toThrow("diagnóstico");
    await executeTool("consultar_fila", {}, ctx);
    await expect(executeTool("registrar_plano_dia", {}, ctx)).rejects.toThrow(
      "Consulte",
    );
    await executeTool("consultar_diagnostico", {}, ctx);
    await expect(
      executeTool(
        "comparar_estrategias",
        {
          strategy: "inventada",
          reason:
            "Conferir pendências antigas antes de organizar encaminhamentos.",
        },
        ctx,
      ),
    ).rejects.toThrow();
  });
  it("estratégias diferentes mudam a seleção sem violar reserva ou capacidade", async () => {
    const varied = {
      ...data,
      orders: Array.from({ length: 220 }, (_, i) => ({
        ...baseOrder,
        id: `VAR-${i}`,
        value: String(10 + i * 3),
        openedAt: i < 70 ? "2026-08-03" : i < 150 ? "2026-09-15" : "2026-09-25",
        promisedAt: i < 70 ? "2026-08-06" : "2026-09-28",
      })),
    };
    const ctx = context(varied);
    await executeTool("consultar_diagnostico", {}, ctx);
    const balanced = await executeTool(
      "comparar_estrategias",
      {
        strategy: "equilibrada",
        reason: "Equilibrar o valor dos pedidos com a espera dos clientes.",
      },
      ctx,
    );
    const a = queue(varied, ctx.weights).orders.map((o) => o.id);
    await executeTool(
      "comparar_estrategias",
      {
        strategy: "urgencia",
        reason:
          "A espera prolongada exige maior foco nas pendências mais antigas.",
      },
      ctx,
    );
    const b = queue(varied, ctx.weights);
    expect(b.orders).toHaveLength(150);
    expect(b.oldestReserved).toBe(30);
    expect(b.orders.map((o) => o.id)).not.toEqual(a);
    expect(balanced).toBeTruthy();
  });
  it("persiste fotografia e não repõe pedidos após um encerramento", async () => {
    const dataset = {
      ...data,
      orders: Array.from({ length: 180 }, (_, i) => ({
        ...baseOrder,
        id: `SNAP-${i}`,
      })),
    };
    const ctx = context(dataset);
    await executeTool("consultar_diagnostico", {}, ctx);
    await executeTool(
      "comparar_estrategias",
      {
        strategy: "urgencia",
        reason:
          "Priorizar a espera documentada e preservar o atendimento dos casos antigos.",
      },
      ctx,
    );
    const plan = (await executeTool(
      "registrar_plano_dia",
      {
        briefing:
          "Conferir as evidências e organizar o encaminhamento das pendências logísticas.",
        priorityAreas: ["Logística"],
        instructions: [
          {
            area: "Logística",
            firstOrderId: workstreams(dataset, ctx.weights)[0].sample[0].id,
            justification:
              "Começar pela pendência logística consultada na amostra do grupo.",
            nextStep:
              "Conferir o rastreio e registrar a evidência para orientar a próxima tratativa.",
          },
        ],
      },
      ctx,
    )) as DailyPlan;
    const first = plan.selectedOrderIds[0];
    const state = {
      tasks: [],
      investigations: [],
      expiresAt: "",
      plans: [plan],
      cases: {
        [first]: {
          orderId: first,
          version: 1,
          resolution: {
            note: "Encerramento de teste",
            resolvedAt: new Date().toISOString(),
          },
          history: [],
        },
      },
    };
    const q = planQueue(dataset, state);
    expect(q.status).toBe("ready");
    expect(q.orders).toHaveLength(149);
    expect(q.completed).toBe(1);
    expect(q.orders.every((o) => plan.selectedOrderIds.includes(o.id))).toBe(
      true,
    );
    expect(q.plan!.comparison).toEqual(plan.comparison);
    expect(
      planQueue({ ...dataset, importedAt: "outra extração" }, state).status,
    ).toBe("needs_review");
    expect(
      planQueue(dataset, {
        ...state,
        plans: [{ ...plan, policyVersion: undefined }],
      }).status,
    ).toBe("needs_review");
  });
  it("falha 429 não cria plano nem sucesso simulado", async () => {
    const run = await investigate(
      { type: "daily", target: "day", requestId: randomUUID() },
      sessionId,
      data,
      () => {},
      async () => {
        throw Object.assign(new Error("provider quota"), { status: 429 });
      },
    );
    expect(run.status).toBe("failed");
    expect(run.planId).toBeUndefined();
    expect(run.summary).toContain("limite");
  });
});

describe("conclusões com evidência e compatibilidade", () => {
  it("exige resultado e não permite usar apenas revisão de status", () => {
    const action = {
      action: "resolve" as const,
      orderId: baseOrder.id,
      note: "Resultado documentado pelo operador",
      outcome: {
        type: "entrega_confirmada" as const,
        evidence: "Comprovante sintético da entrega",
      },
    };
    expect(() =>
      transitionCase(
        baseOrder,
        undefined,
        [{ ...completed, kind: "revisao_status" }],
        action,
        randomUUID(),
        new Date().toISOString(),
      ),
    ).toThrow("Conclua");
    expect(() =>
      transitionCase(
        baseOrder,
        undefined,
        [{ ...completed, execution: undefined }],
        action,
        randomUUID(),
        new Date().toISOString(),
      ),
    ).toThrow("Conclua");
    expect(
      caseActionSchema.safeParse({
        action: "resolve",
        orderId: baseOrder.id,
        note: action.note,
      }).success,
    ).toBe(false);
    expect(() =>
      transitionCase(
        { ...baseOrder, exception: "endereco_divergente" },
        undefined,
        [completed],
        action,
        randomUUID(),
        new Date().toISOString(),
      ),
    ).toThrow("incompatível");
  });
  it("permite corrigir endereço sem inventar valor financeiro", () => {
    const record = transitionCase(
      { ...baseOrder, exception: "endereco_divergente" },
      undefined,
      [completed],
      {
        action: "resolve",
        orderId: baseOrder.id,
        note: "Endereço confirmado na origem",
        outcome: {
          type: "endereco_corrigido",
          evidence: "Referência sintética do endereço confirmado",
        },
      },
      randomUUID(),
      new Date().toISOString(),
    );
    expect(record.resolution?.outcome?.cost).toBeUndefined();
    expect(record.resolution?.outcome?.refund).toBeUndefined();
  });
  it("conclusão de processo exige documentação e pedidos distintos válidos", () => {
    const task = {
      ...completed,
      scope: "process" as const,
      affectedOrderIds: ["P1", "P2"],
    };
    expect(() => completedTask(task)).toThrow();
    const conclusion = {
      outcome: "inconclusiva" as const,
      observations: "Comparação registrada no teste sintético",
      evidenceIds: ["P1", "P1"],
      nextStep: "Solicitar evidências complementares à área responsável",
    };
    expect(() => completedTask(task, undefined, conclusion)).toThrow(
      "distintos",
    );
    expect(() =>
      completedTask(task, undefined, {
        ...conclusion,
        evidenceIds: ["P1", "OUTRO"],
      }),
    ).toThrow("relacionados");
    expect(
      completedTask(task, undefined, {
        ...conclusion,
        evidenceIds: ["P1", "P2"],
      }).conclusion?.outcome,
    ).toBe("inconclusiva");
    expect(task.status).toBe("concluida");
    expect(baseOrder.resolution).toBeUndefined();
  });
  it("mantém legados sem inventar evidências ou custos", () => {
    const legacy = {
      ...baseOrder,
      resolution: { note: "Registro antigo", resolvedAt: "2026-09-30" },
    };
    const report = financialReport(
      { ...data, orders: [legacy] },
      { tasks: [], investigations: [], expiresAt: "" },
    );
    expect(report.legacy).toBe(1);
    expect(report.unmeasured).toBe(1);
    expect(report.declaredCosts.count).toBe(0);
  });
});
import { STRATEGIES } from "../src/domain/types";
