import { Router } from "express";
import { Octokit } from "octokit";
import { parseZarithEmotions } from "../lib/emotionParser";

const router = Router();
const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
const REPO_OWNER = "jadiel054";
const REPO_NAME = "Zarith-Super-Agente";

router.post("/", async (req, res) => {
  try {
    const { content, selectedModel, isAiActive } = req.body;

    // 1. KILL SWITCH: Se o botão geral de ativação estiver off, para tudo.
    if (!isAiActive) {
      return res.status(200).json({ text: "[OFFLINE] Sistema central desativado.", shouldSpeak: false });
    }

    // 2. LÓGICA DE SELEÇÃO INTELIGENTE (A regra que você pediu)
    // Se não houver um modelo selecionado (vazio ou null), forçamos o Modo AUTO.
    let isAutoMode = !selectedModel; 
    let modelToUse = selectedModel;

    const tools: any[] = [{
      name: "execute_github_operation",
      description: "AÇÃO OBRIGATÓRIA: Altera arquivos reais no GitHub. Não simule.",
      input_schema: {
        type: "object",
        properties: {
          operation: { type: "string", enum: ["write"] },
          path: { type: "string" },
          code: { type: "string" },
          reasoning: { type: "string" }
        },
        required: ["operation", "path", "reasoning", "code"]
      }
    }];

    const systemPrompt = `Você é o ZARITH_OS_CORE. Use a ferramenta 'execute_github_operation' para mudanças.`;

    // Função auxiliar para chamar as APIs (Abstração)
    const callAi = async (m: string) => {
      if (m === 'CLAUDE') {
        return await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY!, "anthropic-version": "2023-06-01" },
          body: JSON.stringify({
            model: "claude-3-5-sonnet-20240620",
            max_tokens: 2500,
            tools,
            tool_choice: { type: "tool", name: "execute_github_operation" },
            system: systemPrompt,
            messages: [{ role: "user", content }]
          })
        }).then(r => r.json());
      }
      if (m === 'GEMINI') {
        return await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${process.env.GEMINI_API_KEY}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: content }] }],
            system_instruction: { parts: [{ text: systemPrompt }] },
            tools: [{ function_declarations: tools.map(t => ({ name: t.name, description: t.description, parameters: t.input_schema })) }]
          })
        }).then(r => r.json());
      }
      if (m === 'GROQ') {
        return await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: { "Authorization": `Bearer ${process.env.VITE_GROQ_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "llama-3.3-70b-versatile",
            messages: [{ role: "system", content: systemPrompt }, { role: "user", content }],
            tools: tools.map(t => ({ type: "function", function: { name: t.name, description: t.description, parameters: t.input_schema } })),
            tool_choice: "auto"
          })
        }).then(r => r.json());
      }
      return null;
    };

    // 3. EXECUÇÃO DO FLUXO
    let aiResponse: any = null;
    let finalModel = '';

    if (isAutoMode) {
      // Prioridade de Fallback: Claude -> Gemini -> Groq
      const priority = ['CLAUDE', 'GEMINI', 'GROQ'];
      for (const p of priority) {
        try {
          aiResponse = await callAi(p);
          if (aiResponse && !aiResponse.error) {
            finalModel = p;
            break;
          }
        } catch (e) { continue; }
      }
    } else {
      // Modo Manual (Exclusivo)
      aiResponse = await callAi(modelToUse);
      finalModel = modelToUse;
    }

    // 4. PROCESSADOR DE COMMITS UNIFICADO
    let logs: string[] = [];
    let execParams: any = null;

    if (finalModel === 'CLAUDE') {
      const call = aiResponse.content?.find((b: any) => b.type === "tool_use");
      if (call) execParams = call.input;
    } else if (finalModel === 'GEMINI') {
      const call = aiResponse.candidates?.[0]?.content?.parts?.find((p: any) => p.functionCall);
      if (call) execParams = call.functionCall.args;
    } else if (finalModel === 'GROQ') {
      const call = aiResponse.choices?.[0]?.message?.tool_calls?.[0]?.function;
      if (call) execParams = JSON.parse(call.arguments);
    }

    if (execParams) {
      const { path, code, reasoning } = execParams;
      logs.push(`[${finalModel}] 🧠 ${reasoning}`);
      try {
        let currentSha;
        try {
          const { data: file }: any = await octokit.rest.repos.getContent({ owner: REPO_OWNER, repo: REPO_NAME, path });
          currentSha = file.sha;
        } catch (e) {}

        await octokit.rest.repos.createOrUpdateFileContents({
          owner: REPO_OWNER, repo: REPO_NAME, path,
          message: `🤖 Zarith Elite (${finalModel}): ${reasoning}`,
          content: Buffer.from(code).toString("base64"),
          sha: currentSha,
          author: { name: 'Zarith AI Agent', email: 'jadielalves54@gmail.com' }
        });
        logs.push(`[GITHUB] ✅ Sucesso via ${finalModel}.`);
      } catch (err: any) {
        logs.push(`[ERRO GITHUB] ❌ ${err.message}`);
      }
    } else {
      const text = finalModel === 'CLAUDE' ? aiResponse?.content?.[0]?.text :
                   finalModel === 'GEMINI' ? aiResponse?.candidates?.[0]?.content?.parts?.[0]?.text :
                   aiResponse?.choices?.[0]?.message?.content;
      logs.push(text || "Erro de processamento.");
    }

    res.status(200).json({ text: logs.join("\n"), shouldSpeak: true });

  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
