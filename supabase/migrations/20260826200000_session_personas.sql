-- Panel members for practice sessions (ordered seats).

create table if not exists public.practice_session_personas (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.practice_sessions (id) on delete cascade,
  persona text not null,
  sort_order integer not null,
  unique (session_id, persona),
  unique (session_id, sort_order)
);

create index if not exists practice_session_personas_session_id_idx
  on public.practice_session_personas (session_id);

-- Backfill from legacy practice_sessions.persona
insert into public.practice_session_personas (session_id, persona, sort_order)
select id, persona, 0
from public.practice_sessions
where persona is not null
  and not exists (
    select 1 from public.practice_session_personas psp
    where psp.session_id = practice_sessions.id
  );
