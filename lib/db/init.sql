-- ═══════════════════════════════════════════════════════════════════════════
-- ZARITH — Schema de Inicialização do Banco de Dados (Neon PostgreSQL)
-- Execute este arquivo no SQL Editor do Neon Console:
-- https://console.neon.tech → seu projeto → SQL Editor → cole e execute
-- ═══════════════════════════════════════════════════════════════════════════

-- Extensão pgvector (necessária para zarith_memory — ignorar erro se não disponível)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector" CASCADE; -- pode falhar se não habilitado no plano

-- ── ENUMS ────────────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE task_status   AS ENUM ('pending', 'in_progress', 'completed', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE task_priority AS ENUM ('low', 'medium', 'high', 'critical');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE message_role  AS ENUM ('user', 'assistant');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE activity_type AS ENUM (
    'task_created', 'task_completed', 'task_failed', 'message_sent', 'agent_response'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── TABELAS ───────────────────────────────────────────────────────────────────

-- 1. user_settings — chaves de API por usuário (ESSENCIAL para o salvamento funcionar)
CREATE TABLE IF NOT EXISTS user_settings (
  id         SERIAL PRIMARY KEY,
  email      TEXT NOT NULL,
  key        TEXT NOT NULL,
  value      TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS user_settings_email_key_idx ON user_settings (email, key);

-- 2. tasks — gerenciamento de tarefas
CREATE TABLE IF NOT EXISTS tasks (
  id          SERIAL PRIMARY KEY,
  title       TEXT NOT NULL,
  description TEXT,
  status      task_status    NOT NULL DEFAULT 'pending',
  priority    task_priority  NOT NULL DEFAULT 'medium',
  created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 3. chat_messages — histórico de chat
CREATE TABLE IF NOT EXISTS chat_messages (
  id         SERIAL PRIMARY KEY,
  role       message_role NOT NULL,
  content    TEXT NOT NULL,
  is_thinking BOOLEAN NOT NULL DEFAULT FALSE,
  session_id TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 4. activity_log — feed de atividades do agente
CREATE TABLE IF NOT EXISTS activity_log (
  id          SERIAL PRIMARY KEY,
  type        activity_type NOT NULL,
  description TEXT NOT NULL,
  metadata    JSONB,
  created_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 5. zarith_execution_logs — rastreamento de execuções
CREATE TABLE IF NOT EXISTS zarith_execution_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id     TEXT,
  thought     TEXT,
  action      TEXT,
  observation TEXT,
  status      TEXT,
  metadata    JSONB DEFAULT '{}',
  created_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 6. zarith_authorizations — controle de permissões
CREATE TABLE IF NOT EXISTS zarith_authorizations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_name  TEXT NOT NULL,
  scope_path    TEXT NOT NULL,
  status        TEXT DEFAULT 'pending',
  action        TEXT,
  is_authorized TEXT DEFAULT 'false',
  granted_at    TIMESTAMP,
  expires_at    TIMESTAMP,
  created_at    TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 7. zarith_memory — memória vetorial (requer extensão pgvector)
-- Se pgvector não estiver disponível no seu plano, comente esta tabela
CREATE TABLE IF NOT EXISTS zarith_memory (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content    TEXT NOT NULL,
  metadata   JSONB DEFAULT '{}',
  embedding  vector(1536),  -- requer pgvector
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ── VERIFICAÇÃO ───────────────────────────────────────────────────────────────
SELECT
  table_name,
  (SELECT COUNT(*) FROM information_schema.columns c WHERE c.table_name = t.table_name) AS colunas
FROM information_schema.tables t
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
ORDER BY table_name;
