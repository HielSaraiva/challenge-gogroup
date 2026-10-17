import { currentCaseTasks } from "./case-cycle";
import { completedTask } from "./task-results";
import { sessionDataset, transitionCase } from "./cases";
import { usedDailyCapacity } from "./operations";
import {
  CAPACITY,
  type Dataset,
  type SessionState,
  type TaskExecution,
  type ResolutionOutcome,
} from "./types";

export function prepareTaskResolution(
  data: Dataset,
  state: SessionState,
  taskId: string,
  execution: TaskExecution,
  outcome: ResolutionOutcome,
  eventId: string,
) {
  const previous = state.tasks.find((task) => task.id === taskId);
  if (!previous || previous.scope === "process")
    throw new Error("Tarefa individual não encontrada.");
  if (
    !["aberta", "aprovada"].includes(previous.status) &&
    !(previous.status === "concluida" && !previous.execution)
  )
    throw new Error(
      "Esta tarefa não pode receber uma nova execução. Atualize o pedido.",
    );
  const order = data.orders.find((order) => order.id === previous.orderId);
  if (!order) throw new Error("Pedido não encontrado.");
  if (
    !currentCaseTasks(
      { ...order, caseHistory: state.cases?.[order.id]?.history },
      [previous],
    ).length
  )
    throw new Error(
      "Esta tarefa pertence a uma etapa anterior. Investigue o pedido reaberto novamente.",
    );
  if (usedDailyCapacity(sessionDataset(data, state)) >= CAPACITY)
    throw new Error("A capacidade operacional do dia foi consumida.");
  const task = {
    ...previous,
    ...completedTask(previous, execution),
    status: "concluida" as const,
    updatedAt: new Date().toISOString(),
  };
  const tasks = state.tasks.map((item) => (item.id === taskId ? task : item));
  const record = transitionCase(
    order,
    state.cases?.[order.id],
    tasks,
    {
      action: "resolve",
      orderId: order.id,
      note: task.execution!.note.slice(0, 1200),
      outcome,
    },
    eventId,
    task.updatedAt,
  );
  return { previous, task, record };
}

export function awaitingResultOrders<T extends Dataset["orders"][number]>(
  orders: T[],
  tasks: SessionState["tasks"],
): T[] {
  return orders.filter((order) => {
    if (order.resolution || order.status === "status_divergente") return false;
    const related = currentCaseTasks(order, tasks);
    const lastReopen = [...(order.caseHistory || [])]
      .reverse()
      .find((event) => event.action === "reopen");
    return (
      !related.some((task) =>
        ["aberta", "aprovada", "pendente_aprovacao"].includes(task.status),
      ) &&
      related.some(
        (task) =>
          task.status === "concluida" &&
          task.kind !== "revisao_status" &&
          task.execution &&
          (!lastReopen ||
            Boolean(task.execution.at && task.execution.at >= lastReopen.at)),
      )
    );
  });
}
