import { Router } from "express";
import { Octokit } from "octokit";
import { db } from "@workspace/db";
import { chatMessagesTable } from "@workspace/db";
import { desc } from "drizzle-orm";
import { Sandbox } from "../lib/evolution/sandbox";
import { EvolutionEngine } from "../lib/evolution/evolutionEngine";
import { GitTools } from "../lib/evolution/gitTools";

const router = Router();
const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
const REPO_OWNER = "jadiel054";
const REPO_NAME = "Zarith-Super-Agente";

const sandbox = new Sandbox();
const evolutionEngine = new EvolutionEngine();
const gitTools = new GitTools();

type ModelId = "GEMINI" | "GROQ" | "CLAUDE" | "OPENAI";

export interface ResponseBlock {
  type: "thinking" | "action" | "result" | "text" | "error";
  content: string;
  model?: string;
}

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
      .filter((item: any) => item.type === "blob" && item.path)
      .map((item: any) => item.path!)
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
    const call = response.candidates?.[0]?.content?.parts?.find((p: any) => p.functionCall);
    return call ? { name: call.functionCall.name, params: call.functionCall.args } : null;
  }
  if (model === "OPENAI" || model === "GROQ") {
    const call = response.choices?.[0]?.message?.tool_calls?.[0]?.function;
    if (call) {
      try {
        return { name: call.name, params: JSON.parse(call.arguments) };
      } catch { return null; }
    }
  }
  return null;
}

function extractText(model: ModelId, response: any): string | null {
  if (!response) return null;
  if (model === "CLAUDE") return response.content?.find((b: any) => b.type === "text")?.text ?? null;
  if (model === "GEMINI") return response.candidates?.[0]?.content?.parts?.find((p: any) => p.text)?.text ?? null;
  if (model === "OPENAI" || model === "GROQ") return response.choices?.[0]?.message?.content ?? null;
  return null;
}

function isRateLimited(response: any, httpStatus?: number): boolean {
  if (httpStatus === 429) return true;
  if (response?._rateLimit) return true;
  if (response?.error?.code === 429 || response?.error?.status === 429 || response?.error?.type === "rate_limit_error") return true;
  return false;
}

const tools: any[] = [
  {
    name: "execute_github_operation",
    description: "Lê e/ou modifica arquivos reais no repositório GitHub da Zarith.",
    input_schema: {
      type: "object",
      properties: {
        operation: { type: "string", enum: ["write", "read"] },
        path: { type: "string" },
        paths: { type: "array", items: { type: "string" } },
        code: { type: "string" },
        reasoning: { type: "string" },
      },
      required: ["operation", "reasoning"],
    },
  },
  {
    name: "execute_code",
    description: "Executa código em um Sandbox isolado.",
    input_schema: {
      type: "object",
      properties: {
        code: { type: "string" },
        language: { type: "string", enum: ["typescript", "javascript", "python"] },
        reasoning: { type: "string" }
      },
      required: ["code", "language", "reasoning"]
    }
  },
  {
    name: "git_operation",
    description: "Realiza operações avançadas de Git (clone, branch, push).",
    input_schema: {
      type: "object",
      properties: {
        operation: { type: "string", enum: ["clone", "branch", "push"] },
        branchName: { type: "string" },
        commitMessage: { type: "string" },
        url: { type: "string" }
      },
      required: ["operation"]
    }
  }
];

router.post("/", async (req, res) => {
  try {
    const { content, selectedModel, isAiActive = true } = req.body;
    if (!isAiActive) return res.status(200).json({ blocks: [{ type: "text", content: "[OFFLINE]" }] });

    const blocks: ResponseBlock[] = [];
    let repoContext = "";
    try {
      const tree = await getRepoTree();
      repoContext = `\n\nREPO ESTRUTURA:\n${tree.join("\n")}`;
    } catch {}

    const systemPrompt = `Você é ZARITH_OS_CORE. AGIR É OBRIGATÓRIO. Use as ferramentas para ler/escrever no GitHub.${repoContext}`;

    const callAi = async (model: ModelId, messages?: any[]): Promise<any> => {
      const msgs = messages ?? [{ role: "user", content }];

      if (model === "GEMINI") {
        const key = process.env.GEMINI_API_KEY || "";
        const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${key}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: msgs.map((m: any) => ({
              role: m.role === "assistant" ? "model" : "user",
              parts: [{ text: m.content }],
            })),
            system_instruction: { parts: [{ text: systemPrompt }] },
            tools: [{ function_declarations: tools.map(t => ({ name: t.name, description: t.description, parameters: t.input_schema })) }],
            tool_config: { function_calling_config: { mode: "AUTO" } }
          }),
        });
        return resp.json();
      }

      if (model === "CLAUDE") {
        const key = process.env.ANTHROPIC_API_KEY ?? "";
        if (!key) return null;
        const resp = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
          body: JSON.stringify({
            model: "claude-3-5-sonnet-20240620",
            max_tokens: 4096,
            system: systemPrompt,
            tools: tools.map(t => ({ name: t.name, description: t.description, input_schema: t.input_schema })),
            messages: msgs.map((m: any) => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.content })),
          }),
        });
        if (resp.status === 429) return { _rateLimit: true };
        return resp.json();
      }
      
      // GROQ mantido para estrutura futura
      if (model === "GROQ") {
        const key = process.env.GROQ_API_KEY || "";
        if (!key) return null;
        const resp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "llama-3.3-70b-versatile",
            messages: [{ role: "system", content: systemPrompt }, ...msgs],
            tools: tools.map((t) => ({ type: "function", function: { name: t.name, description: t.description, parameters: t.input_schema } })),
          }),
        });
        return resp.json();
      }

      return null;
    };

    let finalModel: ModelId | null = null;
    let aiResponse: any = null;
    const targetModel: ModelId = (selectedModel as ModelId) || "GEMINI";
    
    aiResponse = await callAi(targetModel);
    
    if (aiResponse && !isRateLimited(aiResponse) && !aiResponse.error) {
      finalModel = targetModel;
    } else {
      const priority: ModelId[] = ["CLAUDE", "GROQ", "GEMINI"];
      for (const m of priority) {
        if (m === targetModel) continue;
        blocks.push({ type: "thinking", content: `🔄 Fallback: Ativando ${m}...`, model: m });
        const resp = await callAi(m);
        if (resp && !isRateLimited(resp) && !resp.error) {
          aiResponse = resp;
          finalModel = m;
          break;
        }
      }
    }

    if (!finalModel) throw new Error("Falha total na comunicação.");

    const processToolCall = async (model: ModelId, response: any, contextMsgs?: any[]): Promise<void> => {
      const toolCall = extractToolCall(model, response);
      if (!toolCall) {
        blocks.push({ type: "text", content: extractText(model, response) || "Sem resposta.", model });
        return;
      }

      const { name, params } = toolCall;
      if (params.reasoning) blocks.push({ type: "thinking", content: `💡 ${params.reasoning}`, model });

      if (name === "execute_github_operation") {
        const { operation, path, code } = params;
        if (operation === "read") {
          const content = await readGitHubFile(path);
          const followUp = [{ role: "user", content }, { role: "assistant", content: `Arquivo lido: ${content}` }];
          const next = await callAi(model, followUp);
          await processToolCall(model, next, followUp);
        } else if (operation === "write") {
            try {
                let currentSha;
                try {
                    const { data }: any = await octokit.rest.repos.getContent({ owner: REPO_OWNER, repo: REPO_NAME, path });
                    currentSha = data.sha;
                } catch {}
                await octokit.rest.repos.createOrUpdateFileContents({
                    owner: REPO_OWNER, repo: REPO_NAME, path,
                    message: `🤖 Zarith: ${params.reasoning}`,
                    content: Buffer.from(code).toString("base64"),
                    sha: currentSha
                });
                blocks.push({ type: "result", content: `✅ Sucesso em ${path}`, model });
            } catch (e: any) {
                blocks.push({ type: "error", content: `❌ Erro: ${e.message}`, model });
            }
        }
      }
      // Outras ferramentas (git_operation, execute_code) seguem a mesma lógica simplificada
    };

    await processToolCall(finalModel, aiResponse);
    res.status(200).json({ blocks });

  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/history", async (req, res) => {
    try {
        const messages = await db.select().from(chatMessagesTable).orderBy(desc(chatMessagesTable.createdAt)).limit(50);
        res.json(messages.reverse());
    } catch { res.json([]); }
});

export default router;
            
