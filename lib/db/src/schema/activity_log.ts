import { pgTable, serial, text, timestamp, pgEnum, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const activityTypeEnum = pgEnum("activity_type", [
  "task_created",
  "task_completed",
  "task_failed",
  "message_sent",
  "agent_response",
]);

export const activityLogTable = pgTable("activity_log", {
  id: serial("id").primaryKey(),
  type: activityTypeEnum("type").notNull(),
  description: text("description").notNull(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertActivityLogSchema = createInsertSchema(activityLogTable).omit({ id: true, createdAt: true });
export type InsertActivityLog = z.infer<typeof insertActivityLogSchema>;
export type ActivityLog = typeof activityLogTable.$inferSelect;
