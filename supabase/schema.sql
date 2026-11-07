-- ============================================================
-- Let's Carol — Supabase Schema
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- ─── Enable UUID extension ────────────────────────────────────────────────────
create extension if not exists "pgcrypto";


-- ─── FAMILIES ─────────────────────────────────────────────────────────────────
create table if not exists public.families (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  address     text not null,
  latitude    double precision not null default 0,
  longitude   double precision not null default 0,
  phone       text,
  notes       text,
  spouse      text,
  children    text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Auto-update updated_at on every row change
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger families_updated_at
  before update on public.families
  for each row execute procedure public.set_updated_at();


-- ─── FAMILY MEMBERS ───────────────────────────────────────────────────────────
create table if not exists public.family_members (
  id          uuid primary key default gen_random_uuid(),
  family_id   uuid not null references public.families(id) on delete cascade,
  name        text not null,
  type        text not null check (type in ('adult', 'child')) default 'adult',
  age         integer check (age >= 0 and age <= 17),
  phone       text,
  created_at  timestamptz not null default now()
);


-- ─── GROUPS ───────────────────────────────────────────────────────────────────
create table if not exists public.groups (
  id                    uuid primary key default gen_random_uuid(),
  name                  text not null,
  leader_id             uuid,
  vehicle_number        text,
  is_active             boolean not null default true,
  current_latitude      double precision,
  current_longitude     double precision,
  current_speed         double precision,
  current_direction     text,
  last_location_update  timestamptz,
  created_at            timestamptz not null default now()
);


-- ─── ROUTES ───────────────────────────────────────────────────────────────────
create table if not exists public.routes (
  id            uuid primary key default gen_random_uuid(),
  group_id      uuid not null references public.groups(id) on delete cascade,
  family_id     uuid not null references public.families(id) on delete cascade,
  status        text not null check (status in ('pending', 'in_progress', 'visited')) default 'pending',
  checked_in_at  timestamptz,
  checked_out_at timestamptz,
  order_index   integer not null default 0,
  eta           text,
  visit_notes   text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create trigger routes_updated_at
  before update on public.routes
  for each row execute procedure public.set_updated_at();


-- ─── SONGS ────────────────────────────────────────────────────────────────────
create table if not exists public.songs (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  artist      text,
  lyrics      text,
  youtube_url text,
  category    text,
  order_index integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger songs_updated_at
  before update on public.songs
  for each row execute procedure public.set_updated_at();


-- ─── ROW LEVEL SECURITY (RLS) ─────────────────────────────────────────────────
-- Enable RLS on all tables (required for Supabase anon key access)
alter table public.families       enable row level security;
alter table public.family_members enable row level security;
alter table public.groups         enable row level security;
alter table public.routes         enable row level security;
alter table public.songs          enable row level security;

-- Simple open policies for now (tighten later with auth.uid() checks)
-- These allow any authenticated or anon user to read/write — fine for internal use
create policy "Allow all on families"       on public.families       for all using (true) with check (true);
create policy "Allow all on family_members" on public.family_members for all using (true) with check (true);
create policy "Allow all on groups"         on public.groups         for all using (true) with check (true);
create policy "Allow all on routes"         on public.routes         for all using (true) with check (true);
create policy "Allow all on songs"          on public.songs          for all using (true) with check (true);


-- ─── REALTIME ─────────────────────────────────────────────────────────────────
-- Enable realtime on groups (for live location tracking)
alter publication supabase_realtime add table public.groups;

