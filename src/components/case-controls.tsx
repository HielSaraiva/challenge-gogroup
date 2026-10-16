"use client";
import { useState } from "react";
import { CheckCircle2, Loader2, RotateCcw, ShieldCheck } from "lucide-react";
import { Button } from "./ui/button";
import type { RankedOrder, Task } from "@/domain/types";
import { statusLabel } from "@/lib/utils";

export function CaseControls({
  order,
  tasks,
  disabled,
  onSaved,
}: {
  order: RankedOrder;
  tasks: Task[];
  disabled: boolean;
  onSaved: () => Promise<void>;
}) {
  const [note, setNote] = useState("");
  const [choice, setChoice] = useState(order.sourceStatuses[0]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [financialEnabled, setFinancialEnabled] = useState(false);
  const [financialType, setFinancialType] = useState("retained");
  const [financialAmount, setFinancialAmount] = useState("0");
  const [financialCost, setFinancialCost] = useState("0");
  const [financialEvidence, setFinancialEvidence] = useState("");
  const needsReview = order.status === "status_divergente";
  const action = order.resolution
    ? "reopen"
    : needsReview
      ? "review_status"
      : "resolve";
  const related = tasks.filter(
    (t) => t.orderId === order.id && t.scope !== "process",
  );
  const hasPending = related.some((t) =>
    ["aberta", "pendente_aprovacao", "aprovada"].includes(t.status),
  );
  const hasCompleted = related.some((t) => t.status === "concluida");
  const canResolve = !hasPending && hasCompleted;
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          orderId: order.id,
          note,
          ...(needsReview ? { status: choice } : {}),
          ...(action === "resolve" && financialEnabled
            ? {
                financial: {
                  retained:
                    financialType === "retained" ? financialAmount : "0",
                  refunded:
                    financialType === "refunded" ? financialAmount : "0",
                  cost: financialCost,
                  evidence: financialEvidence,
                },
              }
            : {}),
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      await onSaved();
      setNote("");
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setSaving(false);
    }
  }
  return (
    <section className="case-controls">
      <div className="case-controls-heading">
        {order.resolution ? (
          <RotateCcw size={18} />
        ) : needsReview ? (
          <ShieldCheck size={18} />
        ) : (
          <CheckCircle2 size={18} />
        )}
        <h3>
          {order.resolution
            ? "Reabrir exceção"
            : needsReview
              ? "Revisar conflito de status"
              : "Encerrar exceção na demonstração"}
        </h3>
      </div>
      <p>
        {order.resolution
          ? "Reabra o caso se houver uma pendência. O pedido volta à fila desta sessão."
          : needsReview
            ? "A origem não indica qual status é o mais recente. Escolha o status validado e registre o motivo; os valores originais serão preservados."
            : "Depois de concluir as tarefas, registre o resultado. O caso sai da sua fila e os indicadores são recalculados. Isso não confirma entrega, reembolso ou recuperação financeira."}
      </p>
      {order.statusReview && (
        <div className="review-record">
          <b>Status revisado: {statusLabel(order.statusReview.status)}</b>
          <small>{order.statusReview.note}</small>
        </div>
      )}
      {order.resolution && (
        <div className="review-record">
          <b>Encerramento registrado</b>
          <small>{order.resolution.note}</small>
        </div>
      )}
      <form onSubmit={submit}>
        {needsReview && (
          <label>
            Status validado
            <select
              aria-label="Status validado"
              value={choice}
              onChange={(e) => setChoice(e.target.value)}
            >
              {order.sourceStatuses.map((status) => (
                <option key={status} value={status}>
                  {statusLabel(status)}
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          {needsReview ? "Motivo da revisão" : "Registro da tratativa"}
          <textarea
            aria-label="Registro da tratativa"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            minLength={10}
            maxLength={1200}
            required
            placeholder="Descreva o que foi verificado e o próximo passo…"
            rows={3}
          />
        </label>
        {action === "resolve" && (
          <fieldset className="financial-entry">
            <legend>Resultado financeiro</legend>
            <label className="toggle">
              <input
                type="checkbox"
                checked={financialEnabled}
                onChange={(event) => setFinancialEnabled(event.target.checked)}
              />{" "}
              Registrar resultado declarado da tratativa
            </label>
            <p>
              Opcional. Sem evidência financeira, encerre apenas o caso. Valores
              declarados na demonstração ficam separados da recuperação
              comprovada.
            </p>
            {financialEnabled && (
              <>
                <div className="financial-entry-grid">
                  <label>
                    Resultado
                    <select
                      aria-label="Tipo de resultado financeiro"
                      value={financialType}
                      onChange={(event) => setFinancialType(event.target.value)}
                    >
                      <option value="retained">
                        Valor do pedido preservado
                      </option>
                      <option value="refunded">Reembolso declarado</option>
                    </select>
                  </label>
                  <label>
                    Valor declarado (R$)
                    <input
                      aria-label="Valor financeiro declarado"
                      type="number"
                      min="0"
                      max={order.value}
                      step="0.01"
                      required
                      value={financialAmount}
                      onChange={(event) =>
                        setFinancialAmount(event.target.value)
                      }
                    />
                  </label>
                  <label>
                    Custo da intervenção (R$)
                    <input
                      aria-label="Custo declarado da intervenção"
                      type="number"
                      min="0"
                      max="9999999"
                      step="0.01"
                      required
                      value={financialCost}
                      onChange={(event) => setFinancialCost(event.target.value)}
                    />
                  </label>
                </div>
                <label>
                  Evidência do resultado
                  <textarea
                    aria-label="Evidência financeira"
                    rows={2}
                    minLength={15}
                    maxLength={1200}
                    required
                    value={financialEvidence}
                    onChange={(event) =>
                      setFinancialEvidence(event.target.value)
                    }
                    placeholder="Informe o que foi confirmado e a referência da evidência. Não inclua dados pessoais."
                  />
                </label>
              </>
            )}
          </fieldset>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {action === "resolve" && !canResolve && (
          <small className="case-help">
            {hasPending
              ? "Avalie as propostas e registre a execução das tarefas pendentes antes de encerrar."
              : "Primeiro investigue este pedido e conclua uma tarefa."}
          </small>
        )}
        <Button
          disabled={disabled || saving || (action === "resolve" && !canResolve)}
          type="submit"
        >
          {saving ? (
            <Loader2 size={15} className="spin" />
          ) : (
            <CheckCircle2 size={15} />
          )}
          {needsReview
            ? "Confirmar status revisado"
            : order.resolution
              ? "Reabrir na minha fila"
              : "Confirmar encerramento"}
        </Button>
      </form>
      {Boolean(order.caseHistory?.length) && (
        <details className="case-history">
          <summary>Histórico de decisões · {order.caseHistory!.length}</summary>
          {[...order.caseHistory!].reverse().map((event) => (
            <div key={event.id}>
              <b>
                {event.action === "review_status"
                  ? "Status revisado"
                  : event.action === "resolve"
                    ? "Exceção encerrada"
                    : "Exceção reaberta"}
              </b>
              <time>{new Date(event.at).toLocaleString("pt-BR")}</time>
              <p>{event.note}</p>
            </div>
          ))}
        </details>
      )}
    </section>
  );
}
