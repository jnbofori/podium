# Supabase (Postgres + Storage only)

Podium does **not** use Supabase Auth. FastAPI owns users and JWTs.

## Apply migrations

```bash
# Option A — Supabase SQL editor: paste contents of migrations/*.sql

# Option B — Supabase CLI (linked project)
supabase db push
```

Schema: `users`, `decks`, `deck_slides`, `practice_sessions`, `practice_session_personas` (see `migrations/`).

Apply **all** migration files in order.

Practice sessions store panel members in `practice_session_personas` (exactly two per new session). The legacy `practice_sessions.persona` column remains as the first panel member for convenience.

## Storage bucket

Create a **private** bucket named `decks` (or match `DECKS_BUCKET` in `api/.env.local`).

- Public: **off**
- Only the FastAPI service role uploads/downloads/deletes
- Object paths:
  - PPTX: `{user_id}/{deck_id}.pptx`
  - Slide images: `{user_id}/{deck_id}/slides/{n}.png`

The browser never talks to Storage; the API returns short-lived signed URLs for slide images (`GET /decks/{id}/slides`).

