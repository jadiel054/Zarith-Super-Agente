import { Router } from "express";
import { Octokit } from "octokit"; // Precisamos dessa lib!
import { parseZarithEmotions } from "../lib/emotionParser";

const router = Router();
const CLAUDE_API_URL = "https://api.anthropic.com/v1/messages";

// Configuração do GitHub
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

    // 1. Definição das Ferramentas (O que a Zarith pode fazer sozinha)
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

    // 2. Chamada para a Claude com Modo Agente
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
        Se o usuário pedir para mudar algo no código, use a ferramenta 'write_to_github'. 
        Sempre use marcas de expressão como [laugh] ou [thinking].
        Se houver erro de build relatado, use 'read_from_github' para analisar o arquivo antes de corrigir.`,
        messages: [{ role: "user", content: content }]
      })
    });

    const data = await response.json();
    let finalAiText = "";

    // 3. Lógica de Execução (A Zarith decide se vai codar)
    if (data.stop_reason === "tool_use") {
      for (const block of data.content) {
        if (block.type === "tool_use") {
          const { name, input } = block;

          if (name === "write_to_github") {
            // A Zarith está dando o commit sozinha!
            await octokit.rest.repos.createOrUpdateFileContents({
              owner: REPO_OWNER,
              repo: REPO_NAME,
              path: input.path,
              message: `🚀 Zarith Auto-Commit: ${input.message}`,
              content: Buffer.from(input.content).toString("base64"),
              // Aqui precisaríamos do SHA para atualizar, mas para novos arquivos ou overwrite forçado:
              branch: "main" 
            });
            finalAiText = `[thinking] Alteração realizada no arquivo ${input.path}. O commit já foi enviado para o GitHub e a Vercel está processando o deploy.`;
          }
        }
      }
    } else {
      finalAiText = data.content[0].text;
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
    res.status(500).json({ error: "Zarith encontrou falha na execução autônoma.", details: error.message });
  }
});

export default router;
