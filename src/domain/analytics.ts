import Decimal from "decimal.js";
import { addBusinessDays, businessDaysBetween, cancellationProbability } from "./calendar";
import { CAPACITY, DEFAULT_WEIGHTS, REFERENCE_DATE, exceptionLabels, type Dataset, type RankedOrder, type Weights, type Insight } from "./types";
export const sumMoney = (values: string[]) => values.reduce((sum, v) => sum.plus(v), new Decimal(0)).toFixed(2);
const logistic = new Set(["atraso_entrega", "extravio", "rastreio_parado", "devolvido_transportadora", "avaria_transporte"]);
const percentile95 = (v: number[]) => [...v].sort((a, b) => a - b)[Math.max(0, Math.ceil(v.length * .95) - 1)] || 1;
export function rankOrders(data: Dataset, weights: Weights = DEFAULT_WEIGHTS, reference = REFERENCE_DATE): RankedOrder[] {
  const customerMap = new Map(data.customers.map(c => [c.id, c]));
  const future = data.orders.map(o => { const c = customerMap.get(o.customerId)!; return new Decimal(c.revenue).div(c.orders).times(new Decimal(c.revenue).gt(1500) ? .70 : .28).times(.5); });
  const p95Value = percentile95(data.orders.map(o => Number(o.value)));
  const p95Future = percentile95(future.map(v => v.toNumber()));
  const totalWeights = weights.value + weights.urgency + weights.relationship;
  if (totalWeights <= 0) throw new Error("Informe ao menos um peso positivo.");
  return data.orders.map((order, i) => {
    const carrier = data.carriers.find(c => c.name === order.carrier && c.state === order.state)!;
    const end = order.deliveredAt && order.deliveredAt < reference ? order.deliveredAt : reference;
    const delay = businessDaysBetween(order.promisedAt, end);
    const age = businessDaysBetween(order.openedAt, reference);
    const probability = !order.deliveredAt && logistic.has(order.exception) ? cancellationProbability(delay) : 0;
    const value = Math.min(Number(order.value) / p95Value, 1);
    const urgency = Math.min(Math.max(delay, age) / 10, 1);
    const relationship = Math.min(future[i].toNumber() / p95Future, 1);
    return { ...order, priority: {
      value, urgency, relationship, score: 100 * (value * weights.value + urgency * weights.urgency + relationship * weights.relationship) / totalWeights,
      delay, age, futureValue: future[i].toFixed(2), cancellationProbability: probability,
      cancellationRisk: new Decimal(order.value).times(probability).toFixed(2),
      resendCost: new Decimal(order.value).times(.24).plus(carrier.freight).toFixed(2),
      contractPromise: addBusinessDays(order.orderedAt, 1 + carrier.sla),
      reasons: [`${age} dias úteis desde a abertura`, `${delay} dias úteis de atraso${order.deliveredAt ? " até a entrega" : ""}`, `Valor: R$ ${order.value}`, `Potencial de recompra em risco: R$ ${future[i].toFixed(2)} (proxy)`],
    } };
  }).sort((a, b) => b.priority.score - a.priority.score || a.openedAt.localeCompare(b.openedAt) || a.id.localeCompare(b.id));
}
export function profile(orders: RankedOrder[]) {
  return {
    count: orders.length, value: sumMoney(orders.map(o => o.value)), risk: sumMoney(orders.map(o => o.priority.cancellationRisk)),
    averageAge: orders.length ? orders.reduce((s, o) => s + o.priority.age, 0) / orders.length : 0,
    exceptions: Object.entries(orders.reduce<Record<string, number>>((s, o) => { s[o.exception] = (s[o.exception] || 0) + 1; return s; }, {})).map(([type, count]) => ({ type, label: exceptionLabels[type], count })).sort((a, b) => b.count - a.count),
  };
}
export function queue(data: Dataset, weights = DEFAULT_WEIGHTS) {
  const ranked = rankOrders(data, weights);
  const prioritized = ranked.slice(0, CAPACITY);
  const fifo = [...ranked].sort((a, b) => a.openedAt.localeCompare(b.openedAt) || a.id.localeCompare(b.id)).slice(0, CAPACITY);
  return { orders: prioritized, prioritized: profile(prioritized), fifo: profile(fifo), capacity: CAPACITY, weights };
}
export function dashboard(data: Dataset) {
  const orders = rankOrders(data);
  return { ...profile(orders), delayed: orders.filter(o => o.priority.delay > 0).length,
    conflicts: orders.filter(o => o.issues.some(i => i.code === "STATUS_CONFLICT")).length,
    promiseMismatches: orders.filter(o => o.issues.some(i => i.code === "PROMISE_MISMATCH")).length,
    sourceRows: data.sourceRows, reference: REFERENCE_DATE, capacity: CAPACITY,
    modelConfigured: Boolean(process.env.GROQ_API_KEY), storage: process.env.DATABASE_URL ? "postgres" : "local",
  };
}
export function insights(data: Dataset): Insight[] {
  const dimensions = ["carrier", "state", "machine", "shift", "dc", "lot", "gift", "carrier_state", "machine_shift_dc"] as const;
  const result: Insight[] = [];
  for (const exception of new Set(data.orders.map(o => o.exception))) {
    const subset = data.orders.filter(o => o.exception === exception);
    for (const dimension of dimensions) {
      const groups = new Map<string, string[]>();
      for (const o of subset) {
        const group = dimension === "carrier_state" ? `${o.carrier} / ${o.state}` : dimension === "machine_shift_dc" ? (o.machine ? `${o.machine} / ${o.shift} / ${o.dc}` : "") : String(o[dimension]);
        if (group) groups.set(group, [...(groups.get(group) || []), o.id]);
      }
      if (groups.size < 2) continue;
      const [group, evidenceIds] = [...groups.entries()].sort((a, b) => b[1].length - a[1].length)[0];
      if (evidenceIds.length < 10) continue;
      result.push({ id: `${exception}:${dimension}:${group}`, title: `${exceptionLabels[exception]} · ${group === "true" ? "Com brinde" : group === "false" ? "Sem brinde" : group}`,
        exception, dimension, group, count: evidenceIds.length, total: subset.length, share: evidenceIds.length / subset.length,
        evidenceIds, hypothesis: "Concentração entre pedidos com exceção. Investigar o processo; sem a base de todos os pedidos, não é possível estimar taxa de falha ou provar causalidade." });
    }
  }
  return result.sort((a, b) => b.share - a.share || b.count - a.count);
}
