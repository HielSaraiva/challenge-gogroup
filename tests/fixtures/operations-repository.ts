import { vi } from "vitest";
import type { OperationsRepository } from "@/application/ports/operations-repository";

/** Typed port double: application tests do not load filesystem or database adapters. */
export function repositoryDouble() {
  return {
    getSession: vi.fn<OperationsRepository["getSession"]>(),
    createSession: vi.fn<OperationsRepository["createSession"]>(),
    getDataset: vi.fn<OperationsRepository["getDataset"]>(),
    saveSessionDataset: vi.fn<OperationsRepository["saveSessionDataset"]>(),
    saveCase: vi.fn<OperationsRepository["saveCase"]>(),
    saveInvestigation: vi.fn<OperationsRepository["saveInvestigation"]>(),
    upsertTask: vi.fn<OperationsRepository["upsertTask"]>(),
    upsertDailyPlan: vi.fn<OperationsRepository["upsertDailyPlan"]>(),
    consumeLimit: vi.fn<OperationsRepository["consumeLimit"]>(),
    acquireAgentLease: vi.fn<OperationsRepository["acquireAgentLease"]>(),
    saveProcessProgress: vi.fn<OperationsRepository["saveProcessProgress"]>(),
    updateTask: vi.fn<OperationsRepository["updateTask"]>(),
    completeTaskAndResolve:
      vi.fn<OperationsRepository["completeTaskAndResolve"]>(),
  } satisfies OperationsRepository;
}
