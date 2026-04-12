interface ZarithConfig {
  groqApiKey: string;
  geminiApiKey: string | null;
}

const _config: ZarithConfig = {
  groqApiKey: process.env["GROQ_API_KEY"] ?? "",
  geminiApiKey: process.env["GEMINI_API_KEY"] ?? null,
};

export function getConfig(): Readonly<ZarithConfig> {
  return _config;
}

export function updateConfig(updates: Partial<ZarithConfig>): void {
  if (updates.groqApiKey !== undefined) _config.groqApiKey = updates.groqApiKey;
  if (updates.geminiApiKey !== undefined) _config.geminiApiKey = updates.geminiApiKey;
}

export function maskKey(key: string | null): string | null {
  if (!key || key.length < 8) return null;
  return key.slice(0, 6) + "•".repeat(8) + key.slice(-4);
}
