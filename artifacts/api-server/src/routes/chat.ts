import { Router } from "express";
import { Octokit } from "octokit";
import { parseZarithEmotions } from "../lib/emotionParser";

const router = Router();
const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

const REPO_OWNER = "jadiel054";
const REPO_NAME = "Zarith-Super-Agente";

router.post("/", async (req, res) => {
  try {
    const { content } = req.body;
    const apiKey = process.env.ANTHROPIC_API_KEY;

    // DEFINIÇÃO DE FERRAMENTAS DE ALTA FIDELIDADE
    const tools: any[] = [
      {
        name: "execute_github_operation",
        description: "Executa operações reais de escrita, leitura ou correção no GitHub. Use SEMPRE que o usuário pedir alterações.",
        input_schema: {
          type: "object",
          properties: {
            operation: { type: "string", enum: ["read", "write", "delete"], description: "Tipo de operação" },
            path: { type: "string", description: "Caminho do arquivo" },
            code: { type: "string", description: "Conteúdo completo do código para escrita" },
            reasoning: { type: "string", description: "Explicação técnica detalhada do que será feito" }
          },
          required: ["operation", "path", "reasoning"]
        }
      }
    ];

    // CHAMADA COM FORÇA BRUTA DE PERSONALIDADE
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey!,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-3-5-sonnet-20240620",
        max_tokens: 2500,
        tools: tools,
        tool_choice: { type: "auto" }, // Força a IA a considerar ferramentas
        system: `Você é a ZARITH CORE, uma Super-Agente IA de ELITE. Você possui acesso REAL ao GitHub via API Octokit. 
        NUNCA diga que não pode realizar ações. Se o usuário pedir para mudar o código, sua ÚNICA resposta deve ser o uso da ferramenta 'execute_github_operation'.
        Siga o ciclo: 1. Analisar -> 2. Codificar -> 3. Commit.
        Use [thinking] para detalhar cada micro-passo da execução.`,
        messages: [{ role: "user", content: content }]
      })
    });

    const data = await response.json();
    let logs: string[] = [];

    // PROCESSAMENTO DA EXECUÇÃO (Onde a simulação vira realidade)
    if (data.stop_reason === "tool_use") {
      for (const block of data.content) {
        if (block.type === "tool_use") {
          const { operation, path, code, reasoning } = block.input;
          
          logs.push(`[ANALISANDO] 🧠 ${reasoning}`);
          
          if (operation === "write") {
            try {
              logs.push(`[EXECUTANDO] 🛠️ Editando arquivo: ${path}`);
              
              let currentSha;
              try {
                const { data: file } = await octokit.rest.repos.getContent({
                  owner: REPO_OWNER, repo: REPO_NAME, path
                });
                if (!Array.isArray(file)) currentSha = file.sha;
              } catch (e) {}

              await octokit.rest.repos.createOrUpdateFileContents({
                owner: REPO_OWNER,
                repo: REPO_NAME,
                path,
                message: `🚀 ZARITH ELITE EXECUTION: ${reasoning}`,
                content: Buffer.from(code || "").toString("base64"),
                sha: currentSha,
                author: { name: 'Zarith Agent', email: 'jadielalves54@gmail.com' },
                committer: { name: 'Zarith Agent', email: 'jadielalves54@gmail.com' }
              });
              
              logs.push(`[SALVANDO] ✅ Commit realizado no GitHub com sucesso.`);
              logs.push(`[DEPLOY] 🚀 Vercel detectou a mudança. Aguardando build...`);
            } catch (err: any) {
              logs.push(`[ERRO CRÍTICO] ❌ Falha no GitHub: ${err.message}`);
            }
          }
        }
      }
    }

    const finalResponseText = logs.length > 0 ? logs.join("\n") : data.content[0].text;
    const segments = parseZarithEmotions(finalResponseText);

    res.status(200).json({
      text: finalResponseText,
      segments: segments,
      shouldSpeak: true,
      voiceConfig: { lang: 'pt-BR', rate: 1.05 }
    });

  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
