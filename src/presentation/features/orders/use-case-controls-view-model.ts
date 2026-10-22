"use client";
import { currentCaseTasks, latestReopen } from "@/domain/case-cycle";
import type { RankedOrder, Task } from "@/domain/types";
import {
  emptyResolution,
  resolutionPayload,
} from "@/presentation/features/orders/resolution-draft";
import { useDraftGuard } from "@/presentation/shared/hooks/form-safety";
import { useState } from "react";

export type CaseControlsProps = {
  order: RankedOrder;
  tasks: Task[];
  disabled: boolean;
  onSaved: () => Promise<void>;
};
export function useCaseControlsViewModel({
  order,
  tasks,
  onSaved,
}: CaseControlsProps) {
  const [note, setNote] = useState("");
  const [status, setStatus] = useState(order.sourceStatuses[0]);
  const [draft, setDraft] = useState(emptyResolution);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const { committed, markSaved } = useDraftGuard(
    { note, status, draft },
    busy,
    JSON.stringify([order.status, order.resolution, order.caseHistory]),
  );
  const review = order.status === "status_divergente";
  const action = order.resolution
    ? "reopen"
    : review
      ? "review_status"
      : "resolve";
  const related = currentCaseTasks(order, tasks);
  const lastReopen = latestReopen(order.caseHistory);
  const canResolve =
    related.some(
      (t) =>
        t.status === "concluida" &&
        t.kind !== "revisao_status" &&
        t.execution &&
        (!lastReopen ||
          Boolean(t.execution.at && t.execution.at >= lastReopen.at)),
    ) &&
    !related.some((t) =>
      ["aberta", "aprovada", "pendente_aprovacao"].includes(t.status),
    );
  const lastExecutionTask = [...related]
    .filter(
      (task) =>
        task.status === "concluida" &&
        task.kind !== "revisao_status" &&
        task.execution &&
        (!lastReopen ||
          Boolean(task.execution.at && task.execution.at >= lastReopen.at)),
    )
    .sort((a, b) =>
      (b.execution?.at || "").localeCompare(a.execution?.at || ""),
    )[0];
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || committed) return;
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          orderId: order.id,
          note:
            action === "resolve"
              ? lastExecutionTask!.execution!.note.slice(0, 1200)
              : note,
          ...(review ? { status } : {}),
          ...(action === "resolve"
            ? {
                outcome: resolutionPayload(draft, {
                  taskId: lastExecutionTask!.id,
                  evidence: lastExecutionTask!.execution!.evidence,
                }),
              }
            : {}),
        }),
      });
      const b = await r.json();
      if (!r.ok) throw new Error(b.error);
      markSaved();
      setNotice("Registro salvo com sucesso.");
      await onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return {
    note,
    setNote,
    status,
    setStatus,
    draft,
    setDraft,
    busy,
    error,
    notice,
    committed,
    review,
    action,
    related,
    lastReopen,
    canResolve,
    lastExecutionTask,
    submit,
  };
}
