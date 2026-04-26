import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";

export const zarithAuthorizationsTable = pgTable("zarith_authorizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectName: text("project_name").notNull(),
  scopePath: text("scope_path").notNull(), // Ex: "jadiel054/Zarith-Super-Agente"
  status: text("status").default("pending"), // "authorized", "denied", "pending"
  action: text("action"), // Ação específica autorizada
  is_authorized: text("is_authorized").default("false"), // "true" ou "false"
  grantedAt: timestamp("granted_at"),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type ZarithAuthorization = typeof zarithAuthorizationsTable.$inferSelect;
export type InsertZarithAuthorization = typeof zarithAuthorizationsTable.$inferInsert;
