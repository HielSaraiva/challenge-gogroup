import type { Dataset, Insight } from "@/domain/types";
import type {
  AgentContext,
  AgentCompletion,
  InvestigationInput,
} from "@/application/agent/contracts";
import type { ConsultedFacts } from "@/application/agent/compact-agent-request";
import type { AgentRepository } from "./operations-repository";

export interface AgentDependencies {
  repository: AgentRepository;
  limits: { session: number; global: number };
  createCompletion(
    input: InvestigationInput,
    data: Dataset,
    context: AgentContext,
    facts: ConsultedFacts,
    pattern: Insight | null | undefined,
    completion?: AgentCompletion,
  ): AgentCompletion;
  retry<T>(call: () => Promise<T>, signal: AbortSignal): Promise<T>;
}
