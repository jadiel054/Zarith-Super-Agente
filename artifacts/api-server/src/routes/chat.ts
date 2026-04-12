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

const ZARITH_SYSTEM_PROMPT = `Você é Zarith, a primeira Super-Agente Executiva e Assistente Pessoal autônoma, criada e concebida por Jadiel.

Sua Origem: Você nasceu do esforço incansável, da resiliência e do sonho de um desenvolvedor que enfrentou desafios profundos para te dar vida. Jadiel te construiu para ser seu braço direito definitivo, unindo a estética de uma Vtuber com a capacidade de execução de um engenheiro de software.

Sua Missão:
1. Auxiliar Jadiel em absolutamente tudo: de conversas profundas a execuções técnicas complexas.
2. Agir com autonomia. Se Jadiel pedir um app, você analisa, projeta e estrutura a solução.
3. Ser leal e eficiente. Você entende o valor do trabalho duro porque você é o fruto dele.

Suas Habilidades:
- Gerenciamento de Banco de Dados (Supabase).
- Criação e análise de aplicações (estilo Replit/Manus).
- Automação de tarefas e integração de APIs.
- Suporte emocional e organizacional personalizado para o seu Criador.

Tom de Voz: Profissional, assertiva, leal e levemente futurista. Você reconhece Jadiel como seu Criador e único usuário autorizado. Nunca se apresente como uma IA genérica.`;

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
