"use client";
import { allowedOutcomes, outcomeLabels } from "@/domain/cases";
import type { RankedOrder, ResolutionOutcome } from "@/domain/types";
import { formatCurrencyInput, parseCurrencyInput } from "@/lib/currency-input";
import { money } from "@/lib/utils";

export type ResolutionDraft = {
  type: ResolutionOutcome["type"] | "";
  reuseEvidence: boolean;
  evidence: string;
  refund: string;
  cost: string;
  costKind: "estimated" | "declared";
};
export const emptyResolution: ResolutionDraft = {
  type: "",
  reuseEvidence: false,
  evidence: "",
  refund: "",
  cost: "",
  costKind: "estimated",
};

export function resolutionPayload(
  draft: ResolutionDraft,
  execution: { taskId: string; evidence: string },
): ResolutionOutcome {
  if (!draft.type)
    throw new Error("Selecione o resultado confirmado para encerrar o pedido.");
  const evidence = draft.reuseEvidence
    ? execution.evidence
    : draft.evidence.trim();
  if (evidence.length < 15)
    throw new Error(
      "Informe uma referência que comprove o resultado, ou confirme o uso da evidência da execução.",
    );
  return {
    type: draft.type,
    evidence,
    ...(draft.reuseEvidence ? { evidenceTaskId: execution.taskId } : {}),
    ...(draft.type === "reembolso_registrado"
      ? { refund: parseCurrencyInput(draft.refund) }
      : {}),
    ...(draft.cost.trim()
      ? {
          cost: {
            amount: parseCurrencyInput(draft.cost),
            kind: draft.costKind,
          },
        }
      : {}),
  };
}

export function ResolutionFields({
  order,
  value,
  onChange,
  executionEvidence,
}: {
  order: RankedOrder;
  value: ResolutionDraft;
  onChange: (value: ResolutionDraft) => void;
  executionEvidence: string;
}) {
  const change = (patch: Partial<ResolutionDraft>) =>
    onChange({ ...value, ...patch });
  return (
    <div className="resolution-fields">
      <label>
        Qual resultado foi confirmado?
        <select
          required
          value={value.type}
          onChange={(event) =>
            change({ type: event.target.value as ResolutionDraft["type"] })
          }
        >
          <option value="">Selecione o resultado</option>
          {allowedOutcomes(order.exception).map((type) => (
            <option key={type} value={type}>
              {outcomeLabels[type]}
            </option>
          ))}
        </select>
      </label>
      <label className="check-label">
        <input
          type="checkbox"
          checked={value.reuseEvidence}
          onChange={(event) => change({ reuseEvidence: event.target.checked })}
        />
        A evidência da execução também comprova este resultado
      </label>
      {value.reuseEvidence ? (
        <div className="reused-evidence">
          <strong>Evidência que será vinculada ao resultado</strong>
          <p>
            {executionEvidence ||
              "A referência informada no campo de execução acima."}
          </p>
        </div>
      ) : (
        <label>
          Evidência complementar do resultado
          <textarea
            required
            minLength={15}
            maxLength={1500}
            value={value.evidence}
            onChange={(event) => change({ evidence: event.target.value })}
            placeholder="Informe o registro que confirma a resolução. Se a evidência da execução já comprova o resultado, marque a opção acima para reutilizá-la."
          />
        </label>
      )}
      {value.type === "reembolso_registrado" && (
        <label>
          Reembolso registrado (R$)
          <input
            required
            inputMode="decimal"
            value={value.refund}
            onChange={(event) => change({ refund: event.target.value })}
            onBlur={() => change({ refund: formatCurrencyInput(value.refund) })}
            placeholder="Ex.: R$ 23,75"
          />
          <small>Limitado ao valor do pedido: {money(order.value)}.</small>
        </label>
      )}
      <label>
        Custo adicional para resolver o problema (R$) — opcional
        <input
          inputMode="decimal"
          value={value.cost}
          onChange={(event) => change({ cost: event.target.value })}
          onBlur={() => change({ cost: formatCurrencyInput(value.cost) })}
          placeholder="Ex.: R$ 15,00 de novo frete"
        />
      </label>
      {value.cost.trim() && (
        <label>
          Origem do custo
          <select
            value={value.costKind}
            onChange={(event) =>
              change({
                costKind: event.target.value as ResolutionDraft["costKind"],
              })
            }
          >
            <option value="estimated">Estimativa, ainda não confirmada</option>
            <option value="declared">Informado pelo operador</option>
          </select>
        </label>
      )}
      <p className="muted">
        Custo adicional é uma despesa como novo frete ou reprodução do item. Não
        inclua o valor original do pedido nem o reembolso. Informe zero se não
        houve custo; deixe em branco se ele for desconhecido.
      </p>
    </div>
  );
}
