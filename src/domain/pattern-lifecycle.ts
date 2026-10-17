import type { Task } from "./types";

export function latestPatternTask(tasks: Task[], insightId: string) {
  const related = tasks.filter(
    (task) => task.scope === "process" && task.insightId === insightId,
  );
  const parents = new Set(
    related.map((task) => task.previousTaskId).filter(Boolean),
  );
  return related
    .filter((task) => !parents.has(task.id))
    .sort(
      (a, b) =>
        b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id),
    )[0];
}
export function patternDecision(
  tasks: Task[],
  insightId: string,
  renewFromTaskId?: string,
): { kind: "reuse"; task: Task } | { kind: "create"; previousTaskId?: string } {
  const latest = latestPatternTask(tasks, insightId);
  if (
    latest &&
    (latest.status !== "concluida" || !latest.conclusion || !renewFromTaskId)
  )
    return { kind: "reuse", task: latest };
  if (renewFromTaskId && latest?.id !== renewFromTaskId)
    throw new Error(
      "A investigação mudou. Abra o registro mais recente antes de solicitar outra análise.",
    );
  return {
    kind: "create",
    ...(renewFromTaskId ? { previousTaskId: renewFromTaskId } : {}),
  };
}
