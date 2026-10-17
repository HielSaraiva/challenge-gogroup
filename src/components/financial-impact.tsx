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
  const [ledgerPage, setLedgerPage] = useState(1);
  const [ledgerSize, setLedgerSize] = useState(10);
  const ledgerRegion = useRef<HTMLElement>(null);
  const ledger = paginate(report.financialRecords, ledgerPage, ledgerSize);
  const changeLedgerPage = (next: number) => {
    setLedgerPage(next);
    ledgerRegion.current?.focus({ preventScroll: true });
    ledgerRegion.current?.scrollIntoView({
      block: "start",
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
  };
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
        <h2>Situação atual dos pedidos</h2>
        <p>
          Veja quantos pedidos estão resolvidos ou continuam abertos nesta
          sessão.
        </p>
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
            <dt>Valor dos pedidos atualmente resolvidos</dt>
            <dd>{money(report.treatedValue)}</dd>
            <small>
              Volume da carteira encerrada; não é receita recuperada.
            </small>
          </div>
        </dl>
      </section>
      <section className="panel prose">
        <h2>Custos e reembolsos acumulados</h2>
        <p>
          Valores informados pela equipe em todas as etapas desta sessão,
          inclusive de pedidos reabertos. Reabrir não apaga esses registros nem
          desfaz uma despesa ou um reembolso. A aplicação não confirma nem
          executa pagamentos externos.
        </p>
        <dl className="result-metrics">
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
        </dl>
        <Expandable>
          <summary>Estimativas e valores não informados</summary>
          <p>
            Estimativas nos encerramentos atuais:{" "}
            {report.estimatedCosts.count
              ? money(report.estimatedCosts.total)
              : "nenhuma informada"}
            . Elas não entram no total de custos informados pelo operador e não
            comprovam uma despesa realizada.
          </p>
          <p>
            {report.unmeasured}{" "}
            {report.unmeasured === 1
              ? "pedido atualmente resolvido sem custo ou reembolso informado"
              : "pedidos atualmente resolvidos sem custo ou reembolso informado"}
            . Valor não informado não significa custo zero.
          </p>
        </Expandable>
        {ledger.total > 0 && (
          <Expandable>
            <summary>
              Ver registros que compõem os totais ({ledger.total})
            </summary>
            <section
              className="paged-workspace"
              ref={ledgerRegion}
              tabIndex={-1}
              aria-label="Histórico financeiro das tratativas"
            >
              <p>
                Cada registro corresponde a uma etapa de atendimento. Os mais
                recentes aparecem primeiro.
              </p>
              <div className="resolved-list">
                {ledger.items.map((record) => (
                  <article className="resolved-card" key={record.key}>
                    <header className="resolved-card-heading">
                      <div className="financial-record-identity">
                        <button
                          className="plain-link"
                          onClick={() => onOrder(record.orderId)}
                          aria-label={`Consultar registro financeiro do pedido ${record.orderId}`}
                        >
                          {record.orderId}
                        </button>
                        <p className="badge">
                          {record.orderOpen
                            ? "Pedido reaberto"
                            : record.current
                              ? "Encerramento atual"
                              : "Etapa anterior"}
                        </p>
                      </div>
                      <time dateTime={record.at}>
                        {new Date(record.at).toLocaleString("pt-BR")}
                      </time>
                    </header>
                    <dl className="resolved-amounts">
                      {record.outcome?.refund !== undefined && (
                        <div>
                          <dt>Reembolso registrado nesta etapa</dt>
                          <dd>{money(record.outcome.refund)}</dd>
                        </div>
                      )}
                      {record.outcome?.cost?.kind === "declared" && (
                        <div>
                          <dt>Custo informado nesta etapa</dt>
                          <dd>{money(record.outcome.cost.amount)}</dd>
                        </div>
                      )}
                    </dl>
                    {record.outcome?.evidence && (
                      <dl className="resolved-details">
                        <div>
                          <dt>Evidência registrada</dt>
                          <dd>{record.outcome.evidence}</dd>
                        </div>
                      </dl>
                    )}
                  </article>
                ))}
              </div>
              <Pagination
                {...ledger}
                noun="registros financeiros"
                pageSize={ledgerSize}
                onPage={changeLedgerPage}
                onPageSize={(next) => {
                  setLedgerSize(next);
                  changeLedgerPage(1);
                }}
              />
            </section>
          </Expandable>
        )}
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
