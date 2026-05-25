import { Router } from "express";
import { db } from "@workspace/db";
import { userSettingsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import ZarithConfig, { getConfig, updateConfig, maskKey } from "../lib/config";

const router = Router();

// Preflight explícito
router.options("/", (_req, res) => res.sendStatus(200));

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
  } catch (err: any) {
    console.error("[DB][loadUserSettings] Falha ao carregar settings:", {
      email,
      message: err?.message,
      code: err?.code,
      detail: err?.detail,
      stack: err?.stack,
    });
    return {};
  }
}

async function saveUserSetting(email: string, key: string, value: string | null): Promise<void> {
  try {
    const existing = await db
      .select({ id: userSettingsTable.id })
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

    console.log(`[DB][save] ✅ ${email} → ${key} = ${value ? "***set***" : "null"}`);
  } catch (err: any) {
    console.error("[DB][saveUserSetting] ❌ ERRO AO SALVAR:", {
      email,
      key,
      message: err?.message,
      code: err?.code,          // ex: "42P01" = tabela não existe
      detail: err?.detail,      // detalhe do PostgreSQL
      hint: err?.hint,
      routine: err?.routine,
      stack: err?.stack,
    });
    // Re-lança para o handler da rota capturar
    throw err;
  }
}

function buildResponse(config: typeof ZarithConfig, dbSettings: Record<string, string | null>) {
  const effectiveGemini = dbSettings["geminiApiKey"] ?? (config as any).geminiApiKey;
  const effectiveGithub = dbSettings["githubToken"] ?? (config as any).githubToken;

  return {
    geminiApiKey:       maskKey(effectiveGemini ?? ""),
    geminiApiKeySet:    Boolean(effectiveGemini),
    groqApiKey:         maskKey(dbSettings["groqApiKey"] ?? ""),
    groqApiKeySet:      Boolean(dbSettings["groqApiKey"]),
    openaiApiKey:       maskKey(dbSettings["openaiApiKey"] ?? ""),
    openaiApiKeySet:    Boolean(dbSettings["openaiApiKey"]),
    anthropicApiKey:    maskKey(dbSettings["anthropicApiKey"] ?? ""),
    anthropicApiKeySet: Boolean(dbSettings["anthropicApiKey"]),
    elevenLabsApiKey:    maskKey(dbSettings["elevenLabsApiKey"] ?? ""),
    elevenLabsApiKeySet: Boolean(dbSettings["elevenLabsApiKey"]),
    elevenLabsVoiceId:    dbSettings["elevenLabsVoiceId"] ?? null,
    elevenLabsVoiceIdSet: Boolean(dbSettings["elevenLabsVoiceId"]),
    googleMapsApiKey:    maskKey(dbSettings["googleMapsApiKey"] ?? ""),
    googleMapsApiKeySet: Boolean(dbSettings["googleMapsApiKey"]),
    searchApiKey:       maskKey(dbSettings["searchApiKey"] ?? ""),
    searchApiKeySet:    Boolean(dbSettings["searchApiKey"]),
    githubToken:       maskKey(effectiveGithub ?? ""),
    githubTokenSet:    Boolean(effectiveGithub),
    vercelToken:       maskKey(dbSettings["vercelToken"] ?? ""),
    vercelTokenSet:    Boolean(dbSettings["vercelToken"]),
  };
}

// GET /api/settings
router.get("/", async (req, res) => {
  const email = (req.headers["x-user-email"] as string) ?? "";
  const config = getConfig();
  const dbSettings = email ? await loadUserSettings(email) : {};
  res.json(buildResponse(config, dbSettings));
});

// PATCH /api/settings
router.patch("/", async (req, res) => {
  const email = (req.headers["x-user-email"] as string) ?? "";
  const updates = req.body as Partial<Record<SettingKey, string>>;

  const errors: string[] = [];

  for (const key of SETTING_KEYS) {
    if (updates[key] === undefined) continue;
    const val = updates[key]?.trim() || null;

    if (email) {
      try {
        await saveUserSetting(email, key, val);
      } catch (err: any) {
        const msg = err?.message ?? "Erro desconhecido";
        const code = err?.code ?? "";
        errors.push(`${key}: ${msg}${code ? ` [PG:${code}]` : ""}`);
        continue; // tenta salvar as outras chaves mesmo se uma falhar
      }
    }

    // Atualiza config em memória para uso imediato
    if (key === "geminiApiKey")  updateConfig({ geminiApiKey: val } as any);
    if (key === "groqApiKey")    updateConfig({ groqApiKey: val } as any);
    if (key === "githubToken" && val) updateConfig({ githubToken: val } as any);
  }

  if (errors.length > 0 && email) {
    // Houve erros no banco mas retornamos 200 com detalhe para diagnóstico
    console.error("[settings][PATCH] Erros ao salvar:", errors);
    return res.status(207).json({
      success: false,
      error: "Falha ao salvar no banco de dados.",
      detail: errors,
      hint: "Verifique se as tabelas foram criadas (execute lib/db/init.sql no Neon Console).",
    });
  }

  const config = getConfig();
  const dbSettings = email ? await loadUserSettings(email) : {};
  res.json({ success: true, ...buildResponse(config, dbSettings) });
});

// POST /api/settings — alias de compatibilidade
router.post("/", async (req, res) => {
  req.method = "PATCH";
  // Re-usa o handler do PATCH
  router.handle(req, res, () => {});
});

export default router;
