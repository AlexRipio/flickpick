-- FlickPick — Supabase schema
-- Run this once in Supabase Studio → SQL Editor.

-- 1. rooms table: one row per lobby, `data` stores the full room JSON.
create table if not exists public.rooms (
  id          uuid         primary key,
  join_code   text         unique not null,
  owner_id    text         not null,
  status      text         not null default 'lobby',
  data        jsonb        not null,
  updated_at  timestamptz  not null default now()
);

create index if not exists rooms_join_code_idx on public.rooms (join_code);
create index if not exists rooms_updated_idx    on public.rooms (updated_at desc);

-- 2. Row-level security. Demo usage: anyone with the anon key can read/write.
--    (Tighten once you wire up user auth on the rooms themselves.)
alter table public.rooms enable row level security;

drop policy if exists "rooms_read_all"   on public.rooms;
drop policy if exists "rooms_write_all"  on public.rooms;
drop policy if exists "rooms_update_all" on public.rooms;

create policy "rooms_read_all"   on public.rooms for select using (true);
create policy "rooms_write_all"  on public.rooms for insert with check (true);
create policy "rooms_update_all" on public.rooms for update using (true) with check (true);

-- 3. Realtime: broadcast postgres changes so other devices see joins/votes/matches live.
alter publication supabase_realtime add table public.rooms;
