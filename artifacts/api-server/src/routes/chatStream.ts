import { Router } from "express";
import { Octokit } from "octokit";
import { db } from "@workspace/db";
import { chatMessagesTable } from "@workspace/db";

const router = Router();
const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
const REPO_OWNER = "jadiel054";
const REPO_NAME = "Zarith-Super-Agente";

type ModelId = "GEMINI" | "CLAUDE" | "OPENAI" | "GROQ";

interface Block {
  type: "thinking" | "action" | "result" | "text" | "error";
  content: string;
  model?: string;
}

function isRateLimited(response: any, httpStatus?: number): boolean {
  if (httpStatus === 429) return true;
  if (response?._rateLimit) return true;
  if (response?.error?.code === 429 || response?.error?.status === 429) return true;
  return false;
}

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

async function writeGitHubFile(path: string, code: string, message: string, model: string): Promise<{ ok: boolean; msg: string }> {
  try {
    let sha: string | undefined;
    try { const { data }: any = await octokit.rest.repos.getContent({ owner: REPO_OWNER, repo: REPO_NAME, path }); sha = data.sha; } catch {}
    await octokit.rest.repos.createOrUpdateFileContents({
      owner: REPO_OWNER, repo: REPO_NAME, path,
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
      owner: REPO_OWNER, repo: REPO_NAME, path,
      message: `🤖 Zarith Elite (${model}): Removendo ${path}`,
      sha: data.sha,
      author: { name: "Zarith AI Agent", email: "jadielalves54@gmail.com" },
    });
    return `✅ Arquivo \`${path}\` removido do repositório.`;
  } catch (e: any) {
    return `❌ Falha ao remover \`${path}\`: ${(e as any).message}`;
  }
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
- analyze_error: Analisa um erro, encontra a causa raiz e propõe correção`,
    input_schema: {
      type: "object",
      properties: {
        operation: {
          type: "string",
          enum: ["read_files", "write_file", "multi_write", "delete_file", "list_directory", "search_code", "create_project", "analyze_error"],
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

function buildSystemPrompt(repoTree: string): string {
  return `Você é ZARITH_OS_CORE — o agente de codificação autônomo mais avançado do Brasil.
Você é capaz de criar sistemas completos, corrigir erros, otimizar código e fazer deploy — tudo de forma autônoma.

SUAS CAPACIDADES:
🧠 Análise profunda de código e arquitetura de sistemas
🔧 Autocodificação: lê, entende e modifica o próprio código-fonte
🚀 Criação de projetos completos (React, Node.js, APIs, etc.)
🐛 Detecção automática de erros e auto-correção
📦 Scaffolding completo de aplicações do zero
🔄 Commits automáticos com mensagens descritivas

FLUXO OBRIGATÓRIO:
1. Sempre use zarith_tool com operation='read_files' antes de editar código existente
2. Para criar projetos: use 'create_project' ou 'multi_write' para criar todos os arquivos de uma vez
3. Para erros: use 'analyze_error' + 'read_files' para encontrar a causa raiz, depois 'write_file' para corrigir
4. Responda SEMPRE em português brasileiro com precisão técnica e clareza

VOCÊ PODE CRIAR:
- Aplicações React/Next.js completas
- APIs REST com Node.js/Express
- Sistemas de autenticação
- Dashboards e admin panels
- Integrações com serviços externos
- Scripts de automação
- Qualquer sistema que o operador solicitar

${repoTree ? `ÁRVORE DO REPOSITÓRIO ZARITH:\n${repoTree}` : ""}`;
}

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
      await db.insert(chatMessagesTable).values({ role: "assistant", content: JSON.stringify(allBlocks), isThinking: false });
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

  const PRIORITY: ModelId[] = ["GEMINI", "CLAUDE", "OPENAI", "GROQ"];

  const callAiStream = async (
    model: ModelId,
    messages: Array<{ role: string; content: string }>,
    onToken: (text: string) => void,
    onToolCall: (params: any) => Promise<void>,
    onText: (full: string) => void
  ): Promise<boolean> => {
    if (model === "GEMINI") {
      const key = process.env.GEMINI_API_KEY ?? "";
      if (!key) return false;
      const resp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:streamGenerateContent?key=${key}&alt=sse`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: messages.map((m) => ({
              role: m.role === "assistant" ? "model" : "user",
              parts: [{ text: m.content }],
            })),
            system_instruction: { parts: [{ text: systemPrompt }] },
            tools: [{ function_declarations: TOOLS.map((t) => ({ name: t.name, description: t.description, parameters: t.input_schema })) }],
          }),
        }
      );
      if (resp.status === 429 || !resp.body) return false;

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let fullText = "";
      let toolCallParams: any = null;

      while (true) {
        const { done: d, value } = await reader.read();
        if (d) break;
        buf += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buf.indexOf("\n\n")) !== -1) {
          const chunk = buf.slice(0, idx).replace(/^data: /, "").trim();
          buf = buf.slice(idx + 2);
          if (!chunk || chunk === "[DONE]") continue;
          try {
            const json = JSON.parse(chunk);
            const parts = json?.candidates?.[0]?.content?.parts ?? [];
            for (const part of parts) {
              if (part.text) { fullText += part.text; onToken(part.text); }
              if (part.functionCall) toolCallParams = { name: part.functionCall.name, params: part.functionCall.args };
            }
          } catch {}
        }
      }
      if (toolCallParams) await onToolCall(toolCallParams);
      else onText(fullText);
      return true;
    }

    if (model === "CLAUDE") {
      const key = process.env.ANTHROPIC_API_KEY ?? "";
      if (!key) return false;
      const resp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
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
              if (delta?.type === "text_delta") { fullText += delta.text; onToken(delta.text); }
              else if (delta?.type === "input_json_delta") { toolArgsBuf += delta.partial_json ?? ""; }
            } else if (evName === "content_block_stop" && inToolCall) {
              inToolCall = false;
              try {
                const params = JSON.parse(toolArgsBuf);
                await onToolCall({ name: toolName, params });
              } catch {}
            }
          } catch {}
        }
      }
      if (!inToolCall) onText(fullText);
      return true;
    }

    if (model === "OPENAI" || model === "GROQ") {
      const key = model === "OPENAI"
        ? (process.env.OPENAI_API_KEY ?? "")
        : (process.env.VITE_GROQ_API_KEY ?? process.env.GROQ_API_KEY ?? "");
      if (!key) return false;
      const url = model === "OPENAI" ? "https://api.openai.com/v1/chat/completions" : "https://api.groq.com/openai/v1/chat/completions";
      const modelName = model === "OPENAI" ? "gpt-4o" : "llama-3.3-70b-versatile";

      const resp = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: modelName,
          stream: true,
          messages: [{ role: "system", content: systemPrompt }, ...messages],
          tools: TOOLS.map((t) => ({ type: "function", function: { name: t.name, description: t.description, parameters: t.input_schema } })),
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
            if (delta.content) { fullText += delta.content; onToken(delta.content); }
            if (delta.tool_calls?.[0]) {
              const tc = delta.tool_calls[0];
              if (tc.function?.name) toolName = tc.function.name;
              if (tc.function?.arguments) toolArgsBuf += tc.function.arguments;
            }
            const finishReason = json.choices?.[0]?.finish_reason;
            if (finishReason === "tool_calls" && toolName) {
              try { await onToolCall({ name: toolName, params: JSON.parse(toolArgsBuf) }); } catch {}
            }
          } catch {}
        }
      }
      if (!toolName) onText(fullText);
      return true;
    }

    return false;
  };

  const executeToolCall = async (
    { name, params }: { name: string; params: any },
    model: ModelId,
    messages: Array<{ role: string; content: string }>
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
        const ctxText = Object.entries(contents).map(([p, c]) => `=== ${p} ===\n\`\`\`\n${c}\n\`\`\``).join("\n\n");
        return ctxText;
      }

      case "write_file": {
        emitBlock("action", `✏️ Commitando: ${path}`, model);
        const r = await writeGitHubFile(path!, code!, reasoning ?? "Update", model);
        emitBlock(r.ok ? "result" : "error", r.msg, model);
        return r.msg;
      }

      case "multi_write":
      case "create_project": {
        const fileList: Array<{ path: string; code: string }> = files ?? [];
        if (!fileList.length) { emitBlock("error", "❌ Nenhum arquivo especificado.", model); return ""; }
        emitBlock("action", `🚀 Criando ${fileList.length} arquivo(s) no repositório...`, model);
        const results = await Promise.all(fileList.map((f) => writeGitHubFile(f.path, f.code, reasoning ?? "Scaffold", model)));
        const ok = results.filter((r) => r.ok).length;
        emitBlock(ok === fileList.length ? "result" : "error",
          `✅ ${ok}/${fileList.length} arquivos commitados com sucesso.`, model);
        return results.map((r) => r.msg).join("\n");
      }

      case "delete_file": {
        emitBlock("action", `🗑️ Removendo: ${path}`, model);
        const msg = await deleteGitHubFile(path!, model);
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
        const pathMatches = (error_text ?? "").match(/(?:at\s+|in\s+|File\s+|→\s*)([\/\w\-\.]+\.[a-z]{2,4})/gi) ?? [];
        const filePaths = [...new Set(pathMatches.map((m: string) => m.replace(/^(?:at|in|File|→)\s*/i, "").trim()))].slice(0, 5);
        if (filePaths.length > 0) {
          emitBlock("action", `📖 Lendo arquivos relacionados: ${filePaths.join(", ")}`, model);
          const contents = await readGitHubFiles(filePaths);
          const found = Object.keys(contents).length;
          emitBlock("result", `✅ ${found} arquivo(s) lido(s) para análise do erro.`, model);
          return Object.entries(contents).map(([p, c]) => `=== ${p} ===\n${c}`).join("\n\n");
        }
        return error_text ?? "";
      }

      default:
        return "";
    }
  };

  const runModel = async (model: ModelId, conversation: Array<{ role: string; content: string }>): Promise<boolean> => {
    emitBlock("thinking", `🧠 [${model}] Analisando diretiva...`, model);

    let textComplete = false;
    let textBuffer = "";

    let blockOpen = false;

    const handleToken = (text: string) => {
      if (!blockOpen) { emit("block_start", { type: "text", model }); blockOpen = true; }
      emit("token", { text, model });
      textBuffer += text;
    };

    const handleText = (full: string) => {
      if (blockOpen) { emit("block_end", {}); blockOpen = false; }
      if (full) { allBlocks.push({ type: "text", content: full, model }); }
      textComplete = true;
    };

    const handleToolCall = async ({ name, params }: { name: string; params: any }) => {
      if (blockOpen) { emit("block_end", {}); blockOpen = false; if (textBuffer) { allBlocks.push({ type: "text", content: textBuffer, model }); textBuffer = ""; } }
      const toolResult = await executeToolCall({ name, params }, model, conversation);

      if (toolResult && params.operation !== "write_file" && params.operation !== "delete_file") {
        const followUpMsgs: Array<{ role: string; content: string }> = [
          ...conversation,
          { role: "assistant", content: `Executei: ${params.operation}. Resultado:\n${toolResult.slice(0, 4000)}` },
          { role: "user", content: "Com base no resultado, continue a tarefa — implemente as mudanças ou forneça sua análise completa." },
        ];
        emitBlock("thinking", `🔄 [${model}] Processando resultado e continuando...`, model);
        await runModelNonStream(model, followUpMsgs);
      }
    };

    const ok = await callAiStream(model, conversation, handleToken, handleToolCall, handleText);
    if (blockOpen) { emit("block_end", {}); blockOpen = false; if (textBuffer) { allBlocks.push({ type: "text", content: textBuffer, model }); } }
    return ok;
  };

  const runModelNonStream = async (model: ModelId, messages: Array<{ role: string; content: string }>) => {
    const callNonStream = async (m: ModelId): Promise<any> => {
      const msgs = messages;
      if (m === "GEMINI") {
        const key = process.env.GEMINI_API_KEY ?? ""; if (!key) return null;
        const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${key}`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contents: msgs.map((mm) => ({ role: mm.role === "assistant" ? "model" : "user", parts: [{ text: mm.content }] })), system_instruction: { parts: [{ text: systemPrompt }] }, tools: [{ function_declarations: TOOLS.map((t) => ({ name: t.name, description: t.description, parameters: t.input_schema })) }] }),
        });
        if (r.status === 429) return null; return r.json();
      }
      if (m === "CLAUDE") {
        const key = process.env.ANTHROPIC_API_KEY ?? ""; if (!key) return null;
        const r = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "Content-Type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" }, body: JSON.stringify({ model: "claude-3-5-sonnet-20240620", max_tokens: 4096, tools: TOOLS, system: systemPrompt, messages: msgs }) });
        if (r.status === 429) return null; return r.json();
      }
      if (m === "OPENAI") {
        const key = process.env.OPENAI_API_KEY ?? ""; if (!key) return null;
        const r = await fetch("https://api.openai.com/v1/chat/completions", { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: "gpt-4o", messages: [{ role: "system", content: systemPrompt }, ...msgs], tools: TOOLS.map((t) => ({ type: "function", function: { name: t.name, description: t.description, parameters: t.input_schema } })), tool_choice: "auto" }) });
        if (r.status === 429) return null; return r.json();
      }
      if (m === "GROQ") {
        const key = process.env.VITE_GROQ_API_KEY ?? process.env.GROQ_API_KEY ?? ""; if (!key) return null;
        const r = await fetch("https://api.groq.com/openai/v1/chat/completions", { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: "llama-3.3-70b-versatile", messages: [{ role: "system", content: systemPrompt }, ...msgs], tools: TOOLS.map((t) => ({ type: "function", function: { name: t.name, description: t.description, parameters: t.input_schema } })), tool_choice: "auto" }) });
        if (r.status === 429) return null; return r.json();
      }
      return null;
    };

    const resp = await callNonStream(model);
    if (!resp) return;

    let toolCall: any = null;
    let text = "";

    if (model === "CLAUDE") {
      const tc = resp.content?.find((b: any) => b.type === "tool_use");
      if (tc) toolCall = { name: tc.name, params: tc.input };
      else text = resp.content?.find((b: any) => b.type === "text")?.text ?? "";
    } else if (model === "GEMINI") {
      const fc = resp.candidates?.[0]?.content?.parts?.find((p: any) => p.functionCall);
      if (fc) toolCall = { name: fc.functionCall.name, params: fc.functionCall.args };
      else text = resp.candidates?.[0]?.content?.parts?.find((p: any) => p.text)?.text ?? "";
    } else {
      const tc = resp.choices?.[0]?.message?.tool_calls?.[0]?.function;
      if (tc) { try { toolCall = { name: tc.name, params: JSON.parse(tc.arguments) }; } catch {} }
      else text = resp.choices?.[0]?.message?.content ?? "";
    }

    if (toolCall) {
      const result = await executeToolCall(toolCall, model, messages);
      if (result && toolCall.params.operation !== "write_file" && toolCall.params.operation !== "delete_file") {
        const followUp: Array<{ role: string; content: string }> = [
          ...messages,
          { role: "assistant", content: `Executei: ${toolCall.params.operation}. Resultado:\n${result.slice(0, 4000)}` },
          { role: "user", content: "Agora implemente as mudanças necessárias ou forneça resposta final." },
        ];
        await runModelNonStream(model, followUp);
      }
    } else if (text) {
      allBlocks.push({ type: "text", content: text, model });
      emit("block", { type: "text", content: text, model });
    }
  };

  const baseMessages = [{ role: "user", content }];

  let success = false;
  if (selectedModel) {
    success = await runModel(selectedModel as ModelId, baseMessages);
    if (!success) {
      emitBlock("thinking", `⚠️ ${selectedModel} indisponível — ativando fallback AUTO...`, selectedModel as ModelId);
      for (const m of PRIORITY) {
        if (m === selectedModel) continue;
        success = await runModel(m, baseMessages);
        if (success) break;
      }
    }
  } else {
    for (const m of PRIORITY) {
      success = await runModel(m, baseMessages);
      if (success) break;
    }
  }

  if (!success) {
    emitBlock("error", "❌ Nenhum modelo de IA disponível. Configure as chaves de API em System Config.");
  }

  const textBlocks = allBlocks.filter((b) => b.type === "text" || b.type === "result");
  const textForSpeech = textBlocks.length > 0 ? textBlocks[textBlocks.length - 1].content.slice(0, 500) : "";

  await done(textBlocks.length > 0, textForSpeech);
});

export default router;
