"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type {
  Insight,
  RankedOrder,
  Task,
  ProcessConclusion,
} from "@/domain/types";
import { exceptionLabels } from "@/domain/types";
import {
  generatedTextLabel,
  insightGroupLabel,
  shortDate,
  statusLabel,
  taskFactLabel,
} from "@/lib/utils";
import { paginate } from "@/lib/pagination";
import { Expandable } from "./ui/expandable";
import { Pagination } from "./ui/pagination";
import { Button } from "./ui/button";

const resultLabels = {
  confirmada: "Hipótese sustentada pelas evidências",
  descartada: "Hipótese descartada",
  inconclusiva: "Verificação encerrada sem confirmação",
};
export function RecurrenceInvestigation({
  task,
  pattern,
  orders,
  onSaved,
  onDirtyChange,
  onBusyChange,
}: {
  task: Task;
  pattern?: Insight;
  orders: RankedOrder[];
  onSaved: () => Promise<void>;
  onDirtyChange: (dirty: boolean) => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const initial = task.processProgress;
  const [observations, setObservations] = useState(initial?.observations || "");
  const [nextStep, setNextStep] = useState(initial?.nextStep || "");
  const [ids, setIds] = useState<string[]>(initial?.evidenceIds || []);
  const [outcome, setOutcome] = useState<ProcessConclusion["outcome"] | "">(
    initial?.outcome || "",
  );
  const [version, setVersion] = useState(task.updatedAt);
  const [savedAt, setSavedAt] = useState(initial?.at);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(5);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const form = useRef<HTMLFormElement>(null);
  const sample = useRef<HTMLElement>(null);
  const overview = useRef<HTMLElement>(null);
  const recordSection = useRef<HTMLElement>(null);
  const savedFeedback = useRef<HTMLParagraphElement>(null);
  const errorFeedback = useRef<HTMLParagraphElement>(null);
  const conclusionSection = useRef<HTMLElement>(null);
  useEffect(() => {
    if (notice) savedFeedback.current?.focus();
  }, [notice]);
  useEffect(() => {
    if (error) errorFeedback.current?.focus();
  }, [error]);
  useEffect(() => {
    if (task.conclusion) conclusionSection.current?.focus();
  }, [task.conclusion?.at]);
  function goTo(target: HTMLElement | null) {
    target?.focus({ preventScroll: true });
    target?.scrollIntoView({
      block: "start",
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
  }
  const draft = {
    observations,
    nextStep,
    evidenceIds: ids,
    ...(outcome ? { outcome } : {}),
  };
  const [saved, setSaved] = useState(JSON.stringify(draft));
  const dirty = !task.conclusion && JSON.stringify(draft) !== saved;
  useEffect(() => {
    onDirtyChange(dirty);
  }, [dirty, onDirtyChange]);
  useEffect(() => {
    onBusyChange(busy);
  }, [busy, onBusyChange]);
  useEffect(
    () => () => {
      onDirtyChange(false);
      onBusyChange(false);
    },
    [onDirtyChange, onBusyChange],
  );
  const related = useMemo(() => {
    const byId = new Map(orders.map((order) => [order.id, order]));
    const allIds = [
      ...new Set([...task.evidenceIds, ...(task.affectedOrderIds || [])]),
    ];
    return allIds.flatMap((id) => (byId.has(id) ? [byId.get(id)!] : []));
  }, [orders, task.evidenceIds, task.affectedOrderIds]);
  const filtered = related.filter((order) =>
    `${order.id} ${order.brand} ${order.product}`
      .toLocaleLowerCase("pt-BR")
      .includes(query.trim().toLocaleLowerCase("pt-BR")),
  );
  const view = paginate(filtered, page, size);
  const changePage = (next: number) => {
    setPage(next);
    sample.current?.focus({ preventScroll: true });
    sample.current?.scrollIntoView({
      block: "start",
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
  };
  async function save(conclude: boolean) {
    if (busy) return;
    setError("");
    setNotice("");
    if (conclude && ids.length < 2) {
      setError(
        "Confira e marque pelo menos dois pedidos para concluir. Você pode salvar o progresso com uma conferência parcial.",
      );
      sample.current?.focus();
      return;
    }
    if (conclude && (!outcome || observations.trim().length < 20)) {
      setError(
        "Para concluir, escolha o resultado, descreva o que foi verificado (mínimo de 20 caracteres) e descreva o que foi verificado.",
      );
      form.current?.reportValidity();
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          conclude
            ? {
                id: task.id,
                status: "concluida",
                expectedUpdatedAt: version,
                conclusion: draft,
              }
            : {
                id: task.id,
                action: "save_process_progress",
                expectedUpdatedAt: version,
                progress: draft,
              },
        ),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(
          result.error || "Não foi possível salvar a investigação.",
        );
      setVersion(result.updatedAt);
      setSavedAt(result.processProgress?.at);
      setSaved(JSON.stringify(draft));
      setNotice(
        conclude
          ? "Conclusão registrada. Os pedidos continuam com suas tratativas individuais."
          : "Progresso salvo. A investigação continua aberta em Pendências.",
      );
      await onSaved();
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="recurrence-workspace" aria-busy={busy}>
      {!task.conclusion && (
        <nav
          className="recurrence-step-nav"
          aria-label="Atalhos da investigação"
        >
          <Button
            type="button"
            variant="outline"
            onClick={() => goTo(overview.current)}
          >
            Orientação
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => goTo(sample.current)}
          >
            1. Pedidos
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => goTo(recordSection.current)}
          >
            2. Registro
          </Button>
        </nav>
      )}
      <section
        ref={overview}
        tabIndex={-1}
        className="recurrence-overview"
        aria-label="Objetivo da investigação"
      >
        <div className="signal-badges">
          <span className="badge">
            {task.conclusion
              ? "Conclusão registrada"
              : savedAt
                ? "Em verificação"
                : "Aguardando verificação"}
          </span>
          <span className="badge">{task.area}</span>
        </div>
        <dl className="recurrence-summary">
          <div>
            <dt>Grupo investigado</dt>
            <dd>
              {pattern
                ? insightGroupLabel(pattern.group)
                : "Pedidos relacionados"}
            </dd>
          </div>
          <div>
            <dt>Casos relacionados</dt>
            <dd>{pattern?.count ?? related.length}</dd>
          </div>
        </dl>
        <div className="agent-hypothesis">
          <strong>Hipótese do agente — a validar</strong>
          <p>
            {generatedTextLabel(
              task.justification.replace(/^Hipótese do agente:\s*/i, ""),
            )}
          </p>
        </div>
        {task.nextStep && (
          <div className="recurrence-check">
            <h3>O que verificar na operação</h3>
            <p>{generatedTextLabel(task.nextStep)}</p>
          </div>
        )}
        <Expandable>
          <summary>Dados usados pelo agente</summary>
          {task.facts?.map((fact) => (
            <p key={fact}>{taskFactLabel(fact)}</p>
          ))}
        </Expandable>
      </section>
      {task.conclusion ? (
        <section
          className="recurrence-section"
          aria-label="Conclusão da equipe"
          ref={conclusionSection}
          tabIndex={-1}
        >
          <h3>Conclusão da equipe</h3>
          <span className="badge">{resultLabels[task.conclusion.outcome]}</span>
          <dl className="resolved-details">
            <div>
              <dt>O que foi verificado</dt>
              <dd>{task.conclusion.observations}</dd>
            </div>
            <div>
              <dt>Próxima verificação ou recomendação — opcional</dt>
              <dd>{task.conclusion.nextStep || "Não informada"}</dd>
            </div>
            <div>
              <dt>Pedidos conferidos</dt>
              <dd>{task.conclusion.evidenceIds.join(", ")}</dd>
            </div>
          </dl>
          {task.conclusion.at && (
            <p className="muted">
              Registrada em{" "}
              {new Date(task.conclusion.at).toLocaleString("pt-BR")}
            </p>
          )}
          <p className="muted">
            Esta conclusão encerra a investigação, sem encerrar pedidos ou
            comprovar a implantação de uma melhoria.
          </p>
        </section>
      ) : (
        <>
          <section
            className="recurrence-section recurrence-sample"
            ref={sample}
            tabIndex={-1}
            aria-label="Pedidos para conferir"
          >
            <header className="recurrence-section-heading">
              <h3>1. Confira os pedidos</h3>
              <span className="badge" aria-live="polite">
                {ids.length} de no mínimo 2 conferidos
              </span>
            </header>
            <p>
              Comece pelas referências do agente. Consulte os dados abaixo e
              confira os registros da operação antes de marcar um pedido.
            </p>
            <label className="recurrence-search">
              Buscar nos {related.length} pedidos relacionados
              <input
                type="search"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setPage(1);
                }}
                placeholder="Código, marca ou produto"
                disabled={busy}
              />
            </label>
            <div className="recurrence-order-list">
              {view.items.map((order) => (
                <article
                  className={`recurrence-order ${ids.includes(order.id) ? "is-checked" : ""}`}
                  key={order.id}
                >
                  <div className="recurrence-order-heading">
                    <div>
                      <strong>{order.id}</strong>
                      <p>
                        {order.brand} · {order.product}
                      </p>
                    </div>
                    {task.evidenceIds.includes(order.id) && (
                      <span className="badge">Referência do agente</span>
                    )}
                  </div>
                  <Expandable>
                    <summary>Consultar dados deste pedido</summary>
                    <dl className="recurrence-order-facts">
                      <div>
                        <dt>Problema</dt>
                        <dd>{exceptionLabels[order.exception]}</dd>
                      </div>
                      <div>
                        <dt>Status</dt>
                        <dd>{statusLabel(order.status)}</dd>
                      </div>
                      <div>
                        <dt>Exceção aberta</dt>
                        <dd>{shortDate(order.openedAt)}</dd>
                      </div>
                      <div>
                        <dt>Entrega prometida</dt>
                        <dd>{shortDate(order.promisedAt)}</dd>
                      </div>
                      <div>
                        <dt>Entrega registrada</dt>
                        <dd>
                          {order.deliveredAt
                            ? shortDate(order.deliveredAt)
                            : "Não registrada"}
                        </dd>
                      </div>
                      <div>
                        <dt>Transportadora / UF</dt>
                        <dd>
                          {order.carrier} / {order.state}
                        </dd>
                      </div>
                      <div>
                        <dt>CD e turno</dt>
                        <dd>
                          {order.dc} · {order.shift}
                        </dd>
                      </div>
                      <div>
                        <dt>Máquina e lote</dt>
                        <dd>
                          {order.machine || "Não informada"} ·{" "}
                          {order.lot || "Não informado"}
                        </dd>
                      </div>
                    </dl>
                    {order.issues.map((issue) => (
                      <p key={issue.code}>{generatedTextLabel(issue.detail)}</p>
                    ))}
                  </Expandable>
                  <label className="check-label">
                    <input
                      type="checkbox"
                      disabled={
                        busy || (!ids.includes(order.id) && ids.length >= 20)
                      }
                      checked={ids.includes(order.id)}
                      onChange={(event) => {
                        setIds((previous) =>
                          event.target.checked
                            ? [...previous, order.id]
                            : previous.filter((id) => id !== order.id),
                        );
                        setNotice("");
                      }}
                    />
                    Conferi os dados e as referências do pedido {order.id}
                  </label>
                </article>
              ))}
              {!view.total && (
                <p className="workspace-empty">
                  Nenhum pedido encontrado. Ajuste a busca.
                </p>
              )}
            </div>
            {ids.length > 0 && (
              <p className="muted">
                Marcados nesta investigação: {ids.join(", ")}. A seleção é
                mantida ao trocar de página.
              </p>
            )}
            {ids.length >= 20 && (
              <p className="muted">
                Limite de 20 referências selecionadas para esta conclusão.
              </p>
            )}
            <Pagination
              {...view}
              noun={view.total === 1 ? "pedido" : "pedidos"}
              pageSize={size}
              sizes={[5, 10, 20]}
              onPage={changePage}
              onPageSize={(next) => {
                setSize(next);
                changePage(1);
              }}
            />
          </section>
          <section
            className="recurrence-section"
            ref={recordSection}
            tabIndex={-1}
          >
            <h3>2. Registre o que encontrou</h3>
            <p>
              Salve as verificações parciais para continuar depois. Conclua
              apenas quando tiver um resultado para esta rodada.
            </p>
            <form
              className="guided-form"
              ref={form}
              onSubmit={(event) => {
                event.preventDefault();
                void save(true);
              }}
            >
              <fieldset disabled={busy} className="recurrence-form-fields">
                <label>
                  O que você verificou?
                  <textarea
                    required
                    minLength={20}
                    maxLength={2000}
                    value={observations}
                    onChange={(event) => {
                      setObservations(event.target.value);
                      setNotice("");
                    }}
                    placeholder="Ex.: conferi os romaneios dos pedidos marcados e encontrei divergência na conferência dos itens. Referência: registro de separação ou protocolo interno, sem dados pessoais."
                  />
                </label>
                <label>
                  Próxima verificação ou recomendação — opcional
                  <textarea
                    maxLength={1500}
                    value={nextStep}
                    onChange={(event) => {
                      setNextStep(event.target.value);
                      setNotice("");
                    }}
                    placeholder="Se houver algo a verificar depois, registre sua recomendação. Ex.: comparar os romaneios com a conferência do próximo turno."
                  />
                </label>
                <label>
                  Resultado desta verificação
                  <select
                    required
                    value={outcome}
                    onChange={(event) => {
                      setOutcome(event.target.value as typeof outcome);
                      setNotice("");
                    }}
                  >
                    <option value="">Selecione o resultado</option>
                    <option value="confirmada">Hipótese sustentada</option>
                    <option value="descartada">Hipótese descartada</option>
                    <option value="inconclusiva">Sem confirmação</option>
                  </select>
                </label>
                {outcome === "confirmada" && (
                  <p className="muted">
                    Registre nas observações quais evidências sustentam a
                    hipótese. Isso não comprova que uma melhoria já foi
                    implantada.
                  </p>
                )}
                {outcome === "descartada" && (
                  <p className="muted">
                    Explique nas observações por que a hipótese foi descartada e
                    indique o que investigar em seguida.
                  </p>
                )}
                {outcome === "inconclusiva" && (
                  <p className="muted">
                    Se ainda pretende continuar as verificações, use “Salvar
                    progresso”. Concluir como inconclusiva encerra esta rodada
                    de investigação.
                  </p>
                )}
              </fieldset>
              {error && (
                <p
                  className="alert alert-error"
                  role="alert"
                  ref={errorFeedback}
                  tabIndex={-1}
                >
                  {generatedTextLabel(error)}
                </p>
              )}
              {notice && (
                <p
                  className="alert alert-info"
                  role="status"
                  ref={savedFeedback}
                  tabIndex={-1}
                >
                  {notice}
                </p>
              )}
              <div className="recurrence-save-bar">
                <div>
                  <strong>
                    {dirty
                      ? "Alterações ainda não salvas"
                      : savedAt
                        ? "Progresso salvo"
                        : "Verificação ainda não registrada"}
                  </strong>
                  {savedAt && (
                    <small>
                      Último salvamento:{" "}
                      {new Date(savedAt).toLocaleString("pt-BR")}
                    </small>
                  )}
                </div>
                <div className="task-actions">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busy || !dirty}
                    onClick={() => void save(false)}
                  >
                    {busy ? "Salvando…" : "Salvar progresso"}
                  </Button>
                  <Button type="submit" disabled={busy}>
                    Registrar conclusão
                  </Button>
                </div>
              </div>
              <p className="muted">
                Salvar progresso mantém a investigação em Pendências. Registrar
                a conclusão exige dois pedidos conferidos, resultado e
                observações; não encerra os pedidos relacionados.
              </p>
            </form>
          </section>
        </>
      )}
    </div>
  );
}
