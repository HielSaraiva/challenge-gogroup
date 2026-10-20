"use client";
import { generatedTextLabel } from "@/lib/utils";
import type { DailyPlan } from "@/domain/types";
import { STRATEGIES } from "@/domain/types";
import { workstreamProgress } from "@/domain/workstream-progress";
import { Button } from "./ui/button";
export function OperationsSummary({
  plan,
  completed,
  onOrder,
  pendingIds,
  onBrowse,
}: {
  plan: DailyPlan;
  completed: number;
  onOrder: (id: string) => void;
  pendingIds: string[];
  onBrowse: () => void;
}) {
  const pending = new Set(pendingIds);
  return (
    <section className="panel prose">
      <span className="badge">
        Análise com Groq · {new Date(plan.createdAt).toLocaleString("pt-BR")}
      </span>
      <h2>Seu plano de trabalho</h2>
      <p>
        <b>
          Estratégia:{" "}
          {plan.strategy
            ? STRATEGIES[plan.strategy].label
            : "Estratégia não registrada"}
        </b>
      </p>
      <p>{plan.strategyReason && generatedTextLabel(plan.strategyReason)}</p>
      <p>{generatedTextLabel(plan.briefing)}</p>
      <p role="status" aria-live="polite">
        {completed} de {plan.selectedOrderIds.length} pedidos encerrados. A
        próxima sugestão de cada área acompanha o progresso, sem nova análise de
        IA.
      </p>
      {completed === plan.selectedOrderIds.length && (
        <div className="plan-complete">
          <strong>Todos os pedidos deste plano foram encerrados</strong>
          <p>
            Consulte a carteira para continuar. Um novo plano depende das vagas
            de planejamento disponíveis.
          </p>
          <Button variant="outline" onClick={onBrowse}>
            Consultar carteira
          </Button>
        </div>
      )}
      <div className="agent-workstreams">
        {plan.workstreams.map((s) => {
          const progress = workstreamProgress(s, pending);
          return (
            <article className="workstream-card" key={s.area}>
              <header className="workstream-heading">
                <h3>{s.area}</h3>
                <span>
                  {s.orderIds.length}{" "}
                  {s.orderIds.length === 1
                    ? "pedido selecionado"
                    : "pedidos selecionados"}
                </span>
              </header>
              <p className="workstream-progress">
                Encerrados: <strong>{progress.completed}</strong> · Em aberto:{" "}
                <strong>{progress.remaining.length}</strong>
              </p>
              <div className="workstream-guidance">
                <h4>Orientação para a equipe</h4>
                <p>{generatedTextLabel(s.nextStep)}</p>
              </div>
              {progress.agentSuggestion && s.agentDecision?.justification && (
                <div className="workstream-guidance">
                  <h4>Por que começar por este pedido</h4>
                  <p>{generatedTextLabel(s.agentDecision.justification)}</p>
                </div>
              )}
              {progress.suggestedId && (
                <footer className="workstream-action">
                  <span>
                    Pedido sugerido <strong>{progress.suggestedId}</strong>
                  </span>
                  {!progress.agentSuggestion && (
                    <p className="workstream-continuation">
                      Próximo pedido pela prioridade do plano.
                    </p>
                  )}
                  <Button
                    variant="outline"
                    aria-label={`Abrir pedido sugerido ${progress.suggestedId} de ${s.area}`}
                    onClick={() => onOrder(progress.suggestedId!)}
                  >
                    Abrir pedido sugerido
                  </Button>
                </footer>
              )}
              {!progress.suggestedId && (
                <p className="workstream-done">
                  Área concluída neste plano.
                  {pending.size > 0
                    ? " Continue pelas outras áreas com pedidos em aberto."
                    : ""}
                </p>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
