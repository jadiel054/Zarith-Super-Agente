import { Router } from "express";
import { EdgeTTS } from "edge-tts";
import { HfInference } from "@huggingface/inference";

const router = Router();
const hf = new HfInference(process.env.HUGGINGFACE_API_KEY);

router.post("/", async (req, res) => {
  try {
    const { content } = req.body;
    
    // 1. LÓGICA DO CÉREBRO (CLAUDE)
    // Aqui você mantém sua chamada atual para a Claude que já está funcionando.
    // Vamos supor que a resposta dela venha na variável 'aiResponse'.
    const aiResponse = "Olá meu Criador! [laugh] Finalmente posso falar com você!"; 

    // 2. MOTOR DE VOZ HÍBRIDO
    let audioBuffer;
    const hasEmotion = aiResponse.includes("[") && aiResponse.includes("]");

    if (hasEmotion && process.env.HUGGINGFACE_API_KEY) {
      // Voz com emoção (Hugging Face)
      const response = await hf.textToSpeech({
        model: "suno/bark-small",
        inputs: aiResponse,
      });
      audioBuffer = Buffer.from(await response.arrayBuffer());
    } else {
      // Voz límpida e rápida (Edge TTS)
      const tts = new EdgeTTS({
        voice: "pt-BR-FranciscaNeural",
        lang: "pt-BR",
        outputFormat: "audio-24khz-48kbitrate-mono-mp3"
      });
      audioBuffer = await tts.ttsPromise(aiResponse);
    }

    // 3. ENTREGA DO ÁUDIO
    res.set({
      "Content-Type": "audio/mpeg",
      "X-Zarith-Message": encodeURIComponent(aiResponse)
    });
    res.send(audioBuffer);

  } catch (error) {
    console.error("Erro na Zarith:", error);
    res.status(500).json({ error: "Falha no sistema vocal" });
  }
});

export default router;
