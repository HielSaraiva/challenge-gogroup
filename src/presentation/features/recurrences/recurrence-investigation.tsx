"use client";
import { exceptionLabels } from "@/domain/types";
import { Button } from "@/presentation/shared/ui/button";
import { Expandable } from "@/presentation/shared/ui/expandable";
import { FormField, ValidatedForm } from "@/presentation/shared/ui/form";
import { Pagination } from "@/presentation/shared/ui/pagination";
import {
  generatedTextLabel,
  insightGroupLabel,
  shortDate,
  statusLabel,
  taskFactLabel,
} from "@/shared/formatting";
import {
  useRecurrenceInvestigationViewModel,
  type RecurrenceInvestigationProps,
} from "./use-recurrence-investigation-view-model";
const resultLabels = {
  confirmada: "Hipótese sustentada pelas evidências",
  descartada: "Hipótese descartada",
  inconclusiva: "Verificação encerrada sem confirmação",
};
export function RecurrenceInvestigation({
  task: sourceTask,
  pattern,
  orders,
  onSaved,
  onDirtyChange,
  onBusyChange,
}: RecurrenceInvestigationProps) {
  const {
    task,
    observations,
    setObservations,
    nextStep,
    setNextStep,
    ids,
    setIds,
    outcome,
    setOutcome,
    savedAt,
    query,
    setQuery,
    setPage,
    size,
    setSize,
    busy,
    notice,
    setNotice,
    error,
    sample,
    overview,
    recordSection,
    savedFeedback,
    errorFeedback,
    conclusionSection,
    goTo,
    dirty,
    related,
    view,
    changePage,
    save,
  } = useRecurrenceInvestigationViewModel({
    task: sourceTask,
    pattern,
    orders,
    onSaved,
    onDirtyChange,
    onBusyChange,
  });
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
            <FormField className="recurrence-search">
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
            </FormField>
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
                  <FormField className="check-label">
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
                  </FormField>
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
            <ValidatedForm
              className="guided-form"
              onSubmit={(event) => {
                event.preventDefault();
                void save(true);
              }}
            >
              <fieldset disabled={busy} className="recurrence-form-fields">
                <FormField>
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
                </FormField>
                <FormField>
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
                </FormField>
                <FormField>
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
                </FormField>
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
            </ValidatedForm>
          </section>
        </>
      )}
    </div>
  );
}
