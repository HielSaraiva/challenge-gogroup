import type {
  CaseRecord,
  DailyPlan,
  Dataset,
  Investigation,
  ProcessConclusion,
  ResolutionOutcome,
  SessionState,
  Task,
  TaskExecution,
} from "@/domain/types";

/** Atomic operations required by use cases; storage choice belongs to infrastructure. */
export interface AgentRepository {
  getSession(id: string): Promise<SessionState | null>;
  saveInvestigation(sessionId: string, run: Investigation): Promise<void>;
  upsertTask(sessionId: string, task: Task): Promise<Task>;
  upsertDailyPlan(sessionId: string, plan: DailyPlan): Promise<DailyPlan>;
  consumeLimit(key: string, limit: number): Promise<void>;
}
export interface OperationsRepository extends AgentRepository {
  createSession(id: string): Promise<SessionState>;
  saveSessionDataset(sessionId: string, data: Dataset): Promise<void>;
  getDataset(state?: SessionState): Promise<Dataset>;
  saveCase(sessionId: string, record: CaseRecord): Promise<void>;
  acquireAgentLease(sessionId: string): Promise<() => Promise<void>>;
  saveProcessProgress(
    sessionId: string,
    taskId: string,
    progress: unknown,
    expectedUpdatedAt: string,
  ): Promise<Task>;
  updateTask(
    sessionId: string,
    taskId: string,
    status: Task["status"],
    execution?: TaskExecution,
    conclusion?: ProcessConclusion,
    rejection?: { note: string },
    expectedUpdatedAt?: string,
  ): Promise<Task>;
  completeTaskAndResolve(
    sessionId: string,
    taskId: string,
    execution: TaskExecution,
    outcome: ResolutionOutcome,
  ): Promise<{ task: Task; record: CaseRecord }>;
}
