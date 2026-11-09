-- ============================================================
-- Let's Carol — Supabase Schema
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- ─── Enable UUID extension ────────────────────────────────────────────────────
create extension if not exists "pgcrypto";


-- ─── HELPER FUNCTIONS ─────────────────────────────────────────────────────────
-- Auto-update updated_at on every row change
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;


-- ─── PROFILES (Linked to Supabase auth.users) ─────────────────────────────────
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  full_name   text,
  role        text not null check (role in ('admin', 'leader', 'team_member', 'driver')) default 'team_member',
  phone       text,
  avatar_url  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create or replace trigger profiles_updated_at
  before update on public.profiles
  for each row execute procedure public.set_updated_at();

-- Auto-sync trigger function: fires when a user signs up via Supabase Auth
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'role', 'team_member')
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = coalesce(excluded.full_name, profiles.full_name);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


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
  relation    text,
  created_at  timestamptz not null default now()
);
alter table public.family_members add column if not exists relation text;


-- ─── GROUPS ───────────────────────────────────────────────────────────────────
create table if not exists public.groups (
  id                    uuid primary key default gen_random_uuid(),
  name                  text not null,
  leader_id             uuid,
  vehicle_number        text,
  slug                  text unique,          -- short share URL e.g. "a1" → /live/a1
  is_active             boolean not null default true,
  current_latitude      double precision,
  current_longitude     double precision,
  current_speed         double precision,
  current_direction     text,
  last_location_update  timestamptz,
  created_at            timestamptz not null default now()
);

-- If the table already exists, add the slug column (run once):
-- alter table public.groups add column if not exists slug text unique;


-- ─── ROUTES ───────────────────────────────────────────────────────────────────
create table if not exists public.routes (
  id            uuid primary key default gen_random_uuid(),
  group_id      uuid not null references public.groups(id) on delete cascade,
  family_id     uuid not null references public.families(id) on delete cascade,
  status        text not null check (status in ('pending', 'arrived', 'in_progress', 'visited')) default 'pending',
  arrived_at     timestamptz,
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
alter table public.profiles       enable row level security;
alter table public.families       enable row level security;
alter table public.family_members enable row level security;
alter table public.groups         enable row level security;
alter table public.routes         enable row level security;
alter table public.songs          enable row level security;

-- Policies for profiles
create policy "Allow read on profiles for authenticated users"
  on public.profiles for select
  to authenticated
  using (true);

create policy "Allow users to update own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id);

-- Open policies for internal app access (tighten later with role-specific checks)
create policy "Allow all on families"       on public.families       for all using (true) with check (true);
create policy "Allow all on family_members" on public.family_members for all using (true) with check (true);
create policy "Allow all on groups"         on public.groups         for all using (true) with check (true);
create policy "Allow all on routes"         on public.routes         for all using (true) with check (true);
create policy "Allow all on songs"          on public.songs          for all using (true) with check (true);


-- ─── REALTIME ─────────────────────────────────────────────────────────────────
-- Enable realtime on groups (for live location tracking)
alter publication supabase_realtime add table public.groups;

