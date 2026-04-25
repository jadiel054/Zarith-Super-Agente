import { pgTable, uuid, text, timestamp, jsonb } from "drizzle-orm/pg-core";

export const zarithExecutionLogsTable = pgTable("zarith_execution_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  taskId: text("task_id"),
  thought: text("thought"),
  action: text("action"),
  observation: text("observation"),
  status: text("status"), // "success", "error", "pending"
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type ZarithExecutionLog = typeof zarithExecutionLogsTable.$inferSelect;
export type InsertZarithExecutionLog = typeof zarithExecutionLogsTable.$inferInsert;
