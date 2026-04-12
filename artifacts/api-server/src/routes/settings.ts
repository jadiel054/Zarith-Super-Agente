import { Router } from "express";
import { db } from "@workspace/db";
import { userSettingsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { getConfig, updateConfig, maskKey } from "../lib/config";

const router = Router();

const SETTING_KEYS = [
  "groqApiKey",
  "openaiApiKey",
  "anthropicApiKey",
  "geminiApiKey",
  "elevenLabsApiKey",
  "elevenLabsVoiceId",
  "googleMapsApiKey",
  "searchApiKey",
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

router.get("/", async (req, res) => {
  const email = (req.headers["x-user-email"] as string) ?? "";
  const config = getConfig();
  const dbSettings = email ? await loadUserSettings(email) : {};

  const effectiveGroq = dbSettings["groqApiKey"] ?? config.groqApiKey;
  const effectiveGemini = dbSettings["geminiApiKey"] ?? config.geminiApiKey;

  res.json({
    groqApiKey: maskKey(effectiveGroq),
    groqApiKeySet: Boolean(effectiveGroq),
    openaiApiKey: maskKey(dbSettings["openaiApiKey"] ?? null),
    openaiApiKeySet: Boolean(dbSettings["openaiApiKey"]),
    anthropicApiKey: maskKey(dbSettings["anthropicApiKey"] ?? null),
    anthropicApiKeySet: Boolean(dbSettings["anthropicApiKey"]),
    geminiApiKey: maskKey(effectiveGemini),
    geminiApiKeySet: Boolean(effectiveGemini),
    elevenLabsApiKey: maskKey(dbSettings["elevenLabsApiKey"] ?? null),
    elevenLabsApiKeySet: Boolean(dbSettings["elevenLabsApiKey"]),
    elevenLabsVoiceId: dbSettings["elevenLabsVoiceId"] ?? null,
    elevenLabsVoiceIdSet: Boolean(dbSettings["elevenLabsVoiceId"]),
    googleMapsApiKey: maskKey(dbSettings["googleMapsApiKey"] ?? null),
    googleMapsApiKeySet: Boolean(dbSettings["googleMapsApiKey"]),
    searchApiKey: maskKey(dbSettings["searchApiKey"] ?? null),
    searchApiKeySet: Boolean(dbSettings["searchApiKey"]),
  });
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

    if (key === "groqApiKey" && val) updateConfig({ groqApiKey: val });
    if (key === "geminiApiKey") updateConfig({ geminiApiKey: val });
  }

  const config = getConfig();
  const dbSettings = email ? await loadUserSettings(email) : {};

  const effectiveGroq = dbSettings["groqApiKey"] ?? config.groqApiKey;
  const effectiveGemini = dbSettings["geminiApiKey"] ?? config.geminiApiKey;

  res.json({
    success: true,
    groqApiKey: maskKey(effectiveGroq),
    groqApiKeySet: Boolean(effectiveGroq),
    openaiApiKey: maskKey(dbSettings["openaiApiKey"] ?? null),
    openaiApiKeySet: Boolean(dbSettings["openaiApiKey"]),
    anthropicApiKey: maskKey(dbSettings["anthropicApiKey"] ?? null),
    anthropicApiKeySet: Boolean(dbSettings["anthropicApiKey"]),
    geminiApiKey: maskKey(effectiveGemini),
    geminiApiKeySet: Boolean(effectiveGemini),
    elevenLabsApiKey: maskKey(dbSettings["elevenLabsApiKey"] ?? null),
    elevenLabsApiKeySet: Boolean(dbSettings["elevenLabsApiKey"]),
    elevenLabsVoiceId: dbSettings["elevenLabsVoiceId"] ?? null,
    elevenLabsVoiceIdSet: Boolean(dbSettings["elevenLabsVoiceId"]),
    googleMapsApiKey: maskKey(dbSettings["googleMapsApiKey"] ?? null),
    googleMapsApiKeySet: Boolean(dbSettings["googleMapsApiKey"]),
    searchApiKey: maskKey(dbSettings["searchApiKey"] ?? null),
    searchApiKeySet: Boolean(dbSettings["searchApiKey"]),
  });
});

export default router;
