import type { financialReport } from "@/domain/operations";
import { outcomeLabels } from "@/domain/cases";
import { exceptionLabels } from "@/domain/types";
import { money } from "@/lib/utils";

function Distribution({
  rows,
  empty,
}: {
  rows: { label: string; count: number }[];
  empty: string;
}) {
  const max = Math.max(1, ...rows.map((row) => row.count));
  if (!rows.length) return <p className="dashboard-empty">{empty}</p>;
  return (
    <ul className="dashboard-distribution">
      {rows.map((row) => (
        <li key={row.label}>
          <div>
            <span>{row.label}</span>
            <strong>{row.count.toLocaleString("pt-BR")}</strong>
          </div>
          <div className="dashboard-bar" aria-hidden="true">
            <span style={{ width: `${(row.count / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function FinancialImpact({
  report,
}: {
  report: ReturnType<typeof financialReport>;
}) {
  const total = report.resolvedCount + report.pendingCount;
  const rate = total ? (report.resolvedCount / total) * 100 : 0;
  const rateLabel = `${rate.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
  const outcomes = new Map<string, number>();
  for (const order of report.resolvedOrders) {
    const label = order.outcome
      ? outcomeLabels[order.outcome.type]
      : "Solução não detalhada";
    outcomes.set(label, (outcomes.get(label) || 0) + 1);
  }
  return (
    <div className="results-workspace operations-dashboard">
      <section className="panel prose">
        <h2>Resumo da operação</h2>
        <p>{total.toLocaleString("pt-BR")} pedidos na base atual</p>
        <dl className="result-metrics dashboard-kpis">
          <div>
            <dt>Pedidos abertos</dt>
            <dd>{report.pendingCount.toLocaleString("pt-BR")}</dd>
          </div>
          <div>
            <dt>Pedidos resolvidos</dt>
            <dd>{report.resolvedCount.toLocaleString("pt-BR")}</dd>
          </div>
          <div>
            <dt>Resolução da base</dt>
            <dd>{rateLabel}</dd>
          </div>
          <div>
            <dt>Reabertos</dt>
            <dd>{report.reopenedCount.toLocaleString("pt-BR")}</dd>
            <small>Incluídos nos pedidos abertos</small>
          </div>
        </dl>
        <div
          className="dashboard-resolution"
          role="img"
          aria-label={`${report.resolvedCount} de ${total} pedidos resolvidos: ${rateLabel}`}
        >
          <span style={{ width: `${rate}%` }} />
        </div>
      </section>
      <section className="panel prose">
        <h2>Valores registrados pela equipe</h2>
        <dl className="result-metrics dashboard-kpis">
          <div>
            <dt>Reembolsos</dt>
            <dd>
              {report.refunds.count
                ? money(report.refunds.total)
                : "Sem registros"}
            </dd>
          </div>
          <div>
            <dt>Custos das tratativas</dt>
            <dd>
              {report.declaredCosts.count
                ? money(report.declaredCosts.total)
                : "Sem registros"}
            </dd>
          </div>
          <div>
            <dt>Custos estimados</dt>
            <dd>
              {report.estimatedCosts.count
                ? money(report.estimatedCosts.total)
                : "Sem estimativas"}
            </dd>
            <small>Separados dos custos informados</small>
          </div>
        </dl>
        <p className="dashboard-caption">
          Reembolsos e custos acumulados, incluindo pedidos reabertos.
        </p>
      </section>
      <div className="dashboard-columns">
        <section className="panel prose">
          <h2>Problemas em aberto</h2>
          <Distribution
            rows={report.openByException.map(({ type, count }) => ({
              label: exceptionLabels[type] || "Outros problemas",
              count,
            }))}
            empty="Nenhum pedido em aberto."
          />
        </section>
        <section className="panel prose">
          <h2>Soluções registradas</h2>
          <p>Dos pedidos atualmente resolvidos</p>
          <Distribution
            rows={[...outcomes]
              .map(([label, count]) => ({ label, count }))
              .sort(
                (a, b) => b.count - a.count || a.label.localeCompare(b.label),
              )}
            empty="Nenhum pedido resolvido ainda."
          />
        </section>
      </div>
    </div>
  );
}
