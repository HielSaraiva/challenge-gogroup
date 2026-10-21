"use client";
import { FormField, ValidatedForm } from "./ui/form";
import { useDraftGuard } from "./hooks/form-safety";
import { currentCaseTasks, latestReopen } from "@/domain/case-cycle";
import { generatedTextLabel } from "@/lib/utils";
import { useState } from "react";
import { Button } from "./ui/button";
import { outcomeLabels } from "@/domain/cases";
import type { RankedOrder, Task } from "@/domain/types";
import {
  ResolutionFields,
  emptyResolution,
  resolutionPayload,
} from "./resolution-fields";
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
  const [status, setStatus] = useState(order.sourceStatuses[0]);
  const [draft, setDraft] = useState(emptyResolution);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const { committed, markSaved } = useDraftGuard(
    { note, status, draft },
    busy,
    JSON.stringify([order.status, order.resolution, order.caseHistory]),
  );
  const review = order.status === "status_divergente";
  const action = order.resolution
    ? "reopen"
    : review
      ? "review_status"
      : "resolve";
  const related = currentCaseTasks(order, tasks);
  const lastReopen = latestReopen(order.caseHistory);
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
  const lastExecutionTask = [...related]
    .filter(
      (task) =>
        task.status === "concluida" &&
        task.kind !== "revisao_status" &&
        task.execution &&
        (!lastReopen ||
          Boolean(task.execution.at && task.execution.at >= lastReopen.at)),
    )
    .sort((a, b) =>
      (b.execution?.at || "").localeCompare(a.execution?.at || ""),
    )[0];
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || committed) return;
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          orderId: order.id,
          note:
            action === "resolve"
              ? lastExecutionTask!.execution!.note.slice(0, 1200)
              : note,
          ...(review ? { status } : {}),
          ...(action === "resolve"
            ? {
                outcome: resolutionPayload(draft, {
                  taskId: lastExecutionTask!.id,
                  evidence: lastExecutionTask!.execution!.evidence,
                }),
              }
            : {}),
        }),
      });
      const b = await r.json();
      if (!r.ok) throw new Error(b.error);
      markSaved();
      setNotice("Registro salvo com sucesso.");
      await onSaved();
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
          {lastReopen
            ? "Este pedido foi reaberto. Para encerrar novamente, investigue"
            : "Para encerrar, primeiro investigue"}{" "}
          o pedido com IA, execute a tarefa sugerida e registre a evidência.{" "}
          {related.length
            ? "Confira as tarefas acima para saber o que ainda falta concluir."
            : lastReopen
              ? "Comece pelo botão “Investigar pedido reaberto com IA”."
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
        <>
          <p className="muted">
            A reabertura inicia uma nova etapa. Os registros anteriores serão
            preservados; será necessária uma nova investigação e execução para
            encerrar novamente.
          </p>
          <p>
            {order.resolution.outcome
              ? outcomeLabels[order.resolution.outcome.type]
              : "Encerramento sem tipo de solução registrado"}
            : {order.resolution.note}
          </p>
        </>
      )}
      {notice && <p role="status">{notice}</p>}
      <ValidatedForm onSubmit={submit} className="guided-form">
        {review && (
          <FormField>
            Status confirmado
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              {order.sourceStatuses.map((s) => (
                <option key={s} value={s}>
                  {statusLabel(s)}
                </option>
              ))}
            </select>
          </FormField>
        )}
        {action === "resolve" && lastExecutionTask && (
          <>
            <div className="reused-evidence">
              <strong>Execução já registrada</strong>
              <p>{lastExecutionTask.execution!.note}</p>
              <strong>Evidência da execução</strong>
              <p>{lastExecutionTask.execution!.evidence}</p>
            </div>
            <p>
              {lastExecutionTask.execution?.stage === "dispatched"
                ? "O despacho já foi registrado. Aguarde o recebimento e informe a confirmação complementar para encerrar."
                : "Falta apenas confirmar o resultado."}{" "}
              Não é necessário descrever a ação novamente.
            </p>
            <ResolutionFields
              order={order}
              requiredOutcome={
                lastExecutionTask.kind === "proposta_reembolso"
                  ? "reembolso_registrado"
                  : undefined
              }
              value={draft}
              onChange={setDraft}
              executionEvidence={lastExecutionTask.execution!.evidence}
              executionStage={lastExecutionTask.execution!.stage}
            />
          </>
        )}
        {action !== "resolve" && (
          <FormField>
            {review ? "Como o status foi validado?" : "Motivo da reabertura"}
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
          </FormField>
        )}
        {error && <p role="alert">{generatedTextLabel(error)}</p>}
        {action === "resolve" && !canResolve && (
          <p>
            Primeiro registre a execução de uma tarefa que trate a exceção.
            Revisar o status ou aprovar uma proposta não basta.
          </p>
        )}
        <Button
          disabled={
            disabled ||
            busy ||
            committed ||
            (action === "resolve" && !canResolve)
          }
        >
          {busy
            ? "Salvando…"
            : review
              ? "Confirmar status"
              : order.resolution
                ? "Reabrir com justificativa"
                : "Confirmar resultado e encerrar"}
        </Button>
      </ValidatedForm>
    </section>
  );
}
