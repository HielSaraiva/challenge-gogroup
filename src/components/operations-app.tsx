"use client";
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
import { money, shortDate, statusLabel } from "@/lib/utils";
import { paginationItems } from "@/lib/pagination";
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
  const [planStrategy, setPlanStrategy] = useState<Strategy>("equilibrada");
  const [query, setQuery] = useState("");
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
  const visible = (
    all || !ready
      ? [...orders].sort(
          (a, b) =>
            a.openedAt.localeCompare(b.openedAt) || a.id.localeCompare(b.id),
        )
      : day?.orders || []
  ).filter((o) =>
    `${o.id} ${o.product} ${exceptionLabels[o.exception]} ${o.brand} ${statusLabel(o.status)}`
      .toLocaleLowerCase("pt-BR")
      .includes(query.toLocaleLowerCase("pt-BR")),
  );
  const totalPages = Math.max(1, Math.ceil(visible.length / 15));
  const currentPage = Math.min(page, totalPages);
  function activity(type: Investigation["type"], target?: string) {
    const matches = (run: Investigation) =>
      run.type === type && (target === undefined || run.target === target);
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
  const related = selected
    ? tasks.filter((t) => t.scope !== "process" && t.orderId === selected.id)
    : [];
  function openOrder(id: string) {
    setProcessId(undefined);
    setSelectedId(id);
  }
  const pending = tasks.filter((t) =>
    ["aberta", "aprovada", "pendente_aprovacao"].includes(t.status),
  );
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
              {id === "agent" && pending.length > 0 && (
                <span className="nav-count">{pending.length}</span>
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
              {error}
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
                    <label className="search-input">
                      <Search size={16} aria-hidden="true" />
                      <input
                        aria-label="Buscar pedidos"
                        placeholder="Pedido, produto, marca ou tipo de problema"
                        value={query}
                        onChange={(e) => {
                          setQuery(e.target.value);
                          setPage(1);
                        }}
                      />
                    </label>
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
                            .slice((currentPage - 1) * 15, currentPage * 15)
                            .map((o) => (
                              <tr key={o.id}>
                                <td>
                                  <button
                                    className="order-link"
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
                        Nenhum pedido nesta seleção. Consulte a carteira
                        completa ou prepare outro plano.
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
                    <details className="panel prose">
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
                    </details>
                  )}
                </>
              )}
              {tab === "agent" && (
                <>
                  <section className="panel prose">
                    <h2>O que precisa de acompanhamento?</h2>
                    <label className="check-label">
                      <input
                        type="checkbox"
                        checked={pendingOnly}
                        onChange={(e) => setPendingOnly(e.target.checked)}
                      />
                      Mostrar somente pendências
                    </label>
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
                          <h3>{t.title}</h3>
                          <p>{t.justification}</p>
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
                    {tasks.length > 0 && pendingOnly && !pending.length && (
                      <p>
                        Não há pendências. Desmarque o filtro para consultar os
                        registros concluídos.
                      </p>
                    )}
                    {!tasks.length && (
                      <p>
                        O agente ainda não registrou tarefas. Prepare o dia e
                        investigue um pedido, ou escolha uma recorrência em
                        Melhorias.
                      </p>
                    )}
                  </section>
                  <details className="panel prose">
                    <summary>Histórico de análises e planos</summary>
                    {plans.map((plan) => (
                      <article key={plan.id} className="result-row">
                        <b>
                          Plano de{" "}
                          {new Date(plan.createdAt).toLocaleString("pt-BR")} ·{" "}
                          {plan.strategy || "legado"}
                        </b>
                        <p>
                          {plan.strategyReason ||
                            "Política anterior, sem comparação de estratégias registrada."}
                        </p>
                        <p>{plan.briefing}</p>
                        <details>
                          <summary>Consultar orientações salvas</summary>
                          {plan.workstreams.map((stream) => (
                            <p key={stream.area}>
                              <b>{stream.area}:</b> {stream.nextStep}
                            </p>
                          ))}
                        </details>
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
                          · {r.status}
                        </b>
                        <p>
                          {shortDate(r.createdAt.slice(0, 10))} · {r.summary}
                        </p>
                      </article>
                    ))}
                  </details>
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
                            <b>Grupo a conferir: {p.group}</b>
                          </p>
                          <p>
                            {p.count} casos relacionados dentro desta análise.
                          </p>
                          <p>{p.investigationQuestion}</p>
                          <details>
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
                          </details>
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
        <DialogContent>
          {selected && (
            <>
              <DialogTitle>
                {selected.id} · {exceptionLabels[selected.exception]}
              </DialogTitle>
              <DialogDescription>
                {selected.brand} · {selected.product}
              </DialogDescription>
              <p>
                <b>{statusLabel(selected.status)}</b> · {money(selected.value)}
              </p>
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
                          : "Peça ao agente um encaminhamento"}
                </h3>
                <p>
                  {selected.priority.age} dias úteis desde a abertura ·{" "}
                  {selected.priority.delay} dias úteis de atraso
                  {selected.deliveredAt ? " até a entrega" : ""}. Entrega
                  registrada não encerra automaticamente a exceção.
                </p>
                {!selected.resolution &&
                  selected.status !== "status_divergente" && (
                    <Button
                      disabled={busy}
                      onClick={() => void investigate(selected.id, "order")}
                    >
                      {busy ? "Investigando…" : "Investigar este pedido com IA"}
                    </Button>
                  )}
                {selected.status === "status_divergente" && (
                  <p>
                    A origem não informa qual status é o mais recente. Confira a
                    fonte e registre a revisão abaixo.
                  </p>
                )}
              </section>
              {activity("order", selected.id)}
              <details className="panel prose">
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
                  <p key={i.code}>{i.detail}</p>
                ))}
              </details>
              <h3>Diagnóstico e encaminhamentos do agente</h3>
              {!related.length && (
                <p>Nenhuma tarefa registrada para este pedido.</p>
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
                      . Verifique a viabilidade e os registros externos antes de
                      executar.
                    </p>
                  )}
                  <TaskResult task={t} orders={orders} onSaved={refresh} />
                </div>
              ))}
              <CaseControls
                key={selected.id + selected.status}
                order={selected}
                tasks={tasks}
                disabled={busy}
                onSaved={refresh}
              />
              <details className="panel prose">
                <summary>Histórico deste caso</summary>
                {selected.caseHistory?.map((e) => (
                  <p key={e.id}>
                    {e.action} · {e.note} ·{" "}
                    {new Date(e.at).toLocaleString("pt-BR")}
                  </p>
                ))}
              </details>
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
