import { db } from "@workspace/db";
import { zarithExecutionLogsTable, zarithMemoryTable, zarithAuthorizationsTable } from "@workspace/db/schema";
import { eq, sql } from "drizzle-orm";
import { OpenAI } from "openai"; // Usaremos OpenAI para embeddings e possivelmente para o LLM principal

interface Tool {
  name: string;
  description: string;
  input_schema: any;
}

interface AgentThought {
  thought: string;
  action?: { name: string; params: any };
  observation?: string;
}

export class ReActEngine {
  private openai: OpenAI;
  private tools: Tool[];
  private projectId: string;
  private repoOwner: string;
  private repoName: string;
  private db: typeof db;
  private emitBlock: (type: any, content: string, model?: string) => void;

  constructor(projectId: string, repoOwner: string, repoName: string, dbInstance: typeof db, emitBlock: (type: any, content: string, model?: string) => void, tools: Tool[]) {
    this.projectId = projectId;
    this.repoOwner = repoOwner;
    this.repoName = repoName;
    this.db = dbInstance;
    this.emitBlock = emitBlock;
    this.tools = tools;
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  private async generateEmbedding(text: string): Promise<number[]> {
    const response = await this.openai.embeddings.create({
      model: "text-embedding-ada-002", // Modelo de embedding da OpenAI
      input: text,
    });
    return response.data[0].embedding;
  }

  private async saveMemory(content: string, metadata: any = {}): Promise<void> {
    const embedding = await this.generateEmbedding(content);
    await db.insert(zarithMemoryTable).values({
      content,
      metadata,
      embedding,
    });
  }

  private async retrieveMemory(query: string, limit: number = 5): Promise<any[]> {
    const queryEmbedding = await this.generateEmbedding(query);
    const similarMemories = await this.db.select().from(zarithMemoryTable)
      .orderBy(sql`embedding <-> ${queryEmbedding}::vector`)
      .limit(limit);
    return similarMemories;
  }

  private async logExecution(log: Partial<typeof zarithExecutionLogsTable.$inferInsert>): Promise<void> {
    await this.db.insert(zarithExecutionLogsTable).values(log);
  }

  private async checkAuthorization(actionName: string, params: any): Promise<boolean> {
    // Por enquanto, um placeholder. A lógica real de autorização será mais complexa.
    // Deverá consultar a tabela zarith_authorizations.
    this.emitBlock("thinking", `Verificando autorização para a ação: ${actionName} com parâmetros: ${JSON.stringify(params)}`, "SYSTEM");
    const authRecord = await this.db.select().from(zarithAuthorizationsTable).where(eq(zarithAuthorizationsTable.action, actionName)).limit(1);
    if (authRecord.length > 0 && authRecord[0].is_authorized) {
      this.emitBlock("result", `✅ Ação ${actionName} autorizada.`, "SYSTEM");
      return true;
    }
    this.emitBlock("ask", `A ação '${actionName}' com parâmetros ${JSON.stringify(params)} requer sua autorização. Por favor, responda 'sim' para autorizar ou 'não' para negar.`, "SYSTEM");
    // Em um ambiente real, o agente pausaria aqui e esperaria a resposta do usuário.
    // Para simular a pausa e a necessidade de interação, vamos lançar um erro que será capturado pelo chatStream.
    throw new Error(`AuthorizationRequired: Ação '${actionName}' requer autorização.`);
  }

  private async think(prompt: string, history: AgentThought[], tools: Tool[]): Promise<AgentThought> {
    // Lógica para o LLM gerar um pensamento e uma ação
    // Isso será o coração do ReAct
    // Por enquanto, um placeholder
    const response = await this.openai.chat.completions.create({
      model: "gpt-4o", // Ou outro modelo, dependendo da configuração
      messages: [
        { role: "system", content: "Você é um agente autônomo. Pense cuidadosamente e decida a próxima ação." },
        ...history.map(h => ({ role: "assistant", content: `Thought: ${h.thought}\nAction: ${JSON.stringify(h.action)}\nObservation: ${h.observation}`})),
        { role: "user", content: prompt },
        { role: "system", content: `Memórias relevantes para a tarefa:\n${(await this.retrieveMemory(prompt)).map(m => m.content).join("\n")}` }
      ],
      tools: this.tools.map(tool => ({
        type: "function",
        function: { name: tool.name, description: tool.description, parameters: tool.input_schema }
      })),
      tool_choice: "auto",
    });

    const choice = response.choices[0].message;
    const thought = choice.content || "";
    let action: { name: string; params: any } | undefined;

    if (choice.tool_calls && choice.tool_calls.length > 0) {
      const toolCall = choice.tool_calls[0];
      action = {
        name: toolCall.function.name,
        params: JSON.parse(toolCall.function.arguments),
      };
    }

    // Salvar o pensamento no log de execução
    await this.logExecution({
      thought,
      action: action ? action.name : null,
      status: "thinking"
    });

    return { thought, action };
  }

  private async act(action: { name: string; params: any }, model: string): Promise<string> {
    const tool = this.tools.find(t => t.name === action.name);
    if (!tool) {
      return `ERRO: Ferramenta ${action.name} não encontrada.`;
    }

    // Verificar autorização antes de executar a ferramenta
    const isAuthorized = await this.checkAuthorization(action.name, action.params);
    if (!isAuthorized) {
      return `Ação ${action.name} não autorizada. Execução interrompida.`;
    }

    this.emitBlock("action", `⚙️ Executando ferramenta: ${action.name} com parâmetros ${JSON.stringify(action.params)}`, model);

    try {
      switch (action.name) {
        case "zarith_tool": {
          const { operation, path, paths, code, files, query, error_text, reasoning, command } = action.params;
          this.emitBlock("thinking", `💡 ${reasoning}`, model);

          switch (operation) {
            case "read_files": {
              const toRead: string[] = paths ?? (path ? [path] : []);
              this.emitBlock("action", `📖 Lendo ${toRead.length} arquivo(s): ${toRead.join(", ")}`, model);
              const contents = await readGitHubFiles(toRead);
              const found = Object.keys(contents).length;
              this.emitBlock("result", `✅ ${found}/${toRead.length} arquivo(s) carregado(s).`, model);
              return Object.entries(contents)
                .map(([p, c]) => `=== ${p} ===\n\`\`\`\n${c}\n\`\`\``)
                .join("\n\n");
            }
            case "write_file": {
              if (!path || !code) {
                this.emitBlock("error", "❌ write_file requer \'path\' e \'code\'.", model);
                return "ERRO: path e code são obrigatórios para write_file.";
              }
              this.emitBlock("action", `✏️ Commitando: ${path}`, model);
              const r = await writeGitHubFile(path, code, reasoning ?? "Update", model);
              this.emitBlock(r.ok ? "result" : "error", r.msg, model);
              return r.msg;
            }
            case "multi_write":
            case "create_project": {
              const fileList: Array<{ path: string; code: string }> = files ?? [];
              if (!fileList.length) {
                this.emitBlock("error", "❌ Nenhum arquivo especificado.", model);
                return "ERRO: nenhum arquivo para criar.";
              }
              this.emitBlock("action", `🚀 Criando ${fileList.length} arquivo(s) no repositório...`, model);
              const results = await Promise.all(
                fileList.map((f) => writeGitHubFile(f.path, f.code, reasoning ?? "Scaffold", model))
              );
              const ok = results.filter((r) => r.ok).length;
              const failed = results.filter((r) => !r.ok);
              if (failed.length > 0) {
                this.emitBlock("error", `⚠️ ${failed.length} arquivo(s) falharam:\n${failed.map((r) => r.msg).join("\n")}`, model);
              }
              this.emitBlock(
                ok === fileList.length ? "result" : "error",
                `✅ ${ok}/${fileList.length} arquivos commitados com sucesso.`,
                model
              );
              return results.map((r) => r.msg).join("\n");
            }
            case "delete_file": {
              if (!path) { this.emitBlock("error", "❌ delete_file requer \'path\'.", model); return "ERRO: path obrigatório."; }
              this.emitBlock("action", `🗑️ Removendo: ${path}`, model);
              const msg = await deleteGitHubFile(path, model);
              this.emitBlock(msg.startsWith("✅") ? "result" : "error", msg, model);
              return msg;
            }
            case "list_directory": {
              this.emitBlock("action", `📁 Listando: ${path ?? "/"}`, model);
              const listing = await listDirectory(path ?? "");
              this.emitBlock("result", listing, model);
              return listing;
            }
            case "search_code": {
              this.emitBlock("action", `🔍 Buscando: \"${query}\"`, model);
              const results = await searchRepoCode(query ?? "");
              this.emitBlock("result", results, model);
              return results;
            }
            case "analyze_error": {
              this.emitBlock("thinking", `🐛 Analisando erro: ${(error_text ?? "").slice(0, 200)}...`, model);
              const pathMatches =
                (error_text ?? "").match(/(?:at\s+|in\s+|File\s+|→\s*)([\/\w\-\.]+\.[a-z]{2,4})/gi) ?? [];
              const filePaths = [
                ...new Set(pathMatches.map((m: string) => m.replace(/^(?:at|in|File|→)\s*/i, "").trim())),
              ].slice(0, 5);
              if (filePaths.length > 0) {
                this.emitBlock("action", `📖 Lendo arquivos relacionados ao erro: ${filePaths.join(", ")}`, model);
                const contents = await readGitHubFiles(filePaths);
                return `Arquivos relacionados:\n${Object.entries(contents).map(([p, c]) => `=== ${p} ===\n\`\`\`\n${c}\n\`\`\``).join("\n\n")}\n\nAnálise do erro: ${error_text}`;
              }
              return `Análise do erro: ${error_text}`;
            }
            case "read_runtime_logs": {
              this.emitBlock("action", `📋 Lendo logs de execução...`, model);
              const logs = await this.db.select().from(zarithExecutionLogsTable).orderBy(desc(zarithExecutionLogsTable.timestamp)).limit(50);
              if (logs.length === 0) {
                this.emitBlock("result", "Nenhum log de execução encontrado.", model);
                return "Nenhum log de execução encontrado.";
              }
              const formattedLogs = logs.map(log => `[${new Date(log.timestamp).toLocaleString()}] ${log.status.toUpperCase()}: ${log.thought} ${log.action ? `(Action: ${log.action})` : ''} ${log.observation ? `(Observation: ${log.observation})` : ''}`).join('\n');
              this.emitBlock("result", `✅ Últimos 50 logs de execução:\n${formattedLogs}`, model);
              return `Últimos 50 logs de execução:\n${formattedLogs}`;
            }
            case "execute_command": {
              if (!command) { this.emitBlock("error", "❌ execute_command requer \'command\'.", model); return "ERRO: command obrigatório."; }
              this.emitBlock("action", `💻 Executando comando: ${command}`, model);
              const result = await executeCommand(command);
              this.emitBlock("result", result, model);
              return result;
            }
            case "read_file_local": {
              if (!path) { this.emitBlock("error", "❌ read_file_local requer \'path\'.", model); return "ERRO: path obrigatório."; }
              this.emitBlock("action", `📖 Lendo arquivo local: ${path}`, model);
              const result = await readFileLocal(path);
              this.emitBlock("result", result, model);
              return result;
            }
            case "write_file_local": {
              if (!path || !code) { this.emitBlock("error", "❌ write_file_local requer \'path\' e \'code\'.", model); return "ERRO: path e code são obrigatórios."; }
              this.emitBlock("action", `✏️ Escrevendo arquivo local: ${path}`, model);
              const result = await writeFileLocal(path, code);
              this.emitBlock("result", result, model);
              return result;
            }
            case "list_directory_local": {
              if (!path) { this.emitBlock("error", "❌ list_directory_local requer \'path\'.", model); return "ERRO: path obrigatório."; }
              this.emitBlock("action", `📁 Listando diretório local: ${path}`, model);
              const result = await listDirectoryLocal(path);
              this.emitBlock("result", result, model);
              return result;
            }
            case "delete_file_local": {
              if (!path) { this.emitBlock("error", "❌ delete_file_local requer \'path\'.", model); return "ERRO: path obrigatório."; }
              this.emitBlock("action", `🗑️ Removendo arquivo local: ${path}`, model);
              const result = await deleteFileLocal(path);
              this.emitBlock("result", result, model);
              return result;
            }
            default:
              return `Operação desconhecida: ${operation}`;
          }
        }
        default:
          return `Ferramenta desconhecida: ${action.name}`;
      }
    } catch (e: any) {
      this.emitBlock("error", `❌ Erro ao executar ferramenta ${action.name}: ${e.message}`, model);
      return `ERRO: ${e.message}`;
    }
  }

  private async observe(result: string): Promise<string> {
    // Lógica para observar o resultado da ação
    // Por enquanto, retorna o próprio resultado
    return result;
  }

  async run(initialPrompt: string, modelId: string): Promise<any> {
    let currentPrompt = initialPrompt;
    let history: AgentThought[] = [];
    let maxIterations = 10; // Limite para evitar loops infinitos

    for (let i = 0; i < maxIterations; i++) {
      const { thought, action } = await this.think(currentPrompt, history, this.tools);
      await this.logExecution({ taskId, thought, status: "thinking" });

      if (action) {
        await this.logExecution({ taskId, thought, action: JSON.stringify(action), status: "acting" });
        const observation = await this.act(action, modelId);
        await this.logExecution({ taskId, thought, action: JSON.stringify(action), observation, status: "observing" });
        history.push({ thought, action, observation });
        currentPrompt = `Ação executada: ${action.name} com resultado: ${observation}. Qual o próximo passo?`;
      } else {
        // Se não houver ação, o agente terminou ou está preso
        await this.logExecution({ taskId, thought, status: "completed" });
        return { finalThought: thought, history };
      }
    }

    await this.logExecution({ taskId, thought: "Max iterations reached", status: "failed" });
    return { finalThought: "Max iterations reached", history };
  }
}
