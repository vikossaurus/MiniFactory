-- MINI FACTORY / SUPABASE
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
  state jsonb not null default '{"money":500,"iron":0,"plates":0,"energy":0,"buildings":[]}'::jsonb,
  updated_at timestamptz not null default now()
);

create or replace view public.leaderboard as
select username,factory_value,production_per_min
from public.profiles
order by factory_value desc;

create or replace view public.public_factories as
select p.username,f.state,f.updated_at
from public.profiles p
join public.factories f on f.user_id=p.id
where p.is_public=true;

alter table public.profiles enable row level security;
alter table public.factories enable row level security;

drop policy if exists "profiles read public" on public.profiles;
create policy "profiles read public" on public.profiles for select using (is_public=true or id=auth.uid());

drop policy if exists "profiles insert own" on public.profiles;
create policy "profiles insert own" on public.profiles for insert with check (id=auth.uid());

drop policy if exists "profiles update own" on public.profiles;
create policy "profiles update own" on public.profiles for update using (id=auth.uid()) with check (id=auth.uid());

drop policy if exists "factories own select" on public.factories;
create policy "factories own select" on public.factories for select using (user_id=auth.uid());

drop policy if exists "factories own insert" on public.factories;
create policy "factories own insert" on public.factories for insert with check (user_id=auth.uid());

drop policy if exists "factories own update" on public.factories;
create policy "factories own update" on public.factories for update using (user_id=auth.uid()) with check (user_id=auth.uid());

-- Public views need security_invoker disabled so they can expose only public rows.
grant select on public.leaderboard to anon, authenticated;
grant select on public.public_factories to anon, authenticated;
grant select,insert,update on public.profiles to authenticated;
grant select,insert,update on public.factories to authenticated;
