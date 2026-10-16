"use client";
import { useState } from "react";
import Decimal from "decimal.js";
import { ArrowRight, CircleHelp, ShieldCheck } from "lucide-react";
import type { OperationsReport } from "./operations-summary";
import type { RankedOrder } from "@/domain/types";
import { money } from "@/lib/utils";
import { Button } from "./ui/button";
export function FinancialImpact({
  report,
  selected,
  onQueue,
}: {
  report: OperationsReport;
  selected: RankedOrder[];
  onQueue: () => void;
}) {
  const [efficacy, setEfficacy] = useState(25);
  const [cost, setCost] = useState("");
  const financial = report.financial;
  const eligible = selected.filter(
    (order) => order.priority.cancellationProbability > 0,
  );
  const exposure = eligible.reduce(
    (sum, order) => sum.plus(order.priority.cancellationRisk),
    new Decimal(0),
  );
  const gross = exposure.times(efficacy).div(100);
  const costValid =
    cost !== "" &&
    Number.isFinite(Number(cost)) &&
    Number(cost) >= 0 &&
    Number(cost) <= 9999999;
  const assumedCost = new Decimal(costValid ? cost : 0).times(eligible.length);
  return (
    <div className="impact-workspace">
      <section className="impact-answer">
        <div>
          <ShieldCheck size={22} />
          <h2>Quanto foi recuperado de forma comprovada?</h2>
          <p>
            Não há integração de pagamento ou confirmação externa nesta
            demonstração. Encerrar pedidos e aprovar propostas não gera
            recuperação comprovada.
          </p>
        </div>
        <strong>{money(financial.verifiedRecovery)}</strong>
      </section>
      <section className="impact-section">
        <h2>Quanto dinheiro está em risco?</h2>
        <p>
          Exposição probabilística de cancelamento, somente no recorte logístico
          elegível.
        </p>
        <dl className="impact-ledger">
          <div>
            <dt>Exposição na referência original</dt>
            <dd>{money(financial.baselineExposure)}</dd>
          </div>
          <div>
            <dt>Exposição em casos ainda pendentes</dt>
            <dd>{money(financial.pendingExposure)}</dd>
          </div>
          <div>
            <dt>Exposição associada a casos encerrados</dt>
            <dd>{money(financial.closedExposure)}</dd>
          </div>
        </dl>
        <p className="impact-caveat">
          Mover exposição para casos encerrados não demonstra que ela foi
          evitada. São estados operacionais, não uma avaliação causal de
          resultado.
        </p>
      </section>
      <section className="impact-section">
        <h2>O que foi declarado nas tratativas?</h2>
        <p>
          {financial.declaredCases} casos com evidência informada pelo operador
          na sessão. Todos são registros da demonstração, sem verificação
          externa.
        </p>
        <dl className="impact-ledger">
          <div>
            <dt>Valor preservado declarado</dt>
            <dd>{money(financial.declaredRetained)}</dd>
          </div>
          <div>
            <dt>Reembolsos declarados</dt>
            <dd>{money(financial.declaredRefunded)}</dd>
          </div>
          <div>
            <dt>Custos de intervenção declarados</dt>
            <dd>{money(financial.declaredCosts)}</dd>
          </div>
          <div className="ledger-total">
            <dt>Saldo declarado das tratativas</dt>
            <dd>{money(financial.declaredBalance)}</dd>
          </div>
        </dl>
        <p className="impact-caveat">
          Saldo = valor preservado − reembolsos − custos registrados. Não é
          lucro, receita incremental nem dinheiro recuperado comprovadamente.{" "}
          {financial.financialProposals} propostas aprovadas não são contadas
          como execução.
        </p>
        <Button variant="outline" onClick={onQueue}>
          Registrar resultado no encerramento de um pedido{" "}
          <ArrowRight size={14} />
        </Button>
      </section>
      <section className="impact-section">
        <h2>Qual seria o benefício em um cenário?</h2>
        <p>
          Hipótese sobre {eligible.length} pedidos elegíveis da seleção atual. A
          eficácia não foi medida; ajuste a suposição e informe os custos para
          avaliar o cenário.
        </p>
        <div className="scenario-inputs">
          <label>
            Eficácia assumida: <b>{efficacy}%</b>
            <input
              aria-label="Eficácia financeira assumida"
              type="range"
              min="0"
              max="100"
              step="5"
              value={efficacy}
              onChange={(event) => setEfficacy(Number(event.target.value))}
            />
          </label>
          <label>
            Custo médio por pedido elegível (R$)
            <input
              aria-label="Custo médio assumido"
              type="number"
              min="0"
              max="9999999"
              step="0.01"
              placeholder="Não informado"
              value={cost}
              onChange={(event) => setCost(event.target.value)}
            />
          </label>
        </div>
        <dl className="impact-ledger">
          <div>
            <dt>Exposição potencialmente evitada, antes dos custos</dt>
            <dd>{money(gross.toFixed(2))}</dd>
          </div>
          <div>
            <dt>Custos assumidos para a seleção elegível</dt>
            <dd>
              {costValid ? money(assumedCost.toFixed(2)) : "Não informados"}
            </dd>
          </div>
          <div className="ledger-total">
            <dt>Benefício líquido hipotético</dt>
            <dd>
              {costValid
                ? money(gross.minus(assumedCost).toFixed(2))
                : "Informe os custos"}
            </dd>
          </div>
        </dl>
        <div className="alert alert-info">
          <CircleHelp size={17} />
          <span>
            Um cenário pode ser negativo quando o custo supera a exposição
            potencialmente evitada. Estes valores não são somados aos resultados
            declarados ou comprovados.
          </span>
        </div>
      </section>
    </div>
  );
}
