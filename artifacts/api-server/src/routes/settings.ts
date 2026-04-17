import { Router } from "express";
import { db } from "@workspace/db";
import { userSettingsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { getConfig, updateConfig, maskKey } from "../lib/config";

const router = Router();

// Groq removido — Gemini é o CORE PRINCIPAL
const SETTING_KEYS = [
  "geminiApiKey",
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
}

function buildResponse(
  config: ReturnType<typeof getConfig>,
  dbSettings: Record<string, string | null>
) {
  const effectiveGemini = dbSettings["geminiApiKey"] ?? config.geminiApiKey;
  const effectiveGithub = dbSettings["githubToken"] ?? (config as any).githubToken;

  return {
    geminiApiKey: maskKey(effectiveGemini),
    geminiApiKeySet: Boolean(effectiveGemini),
    openaiApiKey: maskKey(dbSettings["openaiApiKey"] ?? null),
    openaiApiKeySet: Boolean(dbSettings["openaiApiKey"]),
    anthropicApiKey: maskKey(dbSettings["anthropicApiKey"] ?? null),
    anthropicApiKeySet: Boolean(dbSettings["anthropicApiKey"]),
    elevenLabsApiKey: maskKey(dbSettings["elevenLabsApiKey"] ?? null),
    elevenLabsApiKeySet: Boolean(dbSettings["elevenLabsApiKey"]),
    elevenLabsVoiceId: dbSettings["elevenLabsVoiceId"] ?? null,
    elevenLabsVoiceIdSet: Boolean(dbSettings["elevenLabsVoiceId"]),
    googleMapsApiKey: maskKey(dbSettings["googleMapsApiKey"] ?? null),
    googleMapsApiKeySet: Boolean(dbSettings["googleMapsApiKey"]),
    searchApiKey: maskKey(dbSettings["searchApiKey"] ?? null),
    searchApiKeySet: Boolean(dbSettings["searchApiKey"]),
    githubToken: maskKey(effectiveGithub),
    githubTokenSet: Boolean(effectiveGithub),
    vercelToken: maskKey(dbSettings["vercelToken"] ?? null),
    vercelTokenSet: Boolean(dbSettings["vercelToken"]),
  };
}

router.get("/", async (req, res) => {
  const email = (req.headers["x-user-email"] as string) ?? "";
  const config = getConfig();
  const dbSettings = email ? await loadUserSettings(email) : {};
  res.json(buildResponse(config, dbSettings));
});

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
    if (key === "geminiApiKey") updateConfig({ geminiApiKey: val });
    if (key === "githubToken" && val) updateConfig({ githubToken: val } as any);
  }

  const config = getConfig();
  const dbSettings = email ? await loadUserSettings(email) : {};
  res.json({ success: true, ...buildResponse(config, dbSettings) });
});

export default router;
