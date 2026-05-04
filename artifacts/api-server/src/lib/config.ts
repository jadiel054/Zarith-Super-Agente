interface ZarithConfig {
  PORT: number;
  NODE_ENV: string;
  SUPABASE_URL: string;
  SUPABASE_KEY: string;
}

// Configuração inicial vinda do ambiente
const config: ZarithConfig = {
  PORT: process.env.PORT ? parseInt(process.env.PORT, 10) : 3000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  SUPABASE_URL: process.env.SUPABASE_URL || '',
  SUPABASE_KEY: process.env.SUPABASE_KEY || '',
};

// Funções que os outros arquivos estão pedindo (Exportadas)
export const getConfig = () => config;

export const updateConfig = (newConfig: Partial<ZarithConfig>) => {
  Object.assign(config, newConfig);
  return config;
};

export const maskKey = (key: string) => {
  if (!key || key.length < 8) return "********";
  return `${key.substring(0, 4)}...${key.substring(key.length - 4)}`;
};

export default config;
