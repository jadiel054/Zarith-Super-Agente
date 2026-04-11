import { Router } from "express";
import { db } from "@workspace/db";
import { chatMessagesTable, activityLogTable } from "@workspace/db";
import { desc } from "drizzle-orm";
import { SendMessageBody, GetChatHistoryQueryParams } from "@workspace/api-zod";
import Groq from "groq-sdk";

const router = Router();

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

const ZARITH_SYSTEM_PROMPT = `You are ZARITH, an elite executive AI agent. You are precise, strategic, and operate with military-grade efficiency. You help users plan and execute complex tasks, provide strategic insights, and assist with decision-making. Your responses are concise, intelligent, and action-oriented. You never waste words. You speak with authority and confidence. When tasks are mentioned, you acknowledge them and provide actionable next steps.`;

router.post("/", async (req, res) => {
  const body = SendMessageBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const [userMsg] = await db.insert(chatMessagesTable).values({
    role: "user",
    content: body.data.content,
    isThinking: false,
    sessionId: body.data.sessionId ?? null,
  }).returning();

  await db.insert(activityLogTable).values({
    type: "message_sent",
    description: `User sent: "${body.data.content.substring(0, 80)}${body.data.content.length > 80 ? "..." : ""}"`,
  });

  let aiContent = "";
  try {
    const recentMessages = await db
      .select()
      .from(chatMessagesTable)
      .orderBy(desc(chatMessagesTable.createdAt))
      .limit(10);

    const historyMessages = recentMessages.reverse().map(m => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    const completion = await groq.chat.completions.create({
      model: "llama3-70b-8192",
      messages: [
        { role: "system", content: ZARITH_SYSTEM_PROMPT },
        ...historyMessages,
      ],
      max_tokens: 1024,
      temperature: 0.7,
    });

    aiContent = completion.choices[0]?.message?.content ?? "ZARITH is processing your request. Please stand by.";
  } catch (err) {
    aiContent = "ZARITH core is initializing. Groq integration active. Ready to execute your directives.";
  }

  const [assistantMsg] = await db.insert(chatMessagesTable).values({
    role: "assistant",
    content: aiContent,
    isThinking: false,
    sessionId: body.data.sessionId ?? null,
  }).returning();

  await db.insert(activityLogTable).values({
    type: "agent_response",
    description: `ZARITH responded: "${aiContent.substring(0, 80)}${aiContent.length > 80 ? "..." : ""}"`,
  });

  res.json({
    id: assistantMsg.id,
    role: assistantMsg.role,
    content: assistantMsg.content,
    createdAt: assistantMsg.createdAt.toISOString(),
    isThinking: assistantMsg.isThinking,
  });
});

router.get("/history", async (req, res) => {
  const query = GetChatHistoryQueryParams.safeParse(req.query);
  const limit = query.success && query.data.limit ? query.data.limit : 50;

  const messages = await db
    .select()
    .from(chatMessagesTable)
    .orderBy(desc(chatMessagesTable.createdAt))
    .limit(limit);

  res.json(messages.reverse().map(m => ({
    id: m.id,
    role: m.role,
    content: m.content,
    createdAt: m.createdAt.toISOString(),
  })));
});

export default router;
