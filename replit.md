# ZARITH — Executive AI Super-Agent

## Overview

ZARITH is an elite executive AI super-agent with a futuristic dark mode interface. It features AI-powered chat via Groq (Llama 3), task management, and a real-time activity dashboard.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Frontend**: React + Vite (artifacts/zarith) — dark ops center aesthetic
- **API framework**: Express 5 (artifacts/api-server)
- **AI**: Groq API (Llama 3 70B) for ultra-fast NLP
- **Database**: PostgreSQL + Drizzle ORM
- **Auth**: Simulated OTP flow (6-digit code) via localStorage — ready for Supabase OTP integration
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Design System

- Background: Pure black (#000000)
- Primary accent: Neon Cyan (#00FFFF family)
- Status/premium: Metallic Gold (#C9A84C)
- Fonts: Inter (body), Roboto Mono (labels/code)
- Central dashboard "Orb" pulses cyan and reacts to AI "thinking" state

## Artifacts

- **zarith** (previewPath: `/`) — React + Vite frontend, the ZARITH command center
- **api-server** (previewPath: `/api`) — Express API server

## Routes (Frontend)

- `/login` — Email + 6-digit OTP authentication gate
- `/dashboard` — Command center with pulsing orb, chat, and summary stats
- `/tasks` — Full CRUD task management
- `/logs` — Agent activity feed

## API Routes (Backend)

- `GET /api/healthz` — Health check
- `GET/POST /api/tasks` — List and create tasks
- `GET/PATCH/DELETE /api/tasks/:id` — Task detail operations
- `POST /api/chat` — Send message to ZARITH (Groq Llama 3)
- `GET /api/chat/history` — Chat message history
- `GET /api/dashboard/summary` — Dashboard aggregate stats
- `GET /api/dashboard/activity` — Recent activity feed

## DB Schema

- `tasks` — Task items with status, priority, timestamps
- `chat_messages` — Chat history (user + assistant roles)
- `activity_log` — Audit trail of all agent actions

## Environment Variables (Secrets)

- `SUPABASE_URL` — Supabase project URL (ready for future Supabase OTP)
- `SUPABASE_ANON_KEY` — Supabase anon key
- `GROQ_API_KEY` — Groq API key for Llama 3 processing
- `DATABASE_URL` — PostgreSQL connection string (auto-provisioned)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

## PWA

- `artifacts/zarith/public/manifest.json` configured for installable PWA on Android/iOS
