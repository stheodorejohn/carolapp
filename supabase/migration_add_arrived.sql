-- ============================================================
-- Migration: Add 'arrived' status and arrived_at column
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- 1. Add the arrived_at timestamp column
alter table public.routes
  add column if not exists arrived_at timestamptz;

-- 2. Drop the old status check constraint and add the new one
alter table public.routes
  drop constraint if exists routes_status_check;

alter table public.routes
  add constraint routes_status_check
  check (status in ('pending', 'arrived', 'in_progress', 'visited'));

