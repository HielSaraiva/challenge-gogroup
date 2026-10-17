"use client";
import { useRef, useState } from "react";
import { Pagination } from "./ui/pagination";
import { paginate } from "@/lib/pagination";
import { Expandable } from "./ui/expandable";
import type { financialReport } from "@/domain/operations";
import { outcomeLabels } from "@/domain/cases";
import { money } from "@/lib/utils";
export function FinancialImpact({
  report,
  onOrder,
}: {
  report: ReturnType<typeof financialReport>;
  onOrder: (id: string) => void;
}) {
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(10);
  const region = useRef<HTMLElement>(null);
  const view = paginate(report.resolvedOrders, page, size);
  const total = report.resolvedCount + report.pendingCount;
  const outcomes = [
    ...new Set(report.resolvedOrders.map((order) => order.outcome?.type)),
  ];
  const changePage = (next: number) => {
    setPage(next);
    region.current?.focus({ preventScroll: true });
    region.current?.scrollIntoView({
      block: "start",
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
  };
  return (
    <div className="results-workspace">
      <section className="panel prose">
        <h2>O que a equipe já registrou?</h2>
        <p>
          Encerramentos confirmados pela equipe nesta sessão. Os números
          representam resultados declarados, sem confirmação externa de
          pagamentos, retenção ou lucro.
        </p>
        <Expandable>
          <summary>Como interpretar os indicadores?</summary>
          <p>
            Os totais consideram apenas os pedidos atualmente encerrados.
            Pedidos ainda abertos incluem toda a base e podem não ter uma tarefa
            em Pendências. Ao reabrir, os valores anteriores saem destes
            indicadores e permanecem no histórico do caso; isso não desfaz
            pagamentos nem despesas.
          </p>
        </Expandable>
        <dl className="result-metrics">
          <div>
            <dt>Pedidos resolvidos</dt>
            <dd>{report.resolvedCount}</dd>
          </div>
          <div>
            <dt>Pedidos ainda abertos na base</dt>
            <dd>{report.pendingCount}</dd>
          </div>
          <div>
            <dt>Reabertos e ainda em acompanhamento</dt>
            <dd>{report.reopenedCount}</dd>
          </div>
          <div>
            <dt>Parcela da base encerrada</dt>
            <dd>
              {(total
                ? (100 * report.resolvedCount) / total
                : 0
              ).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}
              %
            </dd>
          </div>
        </dl>
      </section>
      <section className="panel prose">
        <h2>Valores associados às tratativas</h2>
        <dl className="result-metrics">
          <div>
            <dt>Valor dos pedidos resolvidos</dt>
            <dd>{money(report.treatedValue)}</dd>
            <small>Volume tratado; não é receita recuperada.</small>
          </div>
          <div>
            <dt>Reembolsos registrados</dt>
            <dd>
              {report.refunds.count
                ? money(report.refunds.total)
                : "Nenhum registrado"}
            </dd>
          </div>
          <div>
            <dt>Custos informados pelo operador</dt>
            <dd>
              {report.declaredCosts.count
                ? money(report.declaredCosts.total)
                : "Não informados"}
            </dd>
          </div>
          <div>
            <dt>Custos ainda estimados</dt>
            <dd>
              {report.estimatedCosts.count
                ? money(report.estimatedCosts.total)
                : "Não informados"}
            </dd>
          </div>
        </dl>
        <p>
          {report.unmeasured}{" "}
          {report.unmeasured === 1
            ? "encerramento sem valor de custo ou reembolso informado"
            : "encerramentos sem valor de custo ou reembolso informado"}
          . Valor não informado não significa custo zero.
        </p>
        {report.legacy > 0 && (
          <p>
            {report.legacy} registros legados não possuem o novo resultado
            estruturado; suas evidências não foram preenchidas automaticamente.
          </p>
        )}
      </section>
      {report.resolvedCount > 0 && (
        <section className="panel prose">
          <h2>Quais problemas foram resolvidos?</h2>
          <dl className="outcome-summary">
            {outcomes.map((type) => (
              <div key={type || "legacy"}>
                <dt>{type ? outcomeLabels[type] : "Registro legado"}</dt>
                <dd>
                  {
                    report.resolvedOrders.filter(
                      (order) => order.outcome?.type === type,
                    ).length
                  }
                </dd>
              </div>
            ))}
          </dl>
        </section>
      )}
      <section
        className="panel prose paged-workspace"
        ref={region}
        tabIndex={-1}
        aria-label="Resultados por pedido"
      >
        <h2>Resultados por pedido</h2>
        <p>
          Encerramentos mais recentes primeiro. Abra um pedido para consultar os
          detalhes ou reabri-lo.
        </p>
        {!view.total && (
          <div className="workspace-empty">
            <h3>Nenhum encerramento registrado</h3>
            <p>
              Investigue um pedido, registre a execução e confirme seu
              resultado. Preparar o plano do dia é opcional.
            </p>
          </div>
        )}
        <div className="resolved-list">
          {view.items.map((order) => (
            <article className="resolved-card" key={order.id}>
              <header className="resolved-card-heading">
                <div>
                  <button
                    className="plain-link"
                    onClick={() => onOrder(order.id)}
                    aria-label={`Abrir pedido ${order.id}`}
                  >
                    {order.id}
                  </button>
                  <h3>
                    {order.outcome
                      ? outcomeLabels[order.outcome.type]
                      : "Registro legado"}
                  </h3>
                  <p>
                    {order.brand} · {order.product}
                  </p>
                </div>
                <time dateTime={order.resolvedAt}>
                  {new Date(order.resolvedAt).toLocaleString("pt-BR")}
                </time>
              </header>
              <dl className="resolved-details">
                <div>
                  <dt>
                    {order.note.trim() === order.outcome?.evidence.trim()
                      ? "Registro e evidência"
                      : "Ação registrada"}
                  </dt>
                  <dd>{order.note}</dd>
                </div>
                {order.outcome?.evidence &&
                  order.note.trim() !== order.outcome.evidence.trim() && (
                    <div>
                      <dt>Evidência do resultado</dt>
                      <dd>{order.outcome.evidence}</dd>
                    </div>
                  )}
              </dl>
              <dl className="resolved-amounts">
                <div>
                  <dt>Valor do pedido</dt>
                  <dd>{money(order.value)}</dd>
                </div>
                {order.outcome?.refund !== undefined && (
                  <div>
                    <dt>Reembolso registrado</dt>
                    <dd>{money(order.outcome.refund)}</dd>
                  </div>
                )}
                <div>
                  <dt>Custo adicional</dt>
                  <dd>
                    {order.outcome?.cost
                      ? money(order.outcome.cost.amount)
                      : "Não informado"}
                    {order.outcome?.cost && (
                      <small>
                        {order.outcome.cost.kind === "estimated"
                          ? "Estimativa"
                          : "Informado pelo operador"}
                      </small>
                    )}
                  </dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
        <Pagination
          {...view}
          noun="resultados"
          pageSize={size}
          onPage={changePage}
          onPageSize={(next) => {
            setSize(next);
            changePage(1);
          }}
        />
      </section>
    </div>
  );
}
