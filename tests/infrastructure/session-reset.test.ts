import { expect, it, vi } from "vitest";
import type { Dataset } from "../../src/domain/types";
import { resetSession, session } from "../../src/server/http";
import {
  getDataset,
  getSession,
  saveDataset,
  saveSessionDataset,
} from "../../src/infrastructure/persistence/operations-store";

const jar = vi.hoisted(() => new Map<string, string>());
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      jar.has(name) ? { value: jar.get(name) } : undefined,
    set: (name: string, value: string) => jar.set(name, value),
    delete: (name: string) => jar.delete(name),
  }),
}));

it("restores the shared default dataset after resetting an imported demonstration", async () => {
  const standard: Dataset = {
    orders: [],
    customers: [],
    carriers: [],
    sourceRows: 2000,
    importedAt: "2026-09-30T12:00:00.000Z",
  };
  const imported = {
    ...standard,
    sourceRows: 42,
    importedAt: "2026-10-17T12:00:00.000Z",
  };
  await saveDataset(standard);
  const previous = await session();
  await saveSessionDataset(previous.id, imported);
  expect(await getDataset((await getSession(previous.id))!)).toEqual(imported);

  const next = await resetSession();
  expect(next.id).not.toBe(previous.id);
  expect(next.state.importedDataset).toBeUndefined();
  expect(next.state.tasks).toEqual([]);
  expect(next.state.investigations).toEqual([]);
  expect(await getDataset(next.state)).toEqual(standard);
  expect((await session()).id).toBe(next.id);
  expect(await getDataset((await getSession(previous.id))!)).toEqual(imported);
});
