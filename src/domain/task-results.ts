import { z } from "zod";
import type { Task, TaskExecution, ProcessConclusion } from "./types";
export const executionSchema = z
  .object({
    note: z.string().trim().min(15).max(1500),
    evidence: z.string().trim().min(15).max(1500),
  })
  .strict();
export const conclusionSchema = z
  .object({
    outcome: z.enum(["confirmada", "descartada", "inconclusiva"]),
    observations: z.string().trim().min(20).max(2000),
    evidenceIds: z.array(z.string().min(1)).min(2).max(20),
    nextStep: z.string().trim().min(15).max(1500),
  })
  .strict();
export function completedTask(
  task: Task,
  execution?: TaskExecution,
  conclusion?: ProcessConclusion,
) {
  const at = new Date().toISOString();
  if (task.scope === "process") {
    const result = conclusionSchema.parse(conclusion);
    if (
      new Set(result.evidenceIds).size < 2 ||
      result.evidenceIds.some((id) => !task.affectedOrderIds?.includes(id))
    )
      throw new Error(
        "Use ao menos dois pedidos distintos relacionados à investigação.",
      );
    return { conclusion: { ...result, at } };
  }
  return { execution: { ...executionSchema.parse(execution), at } };
}
