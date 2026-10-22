"use client";
import { useRef, useState } from "react";
import { pendingWork } from "@/domain/pending-work";
import type { Order, Task } from "@/domain/types";
import { exceptionLabels } from "@/domain/types";
import { generatedTextLabel, shortDate } from "@/shared/formatting";
import { paginate } from "@/shared/pagination";
import { Pagination } from "@/presentation/shared/ui/pagination";
import { Button } from "@/presentation/shared/ui/button";

const phases = {
  review: [
    "Validar status",
    "Confira o conflito de dados antes de continuar.",
    "Abrir pedido e validar status",
  ],
  approval: [
    "Aguardando aprovação",
    "Revise as propostas antes de autorizar a execução.",
    "Revisar propostas",
  ],
  execution: [
    "Aguardando execução",
    "Execute os encaminhamentos e registre suas evidências.",
    "Abrir pedido e executar",
  ],
  receipt: [
    "Aguardando recebimento",
    "O reenvio foi despachado. Confirme o recebimento antes de encerrar.",
    "Acompanhar recebimento",
  ],
  result: [
    "Aguardando resultado",
    "A execução foi registrada; falta confirmar a solução da pendência.",
    "Confirmar resultado",
  ],
  investigate: [
    "Aguardando investigação",
    "O pedido precisa de outro encaminhamento para continuar.",
    "Abrir pedido e investigar",
  ],
};
export function PendingWorkspace({
  orders,
  tasks,
  onOrder,
  onProcess,
}: {
  orders: Order[];
  tasks: Task[];
  onOrder: (id: string) => void;
  onProcess: (id: string) => void;
}) {
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(10);
  const region = useRef<HTMLElement>(null);
  const work = pendingWork(orders, tasks);
  const view = paginate(work, page, size);
  const changePage = (next: number) => {
    setPage(next);
    region.current?.focus({ preventScroll: true });
    region.current?.scrollIntoView({
      block: "start",
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
  };
  return (
    <section
      className="panel prose paged-workspace"
      ref={region}
      tabIndex={-1}
      aria-label="Pendências em andamento"
    >
      <h2>O que precisa de acompanhamento?</h2>
      <p>
        Apenas pedidos com tratativas em andamento e investigações ainda não
        concluídas. Cada pedido aparece uma vez, com seu próximo passo. Ordem:
        pendências mais antigas primeiro.
      </p>
      <p className="list-count">
        {work.length} {work.length === 1 ? "pendência" : "pendências"} ·{" "}
        {work.filter((item) => item.kind === "order").length}{" "}
        {work.filter((item) => item.kind === "order").length === 1
          ? "pedido"
          : "pedidos"}{" "}
        · {work.filter((item) => item.kind === "process").length}{" "}
        {work.filter((item) => item.kind === "process").length === 1
          ? "investigação"
          : "investigações"}
      </p>
      {!work.length && (
        <div className="workspace-empty">
          <h3>Nenhuma pendência de acompanhamento</h3>
          <p>
            Novas tarefas, pedidos reabertos e execuções aguardando resultado
            aparecerão aqui. Consulte os pedidos resolvidos em Pedidos e o
            resumo da operação em Resultados.
          </p>
        </div>
      )}
      <div className="pending-list">
        {view.items.map((item) =>
          item.kind === "process" ? (
            <article className="pending-card" key={item.id}>
              <div>
                <span className="badge">
                  {item.task.processProgress
                    ? "Recorrência em verificação"
                    : "Investigação de recorrência aberta"}
                </span>
                <h3>{generatedTextLabel(item.task.title)}</h3>
                <p>
                  {item.task.area} · referência: {shortDate(item.task.dueAt)}
                </p>
                <p>
                  {item.task.processProgress?.nextStep ||
                    "Confira os pedidos relacionados e registre o que encontrou. Você pode salvar o progresso antes de concluir."}
                </p>
              </div>
              <Button variant="outline" onClick={() => onProcess(item.task.id)}>
                Abrir investigação
              </Button>
            </article>
          ) : (
            <article className="pending-card" key={item.id}>
              <div>
                <span className="badge">{phases[item.phase][0]}</span>
                <h3>
                  {item.order.id} · {exceptionLabels[item.order.exception]}
                </h3>
                <p>
                  {item.order.brand} · {item.order.product}
                </p>
                <p>
                  {phases[item.phase][1]}{" "}
                  {item.tasks.length > 1 &&
                    `${item.tasks.length} encaminhamentos aguardam ação neste pedido.`}
                </p>
              </div>
              <Button variant="outline" onClick={() => onOrder(item.order.id)}>
                {phases[item.phase][2]}
              </Button>
            </article>
          ),
        )}
      </div>
      <Pagination
        {...view}
        noun={view.total === 1 ? "pendência" : "pendências"}
        pageSize={size}
        onPage={changePage}
        onPageSize={(next) => {
          setSize(next);
          changePage(1);
        }}
      />
    </section>
  );
}
