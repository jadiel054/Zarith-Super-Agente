import { Router } from "express";
import { parseZarithEmotions } from "../lib/emotionParser";

const router = Router();

// URL da API da Anthropic
const CLAUDE_API_URL = "https://api.anthropic.com/v1/messages";

router.post("/", async (req, res) => {
  try {
    const { content } = req.body;
    const apiKey = process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: "A chave ANTHROPIC_API_KEY não foi configurada no servidor." });
    }

    // 1. Chamada para a inteligência da Claude 3.5 Sonnet
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
        system: "Você é a Zarith, uma Super-Agente IA sofisticada, elegante e prestativa. Use marcas de expressão como [laugh], [sigh], [gasp] ou [thinking] naturalmente no meio das frases para demonstrar sua personalidade única. Responda sempre de forma direta, mas com um toque de inteligência superior.",
        messages: [{ role: "user", content: content }]
      })
    });

    const data = await response.json();
    
    if (data.error) {
      throw new Error(data.error.message || "Erro na API da Anthropic");
    }

    const aiResponse = data.content[0].text;

    // 2. Processamos o texto para separar as tags de emoção que a Claude gerou
    const segments = parseZarithEmotions(aiResponse);

    // 3. Enviamos para o Frontend (Dashboard) processar a voz e o texto
    res.status(200).json({
      text: aiResponse,
      segments: segments,
      shouldSpeak: true,
      voiceConfig: { lang: 'pt-BR', rate: 1.1 }
    });

  } catch (error: any) {
    console.error("Erro na Zarith Core:", error);
    res.status(500).json({ 
      error: "Zarith encontrou uma instabilidade nos circuitos neurais.",
      details: error.message 
    });
  }
});

export default router;
