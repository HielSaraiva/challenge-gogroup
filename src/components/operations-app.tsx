"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Bot,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  ClipboardList,
  Clock3,
  FileText,
  Filter,
  Layers3,
  LayoutDashboard,
  Loader2,
  Menu,
  Package,
  RotateCcw,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  TriangleAlert,
  X,
} from "lucide-react";
import { Button } from "./ui/button";
import { CaseControls } from "./case-controls";
import {
  OperationsSummary,
  isPlanCurrent,
  type OperationsReport,
} from "./operations-summary";
import { FinancialImpact } from "./financial-impact";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "./ui/dialog";
import {
  DEFAULT_WEIGHTS,
  exceptionLabels,
  type RankedOrder,
  type Insight,
  type Investigation,
  type Task,
  type ToolEvent,
  type Weights,
} from "@/domain/types";
import { money, shortDate, statusLabel } from "@/lib/utils";
import type { dashboard, queue } from "@/domain/analytics";
type Dashboard = ReturnType<typeof dashboard>;
type Queue = ReturnType<typeof queue>;
type Tab = "overview" | "queue" | "insights" | "agent" | "impact" | "method";
const navigation = [
  { id: "overview", title: "Operação hoje", icon: LayoutDashboard },
  { id: "queue", title: "Fila do dia", icon: Layers3 },
  { id: "insights", title: "Causas e processos", icon: Search },
  { id: "agent", title: "Agente e tarefas", icon: Sparkles },
  { id: "impact", title: "Impacto financeiro", icon: BarChart3 },
  { id: "method", title: "Metodologia", icon: FileText },
] as const;
async function get<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: "no-store" });
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.error || "Não foi possível carregar os dados.");
  return data;
}
function Label({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: string;
}) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}
function Empty({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="empty">
      <Package size={30} />
      <h3>{title}</h3>
      <div className="empty-description">{children}</div>
    </div>
  );
}
function Meter({ value, label }: { value: number; label?: string }) {
  return (
    <div className="meter-wrap">
      {label && (
        <div className="meter-caption">
          <span>{label}</span>
          <b>{Math.round(value)}%</b>
        </div>
      )}
      <div className="meter">
        <span style={{ width: `${Math.min(Math.max(value, 0), 100)}%` }} />
      </div>
    </div>
  );
}

export function OperationsApp() {
  const [tab, setTab] = useState<Tab>("overview");
  const [menuOpen, setMenuOpen] = useState(false);
  const [summary, setSummary] = useState<Dashboard>();
  const [dayQueue, setQueue] = useState<Queue>();
  const [allOrders, setAllOrders] = useState<RankedOrder[]>([]);
  const [patterns, setPatterns] = useState<Insight[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [runs, setRuns] = useState<Investigation[]>([]);
  const [operations, setOperations] = useState<OperationsReport>();
  const [frontIds, setFrontIds] = useState<string[]>();
  const [taskScope, setTaskScope] = useState("all");
  const [weights, setWeights] = useState<Weights>(DEFAULT_WEIGHTS);
  const [draftWeights, setDraftWeights] = useState<Weights>(DEFAULT_WEIGHTS);
  const [query, setQuery] = useState("");
  const [type, setType] = useState("");
  const [brand, setBrand] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [showAll, setShowAll] = useState(false);
  const [showWeights, setShowWeights] = useState(false);
  const [selected, setSelected] = useState<RankedOrder>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [events, setEvents] = useState<ToolEvent[]>([]);
  const [resetting, setResetting] = useState(false);
  const [taskPending, setTaskPending] = useState<string>();
  const [patternQuery, setPatternQuery] = useState("");
  const [patternDimension, setPatternDimension] = useState("");
  const [patternType, setPatternType] = useState("");
  const [patternLimit, setPatternLimit] = useState(6);
  useEffect(
    () => setPatternLimit(6),
    [patternQuery, patternDimension, patternType],
  );
  const visiblePatterns = patterns.filter(
    (p) =>
      (!patternDimension || p.dimension === patternDimension) &&
      (!patternType || p.exception === patternType) &&
      p.title
        .toLocaleLowerCase("pt-BR")
        .includes(patternQuery.toLocaleLowerCase("pt-BR")),
  );
  const refreshActivity = useCallback(async () => {
    const [t, r, op] = await Promise.all([
      get<Task[]>("/api/tasks"),
      get<Investigation[]>("/api/investigations"),
      get<OperationsReport>("/api/operations"),
    ]);
    setTasks(t);
    setRuns(r);
    setOperations(op);
  }, []);
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      // Estabelecer cookie antes das requisições paralelas evita sessões concorrentes na primeira visita.
      await get("/api/session");
      const [s, q, o, i] = await Promise.all([
        get<Dashboard>("/api/dashboard"),
        get<Queue>("/api/queue"),
        get<{ orders: RankedOrder[] }>("/api/orders?limit=2000"),
        get<Insight[]>("/api/insights"),
      ]);
      setSummary(s);
      setQueue(q);
      setAllOrders(o.orders);
      setPatterns(i);
      await refreshActivity();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [refreshActivity]);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    if (busy || !runs.some((run) => run.status === "running")) return;
    const timer = setInterval(() => {
      void refreshActivity().catch(() => {});
    }, 2500);
    return () => clearInterval(timer);
  }, [runs, busy, refreshActivity]);
  useEffect(() => {
    setPage(1);
  }, [query, type, brand, status, showAll]);
  const filtered = useMemo(
    () =>
      (showAll ? allOrders : dayQueue?.orders || []).filter(
        (o) =>
          (!type || o.exception === type) &&
          (!brand || o.brand === brand) &&
          (!status || o.status === status) &&
          (!frontIds || frontIds.includes(o.id)) &&
          `${o.id} ${o.brand} ${o.product} ${o.city}`
            .toLocaleLowerCase("pt-BR")
            .includes(query.toLocaleLowerCase("pt-BR")),
      ),
    [allOrders, dayQueue, showAll, type, brand, status, query, frontIds],
  );
  const openTasks = tasks.filter(
    (t) => t.status === "aberta" || t.status === "pendente_aprovacao",
  );
  const currentPlan = isPlanCurrent(
    operations?.plans[0],
    dayQueue?.orders || [],
    weights,
    operations?.usedCapacity || 0,
  );
  async function refreshWorkspace(nextWeights = weights) {
    const query = new URLSearchParams(
      Object.entries(nextWeights).map(([key, value]) => [key, String(value)]),
    );
    const [s, q, o] = await Promise.all([
      get<Dashboard>("/api/dashboard"),
      get<Queue>(`/api/queue?${query}`),
      get<{ orders: RankedOrder[] }>(`/api/orders?limit=2000&${query}`),
    ]);
    setSummary(s);
    setQueue(q);
    setAllOrders(o.orders);
    setSelected((previous) =>
      previous ? o.orders.find((order) => order.id === previous.id) : undefined,
    );
    await refreshActivity();
  }
  async function applyWeights() {
    try {
      await refreshWorkspace(draftWeights);
      setWeights({ ...draftWeights });
      setShowWeights(false);
      setShowAll(false);
      setPage(1);
      setNotice(
        "Prioridade recalculada. Os pesos são uma heurística, não uma previsão de perda.",
      );
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function startInvestigation(
    target: string,
    kind: Investigation["type"],
  ) {
    if (busy) return;
    setBusy(true);
    setEvents([]);
    setError("");
    setSelected(undefined);
    setTab("agent");
    try {
      const response = await fetch("/api/investigations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: kind,
          target,
          requestId: crypto.randomUUID(),
          ...(kind === "daily" ? { weights } : {}),
        }),
      });
      if (!response.ok) {
        const body = await response.json();
        throw new Error(body.error);
      }
      if (response.headers.get("content-type")?.includes("application/json")) {
        await refreshActivity();
        return;
      }
      const reader = response.body!.getReader();
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
          if (payload.event)
            setEvents((previous) => [...previous, payload.event]);
          if (payload.investigation?.status === "failed")
            setNotice(payload.investigation.summary);
          if (kind === "daily" && payload.investigation?.status === "completed")
            setTab("overview");
        }
        if (done) break;
      }
    } catch (e) {
      setError(
        (e as Error).message ||
          "A conexão foi interrompida. Consulte o histórico.",
      );
    } finally {
      setBusy(false);
      await refreshWorkspace().catch(() => {});
    }
  }
  function openQueue(ids?: string[]) {
    setFrontIds(ids);
    setQuery("");
    setType("");
    setBrand("");
    setStatus("");
    setShowAll(false);
    setPage(1);
    setTab("queue");
  }
  async function changeTask(task: Task, nextStatus: string) {
    if (taskPending) return;
    setTaskPending(task.id);
    try {
      const r = await fetch("/api/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: task.id, status: nextStatus }),
      });
      const result = await r.json();
      if (!r.ok) throw new Error(result.error);
      await refreshActivity();
      setNotice(
        nextStatus === "aprovada"
          ? "Proposta aprovada na demonstração. Nenhum pagamento ou reenvio foi executado."
          : "Tarefa atualizada.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setTaskPending(undefined);
    }
  }
  async function reset() {
    setResetting(true);
    try {
      const r = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      if (!r.ok) throw new Error("Não foi possível reiniciar.");
      setEvents([]);
      setResetting(false);
      setTab("overview");
      setDraftWeights(DEFAULT_WEIGHTS);
      setWeights(DEFAULT_WEIGHTS);
      await load();
      setNotice("Nova demonstração iniciada. A base original foi preservada.");
    } catch (e) {
      setError((e as Error).message);
      setResetting(false);
    }
  }
  function orderTable(orders: RankedOrder[], compact = false) {
    return (
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Pedido / produto</th>
              <th>Exceção</th>
              {!compact && <th>Prazo / atraso</th>}
              <th>Valor</th>
              <th>
                Prioridade <CircleHelp size={12} />
              </th>
              <th>
                <span className="sr-only">Detalhes</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id} onClick={() => setSelected(o)}>
                <td>
                  <button className="order-link" onClick={() => setSelected(o)}>
                    {o.id} <span>{o.brand}</span>
                  </button>
                  <p className="product-name" title={o.product}>
                    {o.product}
                  </p>
                </td>
                <td>
                  <Label
                    tone={
                      o.exception === "extravio" ||
                      o.exception === "falha_personalizacao"
                        ? "orange"
                        : "neutral"
                    }
                  >
                    {exceptionLabels[o.exception]}
                  </Label>
                  {o.status === "status_divergente" && (
                    <p className="conflict">Status divergente</p>
                  )}
                </td>
                {!compact && (
                  <td>
                    <span>{shortDate(o.promisedAt)}</span>
                    <p className={o.priority.delay > 0 ? "delay" : "muted"}>
                      {o.priority.delay
                        ? `${o.priority.delay} dias úteis${o.deliveredAt ? " até entrega" : " de atraso"}`
                        : "Sem atraso"}
                    </p>
                  </td>
                )}
                <td className="nowrap">{money(o.value)}</td>
                <td>
                  <div className="score">
                    <span
                      className={
                        o.priority.score >= 70 ? "score-dot high" : "score-dot"
                      }
                    />
                    {o.priority.score.toFixed(1)}
                    <small>/100</small>
                  </div>
                  {o.selectionReason && (
                    <small className="selection-reason">
                      {o.selectionReason}
                    </small>
                  )}
                </td>
                <td>
                  <ChevronRight size={16} className="muted" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!orders.length && (
          <Empty title="Nenhum pedido encontrado">
            Ajuste os filtros ou a busca para ver outros pedidos.
          </Empty>
        )}
      </div>
    );
  }
  return (
    <div className="app-shell">
      <header className="sidebar">
        <a className="logo" href="/" aria-label="Gogroup início">
          <img src="/gogroup-logo.svg" alt="gogroup" width={159} height={32} />
        </a>
        <span className="brand-product">Go Operations</span>
        <button
          className="mobile-menu-toggle"
          aria-label={menuOpen ? "Fechar menu" : "Abrir menu"}
          aria-expanded={menuOpen}
          aria-controls="operation-navigation"
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? <X size={21} /> : <Menu size={21} />} Menu
        </button>
        <nav
          id="operation-navigation"
          className={menuOpen ? "menu-open" : ""}
          aria-label="Navegação principal"
        >
          {navigation.map((n) => (
            <button
              key={n.id}
              className={`nav-item ${tab === n.id ? "active" : ""}`}
              aria-current={tab === n.id ? "page" : undefined}
              onClick={() => {
                setTab(n.id);
                setMenuOpen(false);
                setPage(1);
              }}
            >
              <n.icon size={18} />
              {n.title}
              {n.id === "queue" && (
                <span className="nav-count">
                  {dayQueue?.orders.length ?? "—"}
                </span>
              )}
              {n.id === "agent" && openTasks.length > 0 && (
                <span className="nav-count">{openTasks.length}</span>
              )}
            </button>
          ))}
        </nav>
      </header>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <span className="topbar-brand">gogroup</span>{" "}
            <ChevronRight size={13} />
            <strong>{navigation.find((n) => n.id === tab)?.title}</strong>
          </div>
          <div className="topbar-right">
            <Label tone="green">
              <span className="live-dot" /> Demo interativa
            </Label>
            <span className="avatar">OP</span>
          </div>
        </header>
        <main>
          <div
            className={`page-heading ${tab === "overview" ? "brand-opening" : ""}`}
          >
            <div>
              {tab === "overview" && (
                <span className="opening-context">
                  Central de operações / Go Operations
                </span>
              )}
              <h1>
                {tab === "overview" ? (
                  <>
                    Amor pelo Cliente.
                    <br />
                    Ação na operação.
                  </>
                ) : tab === "queue" ? (
                  "Fila priorizada"
                ) : tab === "insights" ? (
                  "Causas e melhorias de processo"
                ) : tab === "agent" ? (
                  "Ações e investigações do agente"
                ) : tab === "impact" ? (
                  "Risco e resultado financeiro"
                ) : (
                  "Decisões que você pode explicar."
                )}
              </h1>
              <p>
                {tab === "overview"
                  ? "Prepare o plano com o agente, distribua as frentes e acompanhe as tratativas."
                  : tab === "queue"
                    ? "Uma fila transparente, construída para a capacidade real do seu time."
                    : tab === "insights"
                      ? "Diferencie o atendimento individual dos sinais que exigem investigar o processo."
                      : tab === "agent"
                        ? "Planos e encaminhamentos criados com ferramentas, evidências e histórico."
                        : tab === "impact"
                          ? "Exposição, cenários e resultados declarados, apresentados separadamente."
                          : "Conheça as regras, os cálculos e os limites desta demonstração."}
              </p>
            </div>
            {tab === "overview" && (
              <div className="brand-circuit" aria-hidden="true">
                <svg viewBox="0 0 390 235" fill="none">
                  <path
                    className="circuit-track"
                    d="M115 70H275Q295 70 295 90V180Q295 200 275 200H115Q95 200 95 180V90Q95 70 115 70Z"
                  />
                  <path
                    className="circuit-track"
                    d="M115 55H275Q310 55 310 90V180Q310 215 275 215H115Q80 215 80 180V90Q80 55 115 55Z"
                  />
                  <circle className="circuit-signal" r="3.5">
                    <animateMotion
                      dur="9s"
                      calcMode="paced"
                      repeatCount="indefinite"
                      path="M115 70H275Q295 70 295 90V180Q295 200 275 200H115Q95 200 95 180V90Q95 70 115 70Z"
                    />
                  </circle>
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <ellipse
                      key={i}
                      cx={153 + i * 17}
                      cy="24"
                      rx="13"
                      ry="18"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    />
                  ))}
                  <circle cx="195" cy="135" r="44" fill="white" />
                  <text
                    x="195"
                    y="145"
                    textAnchor="middle"
                    fill="#2659a5"
                    fontFamily="Poppins, sans-serif"
                    fontSize="66"
                    fontWeight="600"
                  >
                    g
                  </text>
                  <text
                    x="195"
                    y="174"
                    textAnchor="middle"
                    fill="#2659a5"
                    fontFamily="Poppins, sans-serif"
                    fontSize="9"
                    fontWeight="500"
                    letterSpacing="1"
                  >
                    gogroup
                  </text>
                </svg>
              </div>
            )}
            <div className="date-chip">
              <CalendarDays size={16} />
              <div>
                <small>Data operacional</small>
                <b>30 set, 2026</b>
              </div>
            </div>
          </div>
          {error && (
            <div className="alert alert-error" role="alert">
              <TriangleAlert size={18} />
              <span>{error}</span>
              <button aria-label="Dispensar erro" onClick={() => setError("")}>
                <X size={16} />
              </button>
            </div>
          )}
          {notice && (
            <div className="alert alert-info" role="status">
              <CheckCircle2 size={18} />
              <span>{notice}</span>
              <button
                aria-label="Dispensar aviso"
                onClick={() => setNotice("")}
              >
                <X size={16} />
              </button>
            </div>
          )}
          {loading ? (
            <div className="loading">
              <Loader2 className="spin" size={28} />
              <p>Organizando os próximos passos da operação…</p>
            </div>
          ) : !summary || !dayQueue ? (
            <Empty title="Prepare a base de operações">
              <p>
                Importe os CSVs pelo comando administrativo e configure o banco
                para publicar. Os dados não são incluídos no código público.
              </p>
              <Button onClick={load}>Tentar novamente</Button>
            </Empty>
          ) : (
            <>
              <div
                className="session-progress"
                aria-label="Progresso da sua sessão"
              >
                <span className="session-progress-title">
                  <ShieldCheck size={16} /> Sua operação nesta sessão
                </span>
                <span>
                  <b>{summary.resolvedCount}</b> exceções encerradas
                </span>
                <span>
                  <b>{summary.reviewedCount}</b> status revisados
                </span>
                <span>
                  <b>{tasks.filter((t) => t.status === "concluida").length}</b>{" "}
                  tarefas concluídas
                </span>
                <button onClick={() => setTab("agent")}>
                  Acompanhar ações <ArrowUpRight size={14} />
                </button>
              </div>
              {tab === "overview" && (
                <>
                  {operations && (
                    <OperationsSummary
                      report={operations}
                      selection={dayQueue?.orders || []}
                      weights={weights}
                      busy={busy}
                      onPrepare={() => startInvestigation("day", "daily")}
                      onQueue={openQueue}
                      onInsights={() => setTab("insights")}
                      onImpact={() => setTab("impact")}
                    />
                  )}
                  <section
                    className="metrics"
                    aria-label="Indicadores da carteira"
                  >
                    <Metric
                      icon={Package}
                      label="Exceções na sua fila"
                      value={summary.count.toLocaleString("pt-BR")}
                      detail={`${summary.totalCount.toLocaleString("pt-BR")} pedidos únicos na base original`}
                    />
                    <Metric
                      icon={BarChart3}
                      label="Carteira pendente"
                      value={money(summary.value)}
                      detail="Valor dos pedidos, não perda estimada"
                    />
                    <Metric
                      icon={TriangleAlert}
                      label="Exposição a cancelamento"
                      value={money(summary.risk)}
                      detail="Probabilidade × valor · logística pendente"
                      tone="orange"
                    />
                    <Metric
                      icon={Target}
                      label="Casos encerrados"
                      value={String(summary.resolvedCount)}
                      detail={`${dayQueue.usedCapacity} tratativas consumidas na sessão`}
                      tone="green"
                    />
                  </section>
                  <div className="overview-grid">
                    <section className="panel distribution">
                      <div className="panel-heading">
                        <div>
                          <h2>Onde estão as exceções</h2>
                          <p>
                            Distribuição por tipo · {summary.count} pedidos
                            únicos
                          </p>
                        </div>
                        <span className="icon-box">
                          <BarChart3 size={17} />
                        </span>
                      </div>
                      <div className="bars">
                        {summary.exceptions.slice(0, 6).map((e, i) => (
                          <button
                            className="bar-row"
                            key={e.type}
                            onClick={() => {
                              setType(e.type);
                              setShowAll(true);
                              setTab("queue");
                            }}
                          >
                            <div className="bar-top">
                              <span>{e.label}</span>
                              <b>
                                {e.count}
                                <small>
                                  {((e.count / summary.count) * 100).toFixed(1)}
                                  %
                                </small>
                              </b>
                            </div>
                            <div className="bar-track">
                              <span
                                className={`bar-color-${i}`}
                                style={{
                                  width: `${(e.count / summary.exceptions[0].count) * 100}%`,
                                }}
                              />
                            </div>
                          </button>
                        ))}
                      </div>
                      <button
                        className="text-link"
                        onClick={() => {
                          setShowAll(true);
                          setType("");
                          setTab("queue");
                        }}
                      >
                        Ver todas as exceções <ArrowRight size={14} />
                      </button>
                    </section>
                    <section className="panel patterns-preview">
                      <div className="panel-heading">
                        <div>
                          <h2>Sinais para investigar</h2>
                          <p>Evidências que merecem um olhar mais próximo</p>
                        </div>
                        <Label tone="purple">
                          <Sparkles size={12} /> Padrões
                        </Label>
                      </div>
                      {[
                        "falha_personalizacao:machine:",
                        "item_faltante:dc:",
                        "vazamento_produto:lot:",
                      ]
                        .map((prefix) =>
                          patterns.find((p) => p.id.startsWith(prefix)),
                        )
                        .filter((p): p is Insight => Boolean(p))
                        .map((p, i) => (
                          <div className="signal" key={p.id}>
                            <span className={`signal-icon signal-${i}`}>
                              {i === 0 ? (
                                <Activity size={18} />
                              ) : i === 1 ? (
                                <Package size={18} />
                              ) : (
                                <Layers3 size={18} />
                              )}
                            </span>
                            <div>
                              <h3>{p.title}</h3>
                              <p>
                                <b>
                                  {p.count} de {p.total}
                                </b>{" "}
                                casos desta exceção{" "}
                                <span>({(p.share * 100).toFixed(0)}%)</span>
                              </p>
                              <small>
                                Concentração observada · hipótese a verificar
                              </small>
                            </div>
                            <button
                              onClick={() =>
                                startInvestigation(p.id, "pattern")
                              }
                              disabled={busy}
                              aria-label={`Investigar ${p.title}`}
                            >
                              <ArrowUpRight size={18} />
                            </button>
                          </div>
                        ))}
                      <button
                        className="text-link"
                        onClick={() => setTab("insights")}
                      >
                        Explorar investigações <ArrowRight size={14} />
                      </button>
                    </section>
                  </div>
                  <section className="panel">
                    <div className="panel-heading">
                      <div>
                        <div className="heading-inline">
                          <h2>Prioridade de hoje</h2>
                          <Label tone="orange">Top 5</Label>
                        </div>
                        <p>
                          Valor, urgência e relacionamento. Cada posição tem uma
                          explicação.
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setTab("queue")}
                      >
                        Ver fila completa <ArrowRight size={14} />
                      </Button>
                    </div>
                    {orderTable(dayQueue.orders.slice(0, 5), true)}
                  </section>
                  <div className="quality-note">
                    <ShieldCheck size={17} />
                    <span>
                      <b>Qualidade dos dados em evidência.</b>{" "}
                      {summary.conflicts} conflitos de status e{" "}
                      {summary.promiseMismatches} promessas divergentes do
                      contrato preservados para revisão.
                    </span>
                    <button onClick={() => setTab("method")}>
                      Entenda <ArrowRight size={13} />
                    </button>
                  </div>
                </>
              )}
              {tab === "queue" && (
                <>
                  <div className="queue-explanation">
                    <p>
                      <b>
                        {dayQueue.orders.length} pedidos selecionados para{" "}
                        {dayQueue.availableCapacity} vagas restantes.
                      </b>{" "}
                      Reserva de {dayQueue.oldestReserved} vagas para os casos
                      mais antigos; demais por valor, urgência e relacionamento.
                      Cada encerramento consome uma vaga.
                    </p>
                    {frontIds && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setFrontIds(undefined)}
                      >
                        Remover filtro da frente
                      </Button>
                    )}
                  </div>
                  <div className="comparison-grid">
                    <Compare
                      title="Fila priorizada"
                      data={dayQueue.prioritized}
                      primary
                    />
                    <Compare
                      title="Ordem de chegada (FIFO)"
                      data={dayQueue.fifo}
                    />
                    <div className="panel comparison-note">
                      <Target size={22} />
                      <h3>
                        A mesma capacidade.
                        <br />
                        Uma escolha explicável.
                      </h3>
                      <p>
                        Comparação de {dayQueue.orders.length} vagas em cada
                        fila. Maior valor coberto não comprova maior recuperação
                        financeira.
                      </p>
                    </div>
                  </div>
                  <section className="panel queue-panel">
                    <div className="panel-heading">
                      <div>
                        <h2>
                          Fila de trabalho{" "}
                          <span className="muted">
                            /{" "}
                            {frontIds
                              ? `${filtered.length} pedidos no recorte da frente`
                              : showAll
                                ? "toda a carteira"
                                : `${dayQueue.orders.length} prioridades`}
                          </span>
                        </h2>
                        <p>
                          Pesos ativos: valor {weights.value} · urgência{" "}
                          {weights.urgency} · relacionamento{" "}
                          {weights.relationship}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowWeights(!showWeights)}
                      >
                        <Filter size={14} /> Ajustar prioridade
                      </Button>
                    </div>
                    {showWeights && (
                      <div className="weights">
                        {(["value", "urgency", "relationship"] as const).map(
                          (key, i) => (
                            <label key={key}>
                              {["Valor", "Urgência", "Relacionamento"][i]}{" "}
                              <b>{draftWeights[key]}</b>
                              <input
                                aria-label={`Peso ${["valor", "urgência", "relacionamento"][i]}`}
                                type="range"
                                min="0"
                                max="100"
                                value={draftWeights[key]}
                                onChange={(e) =>
                                  setDraftWeights((p) => ({
                                    ...p,
                                    [key]: Number(e.target.value),
                                  }))
                                }
                              />
                            </label>
                          ),
                        )}
                        <Button size="sm" onClick={applyWeights}>
                          Aplicar pesos
                        </Button>
                        <small>
                          Os pesos são normalizados pela soma. A pontuação é uma
                          heurística.
                        </small>
                      </div>
                    )}
                    <div className="filters">
                      <label className="search-input">
                        <Search size={16} />
                        <input
                          aria-label="Buscar pedidos"
                          placeholder="Buscar pedido, marca ou produto…"
                          value={query}
                          onChange={(e) => setQuery(e.target.value)}
                        />
                      </label>
                      <select
                        aria-label="Filtrar por tipo de exceção"
                        value={type}
                        onChange={(e) => setType(e.target.value)}
                      >
                        <option value="">Todas as exceções</option>
                        {Object.entries(exceptionLabels).map(([key, name]) => (
                          <option value={key} key={key}>
                            {name}
                          </option>
                        ))}
                      </select>
                      <select
                        aria-label="Filtrar por marca"
                        value={brand}
                        onChange={(e) => setBrand(e.target.value)}
                      >
                        <option value="">Todas as marcas</option>
                        {[...new Set(allOrders.map((o) => o.brand))]
                          .sort()
                          .map((b) => (
                            <option key={b}>{b}</option>
                          ))}
                      </select>
                      <select
                        aria-label="Filtrar por status"
                        value={status}
                        onChange={(e) => setStatus(e.target.value)}
                      >
                        <option value="">Todos os status</option>
                        {[...new Set(allOrders.map((o) => o.status))]
                          .sort()
                          .map((s) => (
                            <option key={s} value={s}>
                              {statusLabel(s)}
                            </option>
                          ))}
                      </select>
                      <label className="toggle">
                        <input
                          type="checkbox"
                          checked={showAll}
                          onChange={(e) => setShowAll(e.target.checked)}
                        />{" "}
                        Toda a carteira
                      </label>
                    </div>
                    {orderTable(filtered.slice((page - 1) * 15, page * 15))}
                    <div className="pagination">
                      <span>
                        {filtered.length} pedidos · página {page} de{" "}
                        {Math.max(1, Math.ceil(filtered.length / 15))}
                      </span>
                      <div>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={page <= 1}
                          onClick={() => setPage((p) => p - 1)}
                          aria-label="Página anterior"
                        >
                          <ChevronLeft size={15} />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={page * 15 >= filtered.length}
                          onClick={() => setPage((p) => p + 1)}
                          aria-label="Próxima página"
                        >
                          <ChevronRight size={15} />
                        </Button>
                      </div>
                    </div>
                  </section>
                  <Button variant="outline" onClick={() => setTab("impact")}>
                    Avaliar risco, custos e cenário financeiro{" "}
                    <ArrowRight size={14} />
                  </Button>
                </>
              )}
              {tab === "insights" && (
                <>
                  <div className="scope-guide">
                    <div>
                      <b>Caso a caso</b>
                      <p>
                        Verificar endereço, pagamento, estoque ou a tratativa de
                        um pedido com o cliente.
                      </p>
                    </div>
                    <div>
                      <b>Investigar processo</b>
                      <p>
                        Recorrência ou divergência de regra exige uma ação para
                        o grupo, com responsável e hipótese de validação. Não
                        prova causa.
                      </p>
                    </div>
                  </div>
                  <div className="alert alert-info">
                    <CircleHelp size={18} />
                    <span>
                      A base contém somente exceções. Estes sinais mostram
                      concentração, não taxa de falha ou causalidade. O agente
                      cria uma tarefa de investigação a partir de evidências.
                    </span>
                  </div>
                  <div className="panel insight-filters">
                    <div className="filters">
                      <label className="search-input">
                        <Search size={16} />
                        <input
                          aria-label="Buscar padrões"
                          placeholder="Buscar grupo, máquina, CD ou transportadora…"
                          value={patternQuery}
                          onChange={(e) => setPatternQuery(e.target.value)}
                        />
                      </label>
                      <select
                        aria-label="Filtrar dimensão do padrão"
                        value={patternDimension}
                        onChange={(e) => setPatternDimension(e.target.value)}
                      >
                        <option value="">Todas as dimensões</option>
                        {Object.entries({
                          carrier: "Transportadora",
                          state: "UF",
                          machine: "Máquina",
                          shift: "Turno",
                          dc: "CD",
                          lot: "Lote",
                          gift: "Brinde",
                          carrier_state: "Transportadora / UF",
                          machine_shift_dc: "Máquina / turno / CD",
                          promise_rule: "Regra de prazo",
                        }).map(([key, label]) => (
                          <option key={key} value={key}>
                            {label}
                          </option>
                        ))}
                      </select>
                      <select
                        aria-label="Filtrar exceção do padrão"
                        value={patternType}
                        onChange={(e) => setPatternType(e.target.value)}
                      >
                        <option value="">Todas as exceções</option>
                        {Object.entries({
                          ...exceptionLabels,
                          divergencia_prazo: "Divergência de prazo",
                        }).map(([key, label]) => (
                          <option key={key} value={key}>
                            {label}
                          </option>
                        ))}
                      </select>
                      <span className="pattern-count">
                        {visiblePatterns.length} sinais encontrados
                      </span>
                    </div>
                  </div>
                  {!visiblePatterns.length && (
                    <Empty title="Nenhum sinal com estes filtros">
                      Ajuste a busca ou selecione outra dimensão.
                    </Empty>
                  )}
                  <div className="insight-grid">
                    {visiblePatterns.slice(0, patternLimit).map((p) => (
                      <section className="panel insight-card" key={p.id}>
                        <div className="insight-top">
                          <span className="icon-box">
                            <Search size={18} />
                          </span>
                          <Label>
                            {
                              (
                                {
                                  carrier: "Transportadora",
                                  state: "UF",
                                  machine: "Máquina",
                                  shift: "Turno",
                                  dc: "Centro de distribuição",
                                  lot: "Lote",
                                  gift: "Brinde",
                                  carrier_state: "Transportadora / UF",
                                  machine_shift_dc: "Máquina / turno / CD",
                                  promise_rule: "Regra de prazo",
                                } as Record<string, string>
                              )[p.dimension]
                            }
                          </Label>
                        </div>
                        <h2>{p.title}</h2>
                        <Label
                          tone={p.scope === "process" ? "purple" : "neutral"}
                        >
                          {p.scope === "process"
                            ? "Investigar processo"
                            : "Validar caso a caso"}
                        </Label>
                        <div className="insight-number">
                          {(p.share * 100).toFixed(1)}
                          <span>%</span>
                        </div>
                        <Meter value={p.share * 100} />
                        <p>
                          <b>
                            {p.count} de {p.total}
                          </b>{" "}
                          registros elegíveis com esta dimensão disponível.
                        </p>
                        {p.dimension !== "promise_rule" && (
                          <p className="association-note">
                            Na base de exceções:{" "}
                            {(p.baselineShare * 100).toFixed(1)}%. Associação
                            relativa: <b>{p.enrichment.toFixed(2)}×</b>. Não é
                            taxa de falha das vendas.
                          </p>
                        )}
                        <small>{p.hypothesis}</small>
                        <p className="validation-question">
                          <b>Como validar</b>
                          {p.investigationQuestion}
                        </p>
                        <div className="evidence-links">
                          {p.evidenceIds.slice(0, 3).map((id) => (
                            <button
                              key={id}
                              onClick={() =>
                                setSelected(allOrders.find((o) => o.id === id))
                              }
                            >
                              {id}
                            </button>
                          ))}
                          <span>
                            +{Math.max(0, p.evidenceIds.length - 3)} evidências
                          </span>
                        </div>
                        <Button
                          variant="outline"
                          disabled={busy}
                          onClick={() => startInvestigation(p.id, "pattern")}
                        >
                          <Sparkles size={15} />{" "}
                          {p.scope === "process"
                            ? "Criar ação de processo com IA"
                            : "Investigar caso com IA"}{" "}
                          <ArrowUpRight size={15} />
                        </Button>
                      </section>
                    ))}
                  </div>
                  {visiblePatterns.length > patternLimit && (
                    <Button
                      variant="outline"
                      onClick={() => setPatternLimit((limit) => limit + 6)}
                    >
                      Mostrar próximos sinais (
                      {visiblePatterns.length - patternLimit} restantes)
                    </Button>
                  )}
                </>
              )}
              {tab === "agent" && (
                <>
                  {operations && (
                    <div className="agent-start">
                      <div>
                        <h2>Comece pelo plano do dia</h2>
                        <p>
                          O agente organiza a seleção inteira por área. Use a
                          investigação individual para aprofundar um caso.
                        </p>
                      </div>
                      <Button
                        disabled={busy || !dayQueue.orders.length}
                        onClick={() =>
                          currentPlan
                            ? setTab("overview")
                            : startInvestigation("day", "daily")
                        }
                      >
                        <Sparkles size={16} />{" "}
                        {currentPlan
                          ? "Abrir plano do dia"
                          : "Preparar plano do dia"}
                      </Button>
                    </div>
                  )}
                  {(busy || events.length > 0) && (
                    <section className="panel execution">
                      <div className="panel-heading">
                        <h2>
                          {busy ? (
                            <>
                              <Loader2 size={18} className="spin" />{" "}
                              Investigação em andamento
                            </>
                          ) : (
                            "Última execução"
                          )}
                        </h2>
                        <Label tone={busy ? "purple" : "neutral"}>
                          {busy ? "Ao vivo" : "Finalizada"}
                        </Label>
                      </div>
                      <div className="tool-timeline" aria-live="polite">
                        {events.map((e, i) => (
                          <div
                            className={`tool-event event-${e.state}`}
                            key={i}
                          >
                            <span>
                              {e.state === "ok" ? (
                                <Check size={14} />
                              ) : e.state === "error" ? (
                                <X size={14} />
                              ) : (
                                <Clock3 size={14} />
                              )}
                            </span>
                            <div>
                              <b>{e.tool.replaceAll("_", " ")}</b>
                              <p>{e.message}</p>
                            </div>
                            <small>
                              {new Date(e.at).toLocaleTimeString("pt-BR")}
                            </small>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}
                  <div className="section-title">
                    <h2>
                      Tarefas e propostas <span>{tasks.length}</span>
                    </h2>
                    <p>
                      Ações restritas à sua demonstração · nenhum envio ou
                      pagamento real
                    </p>
                  </div>
                  <div
                    className="task-scope-filter"
                    role="group"
                    aria-label="Filtrar escopo das ações"
                  >
                    {[
                      ["all", "Todas as ações"],
                      ["case", "Casos individuais"],
                      ["process", "Melhorias de processo"],
                    ].map(([scope, label]) => (
                      <button
                        key={scope}
                        aria-pressed={taskScope === scope}
                        onClick={() => setTaskScope(scope)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  {tasks.length > 0 &&
                    !tasks.some(
                      (task) =>
                        taskScope === "all" ||
                        (task.scope === "process" ? "process" : "case") ===
                          taskScope,
                    ) && (
                      <Empty title="Nenhuma ação neste escopo">
                        Selecione outro filtro ou solicite uma investigação ao
                        agente.
                      </Empty>
                    )}
                  {!tasks.length ? (
                    <section className="panel">
                      <Empty title="A primeira ação começa com uma investigação">
                        Abra um pedido ou escolha um padrão e peça ao agente
                        para investigá-lo.
                      </Empty>
                      <div className="empty-action">
                        <Button onClick={() => setTab("queue")}>
                          Escolher pedido <ArrowRight size={16} />
                        </Button>
                      </div>
                    </section>
                  ) : (
                    <div className="task-grid">
                      {[...tasks]
                        .filter(
                          (t) =>
                            taskScope === "all" ||
                            (t.scope === "process" ? "process" : "case") ===
                              taskScope,
                        )
                        .reverse()
                        .map((t) => (
                          <section className="panel task-card" key={t.id}>
                            <div className="task-top">
                              <Label
                                tone={
                                  t.status === "pendente_aprovacao"
                                    ? "orange"
                                    : ["concluida", "aprovada"].includes(
                                          t.status,
                                        )
                                      ? "green"
                                      : "purple"
                                }
                              >
                                {statusLabel(t.status)}
                              </Label>
                              <small>
                                {t.scope === "process"
                                  ? "Ação de processo"
                                  : t.kind.startsWith("proposta")
                                    ? "Proposta · sem execução externa"
                                    : "Tarefa interna"}
                              </small>
                            </div>
                            <h3>{t.title}</h3>
                            <p>{t.justification}</p>
                            {t.scope === "process" && (
                              <div className="process-next-step">
                                <b>Próximo passo de validação</b>
                                <p>{t.nextStep}</p>
                                <small>
                                  {t.affectedOrderIds?.length || 0} pedidos
                                  relacionados. Esta ação não encerra esses
                                  casos e exige dimensionamento de esforço.
                                </small>
                                <button
                                  className="plain-link"
                                  onClick={() => {
                                    openQueue(t.affectedOrderIds);
                                    setShowAll(true);
                                  }}
                                >
                                  Ver pedidos relacionados{" "}
                                  <ArrowRight size={13} />
                                </button>
                              </div>
                            )}
                            {t.facts && (
                              <div className="verified-facts">
                                <b>Fatos verificados pelo sistema</b>
                                {t.facts.map((fact) => (
                                  <small key={fact}>{fact}</small>
                                ))}
                              </div>
                            )}
                            <div className="task-meta">
                              <span>
                                <Package size={13} />
                                {t.orderId}
                              </span>
                              <span>
                                <ClipboardList size={13} />
                                {t.area}
                              </span>
                              <span>
                                <CalendarDays size={13} />
                                {shortDate(t.dueAt)} · data do caso
                              </span>
                            </div>
                            <div className="evidence-links">
                              {t.evidenceIds.map((id) => (
                                <button
                                  key={id}
                                  onClick={() =>
                                    setSelected(
                                      allOrders.find((o) => o.id === id),
                                    )
                                  }
                                >
                                  {id}
                                </button>
                              ))}
                            </div>
                            <div className="task-actions">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  setSelected(
                                    allOrders.find((o) => o.id === t.orderId),
                                  )
                                }
                              >
                                Ver pedido <ArrowUpRight size={14} />
                              </Button>
                              {t.status === "aberta" && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={Boolean(taskPending) || busy}
                                  onClick={() => changeTask(t, "concluida")}
                                >
                                  <Check size={14} />{" "}
                                  {t.scope === "process"
                                    ? "Concluir ação de processo"
                                    : "Concluir tarefa"}
                                </Button>
                              )}
                              {t.status === "pendente_aprovacao" && (
                                <>
                                  <Button
                                    size="sm"
                                    disabled={Boolean(taskPending) || busy}
                                    onClick={() => changeTask(t, "aprovada")}
                                  >
                                    Aprovar proposta na demo
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={Boolean(taskPending) || busy}
                                    onClick={() => changeTask(t, "rejeitada")}
                                  >
                                    Rejeitar
                                  </Button>
                                </>
                              )}
                            </div>
                          </section>
                        ))}
                    </div>
                  )}
                  <div className="section-title">
                    <h2>Histórico de investigações</h2>
                  </div>
                  {!runs.length ? (
                    <p className="muted">
                      Nenhuma investigação executada nesta sessão.
                    </p>
                  ) : (
                    runs.map((r) => (
                      <details className="panel run-history" key={r.id}>
                        <summary>
                          <span className="history-icon">
                            {r.status === "completed" ? (
                              <CheckCircle2 size={18} />
                            ) : r.status === "running" ? (
                              <Clock3 size={18} />
                            ) : (
                              <TriangleAlert size={18} />
                            )}
                          </span>
                          <b>
                            {r.type === "daily"
                              ? "Plano do dia"
                              : r.type === "order"
                                ? "Pedido"
                                : "Padrão"}{" "}
                            · {r.target}
                          </b>
                          <Label
                            tone={r.status === "completed" ? "green" : "orange"}
                          >
                            {r.status === "completed"
                              ? "Concluída"
                              : r.status === "failed"
                                ? "Interrompida"
                                : "Em andamento"}
                          </Label>
                          <span>
                            {new Date(r.createdAt).toLocaleString("pt-BR")}
                          </span>
                        </summary>
                        <p className="run-summary">
                          {r.summary || "A execução ainda não foi finalizada."}
                        </p>
                        <small>
                          {r.taskIds.length} tarefas vinculadas ·{" "}
                          {r.events.filter((e) => e.state === "ok").length}{" "}
                          etapas concluídas
                        </small>
                        {r.status === "failed" && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busy}
                            onClick={() => startInvestigation(r.target, r.type)}
                          >
                            Tentar novamente
                          </Button>
                        )}
                      </details>
                    ))
                  )}
                </>
              )}
              {tab === "impact" && operations && (
                <FinancialImpact
                  report={operations}
                  selected={dayQueue.orders}
                  onQueue={() => openQueue()}
                />
              )}
              {tab === "method" && (
                <Methodology
                  summary={summary}
                  onReset={() => setResetting(true)}
                />
              )}
              <footer>
                <span>
                  <ShieldCheck size={13} /> Dados sintéticos · referência fixa
                  em 30/09/2026
                </span>
                <span>gogroup · GO OPERATIONS · projeto demonstrativo</span>
              </footer>
            </>
          )}
        </main>
      </div>
      <Dialog
        open={Boolean(selected)}
        onOpenChange={(open) => {
          if (!open) setSelected(undefined);
        }}
      >
        <DialogContent>
          {selected && (
            <>
              <div className="detail-heading">
                <Label tone="purple">DOSSIÊ DO PEDIDO</Label>
                <DialogTitle>{selected.id}</DialogTitle>
                <DialogDescription>
                  {selected.brand} · {selected.product}
                </DialogDescription>
              </div>
              <div className="detail-labels">
                <Label tone="orange">
                  {exceptionLabels[selected.exception]}
                </Label>
                <Label>{statusLabel(selected.status)}</Label>
                {selected.deliveredAt && (
                  <Label tone="green">Entrega registrada</Label>
                )}
              </div>
              {selected.issues.map((i) => (
                <div className="alert alert-info" key={i.code}>
                  <TriangleAlert size={16} />
                  <span>
                    {i.code === "STATUS_CONFLICT" && selected.statusReview
                      ? "Conflito revisado nesta sessão. O histórico original foi preservado."
                      : i.detail}
                    {i.code === "STATUS_CONFLICT" &&
                      ` Status originais: ${selected.sourceStatuses.join(", ")}.`}
                  </span>
                </div>
              ))}
              <div className="detail-stats">
                <div>
                  <small>Valor do pedido</small>
                  <b>{money(selected.value)}</b>
                </div>
                <div>
                  <small>Reenvio estimado</small>
                  <b>{money(selected.priority.resendCost)}</b>
                </div>
                <div>
                  <small>Prioridade</small>
                  <b>
                    {selected.priority.score.toFixed(1)}
                    <span>/100</span>
                  </b>
                </div>
              </div>
              <h3>Por que este pedido está na fila</h3>
              <div className="priority-meters">
                <Meter
                  label="Valor normalizado"
                  value={selected.priority.value * 100}
                />
                <Meter
                  label="Urgência normalizada"
                  value={selected.priority.urgency * 100}
                />
                <Meter
                  label="Relacionamento normalizado"
                  value={selected.priority.relationship * 100}
                />
              </div>
              <ul className="reasons">
                {selected.priority.reasons.map((r) => (
                  <li key={r}>
                    <Check size={14} />
                    {r}
                  </li>
                ))}
              </ul>
              <h3>Prazos e operação</h3>
              <dl className="detail-grid">
                <div>
                  <dt>Pedido em</dt>
                  <dd>{shortDate(selected.orderedAt)}</dd>
                </div>
                <div>
                  <dt>Exceção aberta em</dt>
                  <dd>{shortDate(selected.openedAt)}</dd>
                </div>
                <div>
                  <dt>Promessa original</dt>
                  <dd>{shortDate(selected.promisedAt)}</dd>
                </div>
                <div>
                  <dt>Prazo contratual calculado</dt>
                  <dd>{shortDate(selected.priority.contractPromise)}</dd>
                </div>
                <div>
                  <dt>Entrega registrada</dt>
                  <dd>
                    {selected.deliveredAt
                      ? shortDate(selected.deliveredAt)
                      : "Não registrada"}
                  </dd>
                </div>
                <div>
                  <dt>Risco de cancelamento elegível</dt>
                  <dd>
                    {money(selected.priority.cancellationRisk)} (
                    {selected.priority.cancellationProbability * 100}%)
                  </dd>
                </div>
                <div>
                  <dt>Transportadora / UF</dt>
                  <dd>
                    {selected.carrier} / {selected.state}
                  </dd>
                </div>
                <div>
                  <dt>CD / turno / máquina</dt>
                  <dd>
                    {selected.dc} / {selected.shift} / {selected.machine || "—"}
                  </dd>
                </div>
                <div>
                  <dt>Lote / brinde</dt>
                  <dd>
                    {selected.lot} / {selected.gift ? "Sim" : "Não"}
                  </dd>
                </div>
                <div>
                  <dt>Cliente</dt>
                  <dd>{selected.customerId}</dd>
                </div>
              </dl>
              {selected.customer && (
                <>
                  <h3>Histórico do cliente</h3>
                  <div className="customer-summary">
                    <div>
                      <small>Pedidos realizados</small>
                      <strong>{selected.customer.orders}</strong>
                    </div>
                    <div>
                      <small>Receita histórica</small>
                      <strong>{money(selected.customer.revenue)}</strong>
                    </div>
                    <div>
                      <small>Contatos no período</small>
                      <strong>{selected.customer.contacts}</strong>
                    </div>
                    <div>
                      <small>Cliente desde</small>
                      <strong>{shortDate(selected.customer.firstOrder)}</strong>
                    </div>
                  </div>
                  <p className="customer-caveat">
                    Histórico agregado do cliente. Não atribuímos todos os
                    contatos a esta exceção.
                  </p>
                </>
              )}
              <h3>Ações nesta sessão</h3>
              {tasks
                .filter((t) => t.orderId === selected.id)
                .map((t) => (
                  <div className="detail-task" key={t.id}>
                    <CheckCircle2 size={16} />
                    <span>{t.title}</span>
                    <Label>{statusLabel(t.status)}</Label>
                  </div>
                ))}
              {!tasks.some((t) => t.orderId === selected.id) && (
                <p className="muted">
                  Nenhuma tarefa registrada para este pedido.
                </p>
              )}
              <CaseControls
                key={selected.id}
                order={selected}
                tasks={tasks}
                disabled={busy || Boolean(taskPending)}
                onSaved={async () => {
                  await refreshWorkspace();
                  setNotice(
                    "Tratativa registrada. Fila e indicadores atualizados nesta sessão.",
                  );
                }}
              />
              <div className="detail-bottom">
                <small>
                  O agente consulta evidências e registra uma tarefa interna.
                  Nenhuma transação financeira será executada.
                </small>
                <Button
                  disabled={busy || Boolean(selected.resolution)}
                  onClick={() => startInvestigation(selected.id, "order")}
                >
                  <Sparkles size={16} /> Investigar pedido
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={resetting} onOpenChange={setResetting}>
        <DialogContent>
          <DialogTitle>Reiniciar sua demonstração?</DialogTitle>
          <DialogDescription>
            Você iniciará uma sessão sem tarefas ou investigações. A base
            original de pedidos será preservada.
          </DialogDescription>
          <div className="confirm-actions">
            <Button variant="outline" onClick={() => setResetting(false)}>
              Cancelar
            </Button>
            <Button onClick={reset}>Reiniciar demonstração</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
function Metric({
  icon: Icon,
  label,
  value,
  detail,
  tone = "neutral",
}: {
  icon: typeof Package;
  label: string;
  value: string;
  detail: string;
  tone?: string;
}) {
  return (
    <div className={`metric metric-${tone}`}>
      <div className="metric-top">
        <span>{label}</span>
        <Icon size={17} />
      </div>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}
function Compare({
  title,
  data,
  primary,
}: {
  title: string;
  data: Queue["fifo"];
  primary?: boolean;
}) {
  return (
    <section className={`panel compare ${primary ? "compare-primary" : ""}`}>
      <div>
        <h3>{title}</h3>
        <Label tone={primary ? "green" : "neutral"}>{data.count} pedidos</Label>
      </div>
      <strong>{money(data.value)}</strong>
      <small>valor de carteira coberto</small>
      <div className="compare-stats">
        <span>
          Idade média <b>{data.averageAge.toFixed(1)} dias úteis</b>
        </span>
        <span>
          Exposição elegível <b>{money(data.risk)}</b>
        </span>
      </div>
      <div className="compare-profile">
        {data.exceptions.slice(0, 3).map((e) => (
          <span key={e.type}>
            {e.label}: {e.count}
          </span>
        ))}
      </div>
    </section>
  );
}
function Methodology({
  summary,
  onReset,
}: {
  summary: Dashboard;
  onReset: () => void;
}) {
  return (
    <div className="method-grid">
      <section className="panel prose">
        <Label tone="green">TRANSPARÊNCIA POR PADRÃO</Label>
        <h2>Uma pontuação explicável, não uma promessa de retorno.</h2>
        <p>
          A pontuação combina valor (45%), urgência (35%) e relacionamento
          (20%). Os pesos podem ser alterados e são normalizados pela soma.
          Empates seguem a abertura mais antiga e depois o ID.
        </p>
        <p>
          A seleção reserva 20% das vagas restantes aos casos mais antigos. As
          demais vagas seguem a pontuação. Cada encerramento consome uma
          tratativa do dia; reabrir não devolve o esforço já realizado. A
          reserva é uma política do protótipo e precisa ser avaliada pela
          equipe.
        </p>
        <h3>Como cada componente é calculado</h3>
        <p>
          <b>Valor:</b> valor do pedido dividido pelo percentil 95 da carteira,
          limitado a 1.
        </p>
        <p>
          <b>Urgência:</b> maior valor entre dias úteis de atraso e dias úteis
          desde a abertura da exceção, dividido por 10 e limitado a 1. Para
          pedidos entregues, o atraso termina na entrega.
        </p>
        <p>
          <b>Relacionamento:</b> ticket médio histórico × probabilidade de
          recompra × 50% de redução por exceção mal resolvida. Probabilidade de
          70% para receita acumulada acima de R$ 1.500 e 28% para os demais.
          Normalizado pelo percentil 95. É uma proxy por pedido; não somamos
          essa proxy para alegar perda futura da carteira.
        </p>
        <h3>Datas e calendário</h3>
        <p>
          Referência fixa: 30/09/2026. Sábados, domingos, 07/09 e 12/10 não
          contam como dias úteis. A contagem do contrato inicia no primeiro dia
          útil depois do pedido: um dia de separação + SLA da transportadora. A
          promessa original continua sendo a base para atraso perante o cliente.
        </p>
        <h3>Dinheiro com significado</h3>
        <p>
          Valor da carteira não é perda. A exposição de cancelamento é valor ×
          probabilidade, aplicada apenas à logística ainda não entregue: 1–2
          dias de atraso (4%), 3–5 (10%), 6–10 (22%) e acima de 10 (40%). Não há
          probabilidade fornecida para as outras exceções.
        </p>
        <p>
          Reembolso estimado = valor do pedido. Reenvio/reprodução = 24% do
          valor + frete contratado. Para item faltante, o reenvio integral é uma
          proxy, pois não há preço por item. Custos de contato: R$ 9 por
          contato; não atribuímos o histórico anual de contatos a uma exceção
          específica.
        </p>
        <p>
          A simulação de benefício multiplica a exposição elegível pela eficácia
          assumida. Custos são descontados do cenário apenas quando informados;
          não comprova recuperação. Tarefas criadas ou concluídas não geram
          receita recuperada.
        </p>
      </section>
      <div className="method-side">
        <section className="panel prose">
          <h2>Qualidade e limites da base</h2>
          <p>
            <b>
              {summary.sourceRows} registros → {summary.totalCount} pedidos
              únicos na origem.
            </b>{" "}
            Existem {summary.conflicts} conflitos apenas de status, sem
            timestamp para definir o mais recente. O agente solicita revisão
            antes de qualquer outra tratativa nesses pedidos.
          </p>
          <p>
            <b>{summary.promiseMismatches} promessas divergentes</b> da regra
            contratual nos pedidos consolidados. As duas datas são preservadas e
            exibidas.
          </p>
          <p>
            Padrões mostram concentrações dentro das exceções. Sem todos os
            pedidos expedidos, não há taxa de falha por máquina, transportadora
            ou CD, nem comprovação de causa.
          </p>
          <p>
            As dimensões são selecionadas conforme a etapa operacional. Sinais
            estatísticos exigem ao menos dez casos no grupo; sugerimos
            investigar o processo quando a participação na exceção alcança 15% e
            a associação relativa é de pelo menos 1,5 vez a participação na base
            elegível. São limiares de triagem, sem teste de significância. A
            divergência de prazo é uma verificação da regra contratual e segue
            critério próprio.
          </p>
        </section>
        <section className="panel prose">
          <h2>O agente dentro da operação</h2>
          <p>
            Groq consulta ferramentas controladas pelo servidor: pedido,
            padrões, planos diários, simulação e ações de processo. Cada ação
            exige consulta prévia e IDs válidos de evidência. Há limite de seis
            rodadas, doze ferramentas e duas tarefas por investigação.
          </p>
          <p>
            Tarefas individuais têm prazo de um dia útil; ações de processo, de
            dois dias úteis após a referência. O esforço de processo precisa ser
            dimensionado antes de incluído na agenda. Aprovar uma proposta só
            altera o estado na demonstração.
          </p>
          <p>
            Histórico é persistido por sete dias, isolado por cookie seguro de
            sessão. Produção exige PostgreSQL; o modo local salva em arquivos
            privados.
          </p>
          <Button variant="outline" onClick={onReset}>
            <RotateCcw size={14} /> Reiniciar minha demonstração
          </Button>
        </section>
        <section className="panel prose">
          <h2>Roteiro para apresentar</h2>
          <ol>
            <li>Mostre a carteira e os limites dos indicadores.</li>
            <li>Compare a fila de 150 com FIFO.</li>
            <li>Abra um pedido e explique sua prioridade.</li>
            <li>Execute o agente e acompanhe as ferramentas.</li>
            <li>Confira a tarefa persistida após atualizar.</li>
            <li>Investigue um padrão e ressalve a causalidade.</li>
          </ol>
        </section>
      </div>
    </div>
  );
}
