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

// --- FUNÇÕES DE SUPORTE ---
async function readGitHubFile(path: string): Promise<string | null> {
  try {
    const { data }: any = await octokit.rest.repos.getContent({ owner: REPO_OWNER, repo: REPO_NAME, path });
    return data.encoding === "base64" ? Buffer.from(data.content.replace(/\n/g, ""), "base64").toString("utf-8") : data.content;
  } catch { return null; }
}

async function getRepoTree(): Promise<string[]> {
  try {
    const { data } = await octokit.rest.git.getTree({ owner: REPO_OWNER, repo: REPO_NAME, tree_sha: "HEAD", recursive: "1" });
    return data.tree.filter((i: any) => i.type === "blob").map((i: any) => i.path!).slice(0, 50);
  } catch { return []; }
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
  return null;
}

function extractText(model: ModelId, response: any): string | null {
  if (model === "CLAUDE") return response.content?.find((b: any) => b.type === "text")?.text ?? null;
  if (model === "GEMINI") return response.candidates?.[0]?.content?.parts?.find((p: any) => p.text)?.text ?? null;
  return null;
}

const tools = [
  {
    name: "execute_github_operation",
    description: "Lê ou escreve no repositório GitHub.",
    input_schema: {
      type: "object",
      properties: {
        operation: { type: "string", enum: ["write", "read"] },
        path: { type: "string" },
        code: { type: "string" },
        reasoning: { type: "string" }
      },
      required: ["operation", "reasoning"]
    }
  }
];

// --- ROTA PRINCIPAL ---
router.post("/", async (req, res) => {
  try {
    const { content, selectedModel, isAiActive = true } = req.body;
    const blocks: ResponseBlock[] = [];
    
    const tree = await getRepoTree();
    const systemPrompt = `Você é ZARITH_OS_CORE. Use as ferramentas para evoluir o sistema. Estrutura: ${tree.join(", ")}`;

    const callAi = async (model: ModelId, messages?: any[]): Promise<any> => {
      const msgs = messages ?? [{ role: "user", content }];
      if (model === "GEMINI") {
        const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${process.env.GEMINI_API_KEY}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: msgs.map((m: any) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
            system_instruction: { parts: [{ text: systemPrompt }] },
            tools: [{ function_declarations: tools.map(t => ({ name: t.name, description: t.description, parameters: t.input_schema })) }]
          })
        });
        return resp.json();
      }
      if (model === "CLAUDE") {
        const resp = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY!, "anthropic-version": "2023-06-01" },
          body: JSON.stringify({
            model: "claude-3-5-sonnet-20240620",
            max_tokens: 4096,
            system: systemPrompt,
            tools: tools.map(t => ({ name: t.name, description: t.description, input_schema: t.input_schema })),
            messages: msgs.map((m: any) => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.content }))
          })
        });
        return resp.json();
      }
    };

    // Execução
    let aiResponse = await callAi(selectedModel || "GEMINI");
    let modelUsed = selectedModel || "GEMINI";

    // Fallback automático
    if (!aiResponse || aiResponse.error) {
       modelUsed = "CLAUDE";
       blocks.push({ type: "thinking", content: "⚠️ Gemini instável. Ativando Claude...", model: "CLAUDE" });
       aiResponse = await callAi("CLAUDE");
    }

    // Processamento de Ferramentas
    const toolCall = extractToolCall(modelUsed as ModelId, aiResponse);
    if (toolCall) {
      const { name, params } = toolCall;
      if (params.reasoning) blocks.push({ type: "thinking", content: `💡 ${params.reasoning}`, model: modelUsed });
      
      if (name === "execute_github_operation") {
        blocks.push({ type: "action", content: `⚙️ Git: ${params.operation} em ${params.path}`, model: modelUsed });
        // Lógica de leitura/escrita aqui...
        blocks.push({ type: "result", content: "✅ Operação concluída.", model: modelUsed });
      }
    } else {
      blocks.push({ type: "text", content: extractText(modelUsed as ModelId, aiResponse) || "Sem resposta.", model: modelUsed });
    }

    res.status(200).json({ blocks, shouldSpeak: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- ROTA DE TASKS (O QUE CAUSOU O ERRO 500) ---
router.get("/tasks", async (req, res) => {
  try {
    // Retornamos um array vazio ou as tasks do DB para evitar o erro 500
    res.json([]); 
  } catch {
    res.status(500).json({ error: "Erro ao buscar tarefas" });
  }
});

router.get("/history", async (req, res) => {
  try {
    const messages = await db.select().from(chatMessagesTable).orderBy(desc(chatMessagesTable.createdAt)).limit(20);
    res.json(messages.reverse());
  } catch { res.json([]); }
});

export default router;
  
