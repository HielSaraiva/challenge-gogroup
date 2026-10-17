"use client";
import { Expandable } from "./ui/expandable";
import { useState } from "react";
import type { Task, RankedOrder } from "@/domain/types";
import { shortDate, statusLabel } from "@/lib/utils";
import { CircleCheck } from "lucide-react";
import { Button } from "./ui/button";
import { exceptionLabels } from "@/domain/types";
export function TaskResult({
  task,
  orders,
  onSaved,
}: {
  task: Task;
  orders: RankedOrder[];
  onSaved: () => Promise<void>;
}) {
  const [note, setNote] = useState("");
  const [evidence, setEvidence] = useState("");
  const [outcome, setOutcome] = useState("inconclusiva");
  const [ids, setIds] = useState<string[]>([]);
  const [next, setNext] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function save(status: string) {
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: task.id,
          status,
          ...(status === "concluida"
            ? task.scope === "process"
              ? {
                  conclusion: {
                    outcome,
                    observations: note,
                    evidenceIds: ids,
                    nextStep: next,
                  },
                }
              : { execution: { note, evidence } }
            : {}),
        }),
      });
      const b = await r.json();
      if (!r.ok) throw new Error(b.error);
      await onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <article className="panel prose task-result">
      <span className="badge">
        {task.scope === "process" ? "Investigação de recorrência" : task.area} ·{" "}
        {statusLabel(task.status)}
      </span>
      <h3>{task.title}</h3>
      <p>
        <b>Área responsável:</b> {task.area} · Prazo de referência:{" "}
        {shortDate(task.dueAt)}
      </p>
      <div className="agent-hypothesis">
        <strong>Hipótese do agente</strong>
        <p>{task.justification.replace(/^Hipótese do agente:\s*/i, "")}</p>
      </div>
      {task.nextStep && (
        <p>
          <b>Verificação necessária:</b> {task.nextStep}
        </p>
      )}
      <Expandable>
        <summary>Fatos consultados pelo agente</summary>
        {task.facts?.map((f) => (
          <p key={f}>{f}</p>
        ))}
      </Expandable>
      {task.status === "pendente_aprovacao" && (
        <div className="task-actions">
          <Button disabled={busy} onClick={() => void save("aprovada")}>
            Aprovar encaminhamento
          </Button>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => void save("rejeitada")}
          >
            Rejeitar proposta
          </Button>
          <p>
            A aprovação não executa reenvio ou pagamento. Depois, registre o que
            foi realizado.
          </p>
        </div>
      )}
      {(["aberta", "aprovada"].includes(task.status) ||
        (task.status === "concluida" &&
          (task.scope === "process" ? !task.conclusion : !task.execution))) && (
        <form
          className="guided-form"
          onSubmit={(e) => {
            e.preventDefault();
            void save("concluida");
          }}
        >
          {task.scope === "process" ? (
            <>
              <h4>Confira a amostra e documente a conclusão</h4>
              <p>
                Esta investigação verifica uma hipótese sobre o grupo. Não
                encerra os pedidos nem comprova implantação da melhoria.
              </p>
              <fieldset>
                <legend>Pedidos relacionados conferidos (ao menos dois)</legend>
                {(task.affectedOrderIds || []).slice(0, 20).map((id) => {
                  const o = orders.find((o) => o.id === id);
                  return (
                    <div key={id}>
                      <label className="check-label">
                        <input
                          type="checkbox"
                          checked={ids.includes(id)}
                          onChange={(e) =>
                            setIds((v) =>
                              e.target.checked
                                ? [...v, id]
                                : v.filter((x) => x !== id),
                            )
                          }
                        />
                        {id}
                      </label>
                      {o && (
                        <Expandable>
                          <summary>Conferir evidências de {id}</summary>
                          <p>
                            {exceptionLabels[o.exception]} · {o.product} ·{" "}
                            {o.status}
                          </p>
                          <p>
                            Exceção aberta em {o.openedAt}; promessa{" "}
                            {o.promisedAt}; entrega{" "}
                            {o.deliveredAt || "não registrada"}.
                          </p>
                          <p>
                            CD {o.dc}, turno {o.shift}, máquina{" "}
                            {o.machine || "não informada"}, lote {o.lot}.
                          </p>
                        </Expandable>
                      )}
                    </div>
                  );
                })}
              </fieldset>
              <label>
                Conclusão sobre a hipótese
                <select
                  value={outcome}
                  onChange={(e) => setOutcome(e.target.value)}
                >
                  <option value="inconclusiva">Ainda inconclusiva</option>
                  <option value="confirmada">
                    Confirmada pelas verificações registradas
                  </option>
                  <option value="descartada">
                    Descartada pelas verificações registradas
                  </option>
                </select>
              </label>
              <label>
                Observações e referências verificadas
                <textarea
                  required
                  minLength={20}
                  maxLength={2000}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Descreva o que foi verificado nos pedidos relacionados e o que sustenta a conclusão: hipótese confirmada, descartada ou ainda inconclusiva."
                />
              </label>
              <label>
                Encaminhamento registrado
                <textarea
                  required
                  minLength={15}
                  maxLength={1500}
                  value={next}
                  onChange={(e) => setNext(e.target.value)}
                />
              </label>
            </>
          ) : (
            <>
              <h4>O que foi executado fora da demonstração?</h4>
              <label>
                Ação realizada
                <textarea
                  required
                  minLength={15}
                  maxLength={1500}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Descreva o que você fez e o resultado obtido. Ex.: confirmei o endereço com o cliente e registrei a correção no sistema."
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
                  placeholder="Informe onde essa ação pode ser comprovada: número do chamado, protocolo, comprovante ou link do registro. Não inclua nomes, endereços ou outros dados pessoais."
                />
              </label>
            </>
          )}
          {error && <p role="alert">{error}</p>}
          <Button
            disabled={busy || (task.scope === "process" && ids.length < 2)}
          >
            {busy
              ? "Salvando…"
              : task.scope === "process"
                ? "Registrar conclusão da investigação"
                : "Confirmar execução documentada"}
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
              {task.conclusion
                ? "Conclusão documentada"
                : task.execution
                  ? "Execução registrada"
                  : "Conclusão legada, sem evidência estruturada"}
            </h4>
            {(task.execution?.at || task.conclusion?.at) && (
              <time dateTime={task.execution?.at || task.conclusion?.at}>
                {new Date(
                  (task.execution?.at || task.conclusion?.at)!,
                ).toLocaleString("pt-BR")}
              </time>
            )}
          </header>
          <p className="task-execution-description">
            {task.conclusion
              ? "Conclusão informada pela equipe após conferir as evidências."
              : task.execution
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
            {task.conclusion && (
              <>
                <div>
                  <dt>Resultado da hipótese</dt>
                  <dd>
                    {
                      {
                        confirmada: "Confirmada",
                        descartada: "Descartada",
                        inconclusiva: "Inconclusiva",
                      }[task.conclusion.outcome]
                    }
                  </dd>
                </div>
                <div>
                  <dt>O que foi verificado</dt>
                  <dd>{task.conclusion.observations}</dd>
                </div>
                <div>
                  <dt>Próximo encaminhamento</dt>
                  <dd>{task.conclusion.nextStep}</dd>
                </div>
                <div>
                  <dt>Pedidos usados como referência</dt>
                  <dd>{task.conclusion.evidenceIds.join(", ")}</dd>
                </div>
              </>
            )}
          </dl>
        </section>
      )}
      {error && task.status === "pendente_aprovacao" && (
        <p role="alert">{error}</p>
      )}
    </article>
  );
}
