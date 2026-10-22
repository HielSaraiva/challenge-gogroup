import type { OperationsRepository } from "@/application/ports/operations-repository";
import { changeOrderCommand } from "@/application/orders/change-order";
import { updateTaskCommand } from "@/application/tasks/update-task";
import * as store from "@/infrastructure/persistence/operations-store";

/** Composition root: bind use-case ports to the deployed persistence implementation. */
export const operationsRepository: OperationsRepository = {
  getSession: store.getSession,
  createSession: store.createSession,
  saveSessionDataset: store.saveSessionDataset,
  getDataset: store.getDataset,
  saveCase: store.saveCase,
  saveInvestigation: store.saveInvestigation,
  upsertTask: store.upsertTask,
  upsertDailyPlan: store.upsertDailyPlan,
  consumeLimit: store.consumeLimit,
  acquireAgentLease: store.acquireAgentLease,
  saveProcessProgress: store.saveProcessProgress,
  updateTask: store.updateTask,
  completeTaskAndResolve: store.completeTaskAndResolve,
};

export const {
  getDataset,
  getSession,
  createSession,
  saveSessionDataset,
  saveInvestigation,
  acquireAgentLease,
  consumeLimit,
} = operationsRepository;
export const changeOrder = (id: string, input: unknown) =>
  changeOrderCommand(operationsRepository, id, input);
export const updateTask = (id: string, input: unknown) =>
  updateTaskCommand(operationsRepository, id, input);
