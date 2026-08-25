# Supabase (Postgres + Storage only)

Podium does **not** use Supabase Auth. FastAPI owns users and JWTs.

## Apply migrations

```bash
# Option A — Supabase SQL editor: paste contents of migrations/*.sql

# Option B — Supabase CLI (linked project)
supabase db push
```

Schema: `users`, `decks`, `practice_sessions` (see `migrations/20260824120000_init.sql`).

## Storage bucket

Create a **private** bucket named `decks` (or match `DECKS_BUCKET` in `api/.env.local`).

- Public: **off**
- Only the FastAPI service role uploads/downloads/deletes
- Object paths: `{user_id}/{deck_id}.pptx`
