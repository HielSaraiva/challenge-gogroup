import { investigate as runInvestigation } from "@/application/agent/investigate";
import type {
  AgentCompletion,
  InvestigationInput,
} from "@/application/agent/contracts";
import type { Dataset, ToolEvent } from "@/domain/types";
import { AppError } from "@/application/errors";
import { createAgentCompletion } from "@/infrastructure/ai/groq-completion";
import { withShortRateLimitRetry } from "@/infrastructure/ai/provider-retry";
import { operationsRepository } from "./container";

export { investigationInput } from "@/application/agent/contracts";
export type {
  AgentContext,
  AgentCompletion,
} from "@/application/agent/contracts";

/** Bind infrastructure once; the use case itself has no provider or storage imports. */
export async function investigate(
  input: InvestigationInput,
  sessionId: string,
  data: Dataset,
  emit: (event: ToolEvent) => void,
  completion?: AgentCompletion,
) {
  if (!completion && !process.env.GROQ_API_KEY)
    throw new AppError(
      "Configure GROQ_API_KEY no servidor para executar o agente real.",
      503,
    );
  return runInvestigation(
    input,
    sessionId,
    data,
    emit,
    {
      repository: operationsRepository,
      createCompletion: createAgentCompletion,
      retry: withShortRateLimitRetry,
      limits: {
        session: Number(process.env.AGENT_SESSION_DAILY_LIMIT || 10),
        global: Number(process.env.AGENT_GLOBAL_DAILY_LIMIT || 100),
      },
    },
    completion,
  );
}
