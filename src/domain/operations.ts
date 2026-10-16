import Decimal from "decimal.js";
import { queue, rankOrders, sumMoney } from "./analytics";
import {
  CAPACITY,
  DEFAULT_WEIGHTS,
  type Dataset,
  type RankedOrder,
  type SessionState,
  type Weights,
} from "./types";

export function areaFor(
  order: Pick<RankedOrder, "status" | "exception">,
): string {
  if (order.status === "status_divergente") return "Revisão de dados";
  return (
    (
      {
        pagamento_pendente: "Financeiro",
        endereco_divergente: "Atendimento",
        ruptura_pos_venda: "Estoque",
        falha_personalizacao: "Produção",
        item_faltante: "Operações / CD",
        vazamento_produto: "Qualidade",
      } as Record<string, string>
    )[order.exception] || "Logística"
  );
}
export function usedDailyCapacity(data: Dataset) {
  return data.orders.reduce(
    (total, order) =>
      total +
      (order.caseHistory?.filter((event) => event.action === "resolve")
        .length || 0),
    0,
  );
}
export function workstreams(data: Dataset, weights: Weights = DEFAULT_WEIGHTS) {
  const selected = queue(data, weights).orders;
  const groups = new Map<string, RankedOrder[]>();
  for (const order of selected) {
    const area = areaFor(order);
    groups.set(area, [...(groups.get(area) || []), order]);
  }
  return [...groups].map(([area, orders]) => ({
    area,
    orderIds: orders.map((order) => order.id),
    value: sumMoney(orders.map((order) => order.value)),
    risk: sumMoney(orders.map((order) => order.priority.cancellationRisk)),
    sample: orders.slice(0, 3).map((order) => ({
      id: order.id,
      exception: order.exception,
      reasons: order.priority.reasons,
    })),
  }));
}
export function financialReport(data: Dataset, state: SessionState) {
  const original = {
    ...data,
    orders: data.orders.map((order) => ({ ...order, resolution: undefined })),
  };
  const originalRanks = rankOrders(original);
  const pending = originalRanks.filter(
    (order) =>
      !data.orders.find((source) => source.id === order.id)?.resolution,
  );
  const closed = originalRanks.filter(
    (order) => data.orders.find((source) => source.id === order.id)?.resolution,
  );
  const declared = data.orders.flatMap((order) =>
    order.resolution?.financial ? [order.resolution.financial] : [],
  );
  const retained = sumMoney(declared.map((outcome) => outcome.retained));
  const refunded = sumMoney(declared.map((outcome) => outcome.refunded));
  const costs = sumMoney(declared.map((outcome) => outcome.cost));
  return {
    baselineExposure: sumMoney(
      originalRanks.map((order) => order.priority.cancellationRisk),
    ),
    pendingExposure: sumMoney(
      pending.map((order) => order.priority.cancellationRisk),
    ),
    closedExposure: sumMoney(
      closed.map((order) => order.priority.cancellationRisk),
    ),
    verifiedRecovery: "0.00",
    declaredRetained: retained,
    declaredRefunded: refunded,
    declaredCosts: costs,
    declaredBalance: new Decimal(retained)
      .minus(refunded)
      .minus(costs)
      .toFixed(2),
    declaredCases: declared.length,
    financialProposals: state.tasks.filter(
      (task) => task.kind.startsWith("proposta_") && task.status === "aprovada",
    ).length,
    note: "Registros manuais desta demonstração não comprovam recuperação, lucro ou efeito causal. Aprovar uma proposta ou encerrar um caso não equivale a recuperar dinheiro.",
  };
}
export function operationalReport(
  data: Dataset,
  state: SessionState,
  weights: Weights = DEFAULT_WEIGHTS,
) {
  const q = queue(data, weights);
  const streams = workstreams(data, weights);
  return {
    capacity: CAPACITY,
    usedCapacity: usedDailyCapacity(data),
    availableCapacity: q.availableCapacity,
    selected: q.orders.length,
    oldestReserved: q.oldestReserved,
    streams,
    financial: financialReport(data, state),
  };
}
