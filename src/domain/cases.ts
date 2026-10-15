import { z } from "zod";
import type { CaseRecord, Dataset, Order, SessionState, Task } from "./types";
export const caseActionSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("review_status"),
      orderId: z.string().min(1).max(50),
      status: z.string().min(1).max(50),
      note: z.string().trim().min(10).max(1200),
    })
    .strict(),
  z
    .object({
      action: z.literal("resolve"),
      orderId: z.string().min(1).max(50),
      note: z.string().trim().min(10).max(1200),
    })
    .strict(),
  z
    .object({
      action: z.literal("reopen"),
      orderId: z.string().min(1).max(50),
      note: z.string().trim().min(10).max(1200),
    })
    .strict(),
]);
export function sessionDataset(data: Dataset, state: SessionState): Dataset {
  return {
    ...data,
    orders: data.orders.map((order) => {
      const record = state.cases?.[order.id];
      if (!record) return order;
      return {
        ...order,
        status: record.resolution
          ? "resolvida"
          : record.statusReview?.status || order.status,
        statusReview: record.statusReview,
        resolution: record.resolution,
        caseHistory: record.history,
      };
    }),
  };
}
export function transitionCase(
  order: Order,
  previous: CaseRecord | undefined,
  tasks: Task[],
  action: z.infer<typeof caseActionSchema>,
  eventId: string,
  now: string,
): CaseRecord {
  const next: CaseRecord = {
    orderId: order.id,
    version: (previous?.version || 0) + 1,
    history: [...(previous?.history || [])],
    statusReview: previous?.statusReview,
    resolution: previous?.resolution,
  };
  if (action.action === "review_status") {
    if (order.sourceStatuses.length < 2)
      throw new Error("Este pedido não possui conflito de status.");
    if (next.resolution)
      throw new Error("Reabra a exceção antes de revisar o status.");
    if (!order.sourceStatuses.includes(action.status))
      throw new Error("Escolha um dos status presentes na origem.");
    next.statusReview = {
      status: action.status,
      note: action.note,
      reviewedAt: now,
    };
  } else if (action.action === "resolve") {
    if (next.resolution) throw new Error("Esta exceção já foi encerrada.");
    if (order.sourceStatuses.length > 1 && !next.statusReview)
      throw new Error(
        "Revise o conflito de status antes de encerrar a exceção.",
      );
    const related = tasks.filter((t) => t.orderId === order.id);
    if (!related.some((t) => ["concluida", "aprovada"].includes(t.status)))
      throw new Error(
        "Conclua uma tarefa ou aprove uma proposta antes de encerrar a exceção.",
      );
    if (
      related.some((t) => ["aberta", "pendente_aprovacao"].includes(t.status))
    )
      throw new Error(
        "Existem tarefas ou propostas pendentes para este pedido.",
      );
    next.resolution = { note: action.note, resolvedAt: now };
  } else {
    if (!next.resolution) throw new Error("Esta exceção já está aberta.");
    delete next.resolution;
  }
  next.history.push({
    id: eventId,
    action: action.action,
    note: action.note,
    at: now,
    ...(action.action === "review_status" ? { status: action.status } : {}),
  });
  return next;
}
