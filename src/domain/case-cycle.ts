import type { CaseEvent, Task, Order } from "./types";

export function latestReopen(history: CaseEvent[] = []) {
  return [...history].reverse().find((event) => event.action === "reopen");
}

export function currentCaseTasks(
  order: Pick<Order, "id" | "caseHistory">,
  tasks: Task[],
) {
  const reopened = latestReopen(order.caseHistory);
  return tasks.filter(
    (task) =>
      task.scope !== "process" &&
      task.orderId === order.id &&
      (!reopened || task.createdAt >= reopened.at),
  );
}

export function reopenedWithoutTask<T extends Order>(
  orders: T[],
  tasks: Task[],
) {
  return orders.filter(
    (order) =>
      !order.resolution &&
      latestReopen(order.caseHistory) &&
      !currentCaseTasks(order, tasks).some(
        (task) =>
          ["aberta", "aprovada", "pendente_aprovacao"].includes(task.status) ||
          (task.status === "concluida" &&
            task.kind !== "revisao_status" &&
            task.execution),
      ),
  );
}
