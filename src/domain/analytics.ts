import Decimal from "decimal.js";
import {
  addBusinessDays,
  businessDaysBetween,
  cancellationProbability,
} from "./calendar";
import {
  CAPACITY,
  DEFAULT_WEIGHTS,
  REFERENCE_DATE,
  exceptionLabels,
  type Dataset,
  type RankedOrder,
  type Weights,
  type Insight,
} from "./types";
export const sumMoney = (values: string[]) =>
  values.reduce((sum, v) => sum.plus(v), new Decimal(0)).toFixed(2);
const logistic = new Set([
  "atraso_entrega",
  "extravio",
  "rastreio_parado",
  "devolvido_transportadora",
  "avaria_transporte",
]);
const percentile95 = (v: number[]) =>
  [...v].sort((a, b) => a - b)[Math.max(0, Math.ceil(v.length * 0.95) - 1)] ||
  1;
export function rankOrders(
  data: Dataset,
  weights: Weights = DEFAULT_WEIGHTS,
  reference = REFERENCE_DATE,
): RankedOrder[] {
  const customerMap = new Map(data.customers.map((c) => [c.id, c]));
  const future = data.orders.map((o) => {
    const c = customerMap.get(o.customerId)!;
    return new Decimal(c.revenue)
      .div(c.orders)
      .times(new Decimal(c.revenue).gt(1500) ? 0.7 : 0.28)
      .times(0.5);
  });
  const p95Value = percentile95(data.orders.map((o) => Number(o.value)));
  const p95Future = percentile95(future.map((v) => v.toNumber()));
  const urgencyDays = data.orders.map((o) =>
    Math.max(
      businessDaysBetween(o.openedAt, reference),
      businessDaysBetween(
        o.promisedAt,
        o.deliveredAt && o.deliveredAt < reference ? o.deliveredAt : reference,
      ),
    ),
  );
  const p95Urgency = percentile95(urgencyDays);
  const totalWeights = weights.value + weights.urgency + weights.relationship;
  if (totalWeights <= 0) throw new Error("Informe ao menos um peso positivo.");
  return data.orders
    .map((order, i) => {
      const carrier = data.carriers.find(
        (c) => c.name === order.carrier && c.state === order.state,
      )!;
      const end =
        order.deliveredAt && order.deliveredAt < reference
          ? order.deliveredAt
          : reference;
      const delay = businessDaysBetween(order.promisedAt, end);
      const age = businessDaysBetween(order.openedAt, reference);
      const probability =
        !order.deliveredAt && logistic.has(order.exception)
          ? cancellationProbability(delay)
          : 0;
      const value = Math.min(Number(order.value) / p95Value, 1);
      const urgency = Math.min(Math.max(delay, age) / p95Urgency, 1);
      const relationship = Math.min(future[i].toNumber() / p95Future, 1);
      return {
        ...order,
        customer: customerMap.get(order.customerId),
        priority: {
          value,
          urgency,
          relationship,
          score:
            (100 *
              (value * weights.value +
                urgency * weights.urgency +
                relationship * weights.relationship)) /
            totalWeights,
          delay,
          age,
          futureValue: future[i].toFixed(2),
          cancellationProbability: probability,
          cancellationRisk: new Decimal(order.value)
            .times(probability)
            .toFixed(2),
          resendCost: new Decimal(order.value)
            .times(0.24)
            .plus(carrier.freight)
            .toFixed(2),
          contractPromise: addBusinessDays(order.orderedAt, 1 + carrier.sla),
          reasons: [
            `${age} dias úteis desde a abertura`,
            `${delay} dias úteis de atraso${order.deliveredAt ? " até a entrega" : ""}`,
            `Valor: R$ ${order.value}`,
            `Potencial de recompra em risco: R$ ${future[i].toFixed(2)} (proxy)`,
          ],
        },
      };
    })
    .sort(
      (a, b) =>
        b.priority.score - a.priority.score ||
        a.openedAt.localeCompare(b.openedAt) ||
        a.id.localeCompare(b.id),
    );
}
export function profile(orders: RankedOrder[]) {
  return {
    count: orders.length,
    value: sumMoney(orders.map((o) => o.value)),
    risk: sumMoney(orders.map((o) => o.priority.cancellationRisk)),
    averageAge: orders.length
      ? orders.reduce((s, o) => s + o.priority.age, 0) / orders.length
      : 0,
    exceptions: Object.entries(
      orders.reduce<Record<string, number>>((s, o) => {
        s[o.exception] = (s[o.exception] || 0) + 1;
        return s;
      }, {}),
    )
      .map(([type, count]) => ({ type, label: exceptionLabels[type], count }))
      .sort((a, b) => b.count - a.count),
  };
}
export function queue(data: Dataset, weights = DEFAULT_WEIGHTS) {
  const ranked = rankOrders(data, weights).filter((order) => !order.resolution);
  const usedCapacity = data.orders.reduce(
    (total, order) =>
      total +
      (order.caseHistory?.filter((event) => event.action === "resolve")
        .length || 0),
    0,
  );
  const availableCapacity = Math.max(0, CAPACITY - usedCapacity);
  const chronological = [...ranked].sort(
    (a, b) => a.openedAt.localeCompare(b.openedAt) || a.id.localeCompare(b.id),
  );
  const reserved = chronological.slice(
    0,
    Math.min(Math.ceil(availableCapacity * 0.2), ranked.length),
  );
  const reservedIds = new Set(reserved.map((order) => order.id));
  const selected = [
    ...reserved,
    ...ranked
      .filter((order) => !reservedIds.has(order.id))
      .slice(0, Math.max(0, availableCapacity - reserved.length)),
  ];
  const selectedIds = new Set(selected.map((order) => order.id));
  const prioritized = ranked
    .filter((order) => selectedIds.has(order.id))
    .map((order) => ({
      ...order,
      selectionReason: reservedIds.has(order.id)
        ? "Reserva para os casos mais antigos"
        : "Prioridade por valor, urgência e relacionamento",
    }));
  const fifo = chronological.slice(0, availableCapacity);
  return {
    orders: prioritized,
    prioritized: profile(prioritized),
    fifo: profile(fifo),
    capacity: CAPACITY,
    availableCapacity,
    usedCapacity,
    oldestReserved: reserved.length,
    weights,
  };
}
export function dashboard(data: Dataset) {
  const allOrders = rankOrders(data);
  const orders = allOrders.filter((o) => !o.resolution);
  return {
    ...profile(orders),
    delayed: orders.filter((o) => o.priority.delay > 0).length,
    conflicts: orders.filter((o) =>
      o.issues.some((i) => i.code === "STATUS_CONFLICT"),
    ).length,
    promiseMismatches: orders.filter((o) =>
      o.issues.some((i) => i.code === "PROMISE_MISMATCH"),
    ).length,
    importedAt: data.importedAt,
    sourceRows: data.sourceRows,
    totalCount: allOrders.length,
    resolvedCount: allOrders.length - orders.length,
    reviewedCount: allOrders.filter((o) => o.statusReview).length,
    reference: REFERENCE_DATE,
    capacity: CAPACITY,
    modelConfigured: Boolean(process.env.GROQ_API_KEY),
    storage: process.env.DATABASE_URL ? "postgres" : "local",
  };
}
export function insights(data: Dataset): Insight[] {
  const dimensions = [
    "carrier",
    "state",
    "machine",
    "shift",
    "dc",
    "lot",
    "gift",
    "carrier_state",
    "machine_shift_dc",
  ] as const;
  const result: Insight[] = [];
  function groupFor(o: Dataset["orders"][number], dimension: string) {
    return dimension === "carrier_state"
      ? `${o.carrier} / ${o.state}`
      : dimension === "machine_shift_dc"
        ? o.machine
          ? `${o.machine} / ${o.shift} / ${o.dc}`
          : ""
        : String(o[dimension as keyof typeof o] ?? "");
  }
  for (const exception of new Set(data.orders.map((o) => o.exception))) {
    const subset = data.orders.filter((o) => o.exception === exception);
    // Curadoria operacional: coincidências em campos sem relação com a etapa
    // não devem virar recomendações de processo (ex.: pagamento × transportadora).
    const relevant = logistic.has(exception)
      ? ["carrier", "state", "carrier_state"]
      : (
          {
            falha_personalizacao: [
              "machine",
              "shift",
              "dc",
              "machine_shift_dc",
            ],
            item_faltante: ["dc", "shift", "gift"],
            vazamento_produto: ["lot", "dc"],
            ruptura_pos_venda: ["dc"],
            endereco_divergente: ["state"],
          } as Record<string, string[]>
        )[exception] || [];
    for (const dimension of dimensions) {
      if (!relevant.includes(dimension)) continue;
      const groups = new Map<string, string[]>();
      for (const o of subset) {
        const group = groupFor(o, dimension);
        if (group) groups.set(group, [...(groups.get(group) || []), o.id]);
      }
      if (!groups.size) continue;
      const eligible = data.orders.filter((order) =>
        Boolean(groupFor(order, dimension)),
      );
      const dimensionalTotal = subset.filter((order) =>
        Boolean(groupFor(order, dimension)),
      ).length;
      const baseline = new Map<string, number>();
      for (const order of eligible) {
        const key = groupFor(order, dimension);
        baseline.set(key, (baseline.get(key) || 0) + 1);
      }
      if (baseline.size < 2) continue;
      const candidates = [...groups.entries()].filter(
        ([, ids]) => ids.length >= 10,
      );
      if (!candidates.length) continue;
      const lift = (group: string, ids: string[]) =>
        ids.length /
        dimensionalTotal /
        ((baseline.get(group) || 1) / eligible.length);
      const [group, evidenceIds] = candidates.sort(
        (a, b) =>
          lift(b[0], b[1]) * Math.sqrt(b[1].length) -
          lift(a[0], a[1]) * Math.sqrt(a[1].length),
      )[0];
      if (evidenceIds.length < 10) continue;
      const processSignal =
        lift(group, evidenceIds) >= 1.5 &&
        evidenceIds.length / dimensionalTotal >= 0.15;
      const groupLabel =
        group === "true"
          ? "pedidos com brinde"
          : group === "false"
            ? "pedidos sem brinde"
            : group;
      result.push({
        id: `${exception}:${dimension}:${group}`,
        title: `${exceptionLabels[exception]} · ${group === "true" ? "Com brinde" : group === "false" ? "Sem brinde" : group}`,
        exception,
        dimension,
        group,
        count: evidenceIds.length,
        total: dimensionalTotal,
        share: evidenceIds.length / dimensionalTotal,
        evidenceIds,
        hypothesis: `${processSignal ? "Sinal para investigar o processo" : "Sinal exploratório para validar em casos individuais"}. Sem a base de todos os pedidos, não é possível estimar taxa de falha ou provar causalidade.`,
        baselineShare: (baseline.get(group) || 0) / eligible.length,
        enrichment: lift(group, evidenceIds),
        scope: processSignal ? "process" : "case",
        investigationQuestion: `Comparar ${groupLabel} com os demais grupos da mesma dimensão e verificar se há mudança de procedimento, campanha, lote ou capacidade. Validar com todos os pedidos expedidos antes de concluir causa.`,
      });
    }
  }
  const mismatches = data.orders.filter((order) =>
    order.issues.some((issue) => issue.code === "PROMISE_MISMATCH"),
  );
  if (mismatches.length)
    result.push({
      id: "prazo:regra:checkout",
      title: "Promessa de entrega fora da regra contratual",
      exception: "divergencia_prazo",
      dimension: "promise_rule",
      group: "Cálculo de prazo",
      count: mismatches.length,
      total: data.orders.length,
      share: mismatches.length / data.orders.length,
      evidenceIds: mismatches.map((order) => order.id),
      hypothesis:
        "A divergência de datas está nos registros. Auditar calendário, separação e SLA no cálculo do checkout. Isso não prova que a regra de prazo causou falhas físicas de entrega ou produção.",
      baselineShare: 0,
      enrichment: 0,
      scope: "process",
      investigationQuestion:
        "Reproduzir o cálculo de dias úteis e comparar com a promessa gravada; verificar calendário, SLA da rota e configuração do checkout.",
    });
  return result.sort(
    (a, b) =>
      Number(b.scope === "process") - Number(a.scope === "process") ||
      b.enrichment * Math.sqrt(b.count) - a.enrichment * Math.sqrt(a.count) ||
      b.count - a.count,
  );
}
