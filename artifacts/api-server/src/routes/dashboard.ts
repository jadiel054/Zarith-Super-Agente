import { Router } from "express";
import { db } from "@workspace/db";
import { tasksTable, chatMessagesTable, activityLogTable, zarithExecutionLogsTable } from "@workspace/db";
import { eq, count, desc } from "drizzle-orm";
import { GetRecentActivityQueryParams } from "@workspace/api-zod";

const router = Router();

router.get("/summary", async (_req, res) => {
  const [taskCounts] = await db
    .select({ count: count() })
    .from(tasksTable);

  const [completedCount] = await db
    .select({ count: count() })
    .from(tasksTable)
    .where(eq(tasksTable.status, "completed"));

  const [pendingCount] = await db
    .select({ count: count() })
    .from(tasksTable)
    .where(eq(tasksTable.status, "pending"));

  const [inProgressCount] = await db
    .select({ count: count() })
    .from(tasksTable)
    .where(eq(tasksTable.status, "in_progress"));

  const [messageCount] = await db
    .select({ count: count() })
    .from(chatMessagesTable);

  res.json({
    totalTasks: Number(taskCounts?.count ?? 0),
    completedTasks: Number(completedCount?.count ?? 0),
    pendingTasks: Number(pendingCount?.count ?? 0),
    inProgressTasks: Number(inProgressCount?.count ?? 0),
    totalMessages: Number(messageCount?.count ?? 0),
    agentStatus: "idle",
  });
});

router.get("/activity", async (req, res) => {
  const query = GetRecentActivityQueryParams.safeParse(req.query);
  const limit = query.success && query.data.limit ? query.data.limit : 10;

  const activities = await db
    .select()
    .from(activityLogTable)
    .orderBy(desc(activityLogTable.createdAt))
    .limit(limit);

  const executionLogs = await db
    .select()
    .from(zarithExecutionLogsTable)
    .orderBy(desc(zarithExecutionLogsTable.createdAt))
    .limit(limit);

  const combined = [
    ...activities.map(a => ({
      id: a.id,
      type: a.type,
      description: a.description,
      metadata: a.metadata ?? null,
      createdAt: a.createdAt.toISOString(),
    })),
    ...executionLogs.map(l => ({
      id: l.id,
      type: "agent_thought",
      description: l.thought,
      metadata: { action: l.action, observation: l.observation },
      createdAt: l.createdAt.toISOString(),
    }))
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, limit);

  res.json(combined);
});

export default router;
