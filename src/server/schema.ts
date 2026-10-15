import { pgTable, text, jsonb, timestamp, integer, primaryKey } from "drizzle-orm/pg-core";
import type { Dataset, SessionState, Task } from "@/domain/types";
export const datasets = pgTable("datasets", { id: text("id").primaryKey(), payload: jsonb("payload").$type<Dataset>().notNull() });
export const sessions = pgTable("demo_sessions", {
  id: text("id").primaryKey(), payload: jsonb("payload").$type<SessionState>().notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});
export const taskRecords = pgTable("demo_tasks", {
  sessionId: text("session_id").notNull().references(() => sessions.id, { onDelete: "cascade" }),
  key: text("key").notNull(), payload: jsonb("payload").$type<Task>().notNull(),
}, t => [primaryKey({ columns: [t.sessionId, t.key] })]);
export const counters = pgTable("usage_counters", { id: text("id").primaryKey(), used: integer("used").notNull().default(0), expiresAt: timestamp("expires_at", { withTimezone: true }).notNull() });
