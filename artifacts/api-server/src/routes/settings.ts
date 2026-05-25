import { Router } from "express";
import { db } from "@workspace/db";
import { userSettingsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import ZarithConfig, { getConfig, updateConfig, maskKey } from "../lib/config";

const router = Router();

// Aceita explicitamente OPTIONS para preflight
router.options("/", (req, res) => {
  res.sendStatus(200);
});

const SETTING_KEYS = [
  "geminiApiKey",
  "groqApiKey",
  "openaiApiKey",
  "anthropicApiKey",
  "elevenLabsApiKey",
  "elevenLabsVoiceId",
  "googleMapsApiKey",
  "searchApiKey",
  "githubToken",
  "vercelToken",
] as const;

type SettingKey = (typeof SETTING_KEYS)[number];

async function loadUserSettings(email: string): Promise<Record<string, string | null>> {
  try {
    const rows = await db
      .select()
      .from(userSettingsTable)
      .where(eq(userSettingsTable.email, email));
    return Object.fromEntries(rows.map((r) => [r.key, r.value ?? null]));
  } catch {
    return {};
  }
}

async function saveUserSetting(email: string, key: string, value: string | null) {
  try {
    const existing = await db
      .select()
      .from(userSettingsTable)
      .where(and(eq(userSettingsTable.email, email), eq(userSettingsTable.key, key)));

    if (existing.length > 0) {
      await db
        .update(userSettingsTable)
        .set({ value, updatedAt: new Date() })
        .where(and(eq(userSettingsTable.email, email), eq(userSettingsTable.key, key)));
    } else {
      await db.insert(userSettingsTable).values({ email, key, value });
    }
  } catch (err: any) {
    // Log mas não deixa falhar o request inteiro
    console.error(`[settings] Erro ao salvar ${key}:`, err?.message);
  }
}

function buildResponse(
  config: typeof ZarithConfig,
  dbSettings: Record<string, string | null>
) {
  const effectiveGemini = dbSettings["geminiApiKey"] ?? (config as any).geminiApiKey;
  const effectiveGithub = dbSettings["githubToken"] ?? (config as any).githubToken;

  return {
    geminiApiKey: maskKey(effectiveGemini ?? ""),
    geminiApiKeySet: Boolean(effectiveGemini),
    groqApiKey: maskKey(dbSettings["groqApiKey"] ?? ""),
    groqApiKeySet: Boolean(dbSettings["groqApiKey"]),
    openaiApiKey: maskKey(dbSettings["openaiApiKey"] ?? ""),
    openaiApiKeySet: Boolean(dbSettings["openaiApiKey"]),
    anthropicApiKey: maskKey(dbSettings["anthropicApiKey"] ?? ""),
    anthropicApiKeySet: Boolean(dbSettings["anthropicApiKey"]),
    elevenLabsApiKey: maskKey(dbSettings["elevenLabsApiKey"] ?? ""),
    elevenLabsApiKeySet: Boolean(dbSettings["elevenLabsApiKey"]),
    elevenLabsVoiceId: dbSettings["elevenLabsVoiceId"] ?? null,
    elevenLabsVoiceIdSet: Boolean(dbSettings["elevenLabsVoiceId"]),
    googleMapsApiKey: maskKey(dbSettings["googleMapsApiKey"] ?? ""),
    googleMapsApiKeySet: Boolean(dbSettings["googleMapsApiKey"]),
    searchApiKey: maskKey(dbSettings["searchApiKey"] ?? ""),
    searchApiKeySet: Boolean(dbSettings["searchApiKey"]),
    githubToken: maskKey(effectiveGithub ?? ""),
    githubTokenSet: Boolean(effectiveGithub),
    vercelToken: maskKey(dbSettings["vercelToken"] ?? ""),
    vercelTokenSet: Boolean(dbSettings["vercelToken"]),
  };
}

// GET /api/settings
router.get("/", async (req, res) => {
  const email = (req.headers["x-user-email"] as string) ?? "";
  const config = getConfig();
  const dbSettings = email ? await loadUserSettings(email) : {};
  res.json(buildResponse(config, dbSettings));
});

// PATCH /api/settings — salva uma ou mais chaves
router.patch("/", async (req, res) => {
  const email = (req.headers["x-user-email"] as string) ?? "";
  const updates = req.body as Partial<Record<SettingKey, string>>;

  for (const key of SETTING_KEYS) {
    if (updates[key] === undefined) continue;
    const val = updates[key]?.trim() || null;

    if (email) {
      await saveUserSetting(email, key, val);
    }

    // Atualiza config em memória para uso imediato
    if (key === "geminiApiKey") updateConfig({ geminiApiKey: val } as any);
    if (key === "githubToken" && val) updateConfig({ githubToken: val } as any);
    if (key === "groqApiKey" && val) updateConfig({ groqApiKey: val } as any);
  }

  const config = getConfig();
  const dbSettings = email ? await loadUserSettings(email) : {};
  res.json({ success: true, ...buildResponse(config, dbSettings) });
});

// POST /api/settings — alias do PATCH para compatibilidade
router.post("/", async (req, res, next) => {
  req.method = "PATCH";
  next("route");
});

export default router;
