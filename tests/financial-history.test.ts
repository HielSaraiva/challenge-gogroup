import { describe, expect, it } from "vitest";
import { financialReport } from "@/domain/operations";
import { closureRecords } from "@/domain/financial-records";
import { sessionDataset, transitionCase } from "@/domain/cases";
import type { CaseRecord, Dataset, Order, Task } from "@/domain/types";

const order: Order = {
  id: "FIN-TEST",
  customerId: "CUSTOMER",
  brand: "Marca sintética",
  orderedAt: "2026-09-01",
  value: "100.00",
  sku: "SKU",
  product: "Produto sintético",
  quantity: 1,
  gift: false,
  exception: "atraso_entrega",
  sourceStatuses: ["aberta"],
  status: "aberta",
  carrier: "Transportadora sintética",
  state: "SP",
  city: "Cidade",
  promisedAt: "2026-09-08",
  deliveredAt: null,
  machine: "",
  shift: "manhã",
  dc: "CD",
  lot: "Lote",
  openedAt: "2026-09-09",
  issues: [],
};
const dataset: Dataset = {
  orders: [order],
  customers: [],
  carriers: [],
  importedAt: "2026-09-30",
  sourceRows: 1,
};
function task(at: string): Task {
  return {
    id: at,
    investigationId: at,
    orderId: order.id,
    kind: "investigacao_logistica",
    title: "Conferir o caso",
    justification: "Conferir as evidências do atendimento",
    evidenceIds: [order.id],
    area: "Logística",
    dueAt: "2026-10-01",
    status: "concluida",
    createdAt: at,
    updatedAt: at,
    idempotencyKey: at,
    execution: {
      note: "Tratativa realizada e documentada no sistema",
      evidence: "Protocolo sintético do atendimento conferido",
      at,
    },
  };
}
function close(
  previous: CaseRecord | undefined,
  at: string,
  refund?: string,
  cost?: { amount: string; kind: "declared" | "estimated" },
) {
  return transitionCase(
    order,
    previous,
    [task(at)],
    {
      action: "resolve",
      orderId: order.id,
      note: "Resultado sintético comprovado na origem",
      outcome: {
        type: refund ? "reembolso_registrado" : "entrega_confirmada",
        evidence: "Comprovante sintético da solução do pedido",
        ...(refund ? { refund } : {}),
        ...(cost ? { cost } : {}),
      },
    },
    `close:${at}`,
    at,
  );
}
function reopen(previous: CaseRecord, at: string) {
  return transitionCase(
    order,
    previous,
    [],
    {
      action: "reopen",
      orderId: order.id,
      note: "Pendência voltou a ocorrer e exige outra tratativa",
    },
    `reopen:${at}`,
    at,
  );
}
function report(record: CaseRecord) {
  const state = {
    tasks: [],
    investigations: [],
    expiresAt: "",
    cases: { [order.id]: record },
  };
  return financialReport(sessionDataset(dataset, state), state);
}
describe("situação do pedido e histórico financeiro", () => {
  it("mantém custo e reembolso nos totais após reabrir e não duplica o encerramento atual", () => {
    const first = close(undefined, "2026-10-01T10:00:00Z", "40.00", {
      amount: "15.00",
      kind: "declared",
    });
    expect(report(first)).toMatchObject({
      resolvedCount: 1,
      openByException: [],
      refunds: { count: 1, total: "40.00" },
      declaredCosts: { count: 1, total: "15.00" },
    });
    const reopened = reopen(first, "2026-10-02T10:00:00Z");
    expect(report(reopened)).toMatchObject({
      resolvedCount: 0,
      openByException: [{ type: "atraso_entrega", count: 1 }],
      reopenedCount: 1,
      pendingCount: 1,
      treatedValue: "0.00",
      refunds: { count: 1, total: "40.00" },
      declaredCosts: { count: 1, total: "15.00" },
    });
    expect(report(reopened).financialRecords[0]).toMatchObject({
      orderOpen: true,
      current: false,
    });
    const second = close(reopened, "2026-10-03T10:00:00Z", "20.00", {
      amount: "5.00",
      kind: "declared",
    });
    expect(report(second)).toMatchObject({
      resolvedCount: 1,
      treatedValue: "100.00",
      refunds: { count: 2, total: "60.00" },
      declaredCosts: { count: 2, total: "20.00" },
    });
    expect(report(second).financialRecords).toHaveLength(2);
    expect(
      report(second).financialRecords.map((record) => record.current),
    ).toEqual([true, false]);
  });
  it("reencerrar sem novos valores não cobra de novo a etapa anterior", () => {
    const reopened = reopen(
      close(undefined, "2026-10-01T10:00:00Z", undefined, {
        amount: "15.00",
        kind: "declared",
      }),
      "2026-10-02T10:00:00Z",
    );
    const second = close(reopened, "2026-10-03T10:00:00Z");
    expect(report(second).declaredCosts).toEqual({ count: 1, total: "15.00" });
    expect(report(second).unmeasured).toBe(1);
  });
  it("limita o novo reembolso ao saldo após as etapas anteriores", () => {
    const reopened = reopen(
      close(undefined, "2026-10-01T10:00:00Z", "60.00"),
      "2026-10-02T10:00:00Z",
    );
    expect(() => close(reopened, "2026-10-03T10:00:00Z", "41.00")).toThrow(
      "incluindo etapas anteriores",
    );
    expect(
      report(close(reopened, "2026-10-03T10:00:00Z", "40.00")).refunds.total,
    ).toBe("100.00");
  });
  it("mantém estimativa, custo zero e custo desconhecido distintos", () => {
    const estimated = close(undefined, "2026-10-01T10:00:00Z", undefined, {
      amount: "15.00",
      kind: "estimated",
    });
    expect(report(estimated).declaredCosts.count).toBe(0);
    expect(report(estimated).estimatedCosts.total).toBe("15.00");
    const reopened = reopen(estimated, "2026-10-02T10:00:00Z");
    expect(report(reopened).estimatedCosts.count).toBe(0);
    expect(
      report(
        close(reopened, "2026-10-03T10:00:00Z", undefined, {
          amount: "0.00",
          kind: "declared",
        }),
      ).declaredCosts,
    ).toEqual({ count: 1, total: "0.00" });
  });
  it("preserva registros sem histórico e não soma eventos repetidos nem a projeção atual", () => {
    const first = close(undefined, "2026-10-01T10:00:00Z", undefined, {
      amount: "15.00",
      kind: "declared",
    });
    const state = {
      tasks: [],
      investigations: [],
      expiresAt: "",
      cases: { [order.id]: first },
    };
    const effective = sessionDataset(dataset, state).orders[0];
    const before = JSON.stringify(effective);
    expect(
      closureRecords({
        ...effective,
        caseHistory: [...first.history, ...first.history],
      }),
    ).toHaveLength(1);
    expect(closureRecords({ ...effective, caseHistory: [] })).toHaveLength(1);
    expect(JSON.stringify(effective)).toBe(before);
  });
});
