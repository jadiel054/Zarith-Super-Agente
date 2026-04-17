// Groq removido — Gemini é o CORE PRINCIPAL da Zarith
interface ZarithConfig {
  geminiApiKey: string | null;
  openaiApiKey: string | null;
  anthropicApiKey: string | null;
  githubToken: string | null;
  vercelToken: string | null;
}

const _config: ZarithConfig = {
  geminiApiKey: process.env["GEMINI_API_KEY"] ?? null,
  openaiApiKey: process.env["OPENAI_API_KEY"] ?? null,
  anthropicApiKey: process.env["ANTHROPIC_API_KEY"] ?? null,
  githubToken: process.env["GITHUB_TOKEN"] ?? null,
  vercelToken: process.env["VERCEL_TOKEN"] ?? null,
};

export function getConfig(): Readonly<ZarithConfig> {
  return _config;
}

export function updateConfig(updates: Partial<ZarithConfig>): void {
  if (updates.geminiApiKey !== undefined) _config.geminiApiKey = updates.geminiApiKey;
  if (updates.openaiApiKey !== undefined) _config.openaiApiKey = updates.openaiApiKey;
  if (updates.anthropicApiKey !== undefined) _config.anthropicApiKey = updates.anthropicApiKey;
  if (updates.githubToken !== undefined) _config.githubToken = updates.githubToken;
  if (updates.vercelToken !== undefined) _config.vercelToken = updates.vercelToken;
}

export function maskKey(key: string | null): string | null {
  if (!key || key.length < 8) return null;
  return key.slice(0, 6) + "•".repeat(8) + key.slice(-4);
}
