import { Router } from "express";
import { db } from "@workspace/db";
import { tasksTable, chatMessagesTable, activityLogTable } from "@workspace/db";
import { eq, count, desc } from "drizzle-orm";
import { GetRecentActivityQueryParams } from "@workspace/api-zod";

const router = Router();

router.get("/summary", async (_req, res) => {
  try {
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
  } catch {
    res.status(200).json({
      totalTasks: 0,
      completedTasks: 0,
      pendingTasks: 0,
      inProgressTasks: 0,
      totalMessages: 0,
      agentStatus: "idle",
    });
  }
});

router.get("/activity", async (req, res) => {
  try {
    const query = GetRecentActivityQueryParams.safeParse(req.query);
    const limit = query.success && query.data.limit ? query.data.limit : 10;

    const activities = await db
      .select()
      .from(activityLogTable)
      .orderBy(desc(activityLogTable.createdAt))
      .limit(limit);

    res.json(activities.map(a => ({
      id: a.id,
      type: a.type,
      description: a.description,
      metadata: a.metadata ?? null,
      createdAt: a.createdAt.toISOString(),
    })));
  } catch {
    res.status(200).json([]);
  }
});

export default router;
