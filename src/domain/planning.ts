import { createHash } from "node:crypto";
import { queue, rankOrders } from "./analytics";
import { sessionDataset } from "./cases";
import { DEFAULT_WEIGHTS, type Dataset, type SessionState } from "./types";
export const POLICY_VERSION = "agent-strategy-v3";
export function datasetReference(data: Dataset) {
  // Source identity is stable across session overlays and closures.
  return createHash("sha256")
    .update(
      JSON.stringify({
        importedAt: data.importedAt,
        sourceRows: data.sourceRows,
        orders: data.orders.map((o) => [
          o.id,
          o.value,
          o.exception,
          o.sourceStatuses,
          o.promisedAt,
          o.openedAt,
        ]),
      }),
    )
    .digest("hex");
}
export function planQueue(source: Dataset, state: SessionState) {
  const data = sessionDataset(source, state);
  const plans = [...(state.plans || [])].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
  const plan = plans[0];
  const dailyRuns = state.investigations
    .filter((r) => r.type === "daily")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const latest = dailyRuns[0];
  const running =
    latest?.status === "running" &&
    Date.now() - Date.parse(latest.updatedAt) < 70000;
  const expiredRun = latest?.status === "running" && !running;
  const stale = Boolean(
    plan &&
    (plan.policyVersion !== POLICY_VERSION ||
      plan.datasetReference !== datasetReference(source) ||
      Object.entries(plan.statusSnapshot || {}).some(([id, status]) => {
        const o = data.orders.find((o) => o.id === id);
        return !o || (!o.resolution && o.status !== status);
      })),
  );
  const status = running
    ? "preparing"
    : (expiredRun || latest?.status === "failed") &&
        (!plan || latest.createdAt >= plan.createdAt)
      ? "failed"
      : !plan
        ? "not_prepared"
        : stale
          ? "needs_review"
          : "ready";
  const capacity = queue(data);
  const ranks = new Map(
    rankOrders(data, plan?.weights || DEFAULT_WEIGHTS).map((o) => [o.id, o]),
  );
  const orders =
    plan && !stale
      ? plan.selectedOrderIds.flatMap((id) => {
          const o = ranks.get(id);
          return o && !o.resolution ? [o] : [];
        })
      : [];
  return {
    status,
    usable: Boolean(plan && !stale),
    plan: plan || null,
    orders,
    capacity: capacity.capacity,
    availableCapacity: capacity.availableCapacity,
    usedCapacity: capacity.usedCapacity,
    completed: plan
      ? plan.selectedOrderIds.filter((id) => ranks.get(id)?.resolution).length
      : 0,
    error: expiredRun
      ? "A execução foi interrompida. Os efeitos já registrados foram preservados; confira o plano em Hoje antes de tentar novamente."
      : latest?.status === "failed"
        ? latest.summary
        : null,
  };
}
