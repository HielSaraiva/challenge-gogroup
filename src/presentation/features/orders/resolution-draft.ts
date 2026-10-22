import type { ResolutionOutcome } from "@/domain/types";
import { parseCurrencyInput } from "@/shared/currency-input";

export type ResolutionDraft = {
  type: ResolutionOutcome["type"] | "";
  reuseEvidence: boolean;
  evidence: string;
  refund: string;
  cost: string;
  costKind: "" | "estimated" | "declared";
  receiptConfirmed: boolean;
};
export const emptyResolution: ResolutionDraft = {
  type: "",
  reuseEvidence: false,
  evidence: "",
  refund: "",
  cost: "",
  costKind: "",
  receiptConfirmed: false,
};

export function resolutionPayload(
  draft: ResolutionDraft,
  execution: { taskId: string; evidence: string },
): ResolutionOutcome {
  if (!draft.type)
    throw new Error("Selecione o resultado confirmado para encerrar o pedido.");
  if (draft.type === "item_reenviado" && !draft.receiptConfirmed)
    throw new Error(
      "Confirme o recebimento do item reenviado antes de encerrar.",
    );
  const evidence = draft.reuseEvidence
    ? execution.evidence
    : draft.evidence.trim();
  if (evidence.length < 15)
    throw new Error(
      "Informe uma referência que comprove o resultado, ou confirme o uso da evidência da execução.",
    );
  if (draft.cost.trim() && !draft.costKind)
    throw new Error("Selecione como o valor do custo foi apurado.");
  return {
    type: draft.type,
    executionTaskId: execution.taskId,
    evidence,
    ...(draft.type === "item_reenviado" ? { receiptConfirmed: true } : {}),
    ...(draft.reuseEvidence ? { evidenceTaskId: execution.taskId } : {}),
    ...(draft.type === "reembolso_registrado"
      ? { refund: parseCurrencyInput(draft.refund) }
      : {}),
    ...(draft.cost.trim()
      ? {
          cost: {
            amount: parseCurrencyInput(draft.cost),
            kind: draft.costKind as "estimated" | "declared",
          },
        }
      : {}),
  };
}
