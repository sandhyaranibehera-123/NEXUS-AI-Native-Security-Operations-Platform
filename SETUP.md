# NEXUS — Full Stack Setup

Production-grade SOC platform with TanStack Start frontend, Fastify API, PostgreSQL, Redis, and AI Copilot.

## Architecture

```
sentinel-ai/
├── src/                    # TanStack Start web app (frontend)
├── apps/api/               # Fastify REST + WebSocket API
├── packages/
│   ├── shared/             # Zod schemas & enums (shared contracts)
│   ├── db/                 # Drizzle ORM + Postgres client
│   └── ai-contracts/       # LLM prompts, safety, model config
├── database/migrations/    # PostgreSQL schema (canonical Part 2)
└── docker-compose.yml      # Postgres + Redis + API
```

## Quick Start

### 1. Environment

```bash
cp .env.example .env
# Edit .env — add OPENAI_API_KEY for live Copilot (optional)
```

### 2. Install & Database

```bash
npm install
npm run db:up          # Start Postgres + Redis
npm run db:migrate     # Apply migrations + seed data
```

### 3. Run

```bash
# Terminal 1 — API
npm run dev:api

# Terminal 2 — Frontend
npm run dev

# Or both together:
npm run dev:all
```

### 4. Sign In

- **URL:** http://localhost:5173/login
- **Email:** `amelia.lee@acme.federal`
- **Password:** `NexusDemo2024!`

## API Endpoints

Full module list: see [apps/api/README.md](apps/api/README.md)

Core routes: Auth, Events, Incidents, Alerts, Copilot (SSE), Dashboard, Endpoints, Vulnerabilities, Threat Intel, Cloud, Network, Knowledge, Cases, Investigations, Compliance, Reports, Runbooks, Attack Graphs, Audit, Platform Health, Developer, Integrations, Search, Notifications, WebSocket.

Health checks: `GET /health`, `GET /ready` (DB + optional Redis in production)

## AI Features

- **Copilot streaming** — SSE tokens via `/v1/copilot/sessions/:id/messages`
- **RAG** — Knowledge articles + incident context retrieval
- **Alert priority scoring** — Heuristic `ai_priority_score` on alerts
- **Degraded mode** — Works without `OPENAI_API_KEY` (intelligent fallbacks)

Set in `.env`:
```
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-...
CHAT_MODEL=gpt-4o-mini
```

## Frontend Integration

- **localStorage preserved** — Zustand auth persists to `nexus.auth`
- **TanStack Query** — Events, incidents, alerts, dashboard wired to API
- **Mock fallback** — UI works offline with Faker data when API unavailable
- **WebSocket** — Live events when authenticated

## Production Checklist

- [ ] Change `JWT_SECRET` and `JWT_REFRESH_SECRET` (32+ chars)
- [ ] Configure managed PostgreSQL with PITR backups
- [ ] Enable RLS (migration `003_rls_indexes.sql`)
- [ ] Set `CORS_ORIGIN` to production domain
- [ ] Add `OPENAI_API_KEY` or Azure OpenAI credentials
- [ ] Configure S3 for evidence/reports storage
