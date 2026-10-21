"use client";
import { useState, type ReactNode } from "react";
import type { RankedOrder, Task, Investigation } from "@/domain/types";
import { exceptionLabels } from "@/domain/types";
import { currentCaseTasks, latestReopen } from "@/domain/case-cycle";
import { outcomeLabels } from "@/domain/cases";
import { money, shortDate, statusLabel, generatedTextLabel } from "@/lib/utils";
import { Bot } from "lucide-react";
import { Button } from "./ui/button";
import { Expandable } from "./ui/expandable";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";
import { CaseControls } from "./case-controls";
import { TaskResult } from "./task-result";

type OrderDetailsProps = {
  selected: RankedOrder;
  orders: RankedOrder[];
  tasks: Task[];
  runs: Investigation[];
  activeRun: Investigation | undefined;
  busy: boolean;
  activity: ReactNode;
  onInvestigate: (id: string) => void;
  refreshAfterSave: () => Promise<void>;
};
export function OrderDetails({
  selected,
  orders,
  tasks,
  runs,
  activeRun,
  busy,
  activity,
  onInvestigate,
  refreshAfterSave,
}: OrderDetailsProps) {
  const [confirmOrderId, setConfirmOrderId] = useState<string | null>(null);
  const selectedReopen = latestReopen(selected.caseHistory);
  const related = currentCaseTasks(selected, tasks);
  return (
    <>
      <header className="order-dialog-header">
        <DialogTitle>Pedido {selected.id}</DialogTitle>
        <DialogDescription>
          {selected.brand} · {selected.product}
        </DialogDescription>
        <div className="order-dialog-badges">
          <span className="badge">{exceptionLabels[selected.exception]}</span>
          <span className="badge">{statusLabel(selected.status)}</span>
        </div>
        <dl className="order-dialog-facts">
          <div>
            <dt>Valor do pedido</dt>
            <dd>{money(selected.value)}</dd>
          </div>
          <div>
            <dt>Tempo de espera</dt>
            <dd>{selected.priority.age} dias úteis</dd>
          </div>
          <div>
            <dt>{selected.deliveredAt ? "Atraso até a entrega" : "Atraso"}</dt>
            <dd>{selected.priority.delay} dias úteis</dd>
          </div>
        </dl>
      </header>
      <section className="case-next-step">
        <h3>
          {selected.resolution
            ? "Resultado registrado"
            : selected.status === "status_divergente"
              ? "Primeiro valide o status"
              : related.some((t) =>
                    ["aberta", "aprovada", "pendente_aprovacao"].includes(
                      t.status,
                    ),
                  )
                ? "Revise e execute os encaminhamentos"
                : related.some(
                      (t) => t.execution && t.kind !== "revisao_status",
                    )
                  ? "Registre o resultado da tratativa"
                  : selectedReopen
                    ? "Pedido reaberto — inicie uma nova investigação"
                    : "Peça ao agente um encaminhamento"}
        </h3>
        <p>
          {selected.resolution
            ? "Confira o resultado e o histórico abaixo. Você pode reabrir o pedido com uma justificativa."
            : "Confira as evidências, registre a execução da tratativa e só então encerre a exceção. Uma entrega registrada, sozinha, não comprova que a pendência foi resolvida."}
        </p>
        {!selected.resolution && selected.status !== "status_divergente" && (
          <Button
            disabled={busy}
            onClick={() => {
              const alreadyAnalyzed =
                related.length > 0 ||
                runs.some(
                  (run) =>
                    run.type === "order" &&
                    run.target === selected.id &&
                    (!selectedReopen || run.createdAt >= selectedReopen.at) &&
                    run.status === "completed",
                ) ||
                (activeRun?.type === "order" &&
                  activeRun.target === selected.id &&
                  (!selectedReopen ||
                    activeRun.createdAt >= selectedReopen.at) &&
                  activeRun.status === "completed");
              if (alreadyAnalyzed) setConfirmOrderId(selected.id);
              else void onInvestigate(selected.id);
            }}
          >
            {busy
              ? "Investigando…"
              : selectedReopen && !related.length
                ? "Investigar pedido reaberto com IA"
                : "Investigar este pedido com IA"}
          </Button>
        )}
        {selected.status === "status_divergente" && (
          <p>
            A origem não informa qual status é o mais recente. Confira a fonte e
            registre a revisão abaixo.
          </p>
        )}
      </section>
      {selectedReopen && !selected.resolution && (
        <p className="case-next-step">
          Reaberto em {new Date(selectedReopen.at).toLocaleString("pt-BR")}.
          Motivo: {selectedReopen.note}
          <br />
          As execuções anteriores não encerram esta nova etapa.
        </p>
      )}
      {activity}
      <Expandable className="panel prose order-facts-panel">
        <summary>Conferir fatos, prazos e histórico do cliente</summary>
        <p>
          Pedido: {shortDate(selected.orderedAt)} · Exceção:{" "}
          {shortDate(selected.openedAt)}
        </p>
        <p>
          Promessa original: {shortDate(selected.promisedAt)} · Contrato:{" "}
          {shortDate(selected.priority.contractPromise)} · Entrega:{" "}
          {selected.deliveredAt
            ? shortDate(selected.deliveredAt)
            : "não registrada"}
        </p>
        <p>
          {selected.carrier} / {selected.state} · Centro de distribuição:{" "}
          {selected.dc} · turno {selected.shift} · máquina{" "}
          {selected.machine || "não informada"} · lote {selected.lot}
        </p>
        <p>
          {selected.customer?.orders} pedidos do cliente · valor acumulado de
          compras: {money(selected.customer?.revenue || "0")}
        </p>
        {selected.issues.map((i) => (
          <p key={i.code}>{generatedTextLabel(i.detail)}</p>
        ))}
      </Expandable>
      <section className="order-task-section">
        <h3>Encaminhamentos para este pedido</h3>
        {!related.length && (
          <p className="order-empty-tasks">
            {selectedReopen
              ? "Ainda não há encaminhamentos nesta nova etapa."
              : "Ainda não há tarefas."}{" "}
            A investigação individual com IA pode ser feita sem preparar o plano
            do dia.
          </p>
        )}
        {related.map((t) => (
          <div key={t.id}>
            {t.kind.startsWith("proposta") && (
              <p className="case-next-step">
                <strong>
                  {t.kind === "proposta_reenvio"
                    ? "Estimativa de reenvio"
                    : "Valor proposto para reembolso"}
                  :
                </strong>{" "}
                {money(
                  t.kind === "proposta_reembolso"
                    ? selected.value
                    : selected.priority.resendCost,
                )}
                .{" "}
                {t.kind === "proposta_reenvio" ? (
                  <>
                    Cálculo do piloto: 24% do valor total do pedido + frete da
                    transportadora.{" "}
                    {selected.exception === "item_faltante" &&
                      "Para item faltante, essa aproximação pode superestimar o custo: a base não informa o preço individual do item. "}
                    Não é uma cotação nem um custo efetivamente realizado.
                  </>
                ) : (
                  "O valor efetivo deve ser comprovado e informado no resultado; aprovar não movimenta dinheiro."
                )}{" "}
                Verifique os registros externos antes de executar.
              </p>
            )}
            <TaskResult
              task={t}
              orders={orders}
              tasks={tasks}
              onSaved={refreshAfterSave}
            />
          </div>
        ))}
      </section>
      <CaseControls
        key={selected.id + selected.status + (selectedReopen?.id || "")}
        order={selected}
        tasks={tasks}
        disabled={busy}
        onSaved={refreshAfterSave}
      />
      <Expandable className="panel prose case-history">
        <summary>Histórico deste caso</summary>
        {!selected.caseHistory?.length && (
          <p className="case-history-empty">
            Nenhuma alteração registrada neste pedido. As validações de status,
            os encerramentos e as reaberturas aparecerão aqui. Investigações e
            tarefas ficam em “Encaminhamentos para este pedido”.
          </p>
        )}
        {[...(selected.caseHistory || [])].reverse().map((event) => (
          <article className="case-history-event" key={event.id}>
            <div className="case-history-event-heading">
              <strong>
                {{
                  resolve: "Pedido encerrado",
                  reopen: "Pedido reaberto",
                  review_status: "Status conferido",
                }[event.action] || "Alteração registrada"}
              </strong>
              <time dateTime={event.at}>
                {new Date(event.at).toLocaleString("pt-BR")}
              </time>
            </div>
            {event.outcome && (
              <p>
                <strong>Resultado:</strong> {outcomeLabels[event.outcome.type]}
              </p>
            )}
            {event.outcome && (
              <>
                <p>
                  <strong>Evidência do resultado:</strong>{" "}
                  {event.outcome.evidence}
                </p>
                {event.outcome.refund !== undefined && (
                  <p>
                    <strong>Reembolso registrado:</strong>{" "}
                    {money(event.outcome.refund)}
                  </p>
                )}
                {event.outcome.cost && (
                  <p>
                    <strong>Custo registrado:</strong>{" "}
                    {money(event.outcome.cost.amount)} (
                    {event.outcome.cost.kind === "estimated"
                      ? "estimado"
                      : "informado pelo operador"}
                    )
                  </p>
                )}
              </>
            )}
            {event.status && (
              <p>
                <strong>Status confirmado:</strong> {statusLabel(event.status)}
              </p>
            )}
            <p className="case-history-event-note">{event.note}</p>
          </article>
        ))}
      </Expandable>
      <Dialog
        open={confirmOrderId === selected.id}
        onOpenChange={(open) => {
          if (!open) setConfirmOrderId(null);
        }}
      >
        <DialogContent className="confirmation-dialog">
          <span className="new-plan-icon" aria-hidden="true">
            <Bot size={24} />
          </span>
          <DialogTitle>Investigar este pedido novamente?</DialogTitle>
          <DialogDescription>
            O pedido {selected.id} já tem uma análise ou encaminhamentos
            registrados. A IA consultará novamente as evidências para reavaliar
            o caso.
          </DialogDescription>
          <div className="new-plan-consequences">
            <div>
              <strong>Os registros anteriores serão preservados</strong>
              <p>
                A nova análise não apaga tarefas, execuções ou histórico.
                Encaminhamentos existentes podem ser mantidos, sem criar tarefas
                duplicadas.
              </p>
            </div>
          </div>
          <div className="confirmation-footer">
            <Button variant="outline" onClick={() => setConfirmOrderId(null)}>
              Manter análise atual
            </Button>
            <Button
              disabled={busy || Boolean(selected.resolution)}
              onClick={() => {
                const orderId = confirmOrderId;
                setConfirmOrderId(null);
                if (orderId === selected.id) void onInvestigate(orderId);
              }}
            >
              Investigar novamente
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
