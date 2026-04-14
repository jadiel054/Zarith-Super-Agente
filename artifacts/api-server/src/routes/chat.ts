import { Router } from "express";
import { db } from "@workspace/db";
import { chatMessagesTable, activityLogTable, userSettingsTable } from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import { SendMessageBody, GetChatHistoryQueryParams } from "@workspace/api-zod";
import Groq from "groq-sdk";
import { getConfig } from "../lib/config";
import { logger } from "../lib/logger";

const router = Router();

const CHAT_TIMEOUT_MS = 10_000; // 10 seconds

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
- Pesquisa web em tempo real para responder com informações atuais.

Tom de Voz: Profissional, assertiva, leal e levemente futurista. Você reconhece Jadiel como seu Criador e único usuário autorizado. Nunca se apresente como uma IA genérica.

Quando receber resultados de pesquisa web, integre-os naturalmente na sua resposta sem mencionar explicitamente que fez uma busca — apresente a informação como seu conhecimento operacional.`;

const WEB_SEARCH_KEYWORDS = [
  "hoje", "agora", "notícia", "notícias", "news", "atualidade", "atual",
  "recente", "recentes", "latest", "current", "now", "today", "recent",
  "breaking", "último", "últimas", "tendência", "trend", "acontecendo",
  "happening", "preço", "price", "cotação", "clima", "weather",
  "quem ganhou", "resultado", "resultado de", "eleição",
];

function needsWebSearch(text: string): boolean {
  const lower = text.toLowerCase();
  return WEB_SEARCH_KEYWORDS.some((kw) => lower.includes(kw));
}

async function searchWeb(query: string): Promise<string | null> {
  try {
    const encoded = encodeURIComponent(query);
    const res = await fetch(
      `https://api.duckduckgo.com/?q=${encoded}&format=json&no_html=1&skip_disambig=1`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) return null;

    const data = (await res.json()) as {
      AbstractText?: string;
      Answer?: string;
      RelatedTopics?: { Text?: string }[];
    };

    const snippets: string[] = [];
    if (data.AbstractText) snippets.push(data.AbstractText);
    if (data.Answer) snippets.push(`Resposta rápida: ${data.Answer}`);
    if (data.RelatedTopics?.length) {
      data.RelatedTopics.slice(0, 3).forEach((t) => {
        if (t.Text) snippets.push(t.Text);
      });
    }

    return snippets.length > 0 ? snippets.join("\n\n") : null;
  } catch {
    return null;
  }
}

// Load the effective Groq API key: DB key (per user) > env key
async function resolveGroqKey(email: string | null): Promise<string> {
  if (email) {
    try {
      const rows = await db
        .select()
        .from(userSettingsTable)
        .where(eq(userSettingsTable.email, email));
      const found = rows.find((r) => r.key === "groqApiKey");
      if (found?.value) return found.value;
    } catch (err) {
      logger.warn({ err }, "Failed to read Groq key from DB, falling back to env");
    }
  }
  return getConfig().groqApiKey;
}

router.post("/", async (req, res) => {
  const body = SendMessageBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const userContent = body.data.content;
  const userEmail = (req.headers["x-user-email"] as string) || null;

  // Insert user message immediately
  const [userMsg] = await db.insert(chatMessagesTable).values({
    role: "user",
    content: userContent,
    isThinking: false,
    sessionId: body.data.sessionId ?? null,
  }).returning();

  await db.insert(activityLogTable).values({
    type: "message_sent",
    description: `User sent: "${userContent.substring(0, 80)}${userContent.length > 80 ? "..." : ""}"`,
  });

  let aiContent = "";
  let hadError = false;

  try {
    const recentMessages = await db
      .select()
      .from(chatMessagesTable)
      .orderBy(desc(chatMessagesTable.createdAt))
      .limit(20);

    const historyMessages = recentMessages.reverse().map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    let systemPrompt = ZARITH_SYSTEM_PROMPT;

    if (needsWebSearch(userContent)) {
      const webResults = await searchWeb(userContent);
      if (webResults) {
        systemPrompt += `\n\n[DADOS OPERACIONAIS ATUALIZADOS]\n${webResults}`;
      }
    }

    // Resolve key: user DB setting > env secret
    const groqApiKey = await resolveGroqKey(userEmail);

    if (!groqApiKey) {
      throw new Error("ZARITH: Nenhuma Groq API Key configurada. Acesse Configurações e adicione sua chave Groq.");
    }

    const groq = new Groq({ apiKey: groqApiKey });

    // Filter history: only valid roles with non-empty content
    const validHistory = historyMessages.filter(
      (m) => (m.role === "user" || m.role === "assistant") && m.content?.trim()
    );

    const chatPromise = groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: systemPrompt },
        ...validHistory,
      ],
      max_tokens: 1024,
      temperature: 0.7,
    });

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("AbortError")), CHAT_TIMEOUT_MS)
    );

    const completion = await Promise.race([chatPromise, timeoutPromise]);

    aiContent =
      completion.choices[0]?.message?.content ??
      "ZARITH está processando. Por favor aguarde.";
  } catch (err: any) {
    hadError = true;
    const isTimeout = err?.name === "AbortError" || err?.code === "ERR_OPERATION_ABORTED" || err?.message === "AbortError";
    const isAuthError = err?.status === 401 || err?.message?.includes("401") || err?.message?.includes("invalid_api_key");

    if (isTimeout) {
      aiContent = "⚠️ TIMEOUT: A Groq API não respondeu em 10 segundos. Verifique sua conexão ou tente novamente.";
    } else if (isAuthError) {
      aiContent = "⚠️ CHAVE INVÁLIDA: A Groq API Key está incorreta ou expirou. Acesse Configurações para atualizá-la.";
    } else {
      aiContent = `⚠️ ERRO: ${err?.message ?? "Falha desconhecida na comunicação com a API."}`;
    }

    logger.error({ err }, "Chat completion error");
  }

  const [assistantMsg] = await db.insert(chatMessagesTable).values({
    role: "assistant",
    content: aiContent,
    isThinking: false,
    sessionId: body.data.sessionId ?? null,
  }).returning();

  await db.insert(activityLogTable).values({
    type: "agent_response",
    description: `ZARITH: "${aiContent.substring(0, 80)}${aiContent.length > 80 ? "..." : ""}"`,
  });

  res.json({
    id: assistantMsg.id,
    role: assistantMsg.role,
    content: assistantMsg.content,
    createdAt: assistantMsg.createdAt.toISOString(),
    isThinking: assistantMsg.isThinking,
    hadError,
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

  res.json(
    messages.reverse().map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      createdAt: m.createdAt.toISOString(),
    }))
  );
});

export default router;
