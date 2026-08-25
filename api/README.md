# Podium API

FastAPI backend for auth (email/password JWT), decks (Supabase Storage), practice sessions, evaluate fallback, and LiveKit token minting.

## Setup

```bash
cp .env.example .env.local
# Fill DATABASE_URL, SUPABASE_*, JWT_SECRET, LIVEKIT_*, AGENT_NAME, CORS_ORIGINS
uv sync
uv run uvicorn app.main:app --reload --port 8000
```

Docs: http://localhost:8000/docs

See [root README](../README.md) and [supabase/README.md](../supabase/README.md).
