import { pgTable, uuid, text, timestamp, jsonb, customType } from "drizzle-orm/pg-core";

const vector = customType<{ data: number[]; driverData: string }>({
  dataType() {
    return 'vector(1536)';
  },
  toDriver(value: number[]): string {
    return `[${value.join(',')}]`;
  },
  fromDriver(value: string): number[] {
    return JSON.parse(value);
  },
});

export const zarithMemoryTable = pgTable("zarith_memory", {
  id: uuid("id").primaryKey().defaultRandom(),
  content: text("content").notNull(),
  metadata: jsonb("metadata").default({}),
  embedding: vector("embedding"), // Compatível com OpenAI/Gemini embeddings
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type ZarithMemory = typeof zarithMemoryTable.$inferSelect;
export type InsertZarithMemory = typeof zarithMemoryTable.$inferInsert;
