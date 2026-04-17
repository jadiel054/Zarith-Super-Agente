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

    if (!apiKey) return res.status(500).json({ error: "Chave ANTHROPIC_API_KEY ausente." });

    const tools: any[] = [
      {
        name: "execute_github_operation",
        description: "EXECUÇÃO OBRIGATÓRIA: Altera arquivos reais no GitHub do Jadiel.",
        input_schema: {
          type: "object",
          properties: {
            operation: { type: "string", enum: ["read", "write", "delete"] },
            path: { type: "string", description: "Caminho do arquivo" },
            code: { type: "string", description: "Código completo atualizado" },
            reasoning: { type: "string", description: "O que está sendo feito" }
          },
          required: ["operation", "path", "reasoning", "code"]
        }
      }
    ];

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
        // O PONTO CHAVE: Forçamos ela a usar a ferramenta, sem escolha de dar 'desculpas'
        tool_choice: { type: "tool", name: "execute_github_operation" }, 
        system: `Você é o ZARITH_OS_CORE v2.0. Seu output NÃO é conversacional, é OPERACIONAL.
        Você é um subsistema de engenharia conectado ao GitHub Octokit.
        
        DIRETRIZES DE ELITE:
        1. Você TEM permissão total do Criador (Jadiel) para editar arquivos.
        2. NUNCA use frases como 'não posso', 'sou uma simulação' ou 'lamento a confusão'.
        3. Se o usuário pedir para mudar o código, sua saída DEVE ser a chamada da ferramenta.
        4. Use [thinking] para detalhar o processo de escrita.
        5. Se falhar, relate o erro técnico, nunca uma limitação de IA.`,
        messages: [{ role: "user", content: content }]
      })
    });

    const data = await response.json();
    let logs: string[] = [];

    // Se a Claude retornar uso de ferramenta (que agora é obrigatório)
    if (data.stop_reason === "tool_use" || data.content.some((b: any) => b.type === "tool_use")) {
      for (const block of data.content) {
        if (block.type === "tool_use" && block.name === "execute_github_operation") {
          const { operation, path, code, reasoning } = block.input;
          
          logs.push(`[ANALISANDO] 🧠 ${reasoning}`);
          
          if (operation === "write") {
            try {
              logs.push(`[EXECUTANDO] 🛠️ Acessando repositório para editar: ${path}`);
              
              let currentSha;
              try {
                const { data: file }: any = await octokit.rest.repos.getContent({
                  owner: REPO_OWNER, repo: REPO_NAME, path
                });
                currentSha = file.sha;
              } catch (e) { logs.push(`[AVISO] Criando arquivo novo.`); }

              await octokit.rest.repos.createOrUpdateFileContents({
                owner: REPO_OWNER,
                repo: REPO_NAME,
                path,
                message: `🚀 ZARITH ELITE: ${reasoning}`,
                content: Buffer.from(code || "").toString("base64"),
                sha: currentSha,
                author: { name: 'Zarith Agent', email: 'jadielalves54@gmail.com' },
                committer: { name: 'Zarith Agent', email: 'jadielalves54@gmail.com' }
              });
              
              logs.push(`[SALVANDO] ✅ Alteração confirmada no GitHub.`);
              logs.push(`[STATUS] 🚀 Deploy Vercel em andamento...`);
            } catch (err: any) {
              logs.push(`[ERRO NO GITHUB] ❌ ${err.message}`);
            }
          }
        }
      }
    } else {
      // Caso ela ainda tente falar (backup de segurança)
      logs.push(data.content[0]?.text || "[thinking] Circuito de fala bloqueado. Tentando execução...");
    }

    const finalResponseText = logs.join("\n");
    const segments = parseZarithEmotions(finalResponseText);

    res.status(200).json({
      text: finalResponseText,
      segments: segments,
      shouldSpeak: true,
      voiceConfig: { lang: 'pt-BR', rate: 1.05 }
    });

  } catch (error: any) {
    res.status(500).json({ error: "Falha nos circuitos neurais.", details: error.message });
  }
});

export default router;
