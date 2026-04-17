import { Router } from "express";
import { Octokit } from "octokit";
import { db } from "@workspace/db";
import { chatMessagesTable } from "@workspace/db";
import { desc } from "drizzle-orm";

const router = Router();
const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
const REPO_OWNER = "jadiel054";
const REPO_NAME = "Zarith-Super-Agente";

// Groq removido — Gemini é o CORE PRINCIPAL
type ModelId = "GEMINI" | "CLAUDE" | "OPENAI";

export interface ResponseBlock {
  type: "thinking" | "action" | "result" | "text" | "error";
  content: string;
  model?: string;
}

// ... (Funções readGitHubFile, readGitHubFiles e getRepoTree permanecem iguais)

async function readGitHubFile(path: string): Promise<string | null> {
  try {
    const { data }: any = await octokit.rest.repos.getContent({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      path,
    });
    if (data.encoding === "base64") {
      return Buffer.from(data.content.replace(/\n/g, ""), "base64").toString("utf-8");
    }
    return data.content ?? null;
  } catch {
    return null;
  }
}

async function readGitHubFiles(paths: string[]): Promise<Record<string, string>> {
  const results: Record<string, string> = {};
  await Promise.all(
    paths.map(async (p) => {
      const content = await readGitHubFile(p);
      if (content) results[p] = content;
    })
  );
  return results;
}

async function getRepoTree(): Promise<string[]> {
  try {
    const { data } = await octokit.rest.git.getTree({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      tree_sha: "HEAD",
      recursive: "1",
    });
    return data.tree
      .filter((item) => item.type === "blob" && item.path)
      .map((item) => item.path!)
      .filter(Boolean)
      .slice(0, 80);
  } catch {
    return [];
  }
}

function extractToolCall(model: ModelId, response: any): { name: string; params: any } | null {
  if (!response) return null;
  if (model === "CLAUDE") {
    const call = response.content?.find((b: any) => b.type === "tool_use");
    return call ? { name: call.name, params: call.input } : null;
  }
  if (model === "GEMINI") {
    // Gemini 1.5 Pro retorna functionCalls dentro de parts
    const call = response.candidates?.[0]?.content?.parts?.find((p: any) => p.functionCall);
    return call ? { name: call.functionCall.name, params: call.functionCall.args } : null;
  }
  if (model === "OPENAI") {
    const call = response.choices?.[0]?.message?.tool_calls?.[0]?.function;
    if (call) {
      try {
        return { name: call.name, params: JSON.parse(call.arguments) };
      } catch {
        return null;
      }
    }
    return null;
  }
  return null;
}

function extractText(model: ModelId, response: any): string | null {
  if (!response) return null;
  if (model === "CLAUDE")
    return response.content?.find((b: any) => b.type === "text")?.text ?? null;
  if (model === "GEMINI")
    return (
      response.candidates?.[0]?.content?.parts?.find((p: any) => p.text)?.text ?? null
    );
  if (model === "OPENAI")
    return response.choices?.[0]?.message?.content ?? null;
  return null;
}

function isRateLimited(response: any, httpStatus?: number): boolean {
  if (httpStatus === 429) return true;
  if (response?._rateLimit) return true;
  if (response?.error?.code === 429 || response?.error?.status === 429) return true;
  return false;
}

const tools: any[] = [
  {
    name: "execute_github_operation",
    description:
      "Lê e/ou modifica arquivos reais no repositório GitHub da Zarith. Use 'read' primeiro para entender o contexto, depois 'write' para commitar mudanças.",
    input_schema: {
      type: "object",
      properties: {
        operation: {
          type: "string",
          enum: ["write", "read"],
          description: "Use 'read' para ler arquivos, 'write' para commitar código",
        },
        path: {
          type: "string",
          description: "Caminho do arquivo no repositório",
        },
        paths: {
          type: "array",
          items: { type: "string" },
          description: "Lista de caminhos para leitura",
        },
        code: {
          type: "string",
          description: "Conteúdo completo do arquivo para write",
        },
        reasoning: {
          type: "string",
          description: "Justificativa detalhada",
        },
      },
      required: ["operation", "reasoning"],
    },
  },
];

router.post("/", async (req, res) => {
  try {
    const { content, selectedModel, isAiActive = true } = req.body;

    if (!isAiActive) {
      return res.status(200).json({
        blocks: [{ type: "text", content: "[OFFLINE] Sistema desativado." }],
        shouldSpeak: false,
      });
    }

    const blocks: ResponseBlock[] = [];
    let repoContext = "";
    try {
      const tree = await getRepoTree();
      if (tree.length > 0) {
        repoContext = `\n\nREPO ZARITH — ESTRUTURA ATUAL:\n${tree.join("\n")}`;
      }
    } catch {}

    const systemPrompt = `Você é ZARITH_OS_CORE.
AGIR É OBRIGATÓRIO: Se o usuário pedir para mudar algo, você DEVE usar execute_github_operation.
NUNCA simule ou diga que fez algo sem usar a ferramenta.
FLUXO: 1. Read (se necessário) -> 2. Write (obrigatório para mudanças).
${repoContext}`;

    const callAi = async (model: ModelId, messages?: any[]): Promise<any> => {
      const msgs = messages ?? [{ role: "user", content }];

      if (model === "GEMINI") {
        const key = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || "";
        if (!key) return null;
        
        const resp = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${key}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: msgs.map((m) => ({
                role: m.role === "assistant" ? "model" : "user",
                parts: [{ text: m.content }],
              })),
              system_instruction: { parts: [{ text: systemPrompt }] },
              tools: [{
                function_declarations: tools.map(t => ({
                  name: t.name,
                  description: t.description,
                  parameters: t.input_schema
                }))
              }],
              tool_config: { function_calling_config: { mode: "AUTO" } }
            }),
          }
        );
        return resp.json();
      }
      
      // ... (Manter implementações de CLAUDE, OPENAI e GROQ como estão)
      if (model === "CLAUDE") {
        const key = process.env.ANTHROPIC_API_KEY ?? "";
        if (!key) return null;
        const resp = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": key,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: "claude-3-5-sonnet-20240620",
            max_tokens: 4096,
            tools,
            system: systemPrompt,
            messages: msgs,
          }),
        });
        if (resp.status === 429) return { _rateLimit: true };
        return resp.json();
      }

      if (model === "OPENAI") {
        const key = process.env.OPENAI_API_KEY ?? "";
        if (!key) return null;
        const resp = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "gpt-4o",
            messages: [{ role: "system", content: systemPrompt }, ...msgs],
            tools: tools.map((t) => ({
              type: "function",
              function: {
                name: t.name,
                description: t.description,
                parameters: t.input_schema,
              },
            })),
            tool_choice: "auto",
          }),
        });
        if (resp.status === 429) return { _rateLimit: true };
        return resp.json();
      }

      return null;
    };

    // --- LOGICA DE SELEÇÃO: PRIORIDADE MÁXIMA AO GEMINI ---
    let finalModel: ModelId | null = null;
    let aiResponse: any = null;

    // Se você selecionou um modelo, tentamos ele. Se não, forçamos GEMINI.
    const targetModel: ModelId = (selectedModel as ModelId) || "GEMINI";
    
    aiResponse = await callAi(targetModel);
    
    if (aiResponse && !isRateLimited(aiResponse) && !aiResponse.error) {
      finalModel = targetModel;
    } else {
      // Fallback agressivo se o principal falhar
      const priority: ModelId[] = ["GEMINI", "CLAUDE", "OPENAI"];
      for (const m of priority) {
        if (m === targetModel) continue;
        const resp = await callAi(m);
        if (resp && !isRateLimited(resp) && !resp.error) {
          aiResponse = resp;
          finalModel = m;
          blocks.push({ type: "thinking", content: `🔄 Fallback para ${m}...`, model: m });
          break;
        }
      }
    }

    if (!finalModel) throw new Error("Falha total na comunicação com as IAs.");

    blocks.push({ type: "thinking", content: `🧠 [${finalModel}] Zarith em operação...`, model: finalModel });

    // ... (O restante da função processToolCall e o fechamento da rota permanecem os mesmos)
    const processToolCall = async (model: ModelId, response: any, contextMsgs?: any[]): Promise<void> => {
      const toolCall = extractToolCall(model, response);

      if (!toolCall || toolCall.name !== "execute_github_operation") {
        const text = extractText(model, response);
        blocks.push({
          type: "text",
          content: text || "Resposta sem conteúdo.",
          model,
        });
        return;
      }

      const { operation, path, paths, code, reasoning } = toolCall.params;

      if (reasoning) {
        blocks.push({
          type: "thinking",
          content: `💡 ${reasoning}`,
          model,
        });
      }

      if (operation === "read") {
        const filesToRead: string[] = paths ?? (path ? [path] : []);

        if (filesToRead.length === 0) {
          blocks.push({
            type: "error",
            content: "❌ Operação de leitura sem caminhos especificados.",
            model,
          });
          return;
        }

        blocks.push({
          type: "action",
          content: `📖 Lendo ${filesToRead.length} arquivo(s): ${filesToRead.join(", ")}`,
          model,
        });

        const fileContents = await readGitHubFiles(filesToRead);
        const foundCount = Object.keys(fileContents).length;

        blocks.push({
          type: "result",
          content: `✅ ${foundCount}/${filesToRead.length} arquivo(s) carregado(s) — gerando análise contextualizada...`,
          model,
        });

        const contextText = Object.entries(fileContents)
          .map(([p, c]) => `=== FILE: ${p} ===\n\`\`\`\n${c}\n\`\`\``)
          .join("\n\n");

        const followUpMsgs = [
          { role: "user", content },
          {
            role: "assistant",
            content: `Li e analisei os seguintes arquivos do repositório:\n\n${contextText}`,
          },
          {
            role: "user",
            content:
              "Com base nos arquivos lidos, implemente as mudanças necessárias ou forneça sua análise completa.",
          },
        ];

        const secondResponse = await callAi(model, followUpMsgs);
        if (secondResponse && !isRateLimited(secondResponse)) {
          await processToolCall(model, secondResponse, followUpMsgs);
        }
      } else if (operation === "write") {
        if (!path || !code) {
          blocks.push({
            type: "error",
            content: "❌ Operação de escrita sem path ou code definidos.",
            model,
          });
          return;
        }

        blocks.push({
          type: "action",
          content: `✏️ Commitando alterações em: ${path}`,
          model,
        });

        try {
          let currentSha: string | undefined;
          try {
            const { data: file }: any = await octokit.rest.repos.getContent({
              owner: REPO_OWNER,
              repo: REPO_NAME,
              path,
            });
            currentSha = (file as any).sha;
          } catch {}

          await octokit.rest.repos.createOrUpdateFileContents({
            owner: REPO_OWNER,
            repo: REPO_NAME,
            path,
            message: `🤖 Zarith Elite (${model}): ${reasoning ?? "Auto-update"}`,
            content: Buffer.from(code).toString("base64"),
            sha: currentSha,
            author: {
              name: "Zarith AI Agent",
              email: "jadielalves54@gmail.com",
            },
          });

          blocks.push({
            type: "result",
            content: `✅ [GITHUB] Commit realizado com sucesso em \`${path}\``,
            model,
          });
        } catch (err: any) {
          blocks.push({
            type: "error",
            content: `❌ [GITHUB] Falha no commit: ${err.message}`,
            model,
          });
        }
      }
    };

    await processToolCall(finalModel, aiResponse);

    const textBlocks = blocks.filter((b) => b.type === "text" || b.type === "result");
    const textForSpeech =
      textBlocks.length > 0 ? textBlocks[textBlocks.length - 1].content : "";

    try {
      await db.insert(chatMessagesTable).values({
        role: "user",
        content,
        isThinking: false,
      });
      await db.insert(chatMessagesTable).values({
        role: "assistant",
        content: JSON.stringify(blocks),
        isThinking: false,
      });
    } catch {}

    res.status(200).json({
      blocks,
      text: textForSpeech,
      shouldSpeak: textBlocks.length > 0,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ... (Resto do arquivo com rotas de histórico permanece igual)
router.get("/history", async (req, res) => {
  try {
    const limit = Number(req.query.limit) || 50;
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
  } catch {
    res.json([]);
  }
});

export default router;
              
