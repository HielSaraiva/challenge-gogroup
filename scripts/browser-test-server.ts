// Disposable app: never loads .env.local or the developer's .local dataset.
import { mkdtemp, cp, symlink, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { data, tasks } from "../tests/browser/fixtures";
async function main() {
  const root = process.cwd();
  const copy = await mkdtemp(path.join(tmpdir(), "gogroup-browser-"));
  for (const file of [
    "src",
    "public",
    "package.json",
    "tsconfig.json",
    "next.config.ts",
    "next-env.d.ts",
    "postcss.config.mjs",
  ])
    await cp(path.join(root, file), path.join(copy, file), { recursive: true });
  await symlink(
    path.join(root, "node_modules"),
    path.join(copy, "node_modules"),
  );
  await mkdir(path.join(copy, ".local"));
  await writeFile(path.join(copy, ".local/dataset.json"), JSON.stringify(data));
  await mkdir(path.join(copy, "src/app/api/browser-fixture"), {
    recursive: true,
  });
  await writeFile(
    path.join(copy, "src/app/api/browser-fixture/route.ts"),
    `import { session, json } from "@/server/http"; import { upsertTask } from "@/server/store"; export async function GET() { const {id} = await session(); for (const task of ${JSON.stringify(tasks)}) await upsertTask(id, task as any); return json({ok:true}); }`,
  );
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    DATABASE_URL: "",
    GROQ_API_KEY: "",
    LOCAL_DEMO: "true",
    NODE_ENV: "production",
  };
  const next = path.join(root, "node_modules/next/dist/bin/next");
  // Use a production build: dev hot-reload can race manifest reads between cases.
  let child = spawn(process.execPath, [next, "build", "--webpack"], {
    cwd: copy,
    stdio: "inherit",
    env,
  });
  let stopping = false;
  async function cleanup() {
    if (stopping) return;
    stopping = true;
    if (child.exitCode === null) {
      const exited = new Promise<void>((resolve) =>
        child.once("exit", () => resolve()),
      );
      child.kill("SIGTERM");
      await exited;
    }
    await rm(copy, { recursive: true, force: true });
    process.exit(0);
  }
  process.on("SIGTERM", () => void cleanup());
  process.on("SIGINT", () => void cleanup());
  const code = await new Promise<number | null>((resolve) =>
    child.once("exit", resolve),
  );
  if (code !== 0) {
    await rm(copy, { recursive: true, force: true });
    throw new Error("Falha no build isolado dos testes de navegador.");
  }
  if (stopping) return;
  child = spawn(
    process.execPath,
    [next, "start", "--hostname", "127.0.0.1", "--port", "3102"],
    { cwd: copy, stdio: "inherit", env },
  );
  child.on("exit", () => {
    if (!stopping)
      void rm(copy, { recursive: true, force: true }).then(() =>
        process.exit(1),
      );
  });
}
void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
