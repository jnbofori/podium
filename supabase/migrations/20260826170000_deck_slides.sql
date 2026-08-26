-- Per-slide PNG previews rendered from PPTX on upload (private Storage paths).

create table if not exists public.deck_slides (
  id uuid primary key default gen_random_uuid(),
  deck_id uuid not null references public.decks (id) on delete cascade,
  slide_index integer not null,
  storage_path text not null,
  unique (deck_id, slide_index)
);

create index if not exists deck_slides_deck_id_idx on public.deck_slides (deck_id);
