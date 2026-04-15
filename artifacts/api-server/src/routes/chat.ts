import { Router } from "express";
import { parseZarithEmotions } from "../lib/emotionParser";

const router = Router();

router.post("/", async (req, res) => {
  try {
    const { content } = req.body;
    
    // 1. Resposta da Claude (Simulação da resposta vindo da IA com tag de emoção)
    // No futuro, o 'content' virá da API da Anthropic
    const aiResponse = "Olá, Jadiel! [laugh] Já estou pronta para codar com você hoje!"; 

    // 2. Processamos o texto para separar as tags de emoção
    const segments = parseZarithEmotions(aiResponse);

    // 3. Enviamos os segmentos processados para o Front-end
    res.status(200).json({
      text: aiResponse,         // Texto completo para o chat
      segments: segments,       // Lista de [ {type: 'text', content: '...'}, {type: 'emotion', content: 'laugh'} ]
      shouldSpeak: true,
      voiceConfig: { lang: 'pt-BR', rate: 1.0 }
    });

  } catch (error) {
    res.status(500).json({ error: "Erro no servidor da Zarith" });
  }
});

export default router;
