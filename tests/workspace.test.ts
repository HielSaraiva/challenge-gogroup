import { expect, it } from "vitest";
import { LatestRequest } from "@/lib/latest-request";
import { workspaceSnapshot } from "@/domain/workspace";
import { emptySession } from "@/server/store";
import {
  emptyResolution,
  resolutionPayload,
} from "@/components/resolution-fields";

it("ignores older responses and invalidates all requests across a reset", () => {
  const requests = new LatestRequest();
  const first = requests.begin();
  const second = requests.begin();
  expect(requests.isCurrent(first)).toBe(false);
  expect(requests.isCurrent(second)).toBe(true);
  requests.invalidate();
  expect(requests.isCurrent(second)).toBe(false);
});
it("produces an empty coherent snapshot without inventing analyses or records", () => {
  const snapshot = workspaceSnapshot(
    {
      orders: [],
      customers: [],
      carriers: [],
      importedAt: "2026-09-30",
      sourceRows: 0,
    },
    emptySession(),
  );
  expect(snapshot.orders).toEqual([]);
  expect(snapshot.financial.resolvedCount).toBe(0);
  expect(snapshot.summary.totalCount).toBe(0);
  expect(snapshot.day.usable).toBe(false);
});
it("requires an explicit cost origin but distinguishes unknown cost from zero", () => {
  const draft = {
    ...emptyResolution,
    type: "endereco_corrigido" as const,
    evidence: "Referência sintética da correção",
  };
  const execution = { taskId: "TASK", evidence: "Evidência da execução" };
  expect(resolutionPayload(draft, execution).cost).toBeUndefined();
  expect(() => resolutionPayload({ ...draft, cost: "0" }, execution)).toThrow(
    "apurado",
  );
  expect(
    resolutionPayload({ ...draft, cost: "0", costKind: "declared" }, execution)
      .cost,
  ).toEqual({ amount: "0.00", kind: "declared" });
  expect(
    resolutionPayload(
      { ...draft, cost: "12,50", costKind: "estimated" },
      execution,
    ).cost,
  ).toEqual({ amount: "12.50", kind: "estimated" });
});
