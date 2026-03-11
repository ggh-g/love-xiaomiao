create extension if not exists pgcrypto;

create table if not exists public.love_bank_events (
  id uuid primary key default gen_random_uuid(),
  bank_id text not null,
  kind text not null check (kind in ('heart', 'redeem')),
  amount integer not null check (amount > 0),
  label text not null check (char_length(label) between 1 and 200),
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists love_bank_events_bank_id_created_at_idx
  on public.love_bank_events (bank_id, created_at desc);

alter table public.love_bank_events enable row level security;

drop policy if exists "Anon can read love bank events" on public.love_bank_events;
create policy "Anon can read love bank events"
on public.love_bank_events
for select
to anon
using (true);

drop policy if exists "Anon can insert love bank events" on public.love_bank_events;
create policy "Anon can insert love bank events"
on public.love_bank_events
for insert
to anon
with check (
  kind in ('heart', 'redeem')
  and amount > 0
  and char_length(label) between 1 and 200
);

drop policy if exists "Anon can delete love bank events" on public.love_bank_events;
create policy "Anon can delete love bank events"
on public.love_bank_events
for delete
to anon
using (true);
