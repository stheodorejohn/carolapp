-- ============================================================
-- Migration: Add User Profiles & Auto-Sync Trigger for Auth
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- 1. Create public.profiles table
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

-- Auto-update updated_at on change
create or replace trigger profiles_updated_at
  before update on public.profiles
  for each row execute procedure public.set_updated_at();

-- 2. Auto-sync trigger function: fires when a user signs up via Supabase Auth
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

-- 3. Attach trigger to auth.users
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 4. Backfill any existing auth.users into public.profiles
insert into public.profiles (id, email, full_name, role)
select
  id,
  email,
  coalesce(raw_user_meta_data->>'full_name', ''),
  coalesce(raw_user_meta_data->>'role', 'team_member')
from auth.users
on conflict (id) do nothing;

-- 5. Enable Row Level Security (RLS)
alter table public.profiles enable row level security;

-- Policies for profiles:
-- Authenticated users can view all member profiles (needed for group leader assignments & team view)
drop policy if exists "Allow read on profiles for authenticated users" on public.profiles;
create policy "Allow read on profiles for authenticated users"
  on public.profiles for select
  to authenticated
  using (true);

-- Users can update their own profile details
drop policy if exists "Allow users to update own profile" on public.profiles;
create policy "Allow users to update own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id);

-- Service role / admins can manage all profiles
drop policy if exists "Allow all on profiles for service role" on public.profiles;
create policy "Allow all on profiles for service role"
  on public.profiles for all
  using (auth.jwt()->>'role' = 'service_role');

