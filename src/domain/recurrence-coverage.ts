import type { Investigation } from "./types";

/** Prefer unseen groups, then the least examined, keeping relevance as tie-breaker. */
export function chooseRecurrenceCandidates<T extends { id: string }>(
  candidates: T[],
  runs: Investigation[],
  limit = 16,
): T[] {
  const visits = new Map<string, number>();
  for (const run of runs) {
    const ids =
      run.consultedInsightIds || run.recurrenceReview?.selectedInsightIds || [];
    for (const id of new Set(ids)) visits.set(id, (visits.get(id) || 0) + 1);
  }
  return [...candidates]
    .sort((a, b) => (visits.get(a.id) || 0) - (visits.get(b.id) || 0))
    .slice(0, limit);
}
