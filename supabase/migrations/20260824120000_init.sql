-- Podium app schema (Supabase Postgres). No Supabase Auth dependency.

create extension if not exists "pgcrypto";

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,
  display_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.decks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  file_name text not null,
  storage_path text not null,
  plain_text text not null default '',
  slide_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists decks_user_id_idx on public.decks (user_id);

create table if not exists public.practice_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  deck_id uuid not null references public.decks (id) on delete cascade,
  persona text not null,
  status text not null default 'in_progress',
  room_name text,
  feedback jsonb,
  overall_score numeric(4, 1),
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists practice_sessions_user_id_idx on public.practice_sessions (user_id);
create index if not exists practice_sessions_deck_id_idx on public.practice_sessions (deck_id);

-- Storage: create a private bucket named `decks` in the Supabase dashboard
-- (Storage → New bucket → name: decks → Public: off).
-- FastAPI uses the service role key to upload/delete; the browser never talks to Storage.
