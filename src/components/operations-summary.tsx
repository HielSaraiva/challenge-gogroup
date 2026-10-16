"use client";
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  Layers3,
  Sparkles,
} from "lucide-react";
import type { operationalReport } from "@/domain/operations";
import type { DailyPlan, RankedOrder, Weights } from "@/domain/types";
import { money, shortDate } from "@/lib/utils";
import { Button } from "./ui/button";
export type OperationsReport = ReturnType<typeof operationalReport> & {
  plans: DailyPlan[];
};
export function isPlanCurrent(
  plan: DailyPlan | undefined,
  selection: RankedOrder[],
  weights: Weights,
  usedCapacity: number,
) {
  return Boolean(
    plan &&
    plan.workstreams.every((stream) => Boolean(stream.agentDecision)) &&
    plan.usedCapacity === usedCapacity &&
    JSON.stringify(plan.selectedOrderIds) ===
      JSON.stringify(selection.map((order) => order.id)) &&
    Object.keys(weights).every(
      (key) =>
        weights[key as keyof Weights] === plan.weights[key as keyof Weights],
    ) &&
    !selection.some(
      (order) =>
        order.statusReview && order.statusReview.reviewedAt > plan.createdAt,
    ),
  );
}
export function OperationsSummary({
  report,
  selection,
  weights,
  busy,
  onPrepare,
  onQueue,
  onInsights,
  onImpact,
  onInvestigate,
}: {
  report: OperationsReport;
  selection: RankedOrder[];
  weights: Weights;
  busy: boolean;
  onPrepare: () => void;
  onQueue: (ids?: string[]) => void;
  onInsights: () => void;
  onImpact: () => void;
  onInvestigate: (id: string) => void;
}) {
  const latest = report.plans[0];
  const current = isPlanCurrent(
    latest,
    selection,
    weights,
    report.usedCapacity,
  );
  const stale = latest && !current;
  return (
    <section className="operation-workspace">
      <div className="operation-command">
        <div>
          <span className="command-context">
            <Clock3 size={15} /> Seleção calculada pelo sistema
          </span>
          <h2>Comece pelos pedidos de hoje.</h2>
          <p>
            {report.selected} pedidos selecionados para{" "}
            {report.availableCapacity} vagas restantes. Reserva de{" "}
            {report.oldestReserved} vagas para os casos mais antigos; demais por
            pontuação. Essa seleção usa regras, sem uma chamada à IA.
          </p>
        </div>
        <div className="capacity-readout">
          <strong>
            {report.availableCapacity}
            <span>/{report.capacity}</span>
          </strong>
          <small>vagas estimadas na sessão</small>
          <span>{report.usedCapacity} encerramentos na simulação</span>
        </div>
      </div>
      <details className="decision-explainer">
        <summary>Como a seleção e a IA se complementam</summary>
        <div
          className="decision-boundary"
          aria-label="Contribuição do sistema e do agente"
        >
          <div>
            <b>Sistema · quem entra na seleção</b>
            <p>
              Calcula capacidade, pontuação, desempates e comparação com FIFO.
              Os pesos são uma heurística ajustável.
            </p>
          </div>
          <div>
            <b>Agente · por onde começar e o que fazer</b>
            <p>
              Analisa uma amostra por área, escolhe um primeiro pedido e
              registra motivo e próximo passo. A investigação de um pedido cria
              uma tarefa com evidências.
            </p>
            <span>
              {current
                ? "Encaminhamentos registrados"
                : latest
                  ? "Reanálise necessária"
                  : "Agente ainda não executado nesta seleção"}
            </span>
          </div>
        </div>
      </details>
      <div className="workspace-actions">
        <Button onClick={() => onQueue()}>
          Abrir fila de hoje <ArrowRight size={15} />
        </Button>
        <Button
          variant="outline"
          disabled={busy || !report.selected || current}
          onClick={onPrepare}
        >
          <Sparkles size={16} />{" "}
          {current
            ? "Encaminhamentos registrados"
            : latest
              ? "Reanalisar seleção com o agente"
              : "Preparar plano com IA"}
        </Button>

        <button className="plain-link" onClick={onInsights}>
          Investigar causas
        </button>
        <button className="plain-link" onClick={onImpact}>
          Conferir impacto financeiro
        </button>
      </div>
      <p className="workspace-help">
        O agente não recalcula os pesos nem substitui a seleção. Registrar o
        plano salva decisões de encaminhamento; não cria automaticamente tarefas
        para todos os pedidos nem executa tratativas externas.
      </p>
      {latest ? (
        <div className="daily-plan">
          <div className="daily-plan-heading">
            <div>
              <span>
                <CheckCircle2 size={15} /> Contribuição registrada pelo agente
              </span>
              <h3>Encaminhamentos para {latest.workstreams.length} áreas</h3>
            </div>
            <small>
              {shortDate(latest.reference)} · preparado às{" "}
              {new Date(latest.createdAt).toLocaleTimeString("pt-BR", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </small>
          </div>
          <p className="plan-briefing">
            <b>Leitura do agente sobre a seleção</b>
            {latest.briefing}
          </p>
          {stale && (
            <p className="plan-stale">
              Este plano precisa ser atualizado: a seleção mudou ou o registro
              anterior ainda não contém a escolha de um primeiro pedido com
              justificativa. Reanalise antes de orientar o trabalho atual.
            </p>
          )}
          <p className="workspace-help">
            Base do plano: {latest.selectedOrderIds.length} pedidos selecionados
            pelas regras. O agente recebeu amostras, não investigou todos os
            dossiês. Revise cada encaminhamento antes de executar.
          </p>
          <div className="workstream-list">
            {latest.workstreams.map((stream) => (
              <div className="workstream-row" key={stream.area}>
                <div>
                  <span className="workstream-area">
                    {stream.area}
                    {latest.priorityAreas.includes(stream.area) && (
                      <small>Em destaque</small>
                    )}
                  </span>
                  <p>{stream.nextStep}</p>
                  {stream.agentDecision && (
                    <div className="agent-choice">
                      <b>
                        Por onde o agente sugere começar:{" "}
                        {stream.agentDecision.firstOrderId}
                      </b>
                      <p>{stream.agentDecision.justification}</p>
                      <Button
                        size="sm"
                        disabled={busy || Boolean(stale)}
                        onClick={() =>
                          onInvestigate(stream.agentDecision!.firstOrderId)
                        }
                      >
                        <Sparkles size={14} /> Investigar este pedido e criar
                        tarefa
                      </Button>
                    </div>
                  )}
                </div>
                <div className="workstream-numbers">
                  <b>{stream.orderIds.length} pedidos</b>
                  <small>
                    {money(stream.risk)} de exposição elegível no retrato
                  </small>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onQueue(stream.orderIds)}
                >
                  Abrir frente <ArrowRight size={13} />
                </Button>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="plan-empty">
          <Layers3 size={20} />
          <div>
            <h3>
              Você está vendo a sugestão das regras. A análise do agente ainda
              não foi feita.
            </h3>
            <p>
              Ao analisar a seleção, o agente registra uma escolha inicial e uma
              orientação por área. Depois, investigue o caso escolhido para
              gerar uma tarefa individual; padrões recorrentes podem gerar ações
              de processo na área Causas e processos.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
