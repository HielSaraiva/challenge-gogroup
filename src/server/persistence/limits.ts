import { and, eq, lt, sql } from "drizzle-orm";
import * as schema from "../schema";
import { AppError } from "../errors";
import { db } from "./database";
import { locked, readLocal, writeLocal } from "./local-files";

export async function consumeLimit(key: string, limit: number): Promise<void> {
  const id = `${new Date().toISOString().slice(0, 10)}:${key}`;
  if (!process.env.DATABASE_URL)
    return locked(async () => {
      const counts = await readLocal<Record<string, number>>("usage.json", {});
      if ((counts[id] || 0) >= limit)
        throw new AppError(
          "Limite diário de investigações atingido. Tente novamente amanhã.",
          429,
        );
      counts[id] = (counts[id] || 0) + 1;
      await writeLocal("usage.json", counts);
    });
  const rows = await db()
    .insert(schema.counters)
    .values({ id, used: 1, expiresAt: new Date(Date.now() + 2 * 86400000) })
    .onConflictDoUpdate({
      target: schema.counters.id,
      set: { used: sql`${schema.counters.used} + 1` },
      setWhere: lt(schema.counters.used, limit),
    })
    .returning();
  if (!rows.length)
    throw new AppError("Limite diário de investigações atingido.", 429);
}
export async function acquireAgentLease(
  sessionId: string,
): Promise<() => Promise<void>> {
  const key = `lease:${sessionId}`;
  const until = new Date(Date.now() + 60000);
  if (!process.env.DATABASE_URL) {
    await locked(async () => {
      const leases = await readLocal<Record<string, string>>("leases.json", {});
      if (leases[key] && new Date(leases[key]).getTime() > Date.now())
        throw new AppError(
          "Uma investigação já está em andamento nesta sessão. Aguarde sua conclusão.",
          409,
        );
      leases[key] = until.toISOString();
      await writeLocal("leases.json", leases);
    });
    return () =>
      locked(async () => {
        const leases = await readLocal<Record<string, string>>(
          "leases.json",
          {},
        );
        if (leases[key] === until.toISOString()) {
          delete leases[key];
          await writeLocal("leases.json", leases);
        }
      });
  }
  const database = db();
  const claimed = await database
    .insert(schema.counters)
    .values({ id: key, used: 1, expiresAt: until })
    .onConflictDoUpdate({
      target: schema.counters.id,
      set: { expiresAt: until },
      setWhere: lt(schema.counters.expiresAt, new Date()),
    })
    .returning();
  if (!claimed.length)
    throw new AppError(
      "Uma investigação já está em andamento nesta sessão. Aguarde sua conclusão.",
      409,
    );
  return async () => {
    await database
      .delete(schema.counters)
      .where(
        and(eq(schema.counters.id, key), eq(schema.counters.expiresAt, until)),
      );
  };
}
