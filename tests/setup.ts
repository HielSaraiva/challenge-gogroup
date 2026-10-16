import { afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { rm } from "node:fs/promises";
import path from "node:path";

const parent = path.resolve(process.cwd(), ".local", "test-runs");
const directory = path.resolve(parent, randomUUID());
if (!directory.startsWith(parent + path.sep))
  throw new Error("Invalid test path");
process.env.OPERATIONS_TEST_DIRECTORY = directory;
delete process.env.DATABASE_URL;
afterAll(async () => {
  await rm(directory, { recursive: true, force: true });
});
