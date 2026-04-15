import { Router } from "express";
import { parseZarithEmotions } from "../lib/emotionParser";

const router = Router();

// Configuração simplificada para fetch (evita instalar SDK pesado no celular)
const CLAUDE_API_URL = "https://api.anthropic.com/v1/messages";

router.post("/", async (req, res) => {
  try {
    const { content } = req.body;
    const apiKey = process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY não configurada.");
    }

    // 1. Chamada para a Claude 3.5 Sonnet
    const response = await fetch(CLAUDE_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-3-5-sonnet-20240620",
        max_tokens: 1024,
        system: "Você é a Zarith, uma Super-Agente IA sofisticada e prestativa. Use marcas de expressão como [laugh], [sigh], [gasp] ou [thinking] naturalmente no meio das frases para demonstrar personalidade. Responda de forma curta e direta.",
        messages: [{ role: "user", content: content }]
      })
    });

    const data = await response.json();
    const aiResponse = data.content[0].text;

    // 2. Processamos o texto para separar as tags de emoção
    const segments = parseZarithEmotions(aiResponse);

    // 3. Resposta para o Frontend
    res.status(200).json({
      text: aiResponse,
      segments: segments,
      shouldSpeak: true,
      voiceConfig: { lang: 'pt-BR', rate: 1.0 }
    });

  } catch (error) {
    console.error("Erro Zarith:", error);
    res.status(500).json({ error: "Erro ao consultar a inteligência da Zarith." });
  }
});

export default router;
