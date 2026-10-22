"use client";
import { allowedOutcomes, outcomeLabels } from "@/domain/cases";
import { closureRecords } from "@/domain/financial-records";
import type { RankedOrder, ResolutionOutcome } from "@/domain/types";
import { FormField } from "@/presentation/shared/ui/form";
import {
  currencyValidationMessage,
  formatCurrencyInput,
} from "@/shared/currency-input";
import { money } from "@/shared/formatting";
import Decimal from "decimal.js";
import type { ResolutionDraft } from "./resolution-draft";
export function ResolutionFields({
  order,
  value,
  onChange,
  executionEvidence,
  executionStage,
  requiredOutcome,
}: {
  order: RankedOrder;
  value: ResolutionDraft;
  onChange: (value: ResolutionDraft) => void;
  executionEvidence: string;
  executionStage?: "dispatched" | "received";
  requiredOutcome?: ResolutionOutcome["type"];
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
      <FormField
        validate={(type) =>
          requiredOutcome && type && type !== requiredOutcome
            ? "Para esta proposta de reembolso, selecione Reembolso registrado e informe o valor efetivo."
            : undefined
        }
      >
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
      </FormField>
      {value.type === "item_reenviado" && (
        <FormField className="check-label">
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
        </FormField>
      )}
      {canReuse && (
        <FormField className="check-label">
          <input
            type="checkbox"
            checked={value.reuseEvidence}
            onChange={(event) =>
              change({ reuseEvidence: event.target.checked })
            }
          />
          A evidência da execução também comprova este resultado
        </FormField>
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
        <FormField>
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
        </FormField>
      )}
      {value.type === "reembolso_registrado" && (
        <FormField
          validate={(input) =>
            currencyValidationMessage(input, {
              positive: true,
              max: remainingRefund,
            })
          }
        >
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
        </FormField>
      )}
      <FormField validate={currencyValidationMessage}>
        Custo adicional para resolver o problema (R$) — opcional
        <input
          inputMode="decimal"
          value={value.cost}
          onChange={(event) => change({ cost: event.target.value })}
          onBlur={() => change({ cost: formatCurrencyInput(value.cost) })}
          placeholder="Ex.: R$ 15,00 de novo frete"
        />
      </FormField>
      {value.cost.trim() && (
        <FormField>
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
        </FormField>
      )}
      <p className="muted">
        Custo adicional é uma despesa como novo frete ou reprodução do item. Não
        inclua o valor original do pedido nem o reembolso. Informe zero se não
        houve custo; deixe em branco se ele for desconhecido.
      </p>
    </div>
  );
}
