import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "@/infrastructure/persistence/schema";
import { AppError } from "@/application/errors";

export function db() {
  if (!process.env.DATABASE_URL)
    throw new AppError("Configure DATABASE_URL no servidor.", 503);
  return drizzle(neon(process.env.DATABASE_URL), { schema });
}
