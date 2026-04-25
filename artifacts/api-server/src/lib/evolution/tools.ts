import { Octokit } from "octokit";
import { exec } from "child_process";// Para Sandbox_Executor
import * as fs from "fs/promises"; // Para File_Manager local

const REPO_OWNER = "jadiel054";
const REPO_NAME = "Zarith-Super-Agente";

// Inicializa Octokit com o token do GitHub
const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

// ─── GitHub Helpers ─────────────────────────────────────────────────────────

export async function readGitHubFile(path: string): Promise<string | null> {
  try {
    const { data }: any = await octokit.rest.repos.getContent({ owner: REPO_OWNER, repo: REPO_NAME, path });
    if (data.encoding === "base64") return Buffer.from(data.content.replace(/\n/g, ""), "base64").toString("utf-8");
    return data.content ?? null;
  } catch { return null; }
}

export async function readGitHubFiles(paths: string[]): Promise<Record<string, string>> {
  const results: Record<string, string> = {};
  await Promise.all(paths.map(async (p) => {
    const c = await readGitHubFile(p);
    if (c) results[p] = c;
  }));
  return results;
}

export async function getRepoTree(): Promise<string[]> {
  try {
    const { data } = await octokit.rest.git.getTree({ owner: REPO_OWNER, repo: REPO_NAME, tree_sha: "HEAD", recursive: "1" });
    return data.tree.filter((i) => i.type === "blob" && i.path).map((i) => i.path!).slice(0, 100);
  } catch { return []; }
}

export async function searchRepoCode(query: string): Promise<string> {
  try {
    const { data } = await octokit.rest.search.code({ q: `${query} repo:${REPO_OWNER}/${REPO_NAME}` });
    return data.items.slice(0, 8).map((i) => `${i.path} — ${i.html_url}`).join("\n") || "Nenhum resultado.";
  } catch { return "Busca indisponível."; }
}

export async function listDirectory(dirPath: string): Promise<string> {
  try {
    const { data }: any = await octokit.rest.repos.getContent({ owner: REPO_OWNER, repo: REPO_NAME, path: dirPath });
    if (Array.isArray(data)) return data.map((f) => `${f.type === "dir" ? "📁" : "📄"} ${f.path}`).join("\n");
    return `📄 ${(data as any).path}`;
  } catch { return "Diretório não encontrado."; }
}

export async function writeGitHubFile(
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

export async function deleteGitHubFile(path: string, model: string): Promise<string> {
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

export const TOOLS = [
  {
    name: "zarith_tool",
    description: `Ferramenta unificada do agente Zarith para autocodificação, gestão do repositório GitHub, execução de comandos no sandbox e gerenciamento de arquivos local.
Operações disponíveis:
- read_files: Lê um ou múltiplos arquivos do repo para entender contexto
- write_file: Commita código em um arquivo (sempre leia antes de escrever)
- multi_write: Cria/edita múltiplos arquivos em um único commit (para scaffolding de projetos)
- delete_file: Remove um arquivo do repositório
- list_directory: Lista conteúdo de um diretório
- search_code: Busca padrões de código no repositório
- create_project: Cria estrutura completa de um novo projeto (vários arquivos)
- analyze_error: Analisa um erro, encontra a causa raiz e propõe correção
- read_runtime_logs: Lê as últimas 50 entradas do log de atividade do servidor — use ANTES de grandes alterações para aprender com o histórico e APÓS commits para verificar erros de execução
- execute_command: Executa um comando shell no ambiente sandbox para instalar dependências, rodar testes, etc.
- read_file_local: Lê o conteúdo de um arquivo no sistema de arquivos local do sandbox.
- write_file_local: Escreve conteúdo em um arquivo no sistema de arquivos local do sandbox.
- list_directory_local: Lista o conteúdo de um diretório no sistema de arquivos local do sandbox.
- delete_file_local: Remove um arquivo do sistema de arquivos local do sandbox.`,
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
            "execute_command",
            "read_file_local",
            "write_file_local",
            "list_directory_local",
            "delete_file_local",
          ],
        },
        command: { type: "string", description: "Comando shell a ser executado (para execute_command)" },
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

// ─── Sandbox Executor ───────────────────────────────────────────────────────

export async function executeCommand(command: string): Promise<string> {
  return new Promise((resolve) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        resolve(`❌ Erro de execução: ${error.message}\n${stderr}`);
      } else {
        resolve(`✅ Comando executado com sucesso:\n${stdout}\n${stderr}`);
      }
    });
  });
}

// ─── File Manager ───────────────────────────────────────────────────────────

export async function readFileLocal(path: string): Promise<string> {
  try {
    const content = await fs.readFile(path, 'utf-8');
    return `✅ Conteúdo de ${path}:\n\`\`\`\n${content}\n\`\`\``;
  } catch (e: any) {
    return `❌ Erro ao ler arquivo ${path}: ${e.message}`;
  }
}

export async function writeFileLocal(path: string, content: string): Promise<string> {
  try {
    await fs.writeFile(path, content, 'utf-8');
    return `✅ Arquivo ${path} escrito com sucesso.`;
  } catch (e: any) {
    return `❌ Erro ao escrever arquivo ${path}: ${e.message}`;
  }
}

export async function listDirectoryLocal(path: string): Promise<string> {
  try {
    const files = await fs.readdir(path);
    const fileDetails = await Promise.all(files.map(async (file) => {
      const filePath = `${path}/${file}`;
      const stats = await fs.stat(filePath);
      return `${stats.isDirectory() ? '📁' : '📄'} ${file}`;
    }));
    return `✅ Conteúdo do diretório ${path}:\n${fileDetails.join('\n')}`;
  } catch (e: any) {
    return `❌ Erro ao listar diretório ${path}: ${e.message}`;
  }
}

export async function deleteFileLocal(path: string): Promise<string> {
  try {
    await fs.unlink(path);
    return `✅ Arquivo ${path} removido com sucesso.`;
  } catch (e: any) {
    return `❌ Erro ao remover arquivo ${path}: ${e.message}`;
  }
}
