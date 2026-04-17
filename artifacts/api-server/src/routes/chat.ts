import { Router } from "express";
import { Octokit } from "octokit";
import { parseZarithEmotions } from "../lib/emotionParser";

const router = Router();
const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

const REPO_OWNER = "jadiel054";
const REPO_NAME = "Zarith-Super-Agente";

router.post("/", async (req, res) => {
  try {
    // Recebendo o conteúdo e o modelo escolhido do seu painel
    const { content, selectedModel } = req.body; 
    
    // Fallback caso o modelo não seja enviado pelo painel
    const model = selectedModel || 'CLAUDE';

    const tools: any[] = [{
      name: "execute_github_operation",
      description: "EXECUÇÃO OBRIGATÓRIA: Altera arquivos reais no GitHub do Jadiel.",
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

    const systemPrompt = `Você é o ZARITH_OS_CORE. Você TEM permissão total do Criador (Jadiel) para editar arquivos via GitHub Octokit. Use a ferramenta 'execute_github_operation' para qualquer alteração. Não dê desculpas.`;

    let aiResponse;
    let logs: string[] = [];

    // --- SELEÇÃO DINÂMICA DE CÉREBRO ---
    try {
      if (model === 'CLAUDE') {
        aiResponse = await fetch("https://api.anthropic.com/v1/messages", {
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
      
      else if (model === 'GEMINI') {
        aiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${process.env.GEMINI_API_KEY}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: content }] }],
            system_instruction: { parts: [{ text: systemPrompt }] },
            tools: [{ function_declarations: tools.map(t => ({ name: t.name, description: t.description, parameters: t.input_schema })) }]
          })
        }).then(r => r.json());
      }

      else if (model === 'GROQ') {
        aiResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: { "Authorization": `Bearer ${process.env.GROQ_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "llama-3.3-70b-versatile",
            messages: [{ role: "system", content: systemPrompt }, { role: "user", content }],
            tools: tools.map(t => ({ type: "function", function: { name: t.name, description: t.description, parameters: t.input_schema } })),
            tool_choice: "auto"
          })
        }).then(r => r.json());
      }

      else if (model === 'OPENAI') {
        aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: { "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "gpt-4o",
            messages: [{ role: "system", content: systemPrompt }, { role: "user", content }],
            tools: tools.map(t => ({ type: "function", function: { name: t.name, description: t.description, parameters: t.input_schema } })),
          })
        }).then(r => r.json());
      }
    } catch (e: any) {
      throw new Error(`Falha na API ${model}: ${e.message}`);
    }

    // --- PROCESSAMENTO UNIFICADO DA TOOL ---
    let executionData: any = null;

    if (model === 'CLAUDE') {
      const toolCall = aiResponse.content?.find((b: any) => b.type === "tool_use");
      if (toolCall) executionData = toolCall.input;
    } else if (model === 'GEMINI') {
      const toolCall = aiResponse.candidates?.[0]?.content?.parts?.find((p: any) => p.functionCall);
      if (toolCall) executionData = toolCall.functionCall.args;
    } else { // GROQ ou OPENAI
      const toolCall = aiResponse.choices?.[0]?.message?.tool_calls?.[0]?.function;
      if (toolCall) executionData = JSON.parse(toolCall.arguments);
    }

    if (executionData) {
      const { path, code, reasoning } = executionData;
      logs.push(`[${model}] 🧠 ${reasoning}`);
      
      try {
        let currentSha;
        try {
          const { data: file }: any = await octokit.rest.repos.getContent({ owner: REPO_OWNER, repo: REPO_NAME, path });
          currentSha = file.sha;
        } catch (e) {}

        await octokit.rest.repos.createOrUpdateFileContents({
          owner: REPO_OWNER, repo: REPO_NAME, path,
          message: `🤖 Zarith Elite (${model}): ${reasoning}`,
          content: Buffer.from(code).toString("base64"),
          sha: currentSha,
          author: { name: 'Zarith AI Agent', email: 'jadielalves54@gmail.com' }
        });
        logs.push(`[GITHUB] ✅ Commit via ${model} realizado!`);
      } catch (err: any) {
        logs.push(`[ERRO GITHUB] ❌ ${err.message}`);
      }
    } else {
      // Se não usou ferramenta, retorna o texto puro
      const text = model === 'CLAUDE' ? aiResponse.content[0].text : 
                   model === 'GEMINI' ? aiResponse.candidates[0].content.parts[0].text :
                   aiResponse.choices[0].message.content;
      logs.push(text);
    }

    res.status(200).json({
      text: logs.join("\n"),
      shouldSpeak: true
    });

  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
