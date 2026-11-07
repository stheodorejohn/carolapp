-- ============================================================
-- Let's Carol  –  Supabase Database Schema
-- Run this in the Supabase SQL Editor
-- ============================================================

-- ─── Extensions ──────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ─── Users ───────────────────────────────────────────────────
create table if not exists public.users (
  id          uuid primary key default uuid_generate_v4(),
  email       text not null unique,
  role        text not null default 'leader' check (role in ('admin', 'leader')),
  full_name   text,
  avatar_url  text,
  created_at  timestamptz not null default now()
);

alter table public.users enable row level security;

create policy "Users can view their own record"
  on public.users for select
  using (auth.uid() = id);

create policy "Admins can view all users"
  on public.users for select
  using (exists (
    select 1 from public.users u
    where u.id = auth.uid() and u.role = 'admin'
  ));

-- ─── Families ────────────────────────────────────────────────
create table if not exists public.families (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  address     text not null,
  latitude    double precision not null,
  longitude   double precision not null,
  phone       text,
  notes       text,
  spouse      text,
  children    text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.families enable row level security;
create policy "Authenticated users can read families"
  on public.families for select
  using (auth.role() = 'authenticated');
create policy "Admins can manage families"
  on public.families for all
  using (exists (
    select 1 from public.users u
    where u.id = auth.uid() and u.role = 'admin'
  ));

-- ─── Family Members ───────────────────────────────────────────
create table if not exists public.family_members (
  id          uuid primary key default uuid_generate_v4(),
  family_id   uuid not null references public.families(id) on delete cascade,
  name        text not null,
  type        text not null default 'adult' check (type in ('adult', 'child')),
  age         int,
  phone       text
);

alter table public.family_members enable row level security;
create policy "Authenticated users can read members"
  on public.family_members for select
  using (auth.role() = 'authenticated');

-- ─── Groups ───────────────────────────────────────────────────
create table if not exists public.groups (
  id                      uuid primary key default uuid_generate_v4(),
  name                    text not null,
  leader_id               uuid references public.users(id),
  vehicle_number          text,
  is_active               boolean not null default true,
  current_latitude        double precision,
  current_longitude       double precision,
  current_speed           int,
  current_direction       text,
  last_location_update    timestamptz,
  created_at              timestamptz not null default now()
);

alter table public.groups enable row level security;
create policy "Authenticated users can read groups"
  on public.groups for select
  using (auth.role() = 'authenticated');
create policy "Leaders can update their own group location"
  on public.groups for update
  using (leader_id = auth.uid());

-- ─── Routes ───────────────────────────────────────────────────
create table if not exists public.routes (
  id              uuid primary key default uuid_generate_v4(),
  group_id        uuid not null references public.groups(id) on delete cascade,
  family_id       uuid not null references public.families(id) on delete cascade,
  status          text not null default 'pending'
                  check (status in ('pending', 'in_progress', 'visited')),
  checked_in_at   timestamptz,
  checked_out_at  timestamptz,
  order_index     int not null default 0,
  eta             timestamptz,
  visit_notes     text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table public.routes enable row level security;
create policy "Authenticated users can read routes"
  on public.routes for select
  using (auth.role() = 'authenticated');
create policy "Leaders can update route status"
  on public.routes for update
  using (exists (
    select 1 from public.groups g
    where g.id = group_id and g.leader_id = auth.uid()
  ));

-- ─── Songs ────────────────────────────────────────────────────
create table if not exists public.songs (
  id          uuid primary key default uuid_generate_v4(),
  title       text not null,
  artist      text,
  lyrics      text,
  youtube_url text,
  category    text,
  order_index int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.songs enable row level security;
create policy "Authenticated users can read songs"
  on public.songs for select
  using (auth.role() = 'authenticated');
create policy "Admins can manage songs"
  on public.songs for all
  using (exists (
    select 1 from public.users u
    where u.id = auth.uid() and u.role = 'admin'
  ));

-- ─── Realtime ─────────────────────────────────────────────────
-- Enable Realtime for live location tracking
alter publication supabase_realtime add table public.groups;
alter publication supabase_realtime add table public.routes;

-- ─── Updated_at trigger ───────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger families_updated_at
  before update on public.families
  for each row execute function public.set_updated_at();

create trigger routes_updated_at
  before update on public.routes
  for each row execute function public.set_updated_at();

create trigger songs_updated_at
  before update on public.songs
  for each row execute function public.set_updated_at();
