"use client";
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
      <p>{plan.strategyReason}</p>
      <p>{plan.briefing}</p>
      <p>
        {completed} de {plan.selectedOrderIds.length} pedidos encerrados. A
        seleção original é preservada até você solicitar outro plano.
      </p>
      <div className="agent-workstreams">
        {plan.workstreams.map((s) => (
          <article className="workstream-card" key={s.area}>
            <h3>{s.area}</h3>
            <p>{s.orderIds.length} pedidos selecionados</p>
            <p>{s.nextStep}</p>
            <p>{s.agentDecision?.justification}</p>
            {s.agentDecision &&
              pendingIds.includes(s.agentDecision.firstOrderId) && (
                <Button
                  variant="outline"
                  onClick={() => onOrder(s.agentDecision!.firstOrderId)}
                >
                  Começar pelo pedido sugerido · {s.agentDecision.firstOrderId}
                </Button>
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
