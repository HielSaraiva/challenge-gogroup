"use client";
import type { ReactNode, Ref } from "react";
import type { WorkspaceSnapshot } from "@/domain/workspace";
import { CAPACITY } from "@/domain/types";
import { money } from "@/shared/formatting";
import { Bot } from "lucide-react";
import { Button } from "@/presentation/shared/ui/button";
import { OperationsSummary } from "@/presentation/features/today/operations-summary";

type TodayWorkspaceProps = {
  summary: WorkspaceSnapshot["summary"];
  day: WorkspaceSnapshot["day"] | undefined;
  orders: WorkspaceSnapshot["orders"];
  ready: boolean;
  busy: boolean;
  activity: ReactNode;
  dailyActivity: Ref<HTMLDivElement>;
  onPrepare: () => void;
  onBrowse: () => void;
  onBrowseAll: () => void;
  openOrder: (id: string) => void;
};
export function TodayWorkspace({
  summary,
  day,
  orders,
  ready,
  busy,
  activity,
  dailyActivity,
  onPrepare,
  onBrowse,
  onBrowseAll,
  openOrder,
}: TodayWorkspaceProps) {
  return (
    <>
      <section className="panel prose portfolio-summary">
        <h2>Situação da carteira recebida</h2>
        <dl className="result-metrics">
          <div>
            <dt>Pedidos pendentes</dt>
            <dd>{summary.count}</dd>
          </div>
          <div>
            <dt>Valor dos pedidos pendentes</dt>
            <dd>{money(summary.value)}</dd>
          </div>
          <div>
            <dt>Conflitos de status para conferir</dt>
            <dd>
              {orders.filter((o) => o.status === "status_divergente").length}
            </dd>
          </div>
        </dl>
      </section>
      <section className="panel prose agent-command">
        <span className="badge">
          <Bot size={16} aria-hidden="true" /> Agente de operações · Groq
        </span>
        <h2>
          {ready
            ? "Seu plano está disponível"
            : "Qual é o melhor foco para hoje?"}
        </h2>
        <p>
          {day?.availableCapacity ?? CAPACITY} de {day?.capacity ?? CAPACITY}{" "}
          vagas de planejamento disponíveis. Você escolhe o foco; a IA prepara a
          seleção e as orientações para a equipe.
        </p>
        {day?.status === "needs_review" && (
          <p role="status">
            O plano precisa de atualização após mudanças nos dados ou nas
            regras. Gere outro plano ou consulte a carteira em Pedidos.
          </p>
        )}
        {day?.status === "failed" && (
          <p role="alert">
            {day.error}{" "}
            {day.plan
              ? "O plano anterior foi preservado. Se ainda for válido, continuará disponível em Hoje."
              : ""}
          </p>
        )}
        <div className="task-actions">
          <Button
            disabled={
              busy ||
              day?.status === "preparing" ||
              !day?.availableCapacity ||
              !summary.count
            }
            onClick={onPrepare}
          >
            {busy
              ? "Preparando…"
              : ready
                ? "Preparar novo plano com IA"
                : "Preparar meu dia com IA"}
          </Button>
          <Button variant="outline" onClick={onBrowse}>
            {ready ? "Abrir pedidos do plano" : "Consultar pedidos recebidos"}
          </Button>
        </div>
        <p className="muted">
          O agente registra orientações; a equipe executa ações externas e
          documenta o resultado.
        </p>
      </section>
      <div ref={dailyActivity} className="daily-activity" tabIndex={-1}>
        {activity}
      </div>
      {ready && day?.plan && (
        <OperationsSummary
          plan={day.plan}
          completed={day.completed}
          pendingOrders={day.orders}
          onOrder={openOrder}
          onBrowse={onBrowseAll}
        />
      )}
    </>
  );
}
