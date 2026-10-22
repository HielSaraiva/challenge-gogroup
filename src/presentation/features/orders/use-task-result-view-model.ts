"use client";
import { currentCaseTasks } from "@/domain/case-cycle";
import { taskGuidance } from "@/domain/task-guidance";
import type { RankedOrder, Task } from "@/domain/types";
import {
  emptyResolution,
  resolutionPayload,
} from "@/presentation/features/orders/resolution-draft";
import { useDraftGuard } from "@/presentation/shared/hooks/form-safety";
import { useState } from "react";

export type TaskResultProps = {
  task: Task;
  orders: RankedOrder[];
  tasks: Task[];
  onSaved: () => Promise<void>;
};
export function useTaskResultViewModel({
  task,
  orders,
  tasks,
  onSaved,
}: TaskResultProps) {
  const [note, setNote] = useState("");
  const [evidence, setEvidence] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [resolvedAnswer, setResolvedAnswer] = useState("");
  const [resolution, setResolution] = useState(emptyResolution);
  const [stage, setStage] = useState<"" | "dispatched" | "received">("");
  const [rejecting, setRejecting] = useState(false);
  const [rejectionNote, setRejectionNote] = useState("");
  const { committed, markSaved } = useDraftGuard(
    {
      note,
      evidence,
      resolvedAnswer,
      resolution,
      stage,
      rejectionNote,
    },
    busy,
    task.updatedAt,
  );
  const [notice, setNotice] = useState("");
  const resend = task.kind === "proposta_reenvio";
  const guidance = taskGuidance[task.kind];
  const order = orders.find((order) => order.id === task.orderId);
  const editable =
    task.scope !== "process" && Boolean(order && !order.resolution);
  const canCloseWithExecution = Boolean(
    order &&
    !order.resolution &&
    order.status !== "status_divergente" &&
    task.kind !== "revisao_status" &&
    !(resend && stage !== "received") &&
    !currentCaseTasks(order!, tasks).some(
      (other) =>
        other.id !== task.id &&
        other.scope !== "process" &&
        other.orderId === task.orderId &&
        ["aberta", "aprovada", "pendente_aprovacao"].includes(other.status),
    ),
  );
  async function save(status: string) {
    if (busy || committed) return;
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: task.id,
          status,
          ...(status === "rejeitada"
            ? { rejection: { note: rejectionNote } }
            : {}),
          ...(status === "concluida"
            ? { execution: { note, evidence, ...(resend ? { stage } : {}) } }
            : {}),
          ...(status === "concluida" &&
          task.scope !== "process" &&
          resolvedAnswer === "yes" &&
          order
            ? {
                resolution: resolutionPayload(resolution, {
                  taskId: task.id,
                  evidence,
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
    evidence,
    setEvidence,
    busy,
    error,
    resolvedAnswer,
    setResolvedAnswer,
    resolution,
    setResolution,
    stage,
    setStage,
    rejecting,
    setRejecting,
    rejectionNote,
    setRejectionNote,
    committed,
    notice,
    resend,
    guidance,
    order,
    editable,
    canCloseWithExecution,
    save,
  };
}
