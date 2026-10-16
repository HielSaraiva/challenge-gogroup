"use client";
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
  return (
    <div className="results-workspace">
      <section className="panel prose">
        <h2>O que a equipe já registrou?</h2>
        <p>
          Resultados declarados nesta demonstração. Não há confirmação externa
          de pagamentos, retenção ou lucro.
        </p>
        <dl className="result-metrics">
          <div>
            <dt>Pedidos resolvidos</dt>
            <dd>{report.resolvedCount}</dd>
          </div>
          <div>
            <dt>Ainda pendentes</dt>
            <dd>{report.pendingCount}</dd>
          </div>
          <div>
            <dt>Propostas aguardando aprovação</dt>
            <dd>{report.pendingApprovals}</dd>
          </div>
          <div>
            <dt>Ações aguardando execução</dt>
            <dd>{report.pendingExecution}</dd>
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
          {report.unmeasured} casos resolvidos sem efeito financeiro mensurado.
          Não informar um valor não significa custo zero.
        </p>
        {report.legacy > 0 && (
          <p>
            {report.legacy} registros legados não possuem o novo resultado
            estruturado; suas evidências não foram preenchidas automaticamente.
          </p>
        )}
      </section>
      <section className="panel prose">
        <h2>Resultados por pedido</h2>
        {!report.resolvedOrders.length && (
          <p>
            Nenhum encerramento registrado. Comece pelo plano da IA e registre o
            resultado dentro do pedido.
          </p>
        )}
        {report.resolvedOrders.map((o) => (
          <article className="result-row" key={o.id}>
            <button className="plain-link" onClick={() => onOrder(o.id)}>
              {o.id}
            </button>
            <b>
              {o.outcome ? outcomeLabels[o.outcome.type] : "Registro legado"}
            </b>
            <p>{o.note}</p>
            <small>{o.outcome?.evidence}</small>
            {o.outcome?.refund !== undefined && (
              <p>Reembolso registrado: {money(o.outcome.refund)}</p>
            )}
            <p>
              Custo:{" "}
              {o.outcome?.cost
                ? `${money(o.outcome.cost.amount)} (${o.outcome.cost.kind === "estimated" ? "estimado" : "informado pelo operador"})`
                : "não informado"}
            </p>
          </article>
        ))}
      </section>
    </div>
  );
}
