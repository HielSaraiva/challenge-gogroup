import { randomUUID } from "node:crypto";
import { caseActionSchema, transitionCase } from "@/domain/cases";
import { AppError } from "@/application/errors";
import type { OperationsRepository } from "@/application/ports/operations-repository";
export async function changeOrderCommand(
  repository: OperationsRepository,
  id: string,
  raw: unknown,
) {
  const { acquireAgentLease, getSession, getDataset, saveCase } = repository;
  let release: (() => Promise<void>) | undefined;
  try {
    const input = caseActionSchema.parse(raw);
    release = await acquireAgentLease(id);
    const state = await getSession(id);
    if (!state) throw new AppError("Sessão expirada.", 401);
    const data = await getDataset(state);
    const order = data.orders.find((o) => o.id === input.orderId);
    if (!order) throw new AppError("Pedido não encontrado.", 404);
    let record;
    try {
      record = transitionCase(
        order,
        state.cases?.[order.id],
        state.tasks,
        input,
        randomUUID(),
        new Date().toISOString(),
      );
    } catch (error) {
      throw new AppError((error as Error).message, 409);
    }
    await saveCase(id, record);
    return record;
  } finally {
    await release?.();
  }
}
