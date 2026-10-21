import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import path from "node:path";
import { AppError } from "../errors";

function localAllowed() {
  if (
    process.env.VERCEL ||
    (process.env.NODE_ENV === "production" && process.env.LOCAL_DEMO !== "true")
  )
    throw new AppError(
      "Banco de dados não configurado. Configure DATABASE_URL.",
      503,
    );
}
const localPath = (name: string) =>
  path.join(
    process.env.NODE_ENV === "test" && process.env.OPERATIONS_TEST_DIRECTORY
      ? process.env.OPERATIONS_TEST_DIRECTORY
      : path.join(process.cwd(), ".local"),
    name,
  );
export async function readLocal<T>(name: string, fallback?: T): Promise<T> {
  localAllowed();
  try {
    return JSON.parse(await readFile(localPath(name), "utf8"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    if (fallback !== undefined) return fallback;
    throw new AppError(
      "Base ainda não importada. Execute o comando import:data.",
      503,
    );
  }
}
export async function writeLocal(name: string, payload: unknown) {
  localAllowed();
  await mkdir(localPath(""), { recursive: true });
  const temp = localPath(`${name}.${randomUUID()}.tmp`);
  await writeFile(temp, JSON.stringify(payload), "utf8");
  await rename(temp, localPath(name));
}
// Serializa o modo local num processo. Produção usa operações atômicas no Postgres.
let pending: Promise<unknown> = Promise.resolve();
export function locked<T>(fn: () => Promise<T>): Promise<T> {
  const next = pending.then(fn, fn);
  pending = next.catch(() => {});
  return next;
}
