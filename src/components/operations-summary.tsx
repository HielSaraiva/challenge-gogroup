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
}: {
  report: OperationsReport;
  selection: RankedOrder[];
  weights: Weights;
  busy: boolean;
  onPrepare: () => void;
  onQueue: (ids?: string[]) => void;
  onInsights: () => void;
  onImpact: () => void;
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
            <Clock3 size={15} /> Agenda operacional
          </span>
          <h2>O que o time deve tratar hoje?</h2>
          <p>
            {report.selected} pedidos selecionados para{" "}
            {report.availableCapacity} vagas restantes. Reserva de{" "}
            {report.oldestReserved} vagas para os casos mais antigos; demais por
            pontuação.
          </p>
        </div>
        <div className="capacity-readout">
          <strong>
            {report.availableCapacity}
            <span>/{report.capacity}</span>
          </strong>
          <small>tratativas disponíveis</small>
          <span>{report.usedCapacity} já consumidas na sessão</span>
        </div>
      </div>
      <div className="workspace-actions">
        <Button
          disabled={busy || !report.selected || current}
          onClick={onPrepare}
        >
          <Sparkles size={16} />{" "}
          {current
            ? "Plano atual registrado"
            : latest
              ? "Replanejar com o agente"
              : "Preparar plano com o agente"}
        </Button>
        <Button variant="outline" onClick={() => onQueue()}>
          Abrir fila priorizada <ArrowRight size={15} />
        </Button>
        <button className="plain-link" onClick={onInsights}>
          Investigar causas
        </button>
        <button className="plain-link" onClick={onImpact}>
          Conferir impacto financeiro
        </button>
      </div>
      <p className="workspace-help">
        O agente consulta a fila e registra orientações por área. Preparar o
        plano não executa as tratativas. Cada encerramento consome uma vaga;
        reabrir não devolve o esforço realizado.
      </p>
      {latest ? (
        <div className="daily-plan">
          <div className="daily-plan-heading">
            <div>
              <span>
                <CheckCircle2 size={15} /> Plano registrado pelo agente
              </span>
              <h3>
                {latest.selectedOrderIds.length} pedidos distribuídos em{" "}
                {latest.workstreams.length} frentes
              </h3>
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
            <b>Orientação do agente</b>
            {latest.briefing}
          </p>
          {stale && (
            <p className="plan-stale">
              A seleção, a capacidade ou os pesos mudaram. As frentes abaixo
              preservam o retrato anterior. Prepare um novo plano para orientar
              o trabalho atual.
            </p>
          )}
          <p className="workspace-help">
            Plano registrado no momento da criação. Os pedidos de cada frente
            continuam sujeitos à revisão de status e às tratativas individuais.
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
              A fila já pode ser consultada. O plano do agente ainda não foi
              preparado.
            </h3>
            <p>
              Use o agente para organizar as frentes e registrar o próximo passo
              de cada área, sem investigar os pedidos um a um.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
