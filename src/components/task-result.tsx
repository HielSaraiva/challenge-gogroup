"use client";
import { useDraftGuard } from "./hooks/form-safety";
import { taskGuidance } from "@/domain/task-guidance";
import { currentCaseTasks } from "@/domain/case-cycle";
import { Expandable } from "./ui/expandable";
import { useState } from "react";
import type { Task, RankedOrder } from "@/domain/types";
import {
  shortDate,
  statusLabel,
  taskFactLabel,
  generatedTextLabel,
} from "@/lib/utils";
import { CircleCheck } from "lucide-react";
import {
  ResolutionFields,
  emptyResolution,
  resolutionPayload,
} from "./resolution-fields";
import { Button } from "./ui/button";
export function TaskResult({
  task,
  orders,
  tasks,
  onSaved,
}: {
  task: Task;
  orders: RankedOrder[];
  tasks: Task[];
  onSaved: () => Promise<void>;
}) {
  const [note, setNote] = useState("");
  const [evidence, setEvidence] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [resolvedAnswer, setResolvedAnswer] = useState("");
  const [resolution, setResolution] = useState(emptyResolution);
  const [stage, setStage] = useState<"" | "dispatched" | "received">("");
  const [rejecting, setRejecting] = useState(false);
  const [rejectionNote, setRejectionNote] = useState("");
  const { committed, markSaved } = useDraftGuard(
    {
      note,
      evidence,
      resolvedAnswer,
      resolution,
      stage,
      rejectionNote,
    },
    busy,
    task.updatedAt,
  );
  const [notice, setNotice] = useState("");
  const resend = task.kind === "proposta_reenvio";
  const guidance = taskGuidance[task.kind];
  const order = orders.find((order) => order.id === task.orderId);
  const editable =
    task.scope !== "process" && Boolean(order && !order.resolution);
  const canCloseWithExecution = Boolean(
    order &&
    !order.resolution &&
    order.status !== "status_divergente" &&
    task.kind !== "revisao_status" &&
    !(resend && stage !== "received") &&
    !currentCaseTasks(order!, tasks).some(
      (other) =>
        other.id !== task.id &&
        other.scope !== "process" &&
        other.orderId === task.orderId &&
        ["aberta", "aprovada", "pendente_aprovacao"].includes(other.status),
    ),
  );
  async function save(status: string) {
    if (busy || committed) return;
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: task.id,
          status,
          ...(status === "rejeitada"
            ? { rejection: { note: rejectionNote } }
            : {}),
          ...(status === "concluida"
            ? { execution: { note, evidence, ...(resend ? { stage } : {}) } }
            : {}),
          ...(status === "concluida" &&
          task.scope !== "process" &&
          resolvedAnswer === "yes" &&
          order
            ? {
                resolution: resolutionPayload(resolution, {
                  taskId: task.id,
                  evidence,
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
  return (
    <article className="panel prose task-result">
      {notice && <p role="status">{notice}</p>}
      <span className="badge">
        {task.area} · {statusLabel(task.status)}
      </span>
      <h3>{generatedTextLabel(task.title)}</h3>
      <p>
        <b>Área responsável:</b> {task.area} · Prazo de referência:{" "}
        {shortDate(task.dueAt)}
      </p>
      <div className="agent-hypothesis">
        <strong>Hipótese do agente</strong>
        <p>
          {generatedTextLabel(
            task.justification.replace(/^Hipótese do agente:\s*/i, ""),
          )}
        </p>
      </div>
      {editable && task.scope !== "process" && (
        <p className="case-next-step">{guidance.reminder}</p>
      )}
      {task.kind === "revisao_status" && task.status !== "concluida" && (
        <p>
          Use “Validar o status antes de continuar”, abaixo. A confirmação será
          registrada nesta tarefa sem repetir o preenchimento.
        </p>
      )}
      {task.nextStep && (
        <p>
          <b>
            {order?.resolution
              ? "Orientação registrada:"
              : "Verificação necessária:"}
          </b>{" "}
          {generatedTextLabel(task.nextStep)}
        </p>
      )}
      <Expandable>
        <summary>Fatos consultados pelo agente</summary>
        {task.facts?.map((f) => (
          <p key={f}>{taskFactLabel(f)}</p>
        ))}
      </Expandable>
      {task.approval && (
        <p className="muted">
          Proposta aprovada em{" "}
          {new Date(task.approval.at).toLocaleString("pt-BR")}. A aprovação não
          representa execução.
        </p>
      )}
      {editable && task.status === "pendente_aprovacao" && (
        <div className="task-actions">
          <Button
            disabled={busy || committed}
            onClick={() => void save("aprovada")}
          >
            {resend
              ? "Aprovar proposta de reenvio"
              : "Aprovar proposta de reembolso"}
          </Button>
          <Button
            variant="outline"
            disabled={busy || committed}
            onClick={() => setRejecting(true)}
          >
            Rejeitar proposta
          </Button>
          <p>
            Nenhum produto será enviado e nenhum pagamento será feito
            automaticamente. A aprovação apenas libera o registro da ação
            realizada fora da demonstração.
          </p>
          {rejecting && (
            <form
              className="guided-form"
              onSubmit={(event) => {
                event.preventDefault();
                void save("rejeitada");
              }}
            >
              <label>
                Por que esta proposta foi rejeitada?
                <textarea
                  required
                  minLength={15}
                  maxLength={1200}
                  value={rejectionNote}
                  onChange={(event) => setRejectionNote(event.target.value)}
                  placeholder="Ex.: item indisponível para reenvio; avaliar outra solução com o responsável."
                />
              </label>
              <p>
                O pedido permanece aberto. O motivo ficará registrado para
                orientar a próxima investigação.
              </p>
              <div className="task-actions">
                <Button disabled={busy || committed}>Confirmar rejeição</Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy || committed}
                  onClick={() => setRejecting(false)}
                >
                  Cancelar
                </Button>
              </div>
            </form>
          )}
        </div>
      )}
      {task.status === "rejeitada" && (
        <section className="reused-evidence">
          <strong>
            {order?.resolution
              ? "Proposta rejeitada"
              : "Proposta rejeitada — pedido permanece aberto"}
          </strong>
          <p>
            {task.rejection?.note ||
              "Este registro antigo não informa o motivo da rejeição."}
          </p>
          <p>
            {order?.resolution
              ? "A decisão anterior foi preservada. O resultado do pedido está registrado abaixo."
              : "Solicite outra investigação para avaliar a próxima tratativa. Esta proposta não comprova execução nem resolução."}
          </p>
        </section>
      )}
      {editable &&
        task.kind !== "revisao_status" &&
        (["aberta", "aprovada"].includes(task.status) ||
          (task.status === "concluida" && !task.execution)) && (
          <form
            className="guided-form"
            onSubmit={(e) => {
              e.preventDefault();
              void save("concluida");
            }}
          >
            <>
              <h4>
                {resend
                  ? "Registrar reenvio realizado"
                  : "O que foi executado fora da demonstração?"}
              </h4>
              {resend && (
                <label>
                  Em que etapa está o reenvio?
                  <select
                    required
                    value={stage}
                    onChange={(event) => {
                      setStage(event.target.value as typeof stage);
                      setResolvedAnswer(
                        event.target.value === "dispatched" ? "no" : "",
                      );
                      setResolution(emptyResolution);
                    }}
                  >
                    <option value="">Selecione a etapa confirmada</option>
                    <option value="dispatched">
                      Despachado — aguardando recebimento
                    </option>
                    <option value="received">Recebimento confirmado</option>
                  </select>
                </label>
              )}
              <label>
                Ação realizada
                <textarea
                  required
                  minLength={15}
                  maxLength={1500}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={guidance.action}
                />
              </label>
              <label>
                Evidência ou referência da execução
                <textarea
                  required
                  minLength={15}
                  maxLength={1500}
                  value={evidence}
                  onChange={(e) => setEvidence(e.target.value)}
                  placeholder={`${guidance.evidence} Não inclua dados pessoais.`}
                />
              </label>
              <fieldset
                className="execution-outcome"
                disabled={busy || committed || (resend && stage !== "received")}
              >
                <legend>
                  A ação realizada resolveu a pendência deste pedido?
                </legend>
                <label>
                  <input
                    type="radio"
                    name={`execution-outcome-${task.id}`}
                    value="no"
                    required
                    checked={resolvedAnswer === "no"}
                    onChange={() => setResolvedAnswer("no")}
                  />
                  <span>
                    <strong>Ainda não</strong>
                    <span>Registrar execução e manter o pedido aberto.</span>
                  </span>
                </label>
                <label>
                  <input
                    type="radio"
                    name={`execution-outcome-${task.id}`}
                    value="yes"
                    required
                    disabled={!canCloseWithExecution}
                    checked={resolvedAnswer === "yes"}
                    onChange={() => setResolvedAnswer("yes")}
                  />
                  <span>
                    <strong>Sim</strong>
                    <span>Registrar execução e encerrar o pedido.</span>
                  </span>
                </label>
              </fieldset>
              {resend && stage === "dispatched" && (
                <p className="muted">
                  O despacho será registrado sem encerrar. Quando o recebimento
                  for confirmado, registre apenas a evidência complementar no
                  resultado do pedido.
                </p>
              )}
              {!canCloseWithExecution && !(resend && stage !== "received") && (
                <p className="muted">
                  Registre esta execução sem encerrar o pedido. Antes de
                  confirmar a resolução, é necessário concluir as demais
                  pendências e validar eventuais conflitos de status.
                </p>
              )}
              {resolvedAnswer === "yes" && canCloseWithExecution && order && (
                <ResolutionFields
                  order={order}
                  value={resolution}
                  onChange={setResolution}
                  executionEvidence={evidence}
                  executionStage={resend ? stage || undefined : undefined}
                />
              )}
            </>
            {error && <p role="alert">{generatedTextLabel(error)}</p>}
            <Button disabled={busy || committed}>
              {busy
                ? "Salvando…"
                : resend && stage === "dispatched"
                  ? "Registrar despacho e aguardar recebimento"
                  : resolvedAnswer === "yes"
                    ? "Registrar execução e encerrar pedido"
                    : "Registrar execução e manter aberto"}
            </Button>
          </form>
        )}
      {task.status === "concluida" && (
        <section
          className="task-execution-record"
          aria-label="Registro de conclusão da tarefa"
        >
          <header className="task-execution-header">
            <CircleCheck size={20} aria-hidden="true" />
            <h4>
              {task.execution
                ? task.execution.stage === "dispatched"
                  ? order?.resolution
                    ? "Despacho registrado"
                    : "Despacho registrado — aguardando recebimento"
                  : task.execution.stage === "received"
                    ? "Recebimento confirmado na execução"
                    : "Execução registrada"
                : "Conclusão legada, sem evidência estruturada"}
            </h4>
            {task.execution?.at && (
              <time dateTime={task.execution?.at}>
                {new Date((task.execution?.at)!).toLocaleString("pt-BR")}
              </time>
            )}
          </header>
          <p className="task-execution-description">
            {task.execution
              ? "Execução informada pelo operador. A ação foi realizada fora da aplicação."
              : "Este registro antigo não contém os dados de execução exigidos na versão atual."}
          </p>
          <dl className="task-execution-fields">
            {task.execution && (
              <>
                <div>
                  <dt>Ação realizada</dt>
                  <dd>{task.execution.note}</dd>
                </div>
                <div>
                  <dt>Evidência ou referência</dt>
                  <dd>{task.execution.evidence}</dd>
                </div>
              </>
            )}
          </dl>
        </section>
      )}
      {error && task.status === "pendente_aprovacao" && (
        <p role="alert">{generatedTextLabel(error)}</p>
      )}
    </article>
  );
}
