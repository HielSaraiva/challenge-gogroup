import { currentCaseTasks, latestReopen } from "./case-cycle";
import type { Order, Task } from "./types";

export function taskNeedsWork(task: Task) {
  return (
    ["aberta", "aprovada", "pendente_aprovacao"].includes(task.status) ||
    (task.status === "concluida" &&
      (task.scope === "process"
        ? !task.conclusion
        : task.kind !== "revisao_status" && !task.execution))
  );
}
type Phase =
  "review" | "approval" | "execution" | "receipt" | "result" | "investigate";
export type PendingItem =
  | {
      id: string;
      kind: "order";
      order: Order;
      tasks: Task[];
      phase: Phase;
      since: string;
    }
  | { id: string; kind: "process"; task: Task; since: string };

export function pendingWork(orders: Order[], tasks: Task[]): PendingItem[] {
  const items: PendingItem[] = [];
  for (const order of orders) {
    if (order.resolution) continue;
    const related = currentCaseTasks(order, tasks);
    const active = related.filter(taskNeedsWork);
    const executed = related.some(
      (task) =>
        task.status === "concluida" &&
        task.kind !== "revisao_status" &&
        task.execution,
    );
    const followup =
      latestReopen(order.caseHistory) ||
      order.statusReview ||
      related.some((task) => task.status === "rejeitada");
    if (
      !active.length &&
      !executed &&
      !followup &&
      !(order.status === "status_divergente" && related.length)
    )
      continue;
    const phase: Phase =
      order.status === "status_divergente"
        ? "review"
        : active.some((task) => task.status === "pendente_aprovacao")
          ? "approval"
          : active.length
            ? "execution"
            : executed
              ? related.some((task) => task.execution?.stage === "dispatched")
                ? "receipt"
                : "result"
              : "investigate";
    items.push({
      id: `order:${order.id}`,
      kind: "order",
      order,
      tasks: active,
      phase,
      since: latestReopen(order.caseHistory)?.at || order.openedAt,
    });
  }
  for (const task of tasks)
    if (task.scope === "process" && taskNeedsWork(task))
      items.push({
        id: `process:${task.id}`,
        kind: "process",
        task,
        since: task.createdAt,
      });
  return items.sort(
    (a, b) => a.since.localeCompare(b.since) || a.id.localeCompare(b.id),
  );
}
