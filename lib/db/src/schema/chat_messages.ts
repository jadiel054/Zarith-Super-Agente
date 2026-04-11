import { pgTable, serial, text, timestamp, pgEnum, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const messageRoleEnum = pgEnum("message_role", ["user", "assistant"]);

export const chatMessagesTable = pgTable("chat_messages", {
  id: serial("id").primaryKey(),
  role: messageRoleEnum("role").notNull(),
  content: text("content").notNull(),
  isThinking: boolean("is_thinking").notNull().default(false),
  sessionId: text("session_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertChatMessageSchema = createInsertSchema(chatMessagesTable).omit({ id: true, createdAt: true });
export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;
export type ChatMessage = typeof chatMessagesTable.$inferSelect;
