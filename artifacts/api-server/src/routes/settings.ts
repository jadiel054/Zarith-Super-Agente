import { Router } from "express";
import { getConfig, updateConfig, maskKey } from "../lib/config";

const router = Router();

router.get("/", (_req, res) => {
  const config = getConfig();
  res.json({
    groqApiKey: maskKey(config.groqApiKey),
    groqApiKeySet: Boolean(config.groqApiKey),
    geminiApiKey: maskKey(config.geminiApiKey),
    geminiApiKeySet: Boolean(config.geminiApiKey),
  });
});

router.patch("/", (req, res) => {
  const { groqApiKey, geminiApiKey } = req.body as {
    groqApiKey?: string;
    geminiApiKey?: string;
  };

  const updates: Parameters<typeof updateConfig>[0] = {};

  if (groqApiKey !== undefined && groqApiKey.trim() !== "") {
    updates.groqApiKey = groqApiKey.trim();
  }

  if (geminiApiKey !== undefined) {
    updates.geminiApiKey = geminiApiKey.trim() || null;
  }

  updateConfig(updates);

  const config = getConfig();
  res.json({
    success: true,
    groqApiKey: maskKey(config.groqApiKey),
    groqApiKeySet: Boolean(config.groqApiKey),
    geminiApiKey: maskKey(config.geminiApiKey),
    geminiApiKeySet: Boolean(config.geminiApiKey),
  });
});

export default router;
