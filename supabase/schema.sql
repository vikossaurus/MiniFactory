-- MINI FACTORY - SUPABASE DATABASE
-- Cola tudo isto no SQL Editor do teu projeto Supabase.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null check (char_length(username) between 3 and 20),
  is_public boolean not null default true,
  factory_value bigint not null default 500,
  production_per_min bigint not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.factories (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  state jsonb not null default
    '{"money":500,"iron":0,"plates":0,"energy":0,"buildings":[]}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Views públicas: só expõem dados que o jogo precisa.
drop view if exists public.leaderboard;
create view public.leaderboard
with (security_invoker = false)
as
select username, factory_value, production_per_min
from public.profiles
order by factory_value desc;

drop view if exists public.public_factories;
create view public.public_factories
with (security_invoker = false)
as
select
  p.username,
  p.factory_value,
  p.production_per_min,
  f.state,
  f.updated_at
from public.profiles p
join public.factories f on f.user_id = p.id
where p.is_public = true;

-- RLS
alter table public.profiles enable row level security;
alter table public.factories enable row level security;

drop policy if exists "profiles own insert" on public.profiles;
create policy "profiles own insert"
on public.profiles for insert
to authenticated
with check (id = auth.uid());

drop policy if exists "profiles public or own select" on public.profiles;
create policy "profiles public or own select"
on public.profiles for select
to authenticated
using (is_public = true or id = auth.uid());

drop policy if exists "profiles own update" on public.profiles;
create policy "profiles own update"
on public.profiles for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists "factories own select" on public.factories;
create policy "factories own select"
on public.factories for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "factories own insert" on public.factories;
create policy "factories own insert"
on public.factories for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "factories own update" on public.factories;
create policy "factories own update"
on public.factories for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- Permissões das views/tabelas
grant select on public.leaderboard to anon, authenticated;
grant select on public.public_factories to anon, authenticated;
grant select, insert, update on public.profiles to authenticated;
grant select, insert, update on public.factories to authenticated;
