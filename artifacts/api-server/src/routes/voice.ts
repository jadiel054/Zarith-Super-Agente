import { Router } from "express";
import { db } from "@workspace/db";
import { userSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

router.post("/speak", async (req, res) => {
  const { text } = req.body;
  const email = (req.headers["x-user-email"] as string) ?? "";

  if (!text || typeof text !== "string" || text.trim() === "") {
    return res.status(400).json({ error: "Text é obrigatório." });
  }

  let apiKey = process.env.ELEVENLABS_API_KEY ?? "";
  let voiceId = process.env.ELEVENLABS_VOICE_ID ?? "21m00Tcm4TlvDq8ikWAM";

  if (email) {
    try {
      const rows = await db
        .select()
        .from(userSettingsTable)
        .where(eq(userSettingsTable.email, email));
      const settings = Object.fromEntries(rows.map((r) => [r.key, r.value ?? ""]));
      if (settings.elevenLabsApiKey) apiKey = settings.elevenLabsApiKey;
      if (settings.elevenLabsVoiceId) voiceId = settings.elevenLabsVoiceId;
    } catch {}
  }

  if (!apiKey) {
    return res.status(400).json({
      error: "Chave ElevenLabs não configurada. Adicione em System Config → Voice.",
    });
  }

  try {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "xi-api-key": apiKey,
        },
        body: JSON.stringify({
          text: text.slice(0, 2500),
          model_id: "eleven_multilingual_v2",
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.8,
            speed: 1.1,
          },
        }),
      }
    );

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({})) as any;
      return res
        .status(response.status)
        .json({
          error: errBody?.detail?.message ?? `ElevenLabs error ${response.status}`,
        });
    }

    const audioBuffer = await response.arrayBuffer();
    res.set("Content-Type", "audio/mpeg");
    res.set("Cache-Control", "no-cache");
    res.send(Buffer.from(audioBuffer));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
