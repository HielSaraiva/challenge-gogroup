"use client";
import type { WorkspaceSnapshot } from "@/domain/workspace";
import { LatestRequest } from "@/lib/latest-request";
import { FormSafetyBoundary } from "./hooks/form-safety";
import { RecurrenceInvestigation } from "./recurrence-investigation";
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
import { ImprovementsWorkspace } from "./improvements-workspace";
import { PendingWorkspace } from "./pending-workspace";
import { pendingWork } from "@/domain/pending-work";
import { FinancialImpact } from "./financial-impact";
import { CaseControls } from "./case-controls";
import { TaskResult } from "./task-result";
import { AgentProgress } from "./agent-progress";
import {
  CAPACITY,
  exceptionLabels,
  DEFAULT_WEIGHTS,
  STRATEGIES,
  type Strategy,
  type RankedOrder,
  type Insight,
  type Task,
  type Investigation,
  type ToolEvent,
} from "@/domain/types";
import type { dashboard } from "@/domain/analytics";
import type { planQueue } from "@/domain/planning";
import type { financialReport } from "@/domain/operations";
import { money, shortDate, statusLabel, generatedTextLabel } from "@/lib/utils";
import { paginationItems } from "@/lib/pagination";
import { orderList, PAGE_SIZES } from "@/lib/order-list";
import { currentCaseTasks, latestReopen } from "@/domain/case-cycle";
import { outcomeLabels } from "@/domain/cases";
type Tab =
  "overview" | "queue" | "agent" | "impact" | "insights" | "data" | "method";
const nav = [
  ["overview", "Hoje"],
  ["queue", "Pedidos"],
  ["agent", "Pendências"],
  ["impact", "Resultados"],
  ["insights", "Recorrências"],
  ["data", "Dados"],
  ["method", "Metodologia"],
] as const;
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
  const [selectedId, setSelectedId] = useState<string>();
  const [processId, setProcessId] = useState<string>();
  const [processDirty, setProcessDirty] = useState(false);
  const [processSaving, setProcessSaving] = useState(false);
  const [processDestination, setProcessDestination] = useState<string | null>();
  function changeProcess(id?: string) {
    if (processSaving) return;
    if (processDirty) {
      setProcessDestination(id ?? null);
      return;
    }
    setProcessId(id);
  }
  const [activePatternId, setActivePatternId] = useState<string>();
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
  const [orderSafety, setOrderSafety] = useState({ dirty: false, busy: false });
  const [confirmOrderClose, setConfirmOrderClose] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);
  const resetLock = useRef(false);
  const [refreshWarning, setRefreshWarning] = useState("");
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
  const requests = useRef(new LatestRequest());
  const refresh = useCallback(async () => {
    const ticket = requests.current.begin();
    try {
      const snapshot = await get<WorkspaceSnapshot>("/api/workspace");
      if (!requests.current.isCurrent(ticket)) return;
      setSummary(snapshot.summary);
      setDay(snapshot.day);
      setOrders(snapshot.orders);
      setPatterns(snapshot.patterns);
      setTasks(snapshot.tasks);
      setRuns(snapshot.runs);
      setFinancial(snapshot.financial);
    } catch (error) {
      if (requests.current.isCurrent(ticket)) throw error;
    }
  }, []);
  const refreshAfterSave = useCallback(async () => {
    try {
      await refresh();
      setRefreshWarning("");
    } catch {
      setRefreshWarning(
        "Registro salvo. A tela ainda precisa ser atualizada; não repita a operação.",
      );
    }
  }, [refresh]);
  useEffect(() => {
    if (!orderSafety.dirty && !processDirty) return;
    const prevent = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", prevent);
    return () => window.removeEventListener("beforeunload", prevent);
  }, [orderSafety.dirty, processDirty]);
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      await refresh();
    } catch (e) {
      setSummary(undefined);
      setDay(undefined);
      setOrders([]);
      setTasks([]);
      setRuns([]);
      setPatterns([]);
      setFinancial(undefined);
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
    if (busy || resetBusy || !runs.some((r) => r.status === "running")) return;
    const timer = setInterval(() => void refresh().catch(() => {}), 2500);
    return () => clearInterval(timer);
  }, [busy, resetBusy, runs, refresh]);
  async function investigate(
    target: string,
    type: Investigation["type"],
    renewFromTaskId?: string,
  ) {
    if (busy) return;
    setBusy(true);
    if (type === "pattern") setActivePatternId(target);
    if (type === "recurrences") setActivePatternId(undefined);
    setEvents([]);
    setNotice("");
    let completed = false;
    let processToOpen: string | undefined;
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
          ...(renewFromTaskId ? { renewFromTaskId } : {}),
          ...(type === "daily" ? { strategy: planStrategy } : {}),
        }),
      });
      if (!r.ok) throw new Error((await r.json()).error);
      if (r.headers.get("content-type")?.includes("application/json")) {
        const body = await r.json();
        if (body.taskId) {
          processToOpen = body.taskId;
          setActiveRun(undefined);
          setNotice(
            "Investigação já registrada. Abrindo o registro existente, sem nova chamada à IA.",
          );
        } else {
          const result = body.investigation;
          setActiveRun(result);
          completed = result?.status === "completed";
          if (type === "pattern") processToOpen = result?.taskIds?.[0];
        }
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
                processToOpen = payload.investigation.taskIds[0];
            }
          }
          if (done) break;
        }
      }
      await refresh();
      if (processToOpen && type === "pattern") setProcessId(processToOpen);
      if (completed && type === "recurrences")
        setNotice(
          "Análise concluída. Confira a seleção do agente e as investigações abaixo.",
        );
      if (completed && type === "pattern")
        setNotice(
          "Investigação registrada. Confira a hipótese e documente a verificação pela equipe.",
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
    if (resetLock.current) return;
    requests.current.invalidate();
    resetLock.current = true;
    setResetBusy(true);
    setError("");
    try {
      const r = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      if (!r.ok) throw new Error("Não foi possível reiniciar.");
      setQuery("");
      setExceptionFilter("");
      setStatusFilter("");
      setPage(1);
      setPageSize(10);
      setAll(false);
      setPlanStrategy("equilibrada");
      setRefreshWarning("");
      setOrders([]);
      setPatterns([]);
      setTasks([]);
      setRuns([]);
      setFinancial(undefined);
      setSummary(undefined);
      setDay(undefined);
      setSessionRevision((revision) => revision + 1);
      setResetting(false);
      setEvents([]);
      setActiveRun(undefined);
      setSelectedId(undefined);
      setProcessId(undefined);
      setActivePatternId(undefined);
      await load();
      setNotice("Demonstração reiniciada com a base padrão de 30/09/2026.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      resetLock.current = false;
      setResetBusy(false);
    }
  }
  const selected = orders.find((o) => o.id === selectedId);
  const processTask = tasks.find((t) => t.id === processId);
  const processPattern = patterns.find(
    (pattern) => pattern.id === processTask?.insightId,
  );
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
  function openOrder(id: string) {
    setProcessId(undefined);
    setSelectedId(id);
  }
  const pendingCount = pendingWork(orders, tasks).length;
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
          <img src="/gogroup-logo.svg" alt="Gogroup" width={159} height={32} />
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
              {id === "agent" && pendingCount > 0 && (
                <span className="nav-count">{pendingCount}</span>
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
                    impact: "Resultados da operação",
                    insights: "Recorrências para investigar",
                    data: "Dados da operação",
                    method: "Metodologia da operação",
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
                      "Veja pedidos abertos e resolvidos, tipos de solução e valores registrados.",
                    insights:
                      "Identifique problemas repetidos e investigue possíveis causas na operação.",
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
                  requests.current.invalidate();
                  await load();
                  navigate("overview");
                  setNotice(
                    "Base importada. Consulte Pedidos ou prepare um plano em Hoje.",
                  );
                }}
              />
              <section className="panel prose reset-panel">
                <h2>Reiniciar a demonstração</h2>
                <p>
                  Volte à base padrão de 30/09/2026. A importação desta sessão,
                  os planos, as tarefas, as investigações e os resultados não
                  serão mantidos na nova demonstração.
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
                      {day?.availableCapacity ?? CAPACITY} vagas disponíveis no
                      piloto. Você escolhe o foco; a IA compara as alternativas
                      e registra os encaminhamentos.
                    </p>
                    {day?.status === "needs_review" && (
                      <p role="status">
                        O plano precisa de atualização após mudanças nos dados
                        ou nas regras. Gere outro plano ou consulte a carteira
                        em Pedidos.
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
                      Indicadores dos pedidos ainda abertos. A seleção do plano
                      é apresentada separadamente, em “Seu plano de trabalho”.
                    </p>
                  </section>
                </>
              )}
              {tab === "queue" && (
                <>
                  {!ready && (
                    <section className="panel prose">
                      <h2>Consulte pedidos com ou sem plano</h2>
                      <p>
                        Abra uma linha para investigar o pedido diretamente.
                        Para uma seleção priorizada, prepare um plano em Hoje.
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
                    <p className="queue-order-note">
                      {all || !ready
                        ? "Ordem de abertura da exceção: mais antiga primeiro; em empate, código do pedido. Não é a data da compra."
                        : "Ordem de prioridade do plano. Os filtros mantêm essa ordem."}
                    </p>
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
                <PendingWorkspace
                  key={sessionRevision}
                  orders={orders}
                  tasks={tasks}
                  onOrder={openOrder}
                  onProcess={setProcessId}
                />
              )}
              {tab === "impact" && financial && (
                <FinancialImpact
                  report={financial}
                  capacity={day?.plan ? day : undefined}
                />
              )}
              {tab === "insights" && (
                <ImprovementsWorkspace
                  key={sessionRevision}
                  patterns={patterns}
                  tasks={tasks}
                  runs={runs}
                  busy={busy}
                  analyzing={
                    busy &&
                    (activeRun?.type === "recurrences" ||
                      activeRun?.type === "pattern")
                  }
                  onAnalyze={() => investigate("base", "recurrences")}
                  activity={
                    activeRun?.type === "pattern" && activePatternId
                      ? activity("pattern", activePatternId)
                      : activity("recurrences")
                  }
                  onInvestigate={(id, previousId) =>
                    investigate(id, "pattern", previousId)
                  }
                  onProcess={setProcessId}
                  onPending={() => navigate("agent")}
                />
              )}
            </>
          )}
          {refreshWarning && (
            <div className="alert alert-info" role="status">
              {refreshWarning}{" "}
              <Button variant="outline" onClick={() => void refreshAfterSave()}>
                Atualizar tela
              </Button>
            </div>
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
          if (!open && !orderSafety.busy) {
            if (orderSafety.dirty) setConfirmOrderClose(true);
            else setSelectedId(undefined);
          }
        }}
      >
        <DialogContent className="order-dialog">
          <FormSafetyBoundary onChange={setOrderSafety}>
            {refreshWarning && (
              <div className="alert alert-info" role="status">
                {refreshWarning}{" "}
                <Button
                  variant="outline"
                  onClick={() => void refreshAfterSave()}
                >
                  Atualizar tela
                </Button>
              </div>
            )}
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
                    <span className="badge">
                      {statusLabel(selected.status)}
                    </span>
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
                        {selected.deliveredAt
                          ? "Atraso até a entrega"
                          : "Atraso"}
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
                                (t) =>
                                  t.execution && t.kind !== "revisao_status",
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
                      A origem não informa qual status é o mais recente. Confira
                      a fonte e registre a revisão abaixo.
                    </p>
                  )}
                </section>
                {selectedReopen && !selected.resolution && (
                  <p className="case-next-step">
                    Reaberto em{" "}
                    {new Date(selectedReopen.at).toLocaleString("pt-BR")}.
                    Motivo: {selectedReopen.note}
                    <br />
                    As execuções anteriores não encerram esta nova etapa.
                  </p>
                )}
                {activity("order", selected.id)}
                <Expandable className="panel prose order-facts-panel">
                  <summary>
                    Conferir fatos, prazos e histórico do cliente
                  </summary>
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
                    {selected.carrier} / {selected.state} · Centro de
                    distribuição: {selected.dc} · turno {selected.shift} ·
                    máquina {selected.machine || "não informada"} · lote{" "}
                    {selected.lot}
                  </p>
                  <p>
                    {selected.customer?.orders} pedidos do cliente · valor
                    acumulado de compras:{" "}
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
                      A investigação individual com IA pode ser feita sem
                      preparar o plano do dia.
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
                              Cálculo do piloto: 24% do valor total do pedido +
                              frete da transportadora.{" "}
                              {selected.exception === "item_faltante" &&
                                "Para item faltante, essa aproximação pode superestimar o custo: a base não informa o preço individual do item. "}
                              Não é uma cotação nem um custo efetivamente
                              realizado.
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
                  key={
                    selected.id + selected.status + (selectedReopen?.id || "")
                  }
                  order={selected}
                  tasks={tasks}
                  disabled={busy}
                  onSaved={refreshAfterSave}
                />
                <Expandable className="panel prose case-history">
                  <summary>Histórico deste caso</summary>
                  {!selected.caseHistory?.length && (
                    <p className="case-history-empty">
                      Nenhuma alteração registrada neste pedido. As validações
                      de status, os encerramentos e as reaberturas aparecerão
                      aqui. Investigações e tarefas ficam em “Encaminhamentos
                      para este pedido”.
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
                      O pedido {selected.id} já tem uma análise ou
                      encaminhamentos registrados. A IA consultará novamente as
                      evidências para reavaliar o caso.
                    </DialogDescription>
                    <div className="new-plan-consequences">
                      <div>
                        <strong>
                          Os registros anteriores serão preservados
                        </strong>
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
          </FormSafetyBoundary>
        </DialogContent>
      </Dialog>
      <Dialog
        open={Boolean(processTask)}
        onOpenChange={(open) => {
          if (!open) changeProcess();
        }}
      >
        <DialogContent className="recurrence-dialog">
          {refreshWarning && (
            <div className="alert alert-info" role="status">
              {refreshWarning}{" "}
              <Button variant="outline" onClick={() => void refreshAfterSave()}>
                Atualizar tela
              </Button>
            </div>
          )}
          {processTask && (
            <>
              <DialogTitle>{generatedTextLabel(processTask.title)}</DialogTitle>
              <DialogDescription>
                Confira as evidências, salve o andamento e registre a conclusão
                quando terminar a verificação.
              </DialogDescription>
              {processTask.previousTaskId && (
                <Button
                  variant="outline"
                  onClick={() => changeProcess(processTask.previousTaskId)}
                >
                  Consultar investigação anterior
                </Button>
              )}
              <RecurrenceInvestigation
                key={processTask.id}
                task={processTask}
                orders={orders}
                pattern={processPattern}
                onDirtyChange={setProcessDirty}
                onBusyChange={setProcessSaving}
                onSaved={refreshAfterSave}
              />
            </>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={processDestination !== undefined}
        onOpenChange={(open) => {
          if (!open) setProcessDestination(undefined);
        }}
      >
        <DialogContent className="new-plan-dialog">
          <DialogTitle>Há alterações não salvas</DialogTitle>
          <DialogDescription>
            Para retomar estas anotações depois, volte e use “Salvar progresso”.
            Sair agora descarta apenas as alterações desde o último salvamento.
          </DialogDescription>
          <div className="new-plan-footer">
            <Button
              variant="outline"
              onClick={() => setProcessDestination(undefined)}
            >
              Continuar editando
            </Button>
            <Button
              onClick={() => {
                setProcessDirty(false);
                setProcessId(processDestination || undefined);
                setProcessDestination(undefined);
              }}
            >
              Sair sem salvar alterações
            </Button>
          </div>
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
          <div className="plan-capacity-note">
            <strong>
              Até {Math.min(summary?.count || 0, day?.availableCapacity || 0)}{" "}
              pedidos neste plano
            </strong>
            <p>
              {day?.availableCapacity || 0} de {day?.capacity || CAPACITY} vagas
              de referência disponíveis. Cada encerramento registrado conta como
              uma tratativa no piloto.
            </p>
          </div>
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
                <p>
                  O plano anterior será preservado nos registros da sessão. A
                  tela mostrará o novo plano.
                </p>
              </div>
              <div>
                <strong>Seu trabalho fica preservado</strong>
                <p>
                  As tratativas registradas serão mantidas. Se a análise falhar,
                  o plano atual será preservado.
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
      <Dialog open={confirmOrderClose} onOpenChange={setConfirmOrderClose}>
        <DialogContent>
          <DialogTitle>Há alterações não salvas</DialogTitle>
          <DialogDescription>
            Sair descarta os campos ainda não registrados neste pedido.
          </DialogDescription>
          <div className="task-actions">
            <Button
              variant="outline"
              onClick={() => setConfirmOrderClose(false)}
            >
              Continuar editando
            </Button>
            <Button
              onClick={() => {
                setConfirmOrderClose(false);
                setSelectedId(undefined);
              }}
            >
              Sair sem salvar alterações
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog
        open={resetting}
        onOpenChange={(open) => {
          if (!resetBusy) setResetting(open);
        }}
      >
        <DialogContent>
          <DialogTitle>Reiniciar esta demonstração?</DialogTitle>
          <DialogDescription>
            A nova sessão não terá planos, tarefas, investigações ou resultados.
            A base padrão de 30/09/2026 será restaurada. A base importada nesta
            sessão e os registros anteriores não serão copiados para a nova
            avaliação.
          </DialogDescription>
          <div className="task-actions">
            <Button
              variant="outline"
              disabled={resetBusy}
              onClick={() => setResetting(false)}
            >
              Cancelar
            </Button>
            <Button disabled={resetBusy} onClick={() => void reset()}>
              {resetBusy ? "Reiniciando…" : "Confirmar reinício"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
