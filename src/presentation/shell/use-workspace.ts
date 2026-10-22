"use client";
import { useCallback, useRef, useState } from "react";
import type { WorkspaceSnapshot } from "@/domain/workspace";
import { LatestRequest } from "@/shared/latest-request";
import { getJson } from "@/presentation/shared/api/client-http";

const emptyLists: Pick<
  WorkspaceSnapshot,
  "orders" | "patterns" | "tasks" | "runs"
> = {
  orders: [],
  patterns: [],
  tasks: [],
  runs: [],
};

/** Apply one server snapshot atomically; ignore responses from a previous session/import. */
export function useWorkspace() {
  const [snapshot, setSnapshot] = useState<WorkspaceSnapshot>();
  const requests = useRef(new LatestRequest());
  const refresh = useCallback(async () => {
    const ticket = requests.current.begin();
    try {
      const next = await getJson<WorkspaceSnapshot>("/api/workspace");
      if (requests.current.isCurrent(ticket)) setSnapshot(next);
    } catch (error) {
      if (requests.current.isCurrent(ticket)) throw error;
    }
  }, []);
  const clearWorkspace = useCallback(() => setSnapshot(undefined), []);
  const invalidateWorkspace = useCallback(
    () => requests.current.invalidate(),
    [],
  );
  return {
    ...emptyLists,
    ...snapshot,
    summary: snapshot?.summary,
    day: snapshot?.day,
    financial: snapshot?.financial,
    refresh,
    clearWorkspace,
    invalidateWorkspace,
  };
}
