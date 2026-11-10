-- ============================================================
-- Let's Carol — Church Slugs, Slug History & Song Administration Migration
-- ============================================================

-- ─── 1. CHURCH SLUGS HARDENING & SLUG HISTORY ────────────────────────────────

-- Create church_slug_history table to preserve old links when slugs change
create table if not exists public.church_slug_history (
  id          uuid primary key default gen_random_uuid(),
  church_id   uuid not null references public.churches(id) on delete cascade,
  slug        text not null,
  created_at  timestamptz not null default now()
);

-- Index for fast slug lookups in history
create index if not exists idx_church_slug_history_slug
  on public.church_slug_history(lower(slug));

-- Ensure existing churches have valid slugs backfilled
update public.churches
set slug = lower(regexp_replace(trim(name), '[^a-zA-Z0-9]+', '-', 'g'))
where slug is null or trim(slug) = '';

-- Trim leading/trailing hyphens from slugs
update public.churches
set slug = trim(both '-' from slug)
where slug like '-%' or slug like '%-';

-- Fallback for any edge case church with empty slug
update public.churches
set slug = 'church-' || substr(id::text, 1, 6)
where slug is null or length(slug) < 2;

-- Add case-insensitive unique index on churches.slug
drop index if exists idx_churches_slug_unique;
create unique index idx_churches_slug_unique on public.churches (lower(slug));

-- ─── 2. SONG VISIBILITY & ADMINISTRATION FIELDS ──────────────────────────────

-- Add is_hidden, is_public, updated_by to songs
alter table public.songs
  add column if not exists is_hidden boolean not null default false;

alter table public.songs
  add column if not exists is_public boolean not null default true;

alter table public.songs
  add column if not exists updated_by uuid references auth.users(id) on delete set null;

-- Index for fast song filtering by church and visibility
create index if not exists idx_songs_church_visibility
  on public.songs(church_id, is_hidden, is_public);

-- ─── 3. RESOLVE CHURCH SLUG RPC ──────────────────────────────────────────────
-- Resolves a slug (current or historical) to the canonical church record
create or replace function public.resolve_church_by_slug(lookup_slug text)
returns table (
  church_id uuid,
  name text,
  canonical_slug text,
  is_redirect boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_norm text;
  v_rec record;
begin
  v_norm := lower(trim(lookup_slug));
  if v_norm is null or v_norm = '' then
    return;
  end if;

  -- 1. Check current canonical church slug
  select id, c.name, c.slug into v_rec
  from public.churches c
  where lower(c.slug) = v_norm
  limit 1;

  if v_rec.id is not null then
    church_id := v_rec.id;
    name := v_rec.name;
    canonical_slug := v_rec.slug;
    is_redirect := false;
    return next;
    return;
  end if;

  -- 2. Check slug history for a redirect
  select h.church_id, c.name, c.slug into v_rec
  from public.church_slug_history h
  join public.churches c on c.id = h.church_id
  where lower(h.slug) = v_norm
  order by h.created_at desc
  limit 1;

  if v_rec.church_id is not null then
    church_id := v_rec.church_id;
    name := v_rec.name;
    canonical_slug := v_rec.slug;
    is_redirect := true;
    return next;
    return;
  end if;
end;
$$;

-- ─── 4. RECORD SLUG CHANGE RPC ───────────────────────────────────────────────
-- Safely changes a church's slug and records the old slug in history
create or replace function public.change_church_slug(
  target_church_id uuid,
  new_slug text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old_slug text;
  v_clean_new_slug text;
begin
  -- Must be an administrator of the church
  if not public.is_church_admin(target_church_id) then
    raise exception 'Unauthorized: Only church administrators can change the church URL';
  end if;

  v_clean_new_slug := lower(trim(new_slug));
  if length(v_clean_new_slug) < 3 then
    raise exception 'Church URL must be at least 3 characters';
  end if;

  -- Get current slug
  select slug into v_old_slug from public.churches where id = target_church_id;

  if v_old_slug = v_clean_new_slug then
    return v_clean_new_slug; -- No change needed
  end if;

  -- Check if new slug is already taken by another church
  if exists (
    select 1 from public.churches
    where lower(slug) = v_clean_new_slug and id <> target_church_id
  ) then
    raise exception 'This church URL is already in use by another church';
  end if;

  -- Archive old slug if it existed
  if v_old_slug is not null and trim(v_old_slug) <> '' then
    insert into public.church_slug_history (church_id, slug)
    values (target_church_id, v_old_slug);
  end if;

  -- Update church slug
  update public.churches
  set slug = v_clean_new_slug, updated_at = now()
  where id = target_church_id;

  return v_clean_new_slug;
end;
$$;

-- ─── 5. UPDATED ROW LEVEL SECURITY POLICIES FOR SONGS ────────────────────────

drop policy if exists "Members can view church songs"          on public.songs;
drop policy if exists "Admins can manage church songs"         on public.songs;
drop policy if exists "Public can view public songs for live"  on public.songs;

-- 1. Church members can view unhidden songs
create policy "Members can view active church songs"
  on public.songs for select
  to authenticated
  using (
    public.is_church_member(church_id) and (
      is_hidden = false or public.is_church_admin(church_id)
    )
  );

-- 2. Admins can insert, update, delete songs
create policy "Admins can manage church songs"
  on public.songs for all
  to authenticated
  using (public.is_church_admin(church_id))
  with check (public.is_church_admin(church_id));

-- 3. Anonymous users viewing public live page can only view active, unhidden, public songs
create policy "Public can view active public songs for live"
  on public.songs for select
  to anon
  using (
    is_hidden = false and is_public = true
  );

-- ─── 6. PUBLIC CHURCH METADATA POLICY (FOR SLUG RESOLUTION) ──────────────────

-- Allow anon and authenticated users to resolve public church name and slug
drop policy if exists "Public can resolve church slug" on public.churches;
create policy "Public can resolve church slug"
  on public.churches for select
  to anon, authenticated
  using (slug is not null);

