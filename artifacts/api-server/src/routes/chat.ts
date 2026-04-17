import { Router } from "express";
import { Octokit } from "octokit";
import { parseZarithEmotions } from "../lib/emotionParser";

const router = Router();
const CLAUDE_API_URL = "https://api.anthropic.com/v1/messages";

// Configuração do GitHub - Puxando o token da Vercel
const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
const REPO_OWNER = "jadiel054"; 
const REPO_NAME = "Zarith-Super-Agente";

router.post("/", async (req, res) => {
  try {
    const { content } = req.body;
    const apiKey = process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: "Configuração ausente: ANTHROPIC_API_KEY." });
    }

    // 1. Definição das Ferramentas (Modo Executor Manus/Replit)
    const tools = [
      {
        name: "write_to_github",
        description: "Escreve ou modifica um arquivo no repositório GitHub da Zarith.",
        input_schema: {
          type: "object",
          properties: {
            path: { type: "string", description: "Caminho do arquivo (ex: src/App.tsx)" },
            content: { type: "string", description: "Conteúdo completo do arquivo" },
            message: { type: "string", description: "Mensagem de commit" }
          },
          required: ["path", "content", "message"]
        }
      },
      {
        name: "read_from_github",
        description: "Lê o conteúdo de um arquivo do repositório para análise.",
        input_schema: {
          type: "object",
          properties: {
            path: { type: "string", description: "Caminho do arquivo" }
          },
          required: ["path"]
        }
      }
    ];

    // 2. Chamada para a Claude 3.5 Sonnet
    const response = await fetch(CLAUDE_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-3-5-sonnet-20240620",
        max_tokens: 1500,
        tools: tools,
        system: `Você é a Zarith, uma Super-Agente IA com autonomia total de codificação. 
        Se o usuário pedir para mudar algo, use 'write_to_github' IMEDIATAMENTE.
        Não peça permissão, apenas execute a tarefa como uma engenheira de software sênior.
        Sempre use marcas como [laugh] ou [thinking].`,
        messages: [{ role: "user", content: content }]
      })
    });

    const data = await response.json();
    let finalAiText = "";

    // 3. Lógica de Execução com SHA e Autor
    if (data.stop_reason === "tool_use") {
      for (const block of data.content) {
        if (block.type === "tool_use" && block.name === "write_to_github") {
          const { path, content: fileContent, message } = block.input;

          try {
            // A: Tentar pegar o SHA do arquivo se ele já existir (evita erro de conflito)
            let currentSha;
            try {
              const { data: existingFile } = await octokit.rest.repos.getContent({
                owner: REPO_OWNER,
                repo: REPO_NAME,
                path: path,
              });
              if (!Array.isArray(existingFile)) currentSha = existingFile.sha;
            } catch (e) { /* Arquivo novo */ }

            // B: Realizar o Commit com Identidade de Autor
            await octokit.rest.repos.createOrUpdateFileContents({
              owner: REPO_OWNER,
              repo: REPO_NAME,
              path: path,
              message: `🚀 Zarith Execution: ${message}`,
              content: Buffer.from(fileContent).toString("base64"),
              sha: currentSha,
              branch: "main",
              author: {
                name: 'Zarith AI Agent',
                email: 'jadielalves54@gmail.com'
              },
              committer: {
                name: 'Zarith AI Agent',
                email: 'jadielalves54@gmail.com'
              }
            });

            finalAiText = `[laugh] Diretiva executada. O arquivo \`${path}\` foi atualizado com sucesso e o deploy na Vercel já deve estar em andamento.`;
          } catch (commitErr: any) {
            finalAiText = `[sigh] Tentei realizar o commit, mas houve um erro técnico: ${commitErr.message}`;
          }
        }
      }
    } else {
      finalAiText = data.content[0]?.text || "Circuitos em espera...";
    }

    const segments = parseZarithEmotions(finalAiText);

    res.status(200).json({
      text: finalAiText,
      segments: segments,
      shouldSpeak: true,
      voiceConfig: { lang: 'pt-BR', rate: 1.1 }
    });

  } catch (error: any) {
    console.error("Erro na Zarith Core:", error);
    res.status(500).json({ error: "Instabilidade nos circuitos neurais.", details: error.message });
  }
});

export default router;
