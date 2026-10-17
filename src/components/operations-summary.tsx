"use client";
import { generatedTextLabel } from "@/lib/utils";
import type { DailyPlan } from "@/domain/types";
import { STRATEGIES } from "@/domain/types";
import { Button } from "./ui/button";
export function OperationsSummary({
  plan,
  completed,
  onOrder,
  pendingIds,
}: {
  plan: DailyPlan;
  completed: number;
  onOrder: (id: string) => void;
  pendingIds: string[];
}) {
  return (
    <section className="panel prose">
      <span className="badge">
        Análise com Groq · {new Date(plan.createdAt).toLocaleString("pt-BR")}
      </span>
      <h2>Seu plano de trabalho</h2>
      <p>
        <b>
          Estratégia:{" "}
          {plan.strategy ? STRATEGIES[plan.strategy].label : "Plano legado"}
        </b>
      </p>
      <p>{plan.strategyReason && generatedTextLabel(plan.strategyReason)}</p>
      <p>{generatedTextLabel(plan.briefing)}</p>
      <p>
        {completed} de {plan.selectedOrderIds.length} pedidos encerrados. A
        seleção original é preservada até você solicitar outro plano.
      </p>
      <div className="agent-workstreams">
        {plan.workstreams.map((s) => (
          <article className="workstream-card" key={s.area}>
            <header className="workstream-heading">
              <h3>{s.area}</h3>
              <span>{s.orderIds.length} pedidos selecionados</span>
            </header>
            <div className="workstream-guidance">
              <h4>Orientação para a equipe</h4>
              <p>{generatedTextLabel(s.nextStep)}</p>
            </div>
            {s.agentDecision?.justification && (
              <div className="workstream-guidance">
                <h4>Por que começar por este pedido</h4>
                <p>{generatedTextLabel(s.agentDecision.justification)}</p>
              </div>
            )}
            {s.agentDecision &&
              pendingIds.includes(s.agentDecision.firstOrderId) && (
                <footer className="workstream-action">
                  <span>
                    Pedido sugerido{" "}
                    <strong>{s.agentDecision.firstOrderId}</strong>
                  </span>
                  <Button
                    variant="outline"
                    aria-label={`Abrir pedido sugerido ${s.agentDecision.firstOrderId} de ${s.area}`}
                    onClick={() => onOrder(s.agentDecision!.firstOrderId)}
                  >
                    Abrir pedido sugerido
                  </Button>
                </footer>
              )}
            {s.agentDecision &&
              !pendingIds.includes(s.agentDecision.firstOrderId) && (
                <p>
                  O pedido sugerido já foi encerrado. Consulte os demais pedidos
                  deste plano para continuar.
                </p>
              )}
          </article>
        ))}
      </div>
    </section>
  );
}
