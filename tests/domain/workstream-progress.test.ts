import { expect, it } from "vitest";
import { workstreamProgress } from "../../src/domain/workstream-progress";
const stream = {
  orderIds: ["FIRST", "AGENT", "LAST"],
  agentDecision: {
    firstOrderId: "AGENT",
    justification: "Caso representativo escolhido pelo agente.",
  },
};
it("keeps the agent's initial choice even when another selected order ranks first", () => {
  expect(workstreamProgress(stream, new Set(stream.orderIds))).toMatchObject({
    completed: 0,
    suggestedId: "AGENT",
    agentSuggestion: true,
  });
});
it("advances by saved priority after each closure without drawing from other orders", () => {
  expect(
    workstreamProgress(stream, new Set(["FIRST", "LAST", "OUTSIDE"])),
  ).toMatchObject({
    completed: 1,
    suggestedId: "FIRST",
    agentSuggestion: false,
  });
  expect(
    workstreamProgress(stream, new Set(["LAST", "OUTSIDE"])),
  ).toMatchObject({ completed: 2, suggestedId: "LAST" });
  expect(workstreamProgress(stream, new Set(["OUTSIDE"]))).toMatchObject({
    completed: 3,
    suggestedId: undefined,
    remaining: [],
  });
  expect(stream.orderIds).toEqual(["FIRST", "AGENT", "LAST"]);
});
it("returns a reopened selection to the current workstream and corrects its progress", () => {
  expect(workstreamProgress(stream, new Set(["AGENT"]))).toMatchObject({
    completed: 2,
    suggestedId: "AGENT",
    agentSuggestion: true,
  });
});
it("supports legacy streams without an agent choice", () => {
  expect(
    workstreamProgress({ orderIds: ["FIRST", "LAST"] }, new Set(["LAST"])),
  ).toMatchObject({ suggestedId: "LAST", agentSuggestion: false });
});
