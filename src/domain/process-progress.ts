import { z } from "zod";
import type { Task } from "./types";

export const processProgressSchema = z
  .object({
    observations: z.string().trim().max(2000),
    nextStep: z.string().trim().max(1500),
    evidenceIds: z.array(z.string().min(1)).max(20),
    outcome: z.enum(["confirmada", "descartada", "inconclusiva"]).optional(),
  })
  .strict();

export function processProgressPatch(
  task: Task,
  raw: unknown,
  expectedUpdatedAt: string,
) {
  if (task.scope !== "process")
    throw new Error("O progresso só se aplica a investigações de recorrência.");
  if (task.conclusion || !["aberta", "concluida"].includes(task.status))
    throw new Error(
      "Esta investigação já foi concluída ou não permite alterações.",
    );
  if (task.updatedAt !== expectedUpdatedAt)
    throw new Error(
      "A investigação foi atualizada em outra tela. Recarregue antes de salvar.",
    );
  const progress = processProgressSchema.parse(raw);
  if (
    new Set(progress.evidenceIds).size !== progress.evidenceIds.length ||
    progress.evidenceIds.some((id) => !task.affectedOrderIds?.includes(id))
  )
    throw new Error(
      "Selecione apenas pedidos distintos relacionados a esta investigação.",
    );
  const at = new Date(
    Math.max(Date.now(), Date.parse(task.updatedAt) + 1),
  ).toISOString();
  return {
    processProgress: { ...progress, at },
    updatedAt: at,
    status: "aberta" as const,
  };
}
