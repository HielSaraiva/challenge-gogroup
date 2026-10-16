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
      status: order.status,
      delivered: Boolean(order.deliveredAt),
      issues: order.issues.map((issue) => issue.code),
      reasons: order.priority.reasons,
    })),
  }));
}
export function financialReport(data: Dataset, state: SessionState) {
  const resolved = data.orders.filter((o) => o.resolution);
  const outcomes = resolved.flatMap((o) =>
    o.resolution?.outcome ? [o.resolution.outcome] : [],
  );
  const refunds = outcomes.filter(
    (o) => o.type === "reembolso_registrado" && o.refund !== undefined,
  );
  const declared = outcomes.flatMap((o) =>
    o.cost?.kind === "declared" ? [o.cost.amount] : [],
  );
  const estimated = outcomes.flatMap((o) =>
    o.cost?.kind === "estimated" ? [o.cost.amount] : [],
  );
  return {
    resolvedCount: resolved.length,
    pendingCount: data.orders.length - resolved.length,
    treatedValue: sumMoney(resolved.map((o) => o.value)),
    refunds: {
      count: refunds.length,
      total: sumMoney(refunds.map((o) => o.refund!)),
    },
    declaredCosts: { count: declared.length, total: sumMoney(declared) },
    estimatedCosts: { count: estimated.length, total: sumMoney(estimated) },
    unmeasured: resolved.filter(
      (o) => !o.resolution?.outcome?.cost && !o.resolution?.outcome?.refund,
    ).length,
    legacy: resolved.filter((o) => !o.resolution?.outcome).length,
    pendingApprovals: state.tasks.filter(
      (t) => t.status === "pendente_aprovacao",
    ).length,
    pendingExecution: state.tasks.filter(
      (t) => t.status === "aberta" || t.status === "aprovada",
    ).length,
    resolvedOrders: resolved.map((o) => ({
      id: o.id,
      value: o.value,
      outcome: o.resolution?.outcome,
      note: o.resolution!.note,
    })),
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
