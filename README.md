# Podium

Practice presentations with an AI audience. Upload a PowerPoint, present with camera and mic, take persona-based Q&A, then get scored feedback — with accounts, a decks library, and session history.

```
podium/
  client/   # Next.js UI
  api/      # FastAPI backend (auth, decks, sessions, LiveKit tokens)
  agent/    # LiveKit voice agent (Interviewer + Evaluator)
  supabase/migrations/  # Postgres schema
```

## Prerequisites

- Node.js 24.x and [pnpm](https://pnpm.io)
- Python 3.11+ and [uv](https://docs.astral.sh/uv/)
- A [LiveKit Cloud](https://cloud.livekit.io) project
- A [Supabase](https://supabase.com) project (Postgres + Storage only)

## Supabase setup

1. Create a project and copy the **database connection string** (URI) and **service role** key.
2. Run the SQL in [`supabase/migrations/20260824120000_init.sql`](supabase/migrations/20260824120000_init.sql) (SQL editor or `supabase db push`).
3. Storage → New bucket → name: `decks` → **Private** (not public).

FastAPI talks to Postgres and Storage with the service role. The browser never uses Supabase Auth or Storage directly.

## Setup

```bash
# API
cp api/.env.example api/.env.local
# Fill DATABASE_URL, SUPABASE_*, JWT_SECRET, LIVEKIT_*, AGENT_NAME, CORS_ORIGINS

# Client
cp client/.env.example client/.env.local
# Fill LIVEKIT_* (optional for client build), AGENT_NAME=agent, NEXT_PUBLIC_API_URL=http://localhost:8000

# Agent
cp agent/.env.example agent/.env.local
# Fill LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET
```

`AGENT_NAME` must match `@server.rtc_session(agent_name="agent")` in `agent/src/agent.py`.

## Run locally

Three terminals:

```bash
# 1 — API
cd api && uv sync && uv run uvicorn app.main:app --reload --port 8000

# 2 — voice agent
cd agent && uv sync && uv run python src/agent.py dev

# 3 — web UI
cd client && pnpm install && pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). Register an account, upload a deck, practice.

## Deploy

| Piece | Notes |
|-------|--------|
| Frontend | Root directory `client`; set `NEXT_PUBLIC_API_URL` to the public API URL |
| API | Host `api/` (Fly, Railway, etc.); set env from `api/.env.example` |
| LiveKit agent | From `agent/`: `lk agent deploy` or `docker build -f agent/Dockerfile agent` |
| Supabase | Managed Postgres + Storage |

## CI

- `.github/workflows/client.yml` — lint/build Next app
- `.github/workflows/agent.yml` — ruff/pytest agent
- `.github/workflows/api.yml` — ruff/pytest for FastAPI

See [`supabase/README.md`](supabase/README.md) for migration and private `decks` bucket setup.
