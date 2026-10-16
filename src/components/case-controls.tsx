"use client";
import { useState } from "react";
import { Button } from "./ui/button";
import { allowedOutcomes, outcomeLabels } from "@/domain/cases";
import type { RankedOrder, Task, ResolutionOutcome } from "@/domain/types";
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
                  ...(type === "reembolso_registrado" ? { refund } : {}),
                  ...(cost !== "" ? { cost: { amount: cost, kind } } : {}),
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
  return (
    <section className="panel prose">
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
                <option key={s}>{s}</option>
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
                placeholder="Descreva a confirmação e informe a referência consultada, sem dados pessoais."
              />
            </label>
            {type === "reembolso_registrado" && (
              <label>
                Reembolso registrado (R$)
                <input
                  required
                  type="number"
                  min="0.01"
                  max={order.value}
                  step="0.01"
                  value={refund}
                  onChange={(e) => setRefund(e.target.value)}
                />
              </label>
            )}
            <label>
              Custo desta tratativa (R$), se conhecido
              <input
                type="number"
                min="0"
                max="9999999"
                step="0.01"
                placeholder="Não informado"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
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
              Corrigir um endereço pode resolver a exceção sem reembolso. Deixe
              valores desconhecidos em branco; eles não serão registrados como
              zero.
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
