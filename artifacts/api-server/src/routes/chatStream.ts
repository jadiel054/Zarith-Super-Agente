import { Router } from "express";
import { Octokit } from "octokit";
import { db } from "@workspace/db";
import { chatMessagesTable, activityLogTable } from "@workspace/db";
import { desc } from "drizzle-orm";

const router = Router();
const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
const REPO_OWNER = "jadiel054";
const REPO_NAME = "Zarith-Super-Agente";

// Gemini é o CORE PRINCIPAL. Claude e OpenAI são fallbacks. Groq removido.
type ModelId = "GEMINI" | "CLAUDE" | "OPENAI";

interface Block {
  type: "thinking" | "action" | "result" | "text" | "error";
  content: string;
  model?: string;
}

// ─── GitHub Helpers ─────────────────────────────────────────────────────────

async function readGitHubFile(path: string): Promise<string | null> {
  try {
    const { data }: any = await octokit.rest.repos.getContent({ owner: REPO_OWNER, repo: REPO_NAME, path });
    if (data.encoding === "base64") return Buffer.from(data.content.replace(/\n/g, ""), "base64").toString("utf-8");
    return data.content ?? null;
  } catch { return null; }
}

async function readGitHubFiles(paths: string[]): Promise<Record<string, string>> {
  const results: Record<string, string> = {};
  await Promise.all(paths.map(async (p) => {
    const c = await readGitHubFile(p);
    if (c) results[p] = c;
  }));
  return results;
}

async function getRepoTree(): Promise<string[]> {
  try {
    const { data } = await octokit.rest.git.getTree({ owner: REPO_OWNER, repo: REPO_NAME, tree_sha: "HEAD", recursive: "1" });
    return data.tree.filter((i) => i.type === "blob" && i.path).map((i) => i.path!).slice(0, 100);
  } catch { return []; }
}

async function searchRepoCode(query: string): Promise<string> {
  try {
    const { data } = await octokit.rest.search.code({ q: `${query} repo:${REPO_OWNER}/${REPO_NAME}` });
    return data.items.slice(0, 8).map((i) => `${i.path} — ${i.html_url}`).join("\n") || "Nenhum resultado.";
  } catch { return "Busca indisponível."; }
}

async function listDirectory(dirPath: string): Promise<string> {
  try {
    const { data }: any = await octokit.rest.repos.getContent({ owner: REPO_OWNER, repo: REPO_NAME, path: dirPath });
    if (Array.isArray(data)) return data.map((f) => `${f.type === "dir" ? "📁" : "📄"} ${f.path}`).join("\n");
    return `📄 ${(data as any).path}`;
  } catch { return "Diretório não encontrado."; }
}

async function writeGitHubFile(
  path: string,
  code: string,
  message: string,
  model: string
): Promise<{ ok: boolean; msg: string }> {
  try {
    let sha: string | undefined;
    try {
      const { data }: any = await octokit.rest.repos.getContent({ owner: REPO_OWNER, repo: REPO_NAME, path });
      sha = data.sha;
    } catch {}
    await octokit.rest.repos.createOrUpdateFileContents({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      path,
      message: `🤖 Zarith Elite (${model}): ${message}`,
      content: Buffer.from(code).toString("base64"),
      sha,
      author: { name: "Zarith AI Agent", email: "jadielalves54@gmail.com" },
    });
    return { ok: true, msg: `✅ Commit em \`${path}\` realizado com sucesso.` };
  } catch (e: any) {
    return { ok: false, msg: `❌ Falha no commit de \`${path}\`: ${e.message}` };
  }
}

async function deleteGitHubFile(path: string, model: string): Promise<string> {
  try {
    const { data }: any = await octokit.rest.repos.getContent({ owner: REPO_OWNER, repo: REPO_NAME, path });
    await octokit.rest.repos.deleteFile({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      path,
      message: `🤖 Zarith Elite (${model}): Removendo ${path}`,
      sha: data.sha,
      author: { name: "Zarith AI Agent", email: "jadielalves54@gmail.com" },
    });
    return `✅ Arquivo \`${path}\` removido do repositório.`;
  } catch (e: any) {
    return `❌ Falha ao remover \`${path}\`: ${(e as any).message}`;
  }
}

// ─── Tool Definitions ────────────────────────────────────────────────────────

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

router.post("/stream", async (req, res) => {
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

  let repoTree = "";
  try { repoTree = (await getRepoTree()).join("\n"); } catch {}
  const systemPrompt = buildSystemPrompt(repoTree);

  // ─── Execute Tool Call ──────────────────────────────────────────────────────

  const executeToolCall = async (
    { name: _name, params }: { name: string; params: any },
    model: ModelId,
    _messages: Array<{ role: string; content: string }>
  ): Promise<string> => {
    const { operation, path, paths, code, files, query, error_text, reasoning } = params;
    if (reasoning) emitBlock("thinking", `💡 ${reasoning}`, model);

    switch (operation) {
      case "read_files": {
        const toRead: string[] = paths ?? (path ? [path] : []);
        emitBlock("action", `📖 Lendo ${toRead.length} arquivo(s): ${toRead.join(", ")}`, model);
        const contents = await readGitHubFiles(toRead);
        const found = Object.keys(contents).length;
        emitBlock("result", `✅ ${found}/${toRead.length} arquivo(s) carregado(s).`, model);
        return Object.entries(contents)
          .map(([p, c]) => `=== ${p} ===\n\`\`\`\n${c}\n\`\`\``)
          .join("\n\n");
      }

      case "write_file": {
        if (!path || !code) {
          emitBlock("error", "❌ write_file requer 'path' e 'code'.", model);
          return "ERRO: path e code são obrigatórios para write_file.";
        }
        emitBlock("action", `✏️ Commitando: ${path}`, model);
        const r = await writeGitHubFile(path, code, reasoning ?? "Update", model);
        emitBlock(r.ok ? "result" : "error", r.msg, model);
        return r.msg;
      }

      case "multi_write":
      case "create_project": {
        const fileList: Array<{ path: string; code: string }> = files ?? [];
        if (!fileList.length) {
          emitBlock("error", "❌ Nenhum arquivo especificado.", model);
          return "ERRO: nenhum arquivo para criar.";
        }
        emitBlock("action", `🚀 Criando ${fileList.length} arquivo(s) no repositório...`, model);
        const results = await Promise.all(
          fileList.map((f) => writeGitHubFile(f.path, f.code, reasoning ?? "Scaffold", model))
        );
        const ok = results.filter((r) => r.ok).length;
        const failed = results.filter((r) => !r.ok);
        if (failed.length > 0) {
          emitBlock("error", `⚠️ ${failed.length} arquivo(s) falharam:\n${failed.map((r) => r.msg).join("\n")}`, model);
        }
        emitBlock(
          ok === fileList.length ? "result" : "error",
          `✅ ${ok}/${fileList.length} arquivos commitados com sucesso.`,
          model
        );
        return results.map((r) => r.msg).join("\n");
      }

      case "delete_file": {
        if (!path) { emitBlock("error", "❌ delete_file requer 'path'.", model); return "ERRO: path obrigatório."; }
        emitBlock("action", `🗑️ Removendo: ${path}`, model);
        const msg = await deleteGitHubFile(path, model);
        emitBlock(msg.startsWith("✅") ? "result" : "error", msg, model);
        return msg;
      }

      case "list_directory": {
        emitBlock("action", `📁 Listando: ${path ?? "/"}`, model);
        const listing = await listDirectory(path ?? "");
        emitBlock("result", listing, model);
        return listing;
      }

      case "search_code": {
        emitBlock("action", `🔍 Buscando: "${query}"`, model);
        const results = await searchRepoCode(query ?? "");
        emitBlock("result", results, model);
        return results;
      }

      case "analyze_error": {
        emitBlock("thinking", `🐛 Analisando erro: ${(error_text ?? "").slice(0, 200)}...`, model);
        const pathMatches =
          (error_text ?? "").match(/(?:at\s+|in\s+|File\s+|→\s*)([\/\w\-\.]+\.[a-z]{2,4})/gi) ?? [];
        const filePaths = [
          ...new Set(pathMatches.map((m: string) => m.replace(/^(?:at|in|File|→)\s*/i, "").trim())),
        ].slice(0, 5);
        if (filePaths.length > 0) {
          emitBlock("action", `📖 Lendo arquivos relacionados ao erro: ${filePaths.join(", ")}`, model);
          const contents = await readGitHubFiles(filePaths);
          const found = Object.keys(contents).length;
          emitBlock("result", `✅ ${found} arquivo(s) lido(s) para análise do erro.`, model);
          return Object.entries(contents).map(([p, c]) => `=== ${p} ===\n${c}`).join("\n\n");
        }
        return error_text ?? "";
      }

      case "read_runtime_logs": {
        emitBlock("action", "📋 Lendo log de atividade do servidor (últimas 50 entradas)...", model);
        try {
          const logs = await db
            .select()
            .from(activityLogTable)
            .orderBy(desc(activityLogTable.createdAt))
            .limit(50);
          const formatted = logs
            .reverse()
            .map(
              (l) =>
                `[${l.createdAt.toISOString()}] [${l.type}] ${l.description}${
                  l.metadata ? ` | ${JSON.stringify(l.metadata)}` : ""
                }`
            )
            .join("\n");
          emitBlock("result", `✅ ${logs.length} entradas de log de atividade carregadas.`, model);
          return formatted || "Nenhum log de atividade encontrado no banco de dados.";
        } catch (e: any) {
          emitBlock("error", `❌ Erro ao ler logs de atividade: ${e.message}`, model);
          return `ERRO ao ler logs: ${e.message}`;
        }
      }

      default:
        emitBlock("error", `❌ Operação desconhecida: ${operation}`, model);
        return `ERRO: operação '${operation}' não reconhecida.`;
    }
  };

  // ─── Gemini Non-Stream (follow-ups e autocorreção) ────────────────────────

  const MAX_RETRIES = 3;

  const runGeminiNonStream = async (
    messages: Array<{ role: string; content: string }>,
    retryCount: number
  ): Promise<void> => {
    if (retryCount > MAX_RETRIES) {
      emitBlock("error", `❌ Limite de ${MAX_RETRIES} tentativas de autocorreção atingido.`, "GEMINI");
      return;
    }

    const key = process.env.GEMINI_API_KEY ?? "";
    if (!key) return;

    try {
      const resp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: messages.map((m) => ({
              role: m.role === "assistant" ? "model" : "user",
              parts: [{ text: m.content }],
            })),
            system_instruction: { parts: [{ text: systemPrompt }] },
            tools: [
              {
                function_declarations: TOOLS.map((t) => ({
                  name: t.name,
                  description: t.description,
                  parameters: t.input_schema,
                })),
              },
            ],
          }),
        }
      );

      if (resp.status === 429 || resp.status >= 400) return;
      const json = await resp.json();

      const parts = json?.candidates?.[0]?.content?.parts ?? [];
      let text = "";
      let toolCallParams: { name: string; params: any } | null = null;

      for (const part of parts) {
        if (part.text) text += part.text;
        if (part.functionCall) {
          toolCallParams = { name: part.functionCall.name, params: part.functionCall.args };
        }
      }

      if (toolCallParams) {
        const toolResult = await executeToolCall(toolCallParams, "GEMINI", messages);

        // Loop de autocorreção: se deu erro, tenta corrigir
        if (toolResult.startsWith("❌") || toolResult.startsWith("ERRO:")) {
          if (retryCount < MAX_RETRIES) {
            emitBlock(
              "thinking",
              `🔄 Tentativa ${retryCount + 1}/${MAX_RETRIES} de autocorreção...`,
              "GEMINI"
            );
            await runGeminiNonStream(
              [
                ...messages,
                { role: "assistant", content: `Tentei mas recebi erro: ${toolResult}` },
                { role: "user", content: `Erro: ${toolResult}\n\nTente uma abordagem diferente para corrigir.` },
              ],
              retryCount + 1
            );
          }
        } else if (
          toolCallParams.params.operation !== "write_file" &&
          toolCallParams.params.operation !== "delete_file" &&
          toolCallParams.params.operation !== "multi_write" &&
          toolCallParams.params.operation !== "create_project"
        ) {
          await runGeminiNonStream(
            [
              ...messages,
              { role: "assistant", content: `Executei: ${toolCallParams.params.operation}. Resultado:\n${toolResult.slice(0, 6000)}` },
              { role: "user", content: "Agora implemente as mudanças necessárias ou forneça resposta final." },
            ],
            retryCount
          );
        }
      } else if (text) {
        emitBlock("text", text, "GEMINI");
      }
    } catch (e: any) {
      emitBlock("error", `❌ Erro no follow-up Gemini: ${e.message}`, "GEMINI");
    }
  };

  // ─── Gemini Streaming (Core Principal) ────────────────────────────────────

  const runGeminiStream = async (
    messages: Array<{ role: string; content: string }>
  ): Promise<boolean> => {
    const key = process.env.GEMINI_API_KEY ?? "";
    if (!key) return false;

    emitBlock("thinking", "🧠 [GEMINI 2.5 FLASH] Analisando diretiva...", "GEMINI");

    try {
      const resp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?key=${key}&alt=sse`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: messages.map((m) => ({
              role: m.role === "assistant" ? "model" : "user",
              parts: [{ text: m.content }],
            })),
            system_instruction: { parts: [{ text: systemPrompt }] },
            tools: [
              {
                function_declarations: TOOLS.map((t) => ({
                  name: t.name,
                  description: t.description,
                  parameters: t.input_schema,
                })),
              },
            ],
          }),
        }
      );

      if (resp.status === 429 || resp.status >= 400 || !resp.body) {
        emitBlock("thinking", `⚠️ Gemini retornou HTTP ${resp.status} — ativando fallback...`, "GEMINI");
        return false;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let rawBuf = "";
      let fullText = "";
      let streamingStarted = false;
      let toolCallParams: { name: string; params: any } | null = null;

      while (true) {
        const { done: d, value } = await reader.read();
        if (d) break;
        rawBuf += decoder.decode(value, { stream: true });
        const lines = rawBuf.split("\n");
        rawBuf = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (!jsonStr || jsonStr === "[DONE]") continue;
          try {
            const json = JSON.parse(jsonStr);
            const parts = json?.candidates?.[0]?.content?.parts ?? [];
            for (const part of parts) {
              if (part.text) {
                fullText += part.text;
                if (!streamingStarted) {
                  streamingStarted = true;
                  emit("block_start", { type: "text", model: "GEMINI" });
                }
                emit("token", { text: part.text });
              }
              if (part.functionCall) {
                toolCallParams = {
                  name: part.functionCall.name,
                  params: part.functionCall.args,
                };
              }
            }
          } catch {}
        }
      }

      if (streamingStarted) {
        emit("block_end", { type: "text", content: fullText, model: "GEMINI" });
        allBlocks.push({ type: "text", content: fullText, model: "GEMINI" });
      }

      if (toolCallParams) {
        const toolResult = await executeToolCall(toolCallParams, "GEMINI", messages);

        // Loop de autocorreção se erro
        if (toolResult.startsWith("❌") || toolResult.startsWith("ERRO:")) {
          emitBlock("thinking", "🔄 Erro detectado — iniciando loop de autocorreção...", "GEMINI");
          await runGeminiNonStream(
            [
              ...messages,
              { role: "assistant", content: `Tentei executar a operação mas recebi este erro:\n${toolResult}` },
              { role: "user", content: `Erro: ${toolResult}\n\nAnalise e corrija imediatamente usando zarith_tool.` },
            ],
            1
          );
        } else if (
          toolCallParams.params.operation !== "write_file" &&
          toolCallParams.params.operation !== "delete_file" &&
          toolCallParams.params.operation !== "multi_write" &&
          toolCallParams.params.operation !== "create_project"
        ) {
          await runGeminiNonStream(
            [
              ...messages,
              { role: "assistant", content: `Executei: ${toolCallParams.params.operation}. Resultado:\n${toolResult.slice(0, 6000)}` },
              { role: "user", content: "Com base nos dados obtidos, implemente as mudanças necessárias ou forneça resposta final." },
            ],
            0
          );
        }
      }

      return true;
    } catch (e: any) {
      emitBlock("error", `❌ Erro interno Gemini: ${e.message}`, "GEMINI");
      return false;
    }
  };

  // ─── Claude Fallback ──────────────────────────────────────────────────────

  const runClaudeStream = async (
    messages: Array<{ role: string; content: string }>
  ): Promise<boolean> => {
    const key = process.env.ANTHROPIC_API_KEY ?? "";
    if (!key) return false;

    emitBlock("thinking", "🧠 [CLAUDE 3.5] Analisando diretiva...", "CLAUDE");

    try {
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
          stream: true,
          tools: TOOLS,
          system: systemPrompt,
          messages,
        }),
      });

      if (resp.status === 429 || !resp.body) return false;

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let fullText = "";
      let toolName = "";
      let toolArgsBuf = "";
      let inToolCall = false;
      let streamingStarted = false;

      while (true) {
        const { done: d, value } = await reader.read();
        if (d) break;
        buf += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buf.indexOf("\n\n")) !== -1) {
          const rawChunk = buf.slice(0, idx);
          buf = buf.slice(idx + 2);
          let evName = "";
          let dataStr = "";
          for (const line of rawChunk.split("\n")) {
            if (line.startsWith("event: ")) evName = line.slice(7).trim();
            else if (line.startsWith("data: ")) dataStr = line.slice(6).trim();
          }
          if (!dataStr) continue;
          try {
            const json = JSON.parse(dataStr);
            if (evName === "content_block_start" && json?.content_block?.type === "tool_use") {
              inToolCall = true;
              toolName = json.content_block.name;
              toolArgsBuf = "";
            } else if (evName === "content_block_delta") {
              const delta = json?.delta;
              if (delta?.type === "text_delta") {
                fullText += delta.text;
                if (!streamingStarted) {
                  streamingStarted = true;
                  emit("block_start", { type: "text", model: "CLAUDE" });
                }
                emit("token", { text: delta.text });
              } else if (delta?.type === "input_json_delta") {
                toolArgsBuf += delta.partial_json ?? "";
              }
            } else if (evName === "content_block_stop" && inToolCall) {
              inToolCall = false;
              try {
                const params = JSON.parse(toolArgsBuf);
                await executeToolCall({ name: toolName, params }, "CLAUDE", messages);
              } catch {}
            }
          } catch {}
        }
      }

      if (streamingStarted) {
        emit("block_end", { type: "text", content: fullText, model: "CLAUDE" });
        allBlocks.push({ type: "text", content: fullText, model: "CLAUDE" });
      }

      return true;
    } catch (e: any) {
      emitBlock("error", `❌ Erro Claude: ${e.message}`, "CLAUDE");
      return false;
    }
  };

  // ─── OpenAI Fallback ──────────────────────────────────────────────────────

  const runOpenAIStream = async (
    messages: Array<{ role: string; content: string }>
  ): Promise<boolean> => {
    const key = process.env.OPENAI_API_KEY ?? "";
    if (!key) return false;

    emitBlock("thinking", "🧠 [GPT-4o] Analisando diretiva...", "OPENAI");

    try {
      const resp = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gpt-4o",
          stream: true,
          messages: [{ role: "system", content: systemPrompt }, ...messages],
          tools: TOOLS.map((t) => ({
            type: "function",
            function: { name: t.name, description: t.description, parameters: t.input_schema },
          })),
          tool_choice: "auto",
        }),
      });

      if (resp.status === 429 || !resp.body) return false;

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let fullText = "";
      let toolArgsBuf = "";
      let toolName = "";
      let streamingStarted = false;

      while (true) {
        const { done: d, value } = await reader.read();
        if (d) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          const clean = line.replace(/^data: /, "").trim();
          if (!clean || clean === "[DONE]") continue;
          try {
            const json = JSON.parse(clean);
            const delta = json.choices?.[0]?.delta;
            if (!delta) continue;
            if (delta.content) {
              fullText += delta.content;
              if (!streamingStarted) {
                streamingStarted = true;
                emit("block_start", { type: "text", model: "OPENAI" });
              }
              emit("token", { text: delta.content });
            }
            if (delta.tool_calls?.[0]) {
              const tc = delta.tool_calls[0];
              if (tc.function?.name) toolName = tc.function.name;
              if (tc.function?.arguments) toolArgsBuf += tc.function.arguments;
            }
            const finishReason = json.choices?.[0]?.finish_reason;
            if (finishReason === "tool_calls" && toolName) {
              try {
                await executeToolCall(
                  { name: toolName, params: JSON.parse(toolArgsBuf) },
                  "OPENAI",
                  messages
                );
              } catch {}
            }
          } catch {}
        }
      }

      if (streamingStarted) {
        emit("block_end", { type: "text", content: fullText, model: "OPENAI" });
        allBlocks.push({ type: "text", content: fullText, model: "OPENAI" });
      }

      return true;
    } catch (e: any) {
      emitBlock("error", `❌ Erro OpenAI: ${e.message}`, "OPENAI");
      return false;
    }
  };

  // ─── Execution ────────────────────────────────────────────────────────────

  const baseMessages = [{ role: "user", content }];
  let success = false;

  // Gemini é o padrão. Groq foi removido.
  const validModels: ModelId[] = ["GEMINI", "CLAUDE", "OPENAI"];
  const effectiveModel: ModelId =
    selectedModel && validModels.includes(selectedModel as ModelId)
      ? (selectedModel as ModelId)
      : "GEMINI";

  if (effectiveModel === "GEMINI") {
    success = await runGeminiStream(baseMessages);
    if (!success) {
      emitBlock("thinking", "⚠️ Gemini indisponível — ativando fallback Claude...", "GEMINI");
      success = await runClaudeStream(baseMessages);
      if (!success) {
        emitBlock("thinking", "⚠️ Claude indisponível — ativando fallback GPT-4o...", "CLAUDE");
        success = await runOpenAIStream(baseMessages);
      }
    }
  } else if (effectiveModel === "CLAUDE") {
    success = await runClaudeStream(baseMessages);
    if (!success) {
      emitBlock("thinking", "⚠️ Claude indisponível — ativando fallback Gemini...", "CLAUDE");
      success = await runGeminiStream(baseMessages);
    }
  } else if (effectiveModel === "OPENAI") {
    success = await runOpenAIStream(baseMessages);
    if (!success) {
      emitBlock("thinking", "⚠️ GPT-4o indisponível — ativando fallback Gemini...", "OPENAI");
      success = await runGeminiStream(baseMessages);
    }
  }

  if (!success) {
    emitBlock(
      "error",
      "❌ Nenhum modelo de IA disponível. Configure GEMINI_API_KEY em System Config."
    );
  }

  const textBlocks = allBlocks.filter((b) => b.type === "text" || b.type === "result");
  const textForSpeech =
    textBlocks.length > 0 ? textBlocks[textBlocks.length - 1].content.slice(0, 500) : "";

  await done(textBlocks.length > 0, textForSpeech);
});

export default router;
