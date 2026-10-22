"use client";
import type {
  Insight,
  ProcessConclusion,
  RankedOrder,
  Task,
} from "@/domain/types";
import { paginate } from "@/shared/pagination";
import { useEffect, useMemo, useRef, useState } from "react";

export type RecurrenceInvestigationProps = {
  task: Task;
  pattern?: Insight;
  orders: RankedOrder[];
  onSaved: () => Promise<void>;
  onDirtyChange: (dirty: boolean) => void;
  onBusyChange: (busy: boolean) => void;
};
export function useRecurrenceInvestigationViewModel({
  task: sourceTask,
  orders,
  onSaved,
  onDirtyChange,
  onBusyChange,
}: RecurrenceInvestigationProps) {
  const [savedTask, setSavedTask] = useState<Task>();
  const task =
    savedTask && savedTask.updatedAt >= sourceTask.updatedAt
      ? savedTask
      : sourceTask;
  const initial = task.processProgress;
  const [observations, setObservations] = useState(initial?.observations || "");
  const [nextStep, setNextStep] = useState(initial?.nextStep || "");
  const [ids, setIds] = useState<string[]>(initial?.evidenceIds || []);
  const [outcome, setOutcome] = useState<ProcessConclusion["outcome"] | "">(
    initial?.outcome || "",
  );
  const [version, setVersion] = useState(task.updatedAt);
  const [savedAt, setSavedAt] = useState(initial?.at);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(5);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const sample = useRef<HTMLElement>(null);
  const overview = useRef<HTMLElement>(null);
  const recordSection = useRef<HTMLElement>(null);
  const savedFeedback = useRef<HTMLParagraphElement>(null);
  const errorFeedback = useRef<HTMLParagraphElement>(null);
  const conclusionSection = useRef<HTMLElement>(null);
  useEffect(() => {
    if (notice) savedFeedback.current?.focus();
  }, [notice]);
  useEffect(() => {
    if (error) errorFeedback.current?.focus();
  }, [error]);
  useEffect(() => {
    if (task.conclusion) conclusionSection.current?.focus();
  }, [task.conclusion?.at]);
  function goTo(target: HTMLElement | null) {
    target?.focus({ preventScroll: true });
    target?.scrollIntoView({
      block: "start",
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
  }
  const draft = {
    observations,
    nextStep,
    evidenceIds: ids,
    ...(outcome ? { outcome } : {}),
  };
  const [saved, setSaved] = useState(JSON.stringify(draft));
  const dirty = !task.conclusion && JSON.stringify(draft) !== saved;
  useEffect(() => {
    onDirtyChange(dirty);
  }, [dirty, onDirtyChange]);
  useEffect(() => {
    onBusyChange(busy);
  }, [busy, onBusyChange]);
  useEffect(
    () => () => {
      onDirtyChange(false);
      onBusyChange(false);
    },
    [onDirtyChange, onBusyChange],
  );
  const related = useMemo(() => {
    const byId = new Map(orders.map((order) => [order.id, order]));
    const allIds = [
      ...new Set([...task.evidenceIds, ...(task.affectedOrderIds || [])]),
    ];
    return allIds.flatMap((id) => (byId.has(id) ? [byId.get(id)!] : []));
  }, [orders, task.evidenceIds, task.affectedOrderIds]);
  const filtered = related.filter((order) =>
    `${order.id} ${order.brand} ${order.product}`
      .toLocaleLowerCase("pt-BR")
      .includes(query.trim().toLocaleLowerCase("pt-BR")),
  );
  const view = paginate(filtered, page, size);
  const changePage = (next: number) => {
    setPage(next);
    sample.current?.focus({ preventScroll: true });
    sample.current?.scrollIntoView({
      block: "start",
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
  };
  async function save(conclude: boolean) {
    if (busy) return;
    setError("");
    setNotice("");
    if (conclude && ids.length < 2) {
      setError(
        "Confira e marque pelo menos dois pedidos para concluir. Você pode salvar o progresso com uma conferência parcial.",
      );
      sample.current?.focus();
      return;
    }
    if (conclude && (!outcome || observations.trim().length < 20)) {
      setError(
        "Para concluir, escolha o resultado, descreva o que foi verificado (mínimo de 20 caracteres) para registrar a conclusão.",
      );
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          conclude
            ? {
                id: task.id,
                status: "concluida",
                expectedUpdatedAt: version,
                conclusion: draft,
              }
            : {
                id: task.id,
                action: "save_process_progress",
                expectedUpdatedAt: version,
                progress: draft,
              },
        ),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(
          result.error || "Não foi possível salvar a investigação.",
        );
      setSavedTask(result);
      setVersion(result.updatedAt);
      setSavedAt(result.processProgress?.at);
      setSaved(JSON.stringify(draft));
      setNotice(
        conclude
          ? "Conclusão registrada. Os pedidos continuam com suas tratativas individuais."
          : "Progresso salvo. A investigação continua aberta em Pendências.",
      );
      await onSaved();
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return {
    task,
    observations,
    setObservations,
    nextStep,
    setNextStep,
    ids,
    setIds,
    outcome,
    setOutcome,
    savedAt,
    query,
    setQuery,
    setPage,
    size,
    setSize,
    busy,
    notice,
    setNotice,
    error,
    sample,
    overview,
    recordSection,
    savedFeedback,
    errorFeedback,
    conclusionSection,
    goTo,
    dirty,
    related,
    view,
    changePage,
    save,
  };
}
