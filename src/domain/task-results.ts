import { z } from "zod";
import type { Task, TaskExecution, ProcessConclusion } from "./types";
import type { CaseRecord } from "./types";
import { statusLabel } from "./labels";
export function statusReviewTaskPatch(
  record: CaseRecord,
  existingReview = false,
) {
  if (
    (!existingReview && record.history.at(-1)?.action !== "review_status") ||
    !record.statusReview
  )
    return undefined;
  return {
    status: "concluida" as const,
    updatedAt: record.statusReview.reviewedAt,
    execution: {
      note: record.statusReview.note,
      evidence: `Status confirmado: ${statusLabel(record.statusReview.status)}. Referência: ${record.statusReview.note}`,
      at: record.statusReview.reviewedAt,
    },
  };
}
export const executionSchema = z
  .object({
    note: z.string().trim().min(15).max(1500),
    evidence: z.string().trim().min(15).max(1500),
    stage: z.enum(["dispatched", "received"]).optional(),
  })
  .strict();
export const rejectionSchema = z
  .object({ note: z.string().trim().min(15).max(1200) })
  .strict();
export const conclusionSchema = z
  .object({
    outcome: z.enum(["confirmada", "descartada", "inconclusiva"]),
    observations: z.string().trim().min(20).max(2000),
    evidenceIds: z.array(z.string().min(1)).min(2).max(20),
    nextStep: z.string().trim().max(1500).default(""),
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
  const result = executionSchema.parse(execution);
  if (task.kind === "proposta_reenvio" && !result.stage)
    throw new Error(
      "Informe se o reenvio foi despachado ou se o recebimento já foi confirmado.",
    );
  if (task.kind !== "proposta_reenvio" && result.stage)
    throw new Error(
      "A etapa de reenvio só se aplica a uma proposta de reenvio.",
    );
  return { execution: { ...result, at } };
}
