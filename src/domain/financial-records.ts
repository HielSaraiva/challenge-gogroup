import type { Order, ResolutionOutcome } from "./types";

export type ClosureRecord = {
  key: string;
  orderId: string;
  at: string;
  note: string;
  outcome?: ResolutionOutcome;
  current: boolean;
};

/** Each closure is one financial record; the current resolution is its projection. */
export function closureRecords(
  order: Pick<Order, "id" | "caseHistory" | "resolution">,
): ClosureRecord[] {
  const records: ClosureRecord[] = [];
  const seen = new Set<string>();
  for (const event of order.caseHistory || []) {
    if (event.action !== "resolve" || seen.has(event.id)) continue;
    seen.add(event.id);
    records.push({
      key: `${order.id}:${event.id}`,
      orderId: order.id,
      at: event.at,
      note: event.note,
      outcome: event.outcome,
      current: false,
    });
  }
  if (order.resolution) {
    const matching = [...records]
      .reverse()
      .find((record) => record.at === order.resolution!.resolvedAt);
    if (matching) {
      matching.current = true;
      matching.outcome ||= order.resolution.outcome;
    } else
      records.push({
        key: `${order.id}:resolution:${order.resolution.resolvedAt}`,
        orderId: order.id,
        at: order.resolution.resolvedAt,
        note: order.resolution.note,
        outcome: order.resolution.outcome,
        current: true,
      });
  }
  return records;
}
