import { z } from "zod";
import type { ChatCompletionMessageParam } from "groq-sdk/resources/chat/completions";
import type { Dataset, Investigation, Weights } from "@/domain/types";

export const investigationInput = z.object({
  type: z.enum(["order", "pattern", "daily", "recurrences"]),
  target: z.string().min(1).max(200),
  requestId: z.uuid(),
  renewFromTaskId: z.uuid().optional(),
  strategy: z.enum(["equilibrada", "urgencia", "relacionamento"]).optional(),
  weights: z
    .object({
      value: z.number().min(0).max(100),
      urgency: z.number().min(0).max(100),
      relationship: z.number().min(0).max(100),
    })
    .refine(
      (weights) => weights.value + weights.urgency + weights.relationship > 0,
    )
    .optional(),
});
export type InvestigationInput = z.infer<typeof investigationInput>;

export type AgentContext = {
  sessionId: string;
  runId: string;
  data: Dataset;
  allowedIds: Set<string>;
  consulted: Set<string>;
  simulated: Set<string>;
  evidence: Set<string>;
  requiresPattern?: boolean;
  patternConsulted?: boolean;
  mode?: "order" | "pattern" | "daily" | "recurrences";
  recurrenceCandidates?: { insightId: string; evidenceIds: string[] }[];
  recurrenceTaskIds?: string[];
  recurrenceReview?: Investigation["recurrenceReview"];
  patternId?: string;
  processInvestigation?: boolean;
  renewFromTaskId?: string;
  consultedInsights?: Set<string>;
  weights?: Weights;
  queueConsulted?: boolean;
  diagnosed?: boolean;
  compared?: boolean;
  strategy?: import("@/domain/types").Strategy;
  requestedStrategy?: import("@/domain/types").Strategy;
  strategyReason?: string;
};
export type AgentCompletion = (
  messages: ChatCompletionMessageParam[],
  signal: AbortSignal,
) => Promise<{
  choices: {
    message: {
      content?: string | null;
      tool_calls?: {
        id: string;
        type: "function";
        function: { name: string; arguments: string };
      }[];
    };
  }[];
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}>;
