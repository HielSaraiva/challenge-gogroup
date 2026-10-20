import type { Workstream } from "./types";

/** Advance inside the saved selection, without replacing its orders or using AI. */
export function workstreamProgress(
  stream: Pick<Workstream, "orderIds" | "agentDecision">,
  pendingIds: ReadonlySet<string>,
) {
  const remaining = stream.orderIds.filter((id) => pendingIds.has(id));
  const first = stream.agentDecision?.firstOrderId;
  const suggestedId = first && remaining.includes(first) ? first : remaining[0];
  return {
    remaining,
    completed: stream.orderIds.length - remaining.length,
    suggestedId,
    agentSuggestion: Boolean(first && suggestedId === first),
  };
}
