"use client";
import { useState } from "react";
import { Button } from "./ui/button";
import { allowedOutcomes, outcomeLabels } from "@/domain/cases";
import type { RankedOrder, Task, ResolutionOutcome } from "@/domain/types";
import { formatCurrencyInput, parseCurrencyInput } from "@/lib/currency-input";
import { money, statusLabel } from "@/lib/utils";
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
  const [evidence, setEvidence] = useState("");
  const [status, setStatus] = useState(order.sourceStatuses[0]);
  const [type, setType] = useState<ResolutionOutcome["type"]>(
    allowedOutcomes(order.exception)[0],
  );
  const [refund, setRefund] = useState("");
  const [cost, setCost] = useState("");
  const [kind, setKind] = useState("estimated");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const review = order.status === "status_divergente";
  const action = order.resolution
    ? "reopen"
    : review
      ? "review_status"
      : "resolve";
  const related = tasks.filter(
    (t) => t.orderId === order.id && t.scope !== "process",
  );
  const lastReopen = [...(order.caseHistory || [])]
    .reverse()
    .find((event) => event.action === "reopen");
  const canResolve =
    related.some(
      (t) =>
        t.status === "concluida" &&
        t.kind !== "revisao_status" &&
        t.execution &&
        (!lastReopen ||
          Boolean(t.execution.at && t.execution.at >= lastReopen.at)),
    ) &&
    !related.some((t) =>
      ["aberta", "aprovada", "pendente_aprovacao"].includes(t.status),
    );
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          orderId: order.id,
          note,
          ...(review ? { status } : {}),
          ...(action === "resolve"
            ? {
                outcome: {
                  type,
                  evidence,
                  ...(type === "reembolso_registrado"
                    ? { refund: parseCurrencyInput(refund) }
                    : {}),
                  ...(cost.trim() !== ""
                    ? { cost: { amount: parseCurrencyInput(cost), kind } }
                    : {}),
                },
              }
            : {}),
        }),
      });
      const b = await r.json();
      if (!r.ok) throw new Error(b.error);
      await onSaved();
      setNote("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (action === "resolve" && !canResolve)
    return (
      <section className="panel prose case-result-panel">
        <h3>Encerramento do pedido</h3>
        <p>
          Para encerrar, primeiro investigue o pedido com IA, execute a tarefa
          sugerida e registre a evidência.{" "}
          {related.length
            ? "Confira as tarefas acima para saber o que ainda falta concluir."
            : "Comece pelo botão “Investigar este pedido com IA”."}
        </p>
        <p className="muted">
          Não é necessário preparar o plano do dia. Aprovar uma proposta ou
          confirmar um status não basta: é preciso registrar a ação realizada
          para resolver o problema.
        </p>
      </section>
    );
  return (
    <section className="panel prose case-result-panel">
      <h3>
        {order.resolution
          ? "Reabrir pedido"
          : review
            ? "Validar o status antes de continuar"
            : "Registrar resultado do pedido"}
      </h3>
      {order.resolution && (
        <p>
          {order.resolution.outcome
            ? outcomeLabels[order.resolution.outcome.type]
            : "Encerramento legado, sem resultado estruturado"}
          : {order.resolution.note}
        </p>
      )}
      <form onSubmit={submit} className="guided-form">
        {review && (
          <label>
            Status confirmado
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              {order.sourceStatuses.map((s) => (
                <option key={s} value={s}>
                  {statusLabel(s)}
                </option>
              ))}
            </select>
          </label>
        )}
        {action === "resolve" && (
          <>
            <label>
              O que resolveu a exceção?
              <select
                value={type}
                onChange={(e) =>
                  setType(e.target.value as ResolutionOutcome["type"])
                }
              >
                {allowedOutcomes(order.exception).map((t) => (
                  <option value={t} key={t}>
                    {outcomeLabels[t]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Evidência do resultado
              <textarea
                required
                minLength={15}
                maxLength={1500}
                value={evidence}
                onChange={(e) => setEvidence(e.target.value)}
                placeholder="Informe como o resultado foi confirmado e onde conferir. Ex.: correção do endereço confirmada no chamado de atendimento; informe o protocolo ou link, sem copiar dados pessoais."
              />
            </label>
            {type === "reembolso_registrado" && (
              <label>
                Reembolso registrado (R$)
                <input
                  required
                  type="text"
                  inputMode="decimal"
                  placeholder="Ex.: R$ 23,75 devolvidos ao cliente"
                  value={refund}
                  onChange={(e) => setRefund(e.target.value)}
                  onBlur={() => setRefund(formatCurrencyInput(refund))}
                />
                <small>
                  Limitado ao valor do pedido: {money(order.value)}.
                </small>
              </label>
            )}
            <label>
              Custo adicional para resolver o problema (R$) — opcional
              <input
                type="text"
                inputMode="decimal"
                placeholder="Ex.: R$ 15,00 de novo frete. Se desconhecido, deixe em branco."
                value={cost}
                onChange={(e) => setCost(e.target.value)}
                onBlur={() => setCost(formatCurrencyInput(cost))}
              />
            </label>
            {cost !== "" && (
              <label>
                Origem do custo
                <select value={kind} onChange={(e) => setKind(e.target.value)}>
                  <option value="estimated">
                    Estimativa, ainda não confirmada
                  </option>
                  <option value="declared">Informado pelo operador</option>
                </select>
              </label>
            )}
            <p>
              Registre despesas adicionais, como novo frete ou reprodução do
              item. Não inclua o valor original do pedido nem o reembolso, que
              tem campo próprio. Se não houve custo adicional, informe R$ 0,00;
              se você não sabe o valor, deixe em branco.
            </p>
          </>
        )}
        <label>
          {review ? "Como o status foi validado?" : "Registro da tratativa"}
          <textarea
            required
            minLength={10}
            maxLength={1200}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={
              review
                ? "Descreva a fonte consultada e por que o status escolhido é o correto. Informe a referência do registro, sem dados pessoais."
                : order.resolution
                  ? "Explique por que o pedido precisa ser reaberto e qual pendência voltou a ocorrer."
                  : "Resuma como o problema foi resolvido. Ex.: endereço validado, correção registrada no sistema e pedido liberado para seguir o atendimento."
            }
          />
        </label>
        {error && <p role="alert">{error}</p>}
        {action === "resolve" && !canResolve && (
          <p>
            Primeiro registre a execução de uma tarefa que trate a exceção.
            Revisar o status ou aprovar uma proposta não basta.
          </p>
        )}
        <Button
          disabled={disabled || busy || (action === "resolve" && !canResolve)}
        >
          {busy
            ? "Salvando…"
            : review
              ? "Confirmar status"
              : order.resolution
                ? "Reabrir com justificativa"
                : "Confirmar resultado e encerrar"}
        </Button>
      </form>
    </section>
  );
}
