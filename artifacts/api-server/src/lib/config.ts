interface ZarithConfig {
  PORT: number;
  NODE_ENV: string;
  SUPABASE_URL: string;
  SUPABASE_KEY: string;
}

const config: ZarithConfig = {
  PORT: process.env.PORT ? parseInt(process.env.PORT, 10) : 3000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  SUPABASE_URL: process.env.SUPABASE_URL || '',
  SUPABASE_KEY: process.env.SUPABASE_KEY || '',
};

export default config;
