"use client";
import type { WorkspaceSnapshot } from "@/domain/workspace";
import { exceptionLabels } from "@/domain/types";
import { money, statusLabel } from "@/shared/formatting";
import { paginationItems } from "@/shared/pagination";
import { PAGE_SIZES } from "@/domain/order-list";
import { Search } from "lucide-react";
import { Button } from "@/presentation/shared/ui/button";
import { Expandable } from "@/presentation/shared/ui/expandable";
import type { OrderListController } from "@/presentation/features/orders/use-order-list";

type OrdersWorkspaceProps = {
  day: WorkspaceSnapshot["day"] | undefined;
  ready: boolean;
  list: OrderListController;
  onOrder: (id: string) => void;
  onPrepare: () => void;
};
export function OrdersWorkspace({
  day,
  ready,
  list,
  onOrder: openOrder,
  onPrepare,
}: OrdersWorkspaceProps) {
  const {
    all,
    setAll,
    query,
    setQuery,
    pageSize,
    setPageSize,
    exceptionFilter,
    setExceptionFilter,
    statusFilter,
    setStatusFilter,
    setPage,
    visible,
    sourceOrders,
    hasOrderFilters,
    exceptionOptions,
    statusOptions,
    currentPage,
    totalPages,
  } = list;
  return (
    <>
      {!ready && (
        <section className="panel prose">
          <h2>Consulte pedidos com ou sem plano</h2>
          <p>
            Abra uma linha para investigar o pedido diretamente. Para uma
            seleção priorizada, prepare um plano em Hoje.
          </p>
          <Button onClick={() => onPrepare()}>Preparar o dia</Button>
        </section>
      )}
      <section className="panel queue-panel">
        <div className="panel-heading">
          <h2>
            {all || !ready ? "Pedidos recebidos" : "Pedidos do plano da IA"}
          </h2>
          {ready && (
            <label className="check-label">
              <input
                type="checkbox"
                checked={all}
                onChange={(e) => {
                  setAll(e.target.checked);
                  setPage(1);
                }}
              />
              Consultar toda a carteira
            </label>
          )}
        </div>
        <div className="order-search">
          <p className="queue-order-note">
            {all || !ready
              ? "Ordem de abertura da exceção: mais antiga primeiro; em empate, código do pedido. Não é a data da compra."
              : "Ordem de prioridade do plano. Os filtros mantêm essa ordem."}
          </p>
          <label htmlFor="order-search-input">Buscar pedidos</label>
          <div className="search-input">
            <Search size={18} aria-hidden="true" />
            <input
              id="order-search-input"
              type="search"
              placeholder="Código, produto, marca ou pendência"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
            />
          </div>
        </div>
        <div className="order-list-controls">
          <label>
            Pendência
            <select
              value={exceptionFilter}
              onChange={(event) => {
                setExceptionFilter(event.target.value);
                setPage(1);
              }}
            >
              <option value="">Todas as pendências</option>
              {exceptionOptions.map((value) => (
                <option value={value} key={value}>
                  {exceptionLabels[value] || value}
                </option>
              ))}
            </select>
          </label>
          <label>
            Status
            <select
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value);
                setPage(1);
              }}
            >
              <option value="">Todos os status</option>
              {statusOptions.map((value) => (
                <option value={value} key={value}>
                  {statusLabel(value)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Itens por página
            <select
              value={pageSize}
              onChange={(event) => {
                const size = Number(event.target.value);
                if (PAGE_SIZES.some((value) => value === size)) {
                  setPageSize(size);
                  setPage(1);
                }
              }}
            >
              {PAGE_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size} pedidos
                </option>
              ))}
            </select>
          </label>
          {hasOrderFilters && (
            <Button
              variant="ghost"
              onClick={() => {
                setQuery("");
                setExceptionFilter("");
                setStatusFilter("");
                setPage(1);
              }}
            >
              Limpar filtros
            </Button>
          )}
        </div>
        <p className="order-list-caption">
          {hasOrderFilters
            ? `${visible.length} de ${sourceOrders.length} pedidos encontrados. `
            : `${sourceOrders.length} pedidos. `}
          {all || !ready
            ? "Ordem: exceções abertas há mais tempo primeiro; empate pelo código do pedido."
            : "Ordem: prioridade do plano da IA. Os filtros preservam essa sequência."}
        </p>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Pedido / produto</th>
                <th>Pendência</th>
                <th>Por que conferir</th>
                <th>Valor</th>
              </tr>
            </thead>
            <tbody>
              {visible
                .slice((currentPage - 1) * pageSize, currentPage * pageSize)
                .map((o) => (
                  <tr
                    key={o.id}
                    className="order-row"
                    onClick={(event) => {
                      if (
                        (event.target as HTMLElement).closest(
                          "button, a, input, select, textarea",
                        )
                      )
                        return;
                      if (window.getSelection()?.toString()) return;
                      openOrder(o.id);
                    }}
                  >
                    <td>
                      <button
                        className="order-link"
                        aria-label={`Abrir pedido ${o.id} de ${o.brand}`}
                        onClick={() => openOrder(o.id)}
                      >
                        {o.id} · {o.brand}
                      </button>
                      <p>{o.product}</p>
                    </td>
                    <td>
                      {exceptionLabels[o.exception]}
                      <p>{statusLabel(o.status)}</p>
                    </td>
                    <td>
                      {o.priority.age} dias úteis aguardando
                      {o.priority.delay > 0 && (
                        <p>
                          {o.priority.delay} dias úteis{" "}
                          {o.deliveredAt
                            ? "de atraso até a entrega"
                            : "de atraso"}
                        </p>
                      )}
                      {o.status === "status_divergente" && (
                        <p>Validar status antes da tratativa</p>
                      )}
                    </td>
                    <td>{money(o.value)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        {!visible.length && (
          <p>
            {hasOrderFilters
              ? "Nenhum pedido corresponde aos filtros. Ajuste os critérios ou use Limpar filtros."
              : "Nenhum pedido nesta seleção. Consulte a carteira completa ou prepare outro plano."}
          </p>
        )}
        <div className="pagination">
          <span>
            {visible.length} pedidos · página {currentPage} de {totalPages}
          </span>
          <nav className="pagination-numbers" aria-label="Páginas de pedidos">
            {paginationItems(currentPage, totalPages).map((item, index) =>
              item === "ellipsis" ? (
                <span
                  className="pagination-gap"
                  key={`gap-${index}`}
                  aria-hidden="true"
                >
                  …
                </span>
              ) : (
                <Button
                  key={item}
                  variant="outline"
                  aria-label={`Página ${item}`}
                  aria-current={currentPage === item ? "page" : undefined}
                  onClick={() => setPage(item)}
                >
                  {item}
                </Button>
              ),
            )}
          </nav>
        </div>
      </section>
      {ready && day?.plan?.comparison && (
        <Expandable className="panel prose">
          <summary>Comparação deste plano com a ordem de chegada</summary>
          <p>
            Retrato salvo em{" "}
            {new Date(day.plan.createdAt).toLocaleString("pt-BR")}. Mesma base e
            quantidade de vagas; não comprova recuperação financeira.
          </p>
          <div className="result-metrics">
            {Object.entries(day.plan.comparison).map(([name, m]) => (
              <article key={name}>
                <h3>
                  {name === "prioritized"
                    ? "Plano escolhido pelo agente"
                    : "Ordem de chegada (FIFO)"}
                </h3>
                <p>
                  {m.count} pedidos · {money(m.value)} em valor de carteira
                </p>
                <p>Espera média: {m.averageAge.toFixed(1)} dias úteis</p>
                <p>Exposição elegível: {money(m.risk)}</p>
              </article>
            ))}
          </div>
        </Expandable>
      )}
    </>
  );
}
