"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { readInvestigationStream } from "@/presentation/shared/api/investigation-stream";
import { useWorkspace } from "./use-workspace";
import { useOrderList } from "@/presentation/features/orders/use-order-list";
import { nav, type Tab } from "./navigation";
import { pendingWork } from "@/domain/pending-work";
import { latestReopen } from "@/domain/case-cycle";
import type { Strategy, Investigation, ToolEvent } from "@/domain/types";

export function useOperationsViewModel() {
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
    return { busy: isActive && busy, events: isActive ? events : [], run };
  }
  const selectedReopen = latestReopen(selected?.caseHistory);
  function openOrder(id: string) {
    setProcessId(undefined);
    setSelectedId(id);
  }
  const pendingCount = pendingWork(orders, tasks).length;

  async function handleImported() {
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
    setNotice("Base importada. Consulte Pedidos ou prepare um plano em Hoje.");
  }

  return {
    tab,
    menu,
    setMenu,
    heading,
    dailyActivity,
    scrollToDailyActivity,
    summary,
    day,
    financial,
    orders,
    patterns,
    tasks,
    runs,
    setSelectedId,
    setProcessId,
    setProcessDirty,
    setProcessSaving,
    processDestination,
    setProcessDestination,
    changeProcess,
    activePatternId,
    loading,
    busy,
    activeRun,
    error,
    setError,
    notice,
    setNotice,
    orderSafety,
    setOrderSafety,
    confirmOrderClose,
    setConfirmOrderClose,
    resetBusy,
    refreshWarning,
    resetting,
    setResetting,
    sessionRevision,
    confirmNewPlan,
    setConfirmNewPlan,
    planStrategy,
    setPlanStrategy,
    ready,
    orderFilters,
    setAll,
    navigate,
    refreshAfterSave,
    investigate,
    reset,
    selected,
    processTask,
    processPattern,
    activity,
    openOrder,
    pendingCount,
    handleImported,
  };
}
