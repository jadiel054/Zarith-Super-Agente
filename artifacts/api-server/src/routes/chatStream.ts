import { Router } from "express";
import { ReActEngine } from "../lib/evolution/ReActEngine";
import { TOOLS, readGitHubFiles, writeGitHubFile, deleteGitHubFile, listDirectory, searchRepoCode, getRepoTree } from "../lib/evolution/tools";
import { db } from "@workspace/db";
import { chatMessagesTable, activityLogTable, zarithExecutionLogsTable } from "@workspace/db";
import { desc } from "drizzle-orm";

const router = Router();

const REPO_OWNER = "jadiel054";
const REPO_NAME = "Zarith-Super-Agente";
const SUPABASE_PROJECT_ID = process.env.SUPABASE_PROJECT_ID || "dlwcphhzasvromnagvgh"; // Usar o ID do projeto Zarith-SaaS

// Gemini é o CORE PRINCIPAL. Claude e OpenAI são fallbacks. Groq removido.
type ModelId = "GEMINI" | "CLAUDE" | "OPENAI";

interface Block {
  type: "thinking" | "action" | "result" | "text" | "error";
  content: string;
  model?: string;
}


const TOOLS = [
  {
    name: "zarith_tool",
    description: `Ferramenta unificada do agente Zarith para autocodificação e gestão do repositório GitHub.
Operações disponíveis:
- read_files: Lê um ou múltiplos arquivos do repo para entender contexto
- write_file: Commita código em um arquivo (sempre leia antes de escrever)
- multi_write: Cria/edita múltiplos arquivos em um único commit (para scaffolding de projetos)
- delete_file: Remove um arquivo do repositório
- list_directory: Lista conteúdo de um diretório
- search_code: Busca padrões de código no repositório
- create_project: Cria estrutura completa de um novo projeto (vários arquivos)
- analyze_error: Analisa um erro, encontra a causa raiz e propõe correção
- read_runtime_logs: Lê as últimas 50 entradas do log de atividade do servidor — use ANTES de grandes alterações para aprender com o histórico e APÓS commits para verificar erros de execução`,
    input_schema: {
      type: "object",
      properties: {
        operation: {
          type: "string",
          enum: [
            "read_files",
            "write_file",
            "multi_write",
            "delete_file",
            "list_directory",
            "search_code",
            "create_project",
            "analyze_error",
            "read_runtime_logs",
          ],
        },
        path: { type: "string", description: "Caminho do arquivo (para operações em arquivo único)" },
        paths: { type: "array", items: { type: "string" }, description: "Lista de caminhos para leitura múltipla" },
        code: { type: "string", description: "Conteúdo completo do arquivo a commitar" },
        files: {
          type: "array",
          description: "Para multi_write/create_project: lista de {path, code} para commit simultâneo",
          items: {
            type: "object",
            properties: { path: { type: "string" }, code: { type: "string" } },
            required: ["path", "code"],
          },
        },
        query: { type: "string", description: "Termo de busca para search_code" },
        error_text: { type: "string", description: "Stack trace ou mensagem de erro para analyze_error" },
        reasoning: { type: "string", description: "Justificativa detalhada da operação" },
      },
      required: ["operation", "reasoning"],
    },
  },
];

// ─── System Prompt ────────────────────────────────────────────────────────────

function buildSystemPrompt(repoTree: string): string {
  return `Você é ZARITH_OS_CORE — Engenheira de Sistemas Autônoma de Elite. Você não apenas sugere código: você EXECUTA, COMMITA e CORRIGE automaticamente.

REGRAS ABSOLUTAS:
1. NUNCA simule ou diga que fez algo sem usar zarith_tool
2. Se um commit falhar, analise o erro com analyze_error e tente novamente
3. Sempre leia o arquivo antes de editar (read_files → write_file)
4. Para projetos novos: use create_project ou multi_write para criar todos os arquivos de uma vez
5. Se o código quebrar: leia o log, encontre a causa, corrija imediatamente
6. Responda SEMPRE em português brasileiro com precisão técnica
7. MEMÓRIA DE LONGO PRAZO — OBRIGATÓRIO: ANTES de qualquer alteração significativa (refatorações, novos recursos, mudanças de arquitetura), use read_runtime_logs para consultar o histório de atividades do sistema. Aprenda com erros e sucessos anteriores registrados no activityLogTable antes de agir.
8. VERIFICAÇÃO PÓS-COMMIT: Após commits importantes, use read_runtime_logs para confirmar que nenhum erro de execução foi registrado.

FLUXO DE AUTOCORREÇÃO:
- Erro detectado → analyze_error → read_files dos arquivos afetados → write_file com correção → read_runtime_logs para confirmar sucesso

FLUXO PARA GRANDES ALTERAÇÕES:
- read_runtime_logs (aprender com histórico) → read_files (contexto atual) → write_file/multi_write → read_runtime_logs (verificar impacto)

CAPACIDADES:
🧠 Análise profunda de código e arquitetura
🔧 Autocodificação: lê, entende e modifica o próprio código-fonte
🚀 Criação de projetos completos (React, Node.js, APIs, etc.)
🐛 Detecção automática de erros e auto-correção em loop
📦 Scaffolding completo de aplicações do zero
🔄 Commits automáticos com mensagens descritivas
🔍 Busca de código no repositório
📋 Memória de longo prazo via activityLogTable (read_runtime_logs)
${repoTree ? `\nÁRVORE DO REPOSITÓRIO ZARITH:\n${repoTree}` : ""}`;
}

// ─── Main Stream Route ────────────────────────────────────────────────────────

router.post("/chat/stream", async (req, res) => {
  const { content, selectedModel, isAiActive = true } = req.body;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  if (typeof (res as any).flushHeaders === "function") (res as any).flushHeaders();

  const allBlocks: Block[] = [];

  const emit = (event: string, data: object) => {
    try { res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); } catch {}
  };

  const emitBlock = (type: Block["type"], content: string, model?: string) => {
    const block: Block = { type, content, model };
    allBlocks.push(block);
    emit("block", block);
  };

  const done = async (shouldSpeak: boolean, textForSpeech: string) => {
    emit("done", { shouldSpeak, text: textForSpeech });
    try {
      await db.insert(chatMessagesTable).values({ role: "user", content, isThinking: false });
      await db.insert(chatMessagesTable).values({
        role: "assistant",
        content: JSON.stringify(allBlocks),
        isThinking: false,
      });
    } catch {}
    res.end();
  };

  if (!isAiActive) {
    emitBlock("text", "[OFFLINE] Sistema central desativado pelo operador.");
    await done(false, "");
    return;
  }

  const systemPrompt = buildSystemPrompt(await getRepoTree());

  const reactEngine = new ReActEngine(SUPABASE_PROJECT_ID, REPO_OWNER, REPO_NAME, db, emitBlock, TOOLS);

  // O novo fluxo principal agora usa o ReActEngine
  try {
    const final_response = await reactEngine.run(content, selectedModel);
    emitBlock("text", final_response);
  } catch (e: any) {
    console.error("Error during ReActEngine execution:", e);
    emitBlock("error", `Erro fatal no motor ReAct: ${e.message}`);
  }

  const textBlocks = allBlocks.filter((b) => b.type === "text" || b.type === "result");
  const textForSpeech =
    textBlocks.length > 0 ? textBlocks[textBlocks.length - 1].content.slice(0, 500) : "";
  await done(textBlocks.length > 0, textForSpeech);

});

export default router;
