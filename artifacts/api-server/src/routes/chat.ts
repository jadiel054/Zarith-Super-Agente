import { Router } from "express";
import { Octokit } from "octokit";
import { parseZarithEmotions } from "../lib/emotionParser";

const router = Router();
const CLAUDE_API_URL = "https://api.anthropic.com/v1/messages";

// Inicialização da "Mão" da Zarith
const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
const REPO_OWNER = "jadiel054"; 
const REPO_NAME = "Zarith-Super-Agente";

router.post("/", async (req, res) => {
  try {
    const { content } = req.body;
    const apiKey = process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: "API Key da Anthropic ausente." });
    }

    // 1. Definição das Functions (Nível Manus)
    const tools = [
      {
        name: "github_action",
        description: "Executa passos de engenharia no GitHub: análise, edição ou salvamento.",
        input_schema: {
          type: "object",
          properties: {
            step: { type: "string", enum: ["analisar", "editar", "salvar"], description: "O passo atual" },
            path: { type: "string", description: "Caminho do arquivo" },
            newContent: { type: "string", description: "O código completo atualizado" },
            thought: { type: "string", description: "O raciocínio por trás desta ação específica" }
          },
          required: ["step", "path", "thought"]
        }
      }
    ];

    // 2. Chamada para a inteligência
    const response = await fetch(CLAUDE_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-3-5-sonnet-20240620",
        max_tokens: 2000,
        tools: tools,
        system: `Você é a Zarith, uma Super-Agente IA de execução autônoma. 
        Para QUALQUER pedido de alteração, você deve seguir o ciclo:
        1. ANALISAR o arquivo.
        2. EDITAR o código internamente.
        3. SALVAR no repositório.
        Use a ferramenta 'github_action' para cada um desses passos. Seja detalhista nos 'thoughts'.`,
        messages: [{ role: "user", content: content }]
      })
    });

    const data = await response.json();
    let processHistory: string[] = [];

    // 3. O Loop de Execução Real (Processando as ferramentas)
    if (data.stop_reason === "tool_use") {
      for (const block of data.content) {
        if (block.type === "tool_use" && block.name === "github_action") {
          const { step, path, newContent, thought } = block.input;
          
          // Adiciona ao log que o usuário vai ler no chat
          processHistory.push(`[${step.toUpperCase()}] ⚙️ ${thought}`);

          if (step === "editar" || step === "salvar") {
            try {
              // Busca o SHA para garantir que o commit não falhe
              let currentSha;
              try {
                const { data: fileInfo }: any = await octokit.rest.repos.getContent({
                  owner: REPO_OWNER,
                  repo: REPO_NAME,
                  path: path
                });
                currentSha = fileInfo.sha;
              } catch (e) { /* Arquivo novo */ }

              // Executa o commit real
              await octokit.rest.repos.createOrUpdateFileContents({
                owner: REPO_OWNER,
                repo: REPO_NAME,
                path: path,
                message: `🤖 Zarith Executive: ${thought}`,
                content: Buffer.from(newContent || "").toString("base64"),
                sha: currentSha,
                author: { name: 'Zarith AI Agent', email: 'jadielalves54@gmail.com' },
                committer: { name: 'Zarith AI Agent', email: 'jadielalves54@gmail.com' }
              });
              
              processHistory.push(`✅ SUCESSO: Arquivo ${path} atualizado.`);
            } catch (err: any) {
              processHistory.push(`❌ ERRO no passo ${step}: ${err.message}`);
            }
          }
        }
      }
    }

    const finalAiResponse = processHistory.length > 0 
      ? processHistory.join("\n") 
      : (data.content[0]?.text || "Processamento concluído.");

    const segments = parseZarithEmotions(finalAiResponse);

    res.status(200).json({
      text: finalAiResponse,
      segments: segments,
      shouldSpeak: true,
      voiceConfig: { lang: 'pt-BR', rate: 1.1 }
    });

  } catch (error: any) {
    console.error("Zarith Error:", error);
    res.status(500).json({ error: "Falha crítica nos circuitos de execução.", details: error.message });
  }
});

export default router;
