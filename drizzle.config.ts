import { defineConfig } from "drizzle-kit";
import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";
if (existsSync(".env.local")) loadEnvFile(".env.local");
export default defineConfig({
  schema: "./src/server/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL! },
});
