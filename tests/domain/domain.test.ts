import { describe, expect, it } from "vitest";
import Decimal from "decimal.js";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import {
  addBusinessDays,
  businessDaysBetween,
  cancellationProbability,
} from "../../src/domain/calendar";
import {
  dashboard,
  insights,
  queue,
  rankOrders,
  sumMoney,
} from "../../src/domain/analytics";
import { importDataset } from "../../src/domain/import";
import type { Dataset, Order } from "../../src/domain/types";
export const order: Order = {
  id: "TEST-1",
  customerId: "C1",
  brand: "Teste",
  orderedAt: "2026-09-01",
  value: "100.00",
  sku: "S1",
  product: "Produto fictício",
  quantity: 1,
  gift: false,
  exception: "atraso_entrega",
  sourceStatuses: ["aberta"],
  status: "aberta",
  carrier: "Transportadora teste",
  state: "SP",
  city: "Cidade teste",
  promisedAt: "2026-09-04",
  deliveredAt: null,
  machine: "",
  shift: "manhã",
  dc: "CD1",
  lot: "TEST",
  openedAt: "2026-09-08",
  issues: [],
};
export const data: Dataset = {
  orders: [order],
  customers: [
    {
      id: "C1",
      orders: 2,
      revenue: "1600.00",
      firstOrder: "2025-01-01",
      contacts: 1,
    },
  ],
  carriers: [
    { name: "Transportadora teste", state: "SP", sla: 3, freight: "12.00" },
  ],
  importedAt: "2026-09-30T00:00:00Z",
  sourceRows: 1,
};
describe("calendário operacional", () => {
  it.each(["2026-09-04", "2026-09-05", "2026-09-06"])(
    "inicia depois do pedido e pula feriado: %s",
    (day) => expect(addBusinessDays(day, 1)).toBe("2026-09-08"),
  );
  it("inclui separação e SLA, excluindo o dia do pedido", () =>
    expect(addBusinessDays("2026-09-04", 4)).toBe("2026-09-11"));
  it("pula 12 de outubro", () =>
    expect(addBusinessDays("2026-10-09", 1)).toBe("2026-10-13"));
  it("não gera atraso negativo ou pelo mesmo dia", () => {
    expect(businessDaysBetween("2026-09-30", "2026-09-01")).toBe(0);
    expect(businessDaysBetween("2026-09-04", "2026-09-04")).toBe(0);
  });
  it.each([
    [0, 0],
    [1, 0.04],
    [2, 0.04],
    [3, 0.1],
    [5, 0.1],
    [6, 0.22],
    [10, 0.22],
    [11, 0.4],
  ])("limite de atraso %d → %f", (days, risk) =>
    expect(cancellationProbability(days)).toBe(risk),
  );
});
describe("valores e pontuação", () => {
  it("soma com precisão decimal e calcula custo", () => {
    expect(sumMoney(["0.10", "0.20"])).toBe("0.30");
    expect(rankOrders(data)[0].priority.resendCost).toBe("36.00");
  });
  it("limita a exposição ao recorte elegível", () => {
    expect(rankOrders(data)[0].priority.cancellationRisk).toBe("40.00");
    for (const changed of [
      { deliveredAt: "2026-09-29" },
      { exception: "item_faltante" },
      { exception: "pagamento_pendente" },
    ])
      expect(
        rankOrders({ ...data, orders: [{ ...order, ...changed }] })[0].priority
          .cancellationRisk,
      ).toBe("0.00");
  });
  it("usa metade da probabilidade de recompra em risco sem somá-la como perda observada", () =>
    expect(rankOrders(data)[0].priority.futureValue).toBe("280.00"));
  it("corta atraso na entrega, mesmo com exceção aberta", () =>
    expect(
      rankOrders({
        ...data,
        orders: [{ ...order, deliveredAt: "2026-09-09" }],
      })[0].priority.delay,
    ).toBe(2));
  it("normaliza pesos e rejeita soma zero", () => {
    expect(
      rankOrders(data, { value: 90, urgency: 70, relationship: 40 })[0].priority
        .score,
    ).toBe(rankOrders(data)[0].priority.score);
    expect(() =>
      rankOrders(data, { value: 0, urgency: 0, relationship: 0 }),
    ).toThrow();
  });
  it("desempata por data e ID e compara a mesma capacidade", () => {
    const large = {
      ...data,
      orders: Array.from({ length: 200 }, (_, i) => ({
        ...order,
        id: `T${String(i).padStart(3, "0")}`,
      })),
    };
    const q = queue(large);
    expect(q.orders[0].id).toBe("T000");
    expect(q.prioritized.count).toBe(150);
    expect(q.fifo.count).toBe(150);
  });
});
describe("base privada fornecida", () => {
  it.skipIf(!existsSync(".local/source/pedidos_excecao.csv"))(
    "consolida duplicatas e conserva conflitos, vínculos e valor",
    async () => {
      let files: string[];
      try {
        files = await Promise.all(
          ["pedidos_excecao.csv", "clientes.csv", "transportadoras.csv"].map(
            (n) => readFile(`.local/source/${n}`, "utf8"),
          ),
        );
      } catch (e) {
        throw e;
      }
      const imported = importDataset({
        orders: files[0],
        customers: files[1],
        carriers: files[2],
      });
      const d = dashboard(imported);
      expect(imported.sourceRows).toBeGreaterThanOrEqual(
        imported.orders.length,
      );
      expect(d.count).toBe(
        new Set(imported.orders.map((order) => order.id)).size,
      );
      expect(d.conflicts).toBe(
        imported.orders.filter((order) => order.sourceStatuses.length > 1)
          .length,
      );
      expect(d.value).toBe(
        sumMoney(imported.orders.map((order) => order.value)),
      );
      expect(queue(imported).prioritized.count).toBe(
        queue(imported).fifo.count,
      );
      expect(new Decimal(d.risk).lte(d.value)).toBe(true);
      for (const signal of insights(imported)) {
        expect(signal.count).toBe(signal.evidenceIds.length);
        expect(signal.count).toBeLessThanOrEqual(signal.total);
      }
    },
  );
});
