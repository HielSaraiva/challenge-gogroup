"use client";
import { readInvestigationStream } from "@/lib/investigation-stream";
import { OrdersWorkspace } from "./orders-workspace";
import { useWorkspace } from "./hooks/use-workspace";
import { useOrderList } from "./hooks/use-order-list";
import { FormSafetyBoundary } from "./hooks/form-safety";
import { RecurrenceInvestigation } from "./recurrence-investigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppHeader } from "./app-header";
import { nav, pageTitles, pageDescriptions, type Tab } from "@/lib/navigation";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "./ui/dialog";
import { DataImport } from "./data-import";
import { Methodology } from "./methodology";
import { TodayWorkspace } from "./today-workspace";
import { RecurrencesWorkspace } from "./recurrences-workspace";
import { PendingWorkspace } from "./pending-workspace";
import { pendingWork } from "@/domain/pending-work";
import { FinancialImpact } from "./financial-impact";
import { PlanDialog } from "./plan-dialog";
import { OrderDetails } from "./order-details";
import { AgentProgress } from "./agent-progress";
import {
  DEFAULT_WEIGHTS,
  type Strategy,
  type Investigation,
  type ToolEvent,
} from "@/domain/types";
import { generatedTextLabel } from "@/lib/utils";
import { latestReopen } from "@/domain/case-cycle";
export function OperationsApp() {
  const [tab, setActive] = useState<Tab>("overview");
  const [menu, setMenu] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const dailyActivity = useRef<HTMLDivElement>(null);
  const scrollToDailyActivity = useRef(false);
  const {
    summary,
    day,
    financial,
    orders,
    patterns,
    tasks,
    runs,
    refresh,
    clearWorkspace,
    invalidateWorkspace,
  } = useWorkspace();
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
  const [planStrategy, setPlanStrategy] = useState<Strategy>("equilibrada");
  const ready = day?.usable === true;
  const orderFilters = useOrderList(orders, day?.orders, ready);
  const { setAll, setPage, resetFilters } = orderFilters;
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
  const refreshAfterSave = useCallback(
    async (
      message = "Registro salvo. A tela ainda precisa ser atualizada; não repita a operação.",
    ) => {
      try {
        await refresh();
        setRefreshWarning("");
      } catch {
        setRefreshWarning(message);
      }
    },
    [refresh],
  );
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
      clearWorkspace();
      const m = (e as Error).message;
      if (!m.startsWith("Base ainda não importada")) setError(m);
    } finally {
      setLoading(false);
    }
  }, [refresh, clearWorkspace]);
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
        for await (const payload of readInvestigationStream(r.body)) {
          if (payload.event)
            setEvents((previous) => [...previous, payload.event!]);
          if (payload.investigation) {
            setActiveRun(payload.investigation);
            completed = payload.investigation.status === "completed";
            if (type === "pattern" && completed)
              processToOpen = payload.investigation.taskIds[0];
          }
        }
      }

      let updated = false;
      try {
        await refresh();
        updated = true;
        setRefreshWarning("");
      } catch {
        setRefreshWarning(
          completed
            ? "Análise salva. Não foi possível atualizar a tela."
            : "Não foi possível atualizar a tela. Confira os registros antes de tentar novamente.",
        );
      }
      if (updated && processToOpen && type === "pattern")
        setProcessId(processToOpen);
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
      if (completed) {
        await refreshAfterSave(
          "Análise salva. Não foi possível atualizar a tela.",
        );
      } else {
        setError(message);
        setActiveRun((previous) =>
          previous
            ? { ...previous, status: "failed", summary: message }
            : previous,
        );
        await refresh().catch(() => {});
      }
    } finally {
      setBusy(false);
    }
  }
  async function reset() {
    if (resetLock.current) return;
    invalidateWorkspace();
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
      resetFilters();
      setPlanStrategy("equilibrada");
      setRefreshWarning("");
      clearWorkspace();
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
  function openOrder(id: string) {
    setProcessId(undefined);
    setSelectedId(id);
  }
  const pendingCount = pendingWork(orders, tasks).length;
  return (
    <div className="app-layout">
      <AppHeader
        tab={tab}
        menu={menu}
        setMenu={setMenu}
        pendingCount={pendingCount}
        navigate={navigate}
      />
      <div className="main-shell">
        <main>
          <div
            className={`page-heading ${tab === "overview" ? "brand-opening" : ""}`}
          >
            <div>
              <h1 ref={heading} tabIndex={-1}>
                {pageTitles[tab]}
              </h1>
              <p>{pageDescriptions[tab]}</p>
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
                  invalidateWorkspace();
                  clearWorkspace();
                  setActiveRun(undefined);
                  setEvents([]);
                  setSelectedId(undefined);
                  setProcessId(undefined);
                  setError("");
                  setNotice("");
                  setRefreshWarning("");
                  await refresh();
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
                <TodayWorkspace
                  summary={summary}
                  day={day}
                  orders={orders}
                  ready={ready}
                  busy={busy}
                  activity={activity("daily")}
                  dailyActivity={dailyActivity}
                  openOrder={openOrder}
                  onPrepare={() => {
                    setPlanStrategy(day?.plan?.strategy || "equilibrada");
                    setConfirmNewPlan(true);
                  }}
                  onBrowse={() => {
                    setAll(!ready);
                    navigate("queue");
                  }}
                  onBrowseAll={() => {
                    setAll(true);
                    navigate("queue");
                  }}
                />
              )}
              {tab === "queue" && (
                <OrdersWorkspace
                  day={day}
                  ready={ready}
                  list={orderFilters}
                  onOrder={openOrder}
                  onPrepare={() => navigate("overview")}
                />
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
                <RecurrencesWorkspace
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
              <Button
                variant="outline"
                onClick={() =>
                  void refreshAfterSave(refreshWarning || undefined)
                }
              >
                Atualizar tela
              </Button>
            </div>
          )}
          <footer className="app-footer">
            <p className="footer-disclaimer">
              <span>Dados sintéticos · sessão independente</span>
              <span>Sem ações externas automáticas.</span>
            </p>
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
                  onClick={() =>
                    void refreshAfterSave(refreshWarning || undefined)
                  }
                >
                  Atualizar tela
                </Button>
              </div>
            )}
            {selected && (
              <OrderDetails
                selected={selected}
                orders={orders}
                tasks={tasks}
                runs={runs}
                activeRun={activeRun}
                busy={busy}
                activity={activity("order", selected.id)}
                onInvestigate={(id) => void investigate(id, "order")}
                refreshAfterSave={refreshAfterSave}
              />
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
              <Button
                variant="outline"
                onClick={() =>
                  void refreshAfterSave(refreshWarning || undefined)
                }
              >
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
        <DialogContent className="confirmation-dialog">
          <DialogTitle>Há alterações não salvas</DialogTitle>
          <DialogDescription>
            Para retomar estas anotações depois, volte e use “Salvar progresso”.
            Sair agora descarta apenas as alterações desde o último salvamento.
          </DialogDescription>
          <div className="confirmation-footer">
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
      <PlanDialog
        open={confirmNewPlan}
        onOpenChange={setConfirmNewPlan}
        day={day}
        orderCount={summary?.count}
        strategy={planStrategy}
        onStrategyChange={setPlanStrategy}
        busy={busy}
        onCloseAutoFocus={(event) => {
          if (scrollToDailyActivity.current || busy) event.preventDefault();
        }}
        onPrepare={() => {
          setConfirmNewPlan(false);
          scrollToDailyActivity.current = true;
          void investigate("day", "daily");
        }}
      />
      <Dialog open={confirmOrderClose} onOpenChange={setConfirmOrderClose}>
        <DialogContent className="confirmation-dialog">
          <DialogTitle>Há alterações não salvas</DialogTitle>
          <DialogDescription>
            Sair descarta os campos ainda não registrados neste pedido.
          </DialogDescription>
          <div className="confirmation-footer">
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
        <DialogContent className="confirmation-dialog">
          <DialogTitle>Reiniciar esta demonstração?</DialogTitle>
          <DialogDescription>
            A nova sessão não terá planos, tarefas, investigações ou resultados.
            A base padrão de 30/09/2026 será restaurada. A base importada nesta
            sessão e os registros anteriores não serão copiados para a nova
            avaliação.
          </DialogDescription>
          <div className="confirmation-footer">
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
