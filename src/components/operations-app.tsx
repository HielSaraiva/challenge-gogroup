"use client";
import { Expandable } from "./ui/expandable";
import { useCallback, useEffect, useRef, useState } from "react";
import { Bot, Menu, Search, X } from "lucide-react";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "./ui/dialog";
import { DataImport } from "./data-import";
import { Methodology } from "./methodology";
import { OperationsSummary } from "./operations-summary";
import { FinancialImpact } from "./financial-impact";
import { CaseControls } from "./case-controls";
import { TaskResult } from "./task-result";
import { AgentProgress } from "./agent-progress";
import {
  exceptionLabels,
  DEFAULT_WEIGHTS,
  STRATEGIES,
  type Strategy,
  type RankedOrder,
  type Insight,
  type Task,
  type Investigation,
  type ToolEvent,
  type DailyPlan,
} from "@/domain/types";
import type { dashboard } from "@/domain/analytics";
import type { planQueue } from "@/domain/planning";
import type { financialReport } from "@/domain/operations";
import {
  money,
  shortDate,
  statusLabel,
  generatedTextLabel,
  insightGroupLabel,
} from "@/lib/utils";
import { paginationItems } from "@/lib/pagination";
import { orderList, PAGE_SIZES } from "@/lib/order-list";
import {
  currentCaseTasks,
  latestReopen,
  reopenedWithoutTask,
} from "@/domain/case-cycle";
import { awaitingResultOrders } from "@/domain/task-resolution";
import { outcomeLabels } from "@/domain/cases";
type Tab =
  "overview" | "queue" | "agent" | "impact" | "insights" | "data" | "method";
const nav = [
  ["overview", "Hoje"],
  ["queue", "Pedidos"],
  ["agent", "Pendências"],
  ["impact", "Resultados"],
  ["insights", "Melhorias"],
  ["data", "Dados"],
  ["method", "Metodologia"],
] as const;
function recurrenceQuestion(p: Insight) {
  if (p.dimension === "promise_rule")
    return "Por que a promessa difere do contrato?";
  const problem: Record<string, string> = {
    vazamento_produto: "há vazamentos",
    atraso_entrega: "há atrasos",
    item_faltante: "faltam itens",
    falha_personalizacao: "a personalização falha",
    avaria_transporte: "há avarias",
    extravio: "há extravios",
    rastreio_parado: "o rastreio fica parado",
    devolvido_transportadora: "há devoluções",
  };
  const group = p.group.replaceAll("|", " / ");
  const where =
    (
      {
        lot: `no lote ${group}`,
        machine: `na máquina ${group}`,
        carrier: `com a transportadora ${group}`,
        shift: `no turno ${group}`,
        dc: `no CD ${group}`,
        gift:
          p.group === "true"
            ? "nos pedidos com brinde"
            : "nos pedidos sem brinde",
      } as Record<string, string>
    )[p.dimension] || `no grupo ${group}`;
  return `Por que ${problem[p.exception] || "este problema se repete"} ${where}?`;
}
async function get<T>(path: string): Promise<T> {
  const r = await fetch(path, { cache: "no-store" });
  const b = await r.json();
  if (!r.ok)
    throw new Error(b.error || "Não foi possível carregar a operação.");
  return b;
}
export function OperationsApp() {
  const [tab, setActive] = useState<Tab>("overview");
  const [menu, setMenu] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const dailyActivity = useRef<HTMLDivElement>(null);
  const scrollToDailyActivity = useRef(false);
  const [summary, setSummary] = useState<ReturnType<typeof dashboard>>();
  const [day, setDay] = useState<ReturnType<typeof planQueue>>();
  const [financial, setFinancial] =
    useState<ReturnType<typeof financialReport>>();
  const [orders, setOrders] = useState<RankedOrder[]>([]);
  const [patterns, setPatterns] = useState<Insight[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [runs, setRuns] = useState<Investigation[]>([]);
  const [plans, setPlans] = useState<DailyPlan[]>([]);
  const [selectedId, setSelectedId] = useState<string>();
  const [processId, setProcessId] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [activeRun, setActiveRun] = useState<Investigation>();
  useEffect(() => {
    if (!scrollToDailyActivity.current || activeRun?.type !== "daily" || !busy)
      return;
    const frame = requestAnimationFrame(() => {
      const target = dailyActivity.current;
      if (!target) return;
      scrollToDailyActivity.current = false;
      target.focus({ preventScroll: true });
      target.scrollIntoView({
        block: "start",
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [activeRun?.id, activeRun?.type, busy]);
  const [events, setEvents] = useState<ToolEvent[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [resetting, setResetting] = useState(false);
  const [sessionRevision, setSessionRevision] = useState(0);
  const [confirmNewPlan, setConfirmNewPlan] = useState(false);
  const [confirmOrderId, setConfirmOrderId] = useState<string | null>(null);
  const [planStrategy, setPlanStrategy] = useState<Strategy>("equilibrada");
  const [query, setQuery] = useState("");
  const [pageSize, setPageSize] = useState<number>(10);
  const [exceptionFilter, setExceptionFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [all, setAll] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(4);
  const [pendingOnly, setPendingOnly] = useState(true);
  function navigate(next: Tab) {
    setActive(next);
    setMenu(false);
    setPage(1);
    if (window.location.hash !== `#${next}`)
      window.history.pushState(null, "", `#${next}`);
    window.scrollTo({ top: 0 });
  }
  useEffect(() => {
    const restore = () => {
      const hash = window.location.hash.slice(1);
      setActive(
        hash.startsWith("method-")
          ? "method"
          : nav.some(([id]) => id === hash)
            ? (hash as Tab)
            : "overview",
      );
    };
    restore();
    window.addEventListener("popstate", restore);
    window.addEventListener("hashchange", restore);
    return () => {
      window.removeEventListener("popstate", restore);
      window.removeEventListener("hashchange", restore);
    };
  }, []);
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
  }, [tab]);
  const refresh = useCallback(async () => {
    await get("/api/session");
    const [s, q, o, i, t, r, op] = await Promise.all([
      get<ReturnType<typeof dashboard>>("/api/dashboard"),
      get<ReturnType<typeof planQueue>>("/api/queue"),
      get<{ orders: RankedOrder[] }>("/api/orders?limit=10000"),
      get<Insight[]>("/api/insights"),
      get<Task[]>("/api/tasks"),
      get<Investigation[]>("/api/investigations"),
      get<{
        financial: ReturnType<typeof financialReport>;
        plans: DailyPlan[];
      }>("/api/operations"),
    ]);
    setSummary(s);
    setDay(q);
    setOrders(o.orders);
    setPatterns(i);
    setTasks(t);
    setRuns(r);
    setFinancial(op.financial);
    setPlans(op.plans);
  }, []);
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      await refresh();
    } catch (e) {
      setSummary(undefined);
      setDay(undefined);
      const m = (e as Error).message;
      if (!m.startsWith("Base ainda não importada")) setError(m);
    } finally {
      setLoading(false);
    }
  }, [refresh]);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    if (busy || !runs.some((r) => r.status === "running")) return;
    const timer = setInterval(() => void refresh().catch(() => {}), 2500);
    return () => clearInterval(timer);
  }, [busy, runs, refresh]);
  async function investigate(target: string, type: Investigation["type"]) {
    if (busy) return;
    setBusy(true);
    setEvents([]);
    setNotice("");
    let completed = false;
    const requestId = crypto.randomUUID();
    setActiveRun({
      id: requestId,
      type,
      target,
      status: "running",
      summary: "",
      taskIds: [],
      events: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    setError("");
    try {
      const r = await fetch("/api/investigations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target,
          type,
          requestId,
          ...(type === "daily" ? { strategy: planStrategy } : {}),
        }),
      });
      if (!r.ok) throw new Error((await r.json()).error);
      if (r.headers.get("content-type")?.includes("application/json")) {
        const result = (await r.json()).investigation;
        setActiveRun(result);
        completed = result?.status === "completed";
      } else {
        const reader = r.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        while (true) {
          const { done, value } = await reader.read();
          buffer += decoder.decode(value, { stream: !done });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";
          for (const line of lines.filter(Boolean)) {
            const payload = JSON.parse(line);
            if (payload.error) throw new Error(payload.error);
            if (payload.event) setEvents((v) => [...v, payload.event]);
            if (payload.investigation) {
              setActiveRun(payload.investigation);
              completed = payload.investigation.status === "completed";
              if (
                type === "pattern" &&
                payload.investigation.status === "completed"
              )
                setProcessId(payload.investigation.taskIds[0]);
            }
          }
          if (done) break;
        }
      }
      await refresh();
      if (completed && type === "pattern")
        setNotice(
          "Encaminhamento registrado. Abra a investigação em Pendências.",
        );
    } catch (e) {
      const message = (e as Error).message;
      setError(message);
      setActiveRun((previous) =>
        previous
          ? { ...previous, status: "failed", summary: message }
          : previous,
      );
    } finally {
      setBusy(false);
      await refresh().catch(() => {});
    }
  }
  async function reset() {
    setError("");
    try {
      const r = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      if (!r.ok) throw new Error("Não foi possível reiniciar.");
      setSessionRevision((revision) => revision + 1);
      setResetting(false);
      setEvents([]);
      setActiveRun(undefined);
      setSelectedId(undefined);
      setProcessId(undefined);
      await load();
      setNotice("Tratativas reiniciadas. A base escolhida foi preservada.");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  const selected = orders.find((o) => o.id === selectedId);
  const processTask = tasks.find((t) => t.id === processId);
  const ready = day?.usable === true;
  const sourceOrders = all || !ready ? orders : day?.orders || [];
  const visible = orderList(
    sourceOrders,
    { query, exception: exceptionFilter, status: statusFilter },
    !all && ready,
  );
  const hasOrderFilters = Boolean(
    query.trim() || exceptionFilter || statusFilter,
  );
  const exceptionOptions = [
    ...new Set(sourceOrders.map((order) => order.exception)),
  ].sort((a, b) =>
    (exceptionLabels[a] || a).localeCompare(exceptionLabels[b] || b, "pt-BR"),
  );
  const statusOptions = [
    ...new Set(sourceOrders.map((order) => order.status)),
  ].sort((a, b) => statusLabel(a).localeCompare(statusLabel(b), "pt-BR"));
  const totalPages = Math.max(1, Math.ceil(visible.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  function activity(type: Investigation["type"], target?: string) {
    const matches = (run: Investigation) =>
      run.type === type &&
      (target === undefined || run.target === target) &&
      (type !== "order" ||
        !selectedReopen ||
        run.createdAt >= selectedReopen.at);
    const run =
      activeRun && matches(activeRun) ? activeRun : runs.find(matches);
    if (!run) return null;
    const isActive = run.id === activeRun?.id;
    return (
      <AgentProgress
        busy={isActive && busy}
        events={isActive ? events : []}
        run={run}
      />
    );
  }
  const selectedReopen = latestReopen(selected?.caseHistory);
  const related = selected ? currentCaseTasks(selected, tasks) : [];
  const previousTasks =
    selected && selectedReopen
      ? tasks.filter(
          (task) =>
            task.scope !== "process" &&
            task.orderId === selected.id &&
            task.createdAt < selectedReopen.at,
        )
      : [];
  const previousRuns =
    selected && selectedReopen
      ? runs.filter(
          (run) =>
            run.type === "order" &&
            run.target === selected.id &&
            run.createdAt < selectedReopen.at,
        )
      : [];
  function openOrder(id: string) {
    setProcessId(undefined);
    setSelectedId(id);
  }
  const pending = tasks.filter((t) =>
    ["aberta", "aprovada", "pendente_aprovacao"].includes(t.status),
  );
  const awaitingResults = awaitingResultOrders(orders, tasks);
  const awaitingInvestigation = reopenedWithoutTask(orders, tasks);
  return (
    <div className="app-layout">
      <header className="sidebar">
        <a
          className="logo"
          href="#overview"
          aria-label="Gogroup início"
          onClick={(e) => {
            e.preventDefault();
            navigate("overview");
          }}
        >
          <img src="/gogroup-logo.svg" alt="Gogroup" width={164} height={38} />
        </a>
        <span className="brand-product">Agente de operações</span>
        <button
          className="mobile-menu-toggle"
          aria-label={menu ? "Fechar menu" : "Abrir menu"}
          aria-expanded={menu}
          onClick={() => setMenu(!menu)}
        >
          {menu ? <X /> : <Menu />} Menu
        </button>
        <nav
          className={menu ? "menu-open" : ""}
          aria-label="Navegação principal"
        >
          {nav.map(([id, label]) => (
            <button
              className={`nav-item ${tab === id ? "active" : ""}`}
              aria-current={tab === id ? "page" : undefined}
              key={id}
              onClick={() => navigate(id)}
            >
              {label}
              {id === "agent" &&
                pending.length +
                  awaitingResults.length +
                  awaitingInvestigation.length >
                  0 && (
                  <span className="nav-count">
                    {pending.length +
                      awaitingResults.length +
                      awaitingInvestigation.length}
                  </span>
                )}
            </button>
          ))}
        </nav>
      </header>
      <div className="main-shell">
        <main>
          <div
            className={`page-heading ${tab === "overview" ? "brand-opening" : ""}`}
          >
            <div>
              <h1 ref={heading} tabIndex={-1}>
                {
                  {
                    overview: "Prepare seu dia com o agente",
                    queue: "Pedidos para acompanhar",
                    agent: "Pendências da equipe",
                    impact: "Resultados das tratativas",
                    insights: "Melhorias para investigar",
                    data: "Dados da operação",
                    method: "Como funciona e por quê",
                  }[tab]
                }
              </h1>
              <p>
                {
                  {
                    overview:
                      "Escolha o foco do dia. A IA compara alternativas e prepara um plano para a equipe.",
                    queue:
                      "Consulte a carteira recebida ou siga o plano preparado pelo agente.",
                    agent:
                      "Revise propostas, registre execuções e documente investigações.",
                    impact:
                      "Acompanhe o que foi resolvido e os valores realmente registrados.",
                    insights:
                      "Investigue problemas que voltam a acontecer e podem afetar vários pedidos.",
                    data: "Valide os arquivos, confira a origem e gerencie sua demonstração.",
                    method:
                      "Entenda o fluxo e os motivos das decisões de negócio e tecnologia.",
                  }[tab]
                }
              </p>
            </div>
            <div className="date-chip">
              <span>
                Referência do piloto
                <br />
                <b>30/09/2026</b>
              </span>
            </div>
          </div>
          {error && (
            <div className="alert alert-error" role="alert">
              {generatedTextLabel(error)}
              <button aria-label="Dispensar erro" onClick={() => setError("")}>
                ×
              </button>
            </div>
          )}
          {notice && (
            <div className="alert alert-info" role="status">
              {notice}
              <button
                aria-label="Dispensar aviso"
                onClick={() => setNotice("")}
              >
                ×
              </button>
            </div>
          )}
          {tab === "data" ? (
            <>
              <DataImport
                key={sessionRevision}
                onImported={async () => {
                  await load();
                  navigate("overview");
                  setNotice(
                    "Base importada. Prepare o dia com a IA para gerar seu plano.",
                  );
                }}
              />
              <section className="panel prose reset-panel">
                <h2>Reiniciar a demonstração</h2>
                <p>
                  Inicie outra avaliação com a mesma base. Planos, tarefas,
                  investigações e resultados deixarão de aparecer na nova
                  sessão.
                </p>
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => setResetting(true)}
                >
                  Reiniciar minha demonstração
                </Button>
              </section>
            </>
          ) : tab === "method" ? (
            <Methodology
              summary={summary}
              weights={day?.plan?.weights || DEFAULT_WEIGHTS}
            />
          ) : loading ? (
            <p role="status">Conferindo a operação…</p>
          ) : !summary ? (
            <section className="panel prose">
              <h2>Comece pela base de operações</h2>
              <p>
                Importe os três CSVs e confira a qualidade antes de preparar o
                trabalho com IA.
              </p>
              <Button onClick={() => navigate("data")}>
                Abrir Dados e importar
              </Button>
            </section>
          ) : (
            <>
              {tab === "overview" && (
                <>
                  <section className="panel prose agent-command">
                    <span className="badge">
                      <Bot size={16} aria-hidden="true" /> Agente de operações ·
                      Groq
                    </span>
                    <h2>
                      {ready
                        ? "Seu plano está disponível"
                        : "Qual é o melhor foco para hoje?"}
                    </h2>
                    <p>
                      {summary.count} pedidos pendentes recebidos ·{" "}
                      {day?.availableCapacity ?? 150} vagas disponíveis no
                      piloto. Você escolhe o foco; a IA compara as alternativas
                      e registra os encaminhamentos.
                    </p>
                    {day?.status === "needs_review" && (
                      <p role="status">
                        O plano anterior é legado ou a base/status mudou.
                        Prepare outro plano antes de orientar o trabalho.
                      </p>
                    )}
                    {day?.status === "failed" && (
                      <p role="alert">
                        {day.error}{" "}
                        {day.plan
                          ? "O plano anterior continua disponível abaixo e no histórico."
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
                        onClick={() => {
                          setPlanStrategy(day?.plan?.strategy || "equilibrada");
                          setConfirmNewPlan(true);
                        }}
                      >
                        {busy
                          ? "Preparando…"
                          : ready
                            ? "Preparar novo plano com IA"
                            : "Preparar meu dia com IA"}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setAll(!ready);
                          navigate("queue");
                        }}
                      >
                        {ready
                          ? "Abrir pedidos do plano"
                          : "Consultar pedidos recebidos"}
                      </Button>
                    </div>
                    <p className="muted">
                      O agente registra orientações; a equipe executa ações
                      externas e documenta o resultado.
                    </p>
                  </section>
                  <div
                    ref={dailyActivity}
                    className="daily-activity"
                    tabIndex={-1}
                  >
                    {activity("daily")}
                  </div>
                  {ready && day.plan && (
                    <OperationsSummary
                      plan={day.plan}
                      completed={day.completed}
                      pendingIds={day.orders.map((o) => o.id)}
                      onOrder={openOrder}
                    />
                  )}
                  <section className="panel prose">
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
                          {
                            orders.filter(
                              (o) => o.status === "status_divergente",
                            ).length
                          }
                        </dd>
                      </div>
                    </dl>
                    <p>
                      Estes são fatos da base importada. A carteira ainda não é
                      um plano de trabalho da IA.
                    </p>
                  </section>
                </>
              )}
              {tab === "queue" && (
                <>
                  {!ready && (
                    <section className="panel prose">
                      <h2>O plano do agente ainda não está disponível</h2>
                      <p>
                        Você pode consultar os pedidos recebidos. Para gerar a
                        seleção e as orientações, prepare o dia com a IA.
                      </p>
                      <Button onClick={() => navigate("overview")}>
                        Preparar o dia
                      </Button>
                    </section>
                  )}
                  <section className="panel queue-panel">
                    <div className="panel-heading">
                      <h2>
                        {all || !ready
                          ? "Pedidos recebidos"
                          : "Pedidos do plano da IA"}
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
                            .slice(
                              (currentPage - 1) * pageSize,
                              currentPage * pageSize,
                            )
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
                        {visible.length} pedidos · página {currentPage} de{" "}
                        {totalPages}
                      </span>
                      <nav
                        className="pagination-numbers"
                        aria-label="Páginas de pedidos"
                      >
                        {paginationItems(currentPage, totalPages).map(
                          (item, index) =>
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
                                aria-current={
                                  currentPage === item ? "page" : undefined
                                }
                                onClick={() => setPage(item)}
                              >
                                {item}
                              </Button>
                            ),
                        )}
                      </nav>
                    </div>
                  </section>
                  {ready && day.plan?.comparison && (
                    <Expandable className="panel prose">
                      <summary>
                        Comparação deste plano com a ordem de chegada
                      </summary>
                      <p>
                        Retrato salvo em{" "}
                        {new Date(day.plan.createdAt).toLocaleString("pt-BR")}.
                        Mesma base e quantidade de vagas; não comprova
                        recuperação financeira.
                      </p>
                      <div className="result-metrics">
                        {Object.entries(day.plan.comparison).map(
                          ([name, m]) => (
                            <article key={name}>
                              <h3>
                                {name === "prioritized"
                                  ? "Plano escolhido pelo agente"
                                  : "Ordem de chegada (FIFO)"}
                              </h3>
                              <p>
                                {m.count} pedidos · {money(m.value)} em valor de
                                carteira
                              </p>
                              <p>
                                Espera média: {m.averageAge.toFixed(1)} dias
                                úteis
                              </p>
                              <p>Exposição elegível: {money(m.risk)}</p>
                            </article>
                          ),
                        )}
                      </div>
                    </Expandable>
                  )}
                </>
              )}
              {tab === "agent" && (
                <>
                  <section className="panel prose">
                    <h2>O que precisa de acompanhamento?</h2>
                    <p>
                      Execuções concluídas continuam aqui enquanto o resultado
                      do pedido não for confirmado.
                    </p>
                    <label className="check-label">
                      <input
                        type="checkbox"
                        checked={pendingOnly}
                        onChange={(e) => setPendingOnly(e.target.checked)}
                      />
                      Mostrar somente pendências
                    </label>
                    {awaitingInvestigation.map((order) => (
                      <article
                        className="result-row"
                        key={`reopened-${order.id}`}
                      >
                        <span className="badge">
                          Pedido reaberto — aguardando nova investigação
                        </span>
                        <h3>
                          {order.id} · {exceptionLabels[order.exception]}
                        </h3>
                        <p>
                          A etapa anterior foi preservada. Investigue o pedido
                          para gerar um novo encaminhamento.
                        </p>
                        <Button
                          variant="outline"
                          onClick={() => openOrder(order.id)}
                        >
                          Abrir pedido e iniciar nova etapa
                        </Button>
                      </article>
                    ))}
                    {awaitingResults.map((order) => (
                      <article
                        key={`result-${order.id}`}
                        className="result-row"
                      >
                        <span className="badge">
                          Aguardando resultado do pedido
                        </span>
                        <h3>
                          {order.id} · {exceptionLabels[order.exception]}
                        </h3>
                        <p>
                          A execução foi registrada, mas o pedido permanece
                          aberto. Confirme o resultado ou acompanhe o que ainda
                          falta resolver.
                        </p>
                        <Button
                          variant="outline"
                          onClick={() => openOrder(order.id)}
                        >
                          Abrir pedido e confirmar resultado
                        </Button>
                      </article>
                    ))}
                    {tasks
                      .filter(
                        (t) =>
                          !pendingOnly ||
                          ["aberta", "aprovada", "pendente_aprovacao"].includes(
                            t.status,
                          ),
                      )
                      .map((t) => (
                        <article key={t.id} className="result-row">
                          <span className="badge">
                            {t.scope === "process" ? "Recorrência" : t.area} ·{" "}
                            {statusLabel(t.status)}
                          </span>
                          <h3>{generatedTextLabel(t.title)}</h3>
                          <p>{generatedTextLabel(t.justification)}</p>
                          <Button
                            variant="outline"
                            onClick={() =>
                              t.scope === "process"
                                ? setProcessId(t.id)
                                : openOrder(t.orderId)
                            }
                          >
                            {t.scope === "process"
                              ? "Abrir investigação"
                              : "Abrir pedido e acompanhar"}
                          </Button>
                        </article>
                      ))}
                    {tasks.length > 0 &&
                      pendingOnly &&
                      !pending.length &&
                      !awaitingResults.length &&
                      !awaitingInvestigation.length && (
                        <p>
                          Não há pendências. Desmarque o filtro para consultar
                          os registros concluídos.
                        </p>
                      )}
                    {!tasks.length && !awaitingInvestigation.length && (
                      <p>
                        O agente ainda não registrou tarefas. Prepare o dia e
                        investigue um pedido, ou escolha uma recorrência em
                        Melhorias.
                      </p>
                    )}
                  </section>
                  <Expandable className="panel prose">
                    <summary>Histórico de análises e planos</summary>
                    {plans.map((plan) => (
                      <article key={plan.id} className="result-row">
                        <b>
                          Plano de{" "}
                          {new Date(plan.createdAt).toLocaleString("pt-BR")} ·{" "}
                          {plan.strategy
                            ? STRATEGIES[plan.strategy].label
                            : "Plano legado"}
                        </b>
                        <p>
                          {(plan.strategyReason &&
                            generatedTextLabel(plan.strategyReason)) ||
                            "Política anterior, sem comparação de estratégias registrada."}
                        </p>
                        <p>{generatedTextLabel(plan.briefing)}</p>
                        <Expandable>
                          <summary>Consultar orientações salvas</summary>
                          {plan.workstreams.map((stream) => (
                            <p key={stream.area}>
                              <b>{stream.area}:</b>{" "}
                              {generatedTextLabel(stream.nextStep)}
                            </p>
                          ))}
                        </Expandable>
                      </article>
                    ))}
                    {runs.map((r) => (
                      <article className="result-row" key={r.id}>
                        <b>
                          {r.type === "daily"
                            ? "Plano do dia"
                            : r.type === "pattern"
                              ? "Recorrência"
                              : "Pedido"}{" "}
                          · {statusLabel(r.status)}
                        </b>
                        <p>
                          {shortDate(r.createdAt.slice(0, 10))} ·{" "}
                          {generatedTextLabel(r.summary)}
                        </p>
                      </article>
                    ))}
                  </Expandable>
                </>
              )}
              {tab === "impact" && financial && (
                <FinancialImpact report={financial} onOrder={openOrder} />
              )}
              {tab === "insights" && (
                <>
                  <section className="panel prose">
                    <h2>Qual problema pode estar se repetindo?</h2>
                    <p>
                      Escolha um sinal. A IA consulta evidências e cria uma
                      investigação para a equipe conferir a hipótese. Finalizar
                      esse diagnóstico não resolve os pedidos nem implanta uma
                      melhoria.
                    </p>
                    <p>
                      Os sinais usam somente a base de exceções; não demonstram
                      taxa de falha sobre todas as vendas.
                    </p>
                    <Button variant="outline" onClick={() => navigate("agent")}>
                      Acompanhar investigações abertas
                    </Button>
                  </section>
                  <div className="insight-grid">
                    {patterns
                      .filter((p) => p.scope === "process")
                      .slice(0, limit)
                      .map((p) => (
                        <article className="panel prose" key={p.id}>
                          <span className="badge">
                            {exceptionLabels[p.exception] || "Prazo prometido"}
                          </span>
                          <h2>{recurrenceQuestion(p)}</h2>
                          <p>
                            <b>
                              Grupo a conferir: {insightGroupLabel(p.group)}
                            </b>
                          </p>
                          <p>
                            {p.count} casos relacionados dentro desta análise.
                          </p>
                          <p>{p.investigationQuestion}</p>
                          <Expandable>
                            <summary>
                              Por que este sinal merece investigação?
                            </summary>
                            <p>
                              {p.title}. A concentração é um ponto de partida; é
                              preciso conferir os registros dos pedidos e
                              validar em campo.
                            </p>
                            <p>
                              Referências:{" "}
                              {p.evidenceIds.slice(0, 3).join(", ")}
                            </p>
                          </Expandable>
                          <Button
                            disabled={busy}
                            onClick={() => void investigate(p.id, "pattern")}
                          >
                            Investigar recorrência com IA
                          </Button>
                        </article>
                      ))}
                  </div>
                  {!patterns.some((p) => p.scope === "process") && (
                    <p>
                      Nenhum sinal suficiente para investigação de recorrência
                      nesta base. Continue pelas tratativas individuais.
                    </p>
                  )}
                  {patterns.filter((p) => p.scope === "process").length >
                    limit && (
                    <Button
                      variant="outline"
                      onClick={() => setLimit(limit + 4)}
                    >
                      Ver outros sinais
                    </Button>
                  )}
                  {activity("pattern")}
                </>
              )}
            </>
          )}
          <footer>
            <span>
              Dados sintéticos · demonstração independente por sessão · nenhuma
              ação externa automática
            </span>
          </footer>
        </main>
      </div>
      <Dialog
        open={Boolean(selected)}
        onOpenChange={(open) => {
          if (!open) setSelectedId(undefined);
        }}
      >
        <DialogContent className="order-dialog">
          {selected && (
            <>
              <header className="order-dialog-header">
                <DialogTitle>Pedido {selected.id}</DialogTitle>
                <DialogDescription>
                  {selected.brand} · {selected.product}
                </DialogDescription>
                <div className="order-dialog-badges">
                  <span className="badge">
                    {exceptionLabels[selected.exception]}
                  </span>
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
                    <dt>
                      {selected.deliveredAt ? "Atraso até a entrega" : "Atraso"}
                    </dt>
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
                            [
                              "aberta",
                              "aprovada",
                              "pendente_aprovacao",
                            ].includes(t.status),
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
                {!selected.resolution &&
                  selected.status !== "status_divergente" && (
                    <Button
                      disabled={busy}
                      onClick={() => {
                        const alreadyAnalyzed =
                          related.length > 0 ||
                          runs.some(
                            (run) =>
                              run.type === "order" &&
                              run.target === selected.id &&
                              (!selectedReopen ||
                                run.createdAt >= selectedReopen.at) &&
                              run.status === "completed",
                          ) ||
                          (activeRun?.type === "order" &&
                            activeRun.target === selected.id &&
                            (!selectedReopen ||
                              activeRun.createdAt >= selectedReopen.at) &&
                            activeRun.status === "completed");
                        if (alreadyAnalyzed) setConfirmOrderId(selected.id);
                        else void investigate(selected.id, "order");
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
                    A origem não informa qual status é o mais recente. Confira a
                    fonte e registre a revisão abaixo.
                  </p>
                )}
              </section>
              {selectedReopen && !selected.resolution && (
                <p className="case-next-step">
                  Reaberto em{" "}
                  {new Date(selectedReopen.at).toLocaleString("pt-BR")}. Motivo:{" "}
                  {selectedReopen.note}. As execuções anteriores não encerram
                  esta nova etapa.
                </p>
              )}
              {activity("order", selected.id)}
              <Expandable className="panel prose order-facts-panel">
                <summary>Conferir fatos, prazos e histórico do cliente</summary>
                <p>
                  Pedido: {shortDate(selected.orderedAt)} · Exceção:{" "}
                  {shortDate(selected.openedAt)}
                </p>
                <p>
                  Promessa original: {shortDate(selected.promisedAt)} ·
                  Contrato: {shortDate(selected.priority.contractPromise)} ·
                  Entrega:{" "}
                  {selected.deliveredAt
                    ? shortDate(selected.deliveredAt)
                    : "não registrada"}
                </p>
                <p>
                  {selected.carrier} / {selected.state} · CD {selected.dc} ·
                  turno {selected.shift} · máquina{" "}
                  {selected.machine || "não informada"} · lote {selected.lot}
                </p>
                <p>
                  {selected.customer?.orders} pedidos do cliente · histórico de{" "}
                  {money(selected.customer?.revenue || "0")}
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
                    A investigação individual com IA pode ser feita sem preparar
                    o plano do dia.
                  </p>
                )}
                {related.map((t) => (
                  <div key={t.id}>
                    {t.kind.startsWith("proposta") && (
                      <p className="case-next-step">
                        Custo estimado pelo servidor:{" "}
                        {money(
                          t.kind === "proposta_reembolso"
                            ? selected.value
                            : selected.priority.resendCost,
                        )}
                        . Verifique a viabilidade e os registros externos antes
                        de executar.
                      </p>
                    )}
                    <TaskResult
                      task={t}
                      orders={orders}
                      tasks={tasks}
                      onSaved={refresh}
                    />
                  </div>
                ))}
              </section>
              {selectedReopen &&
                (previousTasks.length > 0 || previousRuns.length > 0) && (
                  <Expandable className="panel prose order-facts-panel">
                    <summary>Etapas anteriores — somente consulta</summary>
                    <p>
                      Estes registros pertencem ao atendimento anterior à última
                      reabertura e não comprovam a resolução da etapa atual.
                    </p>
                    {previousTasks.map((task) => (
                      <article className="case-history-event" key={task.id}>
                        <strong>
                          {generatedTextLabel(task.title)} ·{" "}
                          {statusLabel(task.status)}
                        </strong>
                        <p>{generatedTextLabel(task.justification)}</p>
                        {task.execution && (
                          <>
                            <p>
                              <strong>Ação registrada:</strong>{" "}
                              {task.execution.note}
                            </p>
                            <p>
                              <strong>Evidência:</strong>{" "}
                              {task.execution.evidence}
                            </p>
                          </>
                        )}
                      </article>
                    ))}
                    {previousRuns.map((run) => (
                      <AgentProgress
                        key={run.id}
                        run={run}
                        events={[]}
                        busy={false}
                      />
                    ))}
                  </Expandable>
                )}
              <CaseControls
                key={selected.id + selected.status + (selectedReopen?.id || "")}
                order={selected}
                tasks={tasks}
                disabled={busy}
                onSaved={refresh}
              />
              <Expandable className="panel prose case-history">
                <summary>Histórico deste caso</summary>
                {!selected.caseHistory?.length && (
                  <p className="case-history-empty">
                    Nenhuma alteração registrada neste pedido. As validações de
                    status, os encerramentos e as reaberturas aparecerão aqui.
                    Investigações e tarefas ficam em “Encaminhamentos para este
                    pedido”.
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
                        <strong>Resultado:</strong>{" "}
                        {outcomeLabels[event.outcome.type]}
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
                        <strong>Status confirmado:</strong>{" "}
                        {statusLabel(event.status)}
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
                <DialogContent className="new-plan-dialog">
                  <span className="new-plan-icon" aria-hidden="true">
                    <Bot size={24} />
                  </span>
                  <DialogTitle>Investigar este pedido novamente?</DialogTitle>
                  <DialogDescription>
                    O pedido {selected.id} já tem uma análise ou encaminhamentos
                    registrados. A IA consultará novamente as evidências para
                    reavaliar o caso.
                  </DialogDescription>
                  <div className="new-plan-consequences">
                    <div>
                      <strong>Os registros anteriores serão preservados</strong>
                      <p>
                        A nova análise não apaga tarefas, execuções ou
                        histórico. Encaminhamentos existentes podem ser
                        mantidos, sem criar tarefas duplicadas.
                      </p>
                    </div>
                  </div>
                  <div className="new-plan-footer">
                    <Button
                      variant="outline"
                      onClick={() => setConfirmOrderId(null)}
                    >
                      Manter análise atual
                    </Button>
                    <Button
                      disabled={busy || Boolean(selected.resolution)}
                      onClick={() => {
                        const orderId = confirmOrderId;
                        setConfirmOrderId(null);
                        if (orderId === selected.id)
                          void investigate(orderId, "order");
                      }}
                    >
                      Investigar novamente
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={Boolean(processTask)}
        onOpenChange={(open) => {
          if (!open) setProcessId(undefined);
        }}
      >
        <DialogContent>
          {processTask && (
            <>
              <DialogTitle>Investigação de recorrência</DialogTitle>
              <DialogDescription>
                Documente o diagnóstico do grupo. Os pedidos continuam com
                tratativas independentes.
              </DialogDescription>
              <TaskResult
                key={processTask.id}
                task={processTask}
                orders={orders}
                tasks={tasks}
                onSaved={refresh}
              />
            </>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={confirmNewPlan} onOpenChange={setConfirmNewPlan}>
        <DialogContent
          className="new-plan-dialog"
          onCloseAutoFocus={(event) => {
            if (scrollToDailyActivity.current || busy) event.preventDefault();
          }}
        >
          <span className="new-plan-icon" aria-hidden="true">
            <Bot size={24} />
          </span>
          <DialogTitle>
            {day?.plan ? "Preparar um novo plano" : "Preparar meu dia com IA"}
          </DialogTitle>
          <DialogDescription>
            Escolha o foco da equipe. A IA comparará as alternativas, aplicará
            sua escolha e preparará os encaminhamentos.
          </DialogDescription>
          <fieldset className="plan-strategies">
            <legend>Qual é o foco para este plano?</legend>
            {(
              Object.entries(STRATEGIES) as [
                Strategy,
                (typeof STRATEGIES)[Strategy],
              ][]
            ).map(([id, strategy]) => (
              <label className="plan-strategy" key={id}>
                <input
                  type="radio"
                  name="plan-strategy"
                  value={id}
                  checked={planStrategy === id}
                  onChange={() => setPlanStrategy(id)}
                />
                <span>
                  <strong>{strategy.label}</strong>
                  <span>
                    {id === "equilibrada"
                      ? "Equilibra valor dos pedidos, tempo de espera e histórico do cliente."
                      : id === "urgencia"
                        ? "Dá mais peso ao tempo de espera e aos atrasos."
                        : "Dá mais peso ao histórico do cliente e ao potencial de relacionamento."}
                  </span>
                </span>
              </label>
            ))}
          </fieldset>
          {day?.plan && (
            <div className="new-plan-consequences">
              <div>
                <strong>O novo plano passa a ser o ativo</strong>
                <p>O plano atual continuará disponível no histórico.</p>
              </div>
              <div>
                <strong>Seu trabalho fica preservado</strong>
                <p>
                  As tratativas registradas serão mantidas. Se a análise falhar,
                  o plano atual continua ativo.
                </p>
              </div>
            </div>
          )}
          <div className="new-plan-footer">
            <Button variant="outline" onClick={() => setConfirmNewPlan(false)}>
              {day?.plan ? "Manter plano atual" : "Cancelar"}
            </Button>
            <Button
              disabled={
                busy ||
                day?.status === "preparing" ||
                !day?.availableCapacity ||
                !summary?.count
              }
              onClick={() => {
                setConfirmNewPlan(false);
                scrollToDailyActivity.current = true;
                void investigate("day", "daily");
              }}
            >
              {day?.plan ? "Gerar novo plano" : "Preparar plano com IA"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={resetting} onOpenChange={setResetting}>
        <DialogContent>
          <DialogTitle>Reiniciar esta demonstração?</DialogTitle>
          <DialogDescription>
            A nova sessão não terá planos, tarefas, investigações ou resultados.
            A base escolhida será preservada. Os registros anteriores não são
            copiados para a nova avaliação.
          </DialogDescription>
          <div className="task-actions">
            <Button variant="outline" onClick={() => setResetting(false)}>
              Cancelar
            </Button>
            <Button onClick={() => void reset()}>Confirmar reinício</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
