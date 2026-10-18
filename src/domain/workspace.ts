import { dashboard, insights, rankOrders } from "./analytics";
import { sessionDataset } from "./cases";
import { financialReport } from "./operations";
import { planQueue } from "./planning";
import type { Dataset, SessionState } from "./types";

export function workspaceSnapshot(
  source: Dataset,
  state: SessionState,
  now = Date.now(),
) {
  const runs = state.investigations
    .map((run) =>
      run.status === "running" && now - Date.parse(run.updatedAt) > 70000
        ? {
            ...run,
            status: "failed" as const,
            summary:
              "A análise foi interrompida. Os registros anteriores foram preservados; confira o resultado antes de tentar novamente.",
          }
        : run,
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const snapshot = { ...state, investigations: runs };
  const data = sessionDataset(source, snapshot);
  return {
    summary: dashboard(data),
    day: planQueue(source, snapshot),
    orders: rankOrders(data),
    patterns: insights(source),
    tasks: snapshot.tasks,
    runs,
    financial: financialReport(data, snapshot),
  };
}
export type WorkspaceSnapshot = ReturnType<typeof workspaceSnapshot>;
