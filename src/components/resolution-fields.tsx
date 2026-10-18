"use client";
import { allowedOutcomes, outcomeLabels } from "@/domain/cases";
import type { RankedOrder, ResolutionOutcome } from "@/domain/types";
import { formatCurrencyInput, parseCurrencyInput } from "@/lib/currency-input";
import { closureRecords } from "@/domain/financial-records";
import Decimal from "decimal.js";
import { money } from "@/lib/utils";

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

export function ResolutionFields({
  order,
  value,
  onChange,
  executionEvidence,
  executionStage,
}: {
  order: RankedOrder;
  value: ResolutionDraft;
  onChange: (value: ResolutionDraft) => void;
  executionEvidence: string;
  executionStage?: "dispatched" | "received";
}) {
  const change = (patch: Partial<ResolutionDraft>) =>
    onChange({ ...value, ...patch });
  const previous = closureRecords(order);
  const refunded = previous.reduce(
    (total, record) => total.plus(record.outcome?.refund || 0),
    new Decimal(0),
  );
  const remainingRefund = Decimal.max(
    0,
    new Decimal(order.value).minus(refunded),
  ).toFixed(2);
  const canReuse =
    value.type !== "item_reenviado" || executionStage === "received";
  return (
    <div className="resolution-fields">
      {previous.length > 0 && (
        <p className="reused-evidence">
          Os valores das etapas anteriores já estão registrados. Informe apenas
          novos custos ou reembolsos desta etapa; não repita os valores
          anteriores.
        </p>
      )}
      <label>
        Qual resultado foi confirmado?
        <select
          required
          value={value.type}
          onChange={(event) =>
            change({
              type: event.target.value as ResolutionDraft["type"],
              reuseEvidence: false,
              receiptConfirmed: false,
            })
          }
        >
          <option value="">Selecione o resultado</option>
          {allowedOutcomes(order.exception).map((type) => (
            <option
              key={type}
              value={type}
              disabled={
                type === "reembolso_registrado" && remainingRefund === "0.00"
              }
            >
              {type === "item_reenviado"
                ? "Recebimento do item reenviado confirmado"
                : outcomeLabels[type]}
              {type === "reembolso_registrado" && remainingRefund === "0.00"
                ? " (valor total já registrado)"
                : ""}
            </option>
          ))}
        </select>
      </label>
      {value.type === "item_reenviado" && (
        <label className="check-label">
          <input
            type="checkbox"
            required
            checked={value.receiptConfirmed}
            onChange={(event) =>
              change({ receiptConfirmed: event.target.checked })
            }
          />
          Confirmei o recebimento do item reenviado e que a pendência foi
          resolvida.
        </label>
      )}
      {canReuse && (
        <label className="check-label">
          <input
            type="checkbox"
            checked={value.reuseEvidence}
            onChange={(event) =>
              change({ reuseEvidence: event.target.checked })
            }
          />
          A evidência da execução também comprova este resultado
        </label>
      )}
      {!canReuse && (
        <p>
          A evidência do despacho não comprova o recebimento. Informe somente a
          confirmação complementar abaixo; não é necessário repetir a ação
          realizada.
        </p>
      )}
      {value.reuseEvidence && canReuse ? (
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
            placeholder={
              value.type === "item_reenviado"
                ? "Informe a referência do comprovante de recebimento ou protocolo que confirma a entrega do item e a resolução da falta, sem dados pessoais."
                : "Informe o registro que confirma a resolução. Se a evidência da execução já comprova o resultado, marque a opção acima para reutilizá-la."
            }
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
          <small>
            Limite disponível para novo reembolso: {money(remainingRefund)}.
            {refunded.gt(0) &&
              ` Já registrado neste pedido: ${money(refunded.toFixed(2))}.`}
          </small>
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
          Como o custo foi apurado?
          <select
            required
            value={value.costKind}
            onChange={(event) =>
              change({
                costKind: event.target.value as ResolutionDraft["costKind"],
              })
            }
          >
            <option value="">Selecione como o valor foi apurado</option>
            <option value="estimated">Estimativa, ainda não confirmada</option>
            <option value="declared">
              Custo realizado, informado pela equipe
            </option>
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
