import { expect, it } from "vitest";
import { chooseRecurrenceCandidates } from "../../src/domain/recurrence-coverage";
import type { Investigation } from "../../src/domain/types";
import { conclusionSchema } from "../../src/domain/task-results";

it("examines groups beyond the initial sixteen and balances later passes", () => {
  const candidates = Array.from({ length: 40 }, (_, i) => ({
    id: `GROUP-${i}`,
  }));
  const runs: Investigation[] = [];
  for (let pass = 0; pass < 3; pass++) {
    const picked = chooseRecurrenceCandidates(candidates, runs);
    runs.push({
      id: String(pass),
      type: "recurrences",
      target: "base",
      status: "completed",
      summary: "",
      events: [],
      taskIds: [],
      createdAt: "",
      updatedAt: "",
      consultedInsightIds: picked.map((p) => p.id),
    });
  }
  expect(new Set(runs.flatMap((r) => r.consultedInsightIds!)).size).toBe(40);
  expect(chooseRecurrenceCandidates(candidates, []).map((c) => c.id)).toEqual(
    candidates.slice(0, 16).map((c) => c.id),
  );
});
it("accepts historical runs without coverage and conclusions without recommendations", () => {
  const conclusion = conclusionSchema.parse({
    outcome: "inconclusiva",
    observations: "A amostra não permitiu confirmar a hipótese.",
    evidenceIds: ["A", "B"],
  });
  expect(conclusion.nextStep).toBe("");
  expect(
    chooseRecurrenceCandidates(
      [{ id: "A" }],
      [{ recurrenceReview: { selectedInsightIds: ["A"] } } as Investigation],
    ),
  ).toHaveLength(1);
});
