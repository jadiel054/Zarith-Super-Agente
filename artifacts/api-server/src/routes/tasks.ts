import { Router } from "express";
import { db } from "@workspace/db";
import { tasksTable, insertTaskSchema, activityLogTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import {
  CreateTaskBody,
  UpdateTaskBody,
  UpdateTaskParams,
  DeleteTaskParams,
  GetTaskParams,
  ListTasksQueryParams,
} from "@workspace/api-zod";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const query = ListTasksQueryParams.safeParse(req.query);
    const limit = query.success && query.data.limit ? query.data.limit : 50;
    const status = query.success ? query.data.status : undefined;

    let tasks;
    if (status) {
      tasks = await db
        .select()
        .from(tasksTable)
        .where(eq(tasksTable.status, status as "pending" | "in_progress" | "completed" | "failed"))
        .orderBy(desc(tasksTable.createdAt))
        .limit(limit);
    } else {
      tasks = await db
        .select()
        .from(tasksTable)
        .orderBy(desc(tasksTable.createdAt))
        .limit(limit);
    }

    res.json(tasks.map(t => ({
      ...t,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
    })));
  } catch {
    res.status(200).json([]);
  }
});

router.post("/", async (req, res) => {
  const body = CreateTaskBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const [task] = await db.insert(tasksTable).values({
    title: body.data.title,
    description: body.data.description ?? null,
    priority: (body.data.priority ?? "medium") as "low" | "medium" | "high" | "critical",
    status: "pending",
  }).returning();

  await db.insert(activityLogTable).values({
    type: "task_created",
    description: `Task "${task.title}" was created`,
    metadata: { taskId: task.id },
  });

  res.status(201).json({
    ...task,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  });
});

router.get("/:id", async (req, res) => {
  const params = GetTaskParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid task ID" });
    return;
  }

  const [task] = await db.select().from(tasksTable).where(eq(tasksTable.id, params.data.id));
  if (!task) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  res.json({
    ...task,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  });
});

router.patch("/:id", async (req, res) => {
  const params = UpdateTaskParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid task ID" });
    return;
  }

  const body = UpdateTaskBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const updateData: Record<string, unknown> = { updatedAt: new Date() };
  if (body.data.title !== undefined) updateData.title = body.data.title;
  if (body.data.description !== undefined) updateData.description = body.data.description;
  if (body.data.status !== undefined) updateData.status = body.data.status;
  if (body.data.priority !== undefined) updateData.priority = body.data.priority;

  const [task] = await db
    .update(tasksTable)
    .set(updateData)
    .where(eq(tasksTable.id, params.data.id))
    .returning();

  if (!task) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  if (body.data.status === "completed") {
    await db.insert(activityLogTable).values({
      type: "task_completed",
      description: `Task "${task.title}" was completed`,
      metadata: { taskId: task.id },
    });
  } else if (body.data.status === "failed") {
    await db.insert(activityLogTable).values({
      type: "task_failed",
      description: `Task "${task.title}" failed`,
      metadata: { taskId: task.id },
    });
  }

  res.json({
    ...task,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  });
});

router.delete("/:id", async (req, res) => {
  const params = DeleteTaskParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid task ID" });
    return;
  }

  await db.delete(tasksTable).where(eq(tasksTable.id, params.data.id));
  res.status(204).send();
});

export default router;
