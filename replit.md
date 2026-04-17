# ZARITH — Executive AI Super-Agent

## Overview

ZARITH is an elite autonomous executive AI agent with a futuristic dark mode interface. It features a hybrid multi-model brain (Gemini, Claude, GPT-4o, Groq), auto-resilient fallback, GitHub self-coding capabilities, ElevenLabs voice synthesis, Manus.ai-style block-based chat, and full task management.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Frontend**: React 19 + Vite (artifacts/zarith) — dark ops center aesthetic
- **API framework**: Express 5 (artifacts/api-server)
- **AI Models**: Gemini 1.5 Pro, Claude 3.5 Sonnet, GPT-4o, Groq Llama 3 70B
- **Voice**: ElevenLabs (multilingual v2) with browser TTS fallback
- **Database**: PostgreSQL + Drizzle ORM
- **Auth**: OTP flow (6-digit code) via localStorage — Supabase OTP ready
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (ESM bundle)

## Design System

- Background: Pure black (#000000)
- Primary accent: Neon Cyan (#00FFFF family)
- Status/premium: Metallic Gold (#C9A84C)
- Fonts: Inter (body), Roboto Mono (labels/code)
- Central dashboard "Orb" pulses cyan and reacts to AI state (idle/thinking/executing/speaking)
- Manus.ai style chat: messages separated into typed blocks (thinking/action/result/text/error)

## Artifacts

- **zarith** (previewPath: `/`) — React + Vite frontend, the ZARITH command center
- **api-server** (previewPath: `/api`) — Express API server

## Routes (Frontend)

- `/login` — Email + 6-digit OTP authentication gate
- `/dashboard` — Command center with pulsing orb, model control panel, block-based chat
- `/tasks` — Full CRUD task management
- `/logs` — Agent activity feed
- `/settings` — System Config: API keys, voice settings

## API Routes (Backend)

- `GET /api/healthz` — Health check
- `GET/POST /api/tasks` — List and create tasks
- `GET/PATCH/DELETE /api/tasks/:id` — Task detail operations
- `POST /api/chat` — Send message to ZARITH (hybrid AI with auto-fallback)
- `GET /api/chat/history` — Chat message history
- `GET /api/dashboard/summary` — Dashboard aggregate stats
- `GET /api/dashboard/activity` — Recent activity feed
- `GET/PATCH /api/settings` — User API key management
- `POST /api/voice/speak` — ElevenLabs TTS synthesis → returns audio/mpeg

## AI Architecture (Hybrid Brain)

- **Auto Mode**: If no model selected, tries in order: Gemini → Claude → OpenAI → Groq
- **Manual Mode**: User selects a specific model (exclusive — others disabled)
- **Rate Limit Fallback (429)**: If selected model hits rate limit, auto-switches to next available
- **Tool Use**: `execute_github_operation` with `read` (multi-file) and `write` operations
- **Context**: Pre-fetches GitHub repo file tree to enrich system prompt
- **Read-before-write**: AI reads relevant files first to understand full context before committing

## Chat Block Types (Manus.ai Style)

- `thinking` — AI reasoning/analysis (dim, Brain icon)
- `action` — GitHub operation being executed (cyan, Github icon)
- `result` — Success/failure outcome (green/red, CheckCircle icon)
- `text` — Main text response (white, Terminal icon)
- `error` — Error messages (red, XCircle icon)

Each block has: Copy button (hover) + Speaker button for ElevenLabs TTS (on text/result blocks)

## DB Schema

- `tasks` — Task items with status, priority, timestamps
- `chat_messages` — Chat history (user + assistant roles; assistant content is JSON blocks)
- `activity_log` — Audit trail of all agent actions
- `user_settings` — Per-user API key storage (encrypted via DB)

## Environment Variables (Secrets)

- `GEMINI_API_KEY` — Google Gemini 1.5 Pro
- `ANTHROPIC_API_KEY` — Anthropic Claude 3.5 Sonnet
- `OPENAI_API_KEY` — OpenAI GPT-4o
- `VITE_GROQ_API_KEY` / `GROQ_API_KEY` — Groq Llama 3 70B
- `ELEVENLABS_API_KEY` — ElevenLabs TTS (fallback for users without DB key)
- `ELEVENLABS_VOICE_ID` — Default voice ID (fallback)
- `GITHUB_TOKEN` — Octokit auth for self-coding operations
- `DATABASE_URL` — PostgreSQL connection string (auto-provisioned)
- `SUPABASE_URL` / `SUPABASE_ANON_KEY` — Supabase OTP (optional)

## Key Commands

- `pnpm install` — Install all workspace dependencies
- `pnpm run build` — Build all packages
- `pnpm run typecheck` — Full typecheck across all packages
- `pnpm --filter @workspace/api-spec run codegen` — Regenerate API hooks and Zod schemas
- `pnpm --filter @workspace/db run push` — Push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — Run API server locally
- `pnpm --filter @workspace/zarith run dev` — Run frontend locally
