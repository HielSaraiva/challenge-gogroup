import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { rm } from "node:fs/promises";
import {
  caseActionSchema,
  sessionDataset,
  transitionCase,
} from "@/domain/cases";
import { dashboard, queue } from "@/domain/analytics";
import {
  acquireAgentLease,
  createSession,
  getSession,
  saveCase,
} from "@/server/store";
import type { Dataset, Order, Task } from "@/domain/types";

const order: Order = {
  id: "DEMO-CASE",
  customerId: "DEMO-CUSTOMER",
  brand: "Marca fictícia",
  orderedAt: "2026-09-01",
  value: "120.00",
  sku: "DEMO-SKU",
  product: "Produto de teste",
  quantity: 1,
  gift: false,
  exception: "atraso_entrega",
  sourceStatuses: ["aberta", "em_analise"],
  status: "status_divergente",
  carrier: "Operador fictício",
  state: "SP",
  city: "Cidade fictícia",
  promisedAt: "2026-09-10",
  deliveredAt: null,
  machine: "",
  shift: "manhã",
  dc: "DC-DEMO",
  lot: "LOT-DEMO",
  openedAt: "2026-09-11",
  issues: [{ code: "STATUS_CONFLICT", detail: "Conflito para teste" }],
};
const data: Dataset = {
  orders: [order],
  customers: [
    {
      id: order.customerId,
      orders: 1,
      revenue: "120.00",
      firstOrder: order.orderedAt,
      contacts: 0,
    },
  ],
  carriers: [{ name: order.carrier, state: "SP", freight: "15.00", sla: 3 }],
  importedAt: "",
  sourceRows: 2,
};
const task: Task = {
  id: randomUUID(),
  investigationId: randomUUID(),
  orderId: order.id,
  kind: "investigacao_logistica",
  title: "Verificar conflito de status",
  justification: "Confirmar o estado do pedido fictício",
  evidenceIds: [order.id],
  area: "Operações",
  dueAt: "2026-10-01",
  status: "concluida",
  execution: {
    note: "Execução documentada no teste",
    evidence: "Comprovante sintético conferido",
  },
  createdAt: "",
  updatedAt: "",
  idempotencyKey: "demo",
};
const now = "2026-10-01T12:00:00Z";
const reviewInput = {
  action: "review_status" as const,
  orderId: order.id,
  status: "em_analise",
  note: "Status verificado por um operador da demonstração.",
};
const resolveInput = {
  action: "resolve" as const,
  outcome: {
    type: "entrega_confirmada" as const,
    evidence: "Comprovante sintético da entrega",
  },
  orderId: order.id,
  note: "Tratativa encerrada com a evidência de teste.",
};
const review = () =>
  transitionCase(order, undefined, [], reviewInput, randomUUID(), now);

describe("ciclo de tratativa", () => {
  it("exige justificativa e valida o contrato", () =>
    expect(
      caseActionSchema.safeParse({ ...reviewInput, note: "curto" }).success,
    ).toBe(false));
  it("preserva a origem e aplica a revisão somente na sessão", () => {
    const reviewed = review();
    const effective = sessionDataset(data, {
      tasks: [],
      investigations: [],
      expiresAt: "",
      cases: { [order.id]: reviewed },
    });
    expect(effective.orders[0].status).toBe("em_analise");
    expect(effective.orders[0].sourceStatuses).toEqual(order.sourceStatuses);
    expect(data.orders[0].status).toBe("status_divergente");
    expect(effective.orders[0].caseHistory).toHaveLength(1);
  });
  it("impede status inventado e resolução de conflito pendente", () => {
    expect(() =>
      transitionCase(
        order,
        undefined,
        [],
        { ...reviewInput, status: "inventado" },
        randomUUID(),
        now,
      ),
    ).toThrow("origem");
    expect(() =>
      transitionCase(order, undefined, [task], resolveInput, randomUUID(), now),
    ).toThrow("conflito");
  });
  it("exige conclusão e bloqueia tarefas pendentes", () => {
    expect(() =>
      transitionCase(order, review(), [], resolveInput, randomUUID(), now),
    ).toThrow("Conclua");
    expect(() =>
      transitionCase(
        order,
        review(),
        [task, { ...task, id: randomUUID(), status: "aberta" }],
        resolveInput,
        randomUUID(),
        now,
      ),
    ).toThrow("pendentes");
  });
  it("aprovação não substitui execução, inclusive quando há outra tarefa concluída", () => {
    const approved = {
      ...task,
      id: randomUUID(),
      kind: "proposta_reenvio" as const,
      status: "aprovada" as const,
    };
    expect(() =>
      transitionCase(
        order,
        review(),
        [approved],
        resolveInput,
        randomUUID(),
        now,
      ),
    ).toThrow("Conclua");
    expect(() =>
      transitionCase(
        order,
        review(),
        [task, approved],
        resolveInput,
        randomUUID(),
        now,
      ),
    ).toThrow("pendentes");
    expect(
      transitionCase(
        order,
        review(),
        [{ ...approved, status: "concluida" }],
        resolveInput,
        randomUUID(),
        now,
      ).resolution,
    ).toBeDefined();
  });
  it("exige uma execução nova após reabrir a exceção", () => {
    const originalTask = {
      ...task,
      execution: {
        note: "Execução inicial do teste",
        evidence: "Referência sintética conferida",
        at: now,
      },
    };
    const resolved = transitionCase(
      order,
      review(),
      [originalTask],
      resolveInput,
      randomUUID(),
      now,
    );
    const reopened = transitionCase(
      order,
      resolved,
      [originalTask],
      {
        action: "reopen",
        orderId: order.id,
        note: "Nova pendência identificada na origem",
      },
      randomUUID(),
      "2026-10-02T12:00:00Z",
    );
    expect(() =>
      transitionCase(
        order,
        reopened,
        [originalTask],
        resolveInput,
        randomUUID(),
        "2026-10-03T12:00:00Z",
      ),
    ).toThrow("Conclua");
    expect(
      transitionCase(
        order,
        reopened,
        [
          {
            ...originalTask,
            id: randomUUID(),
            createdAt: "2026-10-03T10:00:00Z",
            execution: {
              ...originalTask.execution,
              at: "2026-10-03T11:00:00Z",
            },
          },
        ],
        resolveInput,
        randomUUID(),
        "2026-10-03T12:00:00Z",
      ).resolution,
    ).toBeDefined();
  });
  it("remove o caso encerrado da fila sem alegar recuperação financeira", () => {
    const record = transitionCase(
      order,
      review(),
      [task],
      resolveInput,
      randomUUID(),
      now,
    );
    const effective = sessionDataset(data, {
      tasks: [task],
      investigations: [],
      expiresAt: "",
      cases: { [order.id]: record },
    });
    expect(queue(effective).orders).toHaveLength(0);
    expect(dashboard(effective).resolvedCount).toBe(1);
    expect(dashboard(effective).value).toBe("0.00");
    expect(data.orders).toHaveLength(1);
    const reopened = transitionCase(
      order,
      record,
      [task],
      {
        action: "reopen",
        orderId: order.id,
        note: "Pendência identificada para nova análise.",
      },
      randomUUID(),
      now,
    );
    expect(reopened.resolution).toBeUndefined();
    expect(reopened.history).toHaveLength(3);
    expect(
      queue(
        sessionDataset(data, {
          tasks: [],
          investigations: [],
          expiresAt: "",
          cases: { [order.id]: reopened },
        }),
      ).orders,
    ).toHaveLength(1);
  });
});

describe("persistência da decisão e concorrência", () => {
  const sessionId = randomUUID().replaceAll("-", "");
  beforeAll(async () => {
    process.env.LOCAL_DEMO = "true";
    await createSession(sessionId);
  });
  afterAll(async () => {
    await rm(`.local/session-${sessionId}.json`, { force: true });
  });
  it("persiste versão e recusa sobrescrita de decisão", async () => {
    const record = review();
    await saveCase(sessionId, record);
    expect(
      (await getSession(sessionId))!.cases![order.id].statusReview?.status,
    ).toBe("em_analise");
    await expect(saveCase(sessionId, record)).rejects.toThrow("alterado");
  });
  it("libera a sessão ao concluir, sem exigir espera de um minuto", async () => {
    const release = await acquireAgentLease(sessionId);
    await expect(acquireAgentLease(sessionId)).rejects.toThrow("andamento");
    await release();
    const releaseAgain = await acquireAgentLease(sessionId);
    await releaseAgain();
  });
});

describe("vínculo da execução no encerramento", () => {
  const clean = { ...order, status: "aberta", sourceStatuses: ["aberta"] };
  const refundTask = { ...task, kind: "proposta_reembolso" as const };
  const action = {
    action: "resolve" as const,
    orderId: clean.id,
    note: "Registro sintético do resultado",
    outcome: {
      type: "entrega_confirmada" as const,
      evidence: "Evidência sintética do resultado",
      executionTaskId: task.id,
    },
  };
  it("recusa resultado de entrega para execução de reembolso no encerramento separado", () => {
    expect(() =>
      transitionCase(clean, undefined, [refundTask], action, randomUUID(), now),
    ).toThrow("reembolso");
  });
  it("recusa vínculo de outra tarefa e persiste o vínculo mesmo sem reutilizar evidência", () => {
    expect(() =>
      transitionCase(
        clean,
        undefined,
        [task],
        {
          ...action,
          outcome: { ...action.outcome, executionTaskId: "outro-pedido" },
        },
        randomUUID(),
        now,
      ),
    ).toThrow("execução válida");
    const record = transitionCase(
      clean,
      undefined,
      [task],
      action,
      randomUUID(),
      now,
    );
    expect(record.resolution?.outcome?.executionTaskId).toBe(task.id);
    expect(record.resolution?.outcome?.evidenceTaskId).toBeUndefined();
  });
});
