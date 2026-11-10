-- ============================================================
-- Let's Carol — Multi-Church Architecture & Tenant RLS Migration
-- ============================================================

-- Enable pgcrypto if not already enabled
create extension if not exists "pgcrypto";

-- ─── 1. CHURCHES TABLE ────────────────────────────────────────────────────────
create table if not exists public.churches (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text unique,
  address     text,
  city        text,
  phone       text,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Auto-update updated_at trigger for churches
drop trigger if exists churches_updated_at on public.churches;
create trigger churches_updated_at
  before update on public.churches
  for each row execute procedure public.set_updated_at();


-- ─── 2. CHURCH MEMBERS TABLE ──────────────────────────────────────────────────
-- Links Supabase auth.users to churches with an authoritative role
create table if not exists public.church_members (
  id          uuid primary key default gen_random_uuid(),
  church_id   uuid not null references public.churches(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  role        text not null check (role in ('admin', 'team_member', 'driver')) default 'team_member',
  status      text not null check (status in ('active', 'inactive')) default 'active',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (church_id, user_id)
);

-- Auto-update updated_at trigger for church_members
drop trigger if exists church_members_updated_at on public.church_members;
create trigger church_members_updated_at
  before update on public.church_members
  for each row execute procedure public.set_updated_at();


-- ─── 3. CHURCH INVITES TABLE ──────────────────────────────────────────────────
-- Secure invitation tokens with hash, expiry, usage count, and role
create table if not exists public.church_invites (
  id          uuid primary key default gen_random_uuid(),
  church_id   uuid not null references public.churches(id) on delete cascade,
  token_hash  text not null unique,
  role        text not null check (role in ('admin', 'team_member', 'driver')) default 'team_member',
  created_by  uuid not null references auth.users(id) on delete cascade,
  expires_at  timestamptz,
  max_uses    integer,
  use_count   integer not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);


-- ─── 4. TENANT SCOPING FOR BUSINESS ENTITIES ─────────────────────────────────
-- Add church_id to families, groups, songs, and routes
alter table public.families
  add column if not exists church_id uuid references public.churches(id) on delete cascade;

alter table public.groups
  add column if not exists church_id uuid references public.churches(id) on delete cascade;

alter table public.songs
  add column if not exists church_id uuid references public.churches(id) on delete cascade;

alter table public.routes
  add column if not exists church_id uuid references public.churches(id) on delete cascade;


-- ─── 5. DATA BACKFILL (Preserve Existing Records) ─────────────────────────────
do $$
declare
  default_cid uuid;
begin
  -- Check if any existing tenant records lack a church_id
  if exists (select 1 from public.families where church_id is null) or
     exists (select 1 from public.groups where church_id is null) or
     exists (select 1 from public.songs where church_id is null) then

    -- Find or create a default church for existing data
    select id into default_cid from public.churches order by created_at asc limit 1;

    if default_cid is null then
      insert into public.churches (name, slug)
      values ('Emmanuel Carol Church', 'emmanuel-carol')
      returning id into default_cid;
    end if;

    -- Backfill tenant records
    update public.families set church_id = default_cid where church_id is null;
    update public.groups set church_id = default_cid where church_id is null;
    update public.songs set church_id = default_cid where church_id is null;
    update public.routes r
      set church_id = g.church_id
      from public.groups g
      where r.group_id = g.id and r.church_id is null;
    update public.routes set church_id = default_cid where church_id is null;

    -- Backfill any existing users into the default church
    insert into public.church_members (church_id, user_id, role, status)
    select default_cid, u.id,
      case
        when u.raw_user_meta_data->>'role' = 'admin' then 'admin'
        else 'team_member'
      end,
      'active'
    from auth.users u
    on conflict (church_id, user_id) do nothing;
  end if;
end $$;


-- ─── 6. ROUTE TENANT INTEGRITY TRIGGER ────────────────────────────────────────
-- Ensures routes inherit church_id from their group and match family's church_id
create or replace function public.validate_route_tenant()
returns trigger
language plpgsql
as $$
declare
  grp_church_id uuid;
  fam_church_id uuid;
begin
  select church_id into grp_church_id from public.groups where id = new.group_id;
  select church_id into fam_church_id from public.families where id = new.family_id;

  if grp_church_id is null or fam_church_id is null then
    raise exception 'Group and Family must exist with valid church assignment';
  end if;

  if grp_church_id <> fam_church_id then
    raise exception 'Cross-church relationship rejected: Group and Family must belong to the same church';
  end if;

  new.church_id = grp_church_id;
  return new;
end;
$$;

drop trigger if exists trg_validate_route_tenant on public.routes;
create trigger trg_validate_route_tenant
  before insert or update on public.routes
  for each row execute procedure public.validate_route_tenant();


-- ─── 7. HELPER SECURITY DEFINER FUNCTIONS ─────────────────────────────────────

-- Check if current authenticated user is an active member of a church
create or replace function public.is_church_member(target_church_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.church_members cm
    where cm.church_id = target_church_id
      and cm.user_id = auth.uid()
      and cm.status = 'active'
  );
$$;

-- Check if current authenticated user is an active admin of a church
create or replace function public.is_church_admin(target_church_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.church_members cm
    where cm.church_id = target_church_id
      and cm.user_id = auth.uid()
      and cm.role = 'admin'
      and cm.status = 'active'
  );
$$;

-- Atomic helper: Create a new church and assign creator as admin
create or replace function public.create_church_with_admin(
  church_name text,
  church_slug text default null
)
returns public.churches
language plpgsql
security definer
set search_path = public
as $$
declare
  new_church public.churches;
  caller_id uuid;
begin
  caller_id := auth.uid();
  if caller_id is null then
    raise exception 'Authentication required to create a church';
  end if;

  if coalesce(trim(church_name), '') = '' then
    raise exception 'Church name cannot be empty';
  end if;

  insert into public.churches (name, slug, created_by)
  values (trim(church_name), nullif(trim(church_slug), ''), caller_id)
  returning * into new_church;

  insert into public.church_members (church_id, user_id, role, status)
  values (new_church.id, caller_id, 'admin', 'active')
  on conflict (church_id, user_id) do update set role = 'admin', status = 'active';

  return new_church;
end;
$$;

-- Securely validate a church invite token (returns safe church info without secrets)
create or replace function public.validate_church_invite(invite_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_hash text;
  v_invite public.church_invites;
  v_church public.churches;
begin
  if coalesce(trim(invite_token), '') = '' then
    return jsonb_build_object('valid', false, 'error', 'Invitation token cannot be empty');
  end if;

  v_hash := encode(digest(trim(invite_token), 'sha256'), 'hex');

  select * into v_invite
  from public.church_invites
  where token_hash = v_hash;

  if v_invite is null then
    return jsonb_build_object('valid', false, 'error', 'This invitation link is not valid');
  end if;

  if not v_invite.is_active then
    return jsonb_build_object('valid', false, 'error', 'This invitation link is no longer active');
  end if;

  if v_invite.expires_at is not null and v_invite.expires_at < now() then
    return jsonb_build_object('valid', false, 'error', 'This invitation link has expired');
  end if;

  if v_invite.max_uses is not null and v_invite.use_count >= v_invite.max_uses then
    return jsonb_build_object('valid', false, 'error', 'This invitation link has reached its usage limit');
  end if;

  select * into v_church from public.churches where id = v_invite.church_id;
  if v_church is null then
    return jsonb_build_object('valid', false, 'error', 'Church not found');
  end if;

  return jsonb_build_object(
    'valid', true,
    'church_id', v_church.id,
    'church_name', v_church.name,
    'role', v_invite.role
  );
end;
$$;

-- Securely accept a church invite token for the calling authenticated user
create or replace function public.accept_church_invite(invite_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_hash text;
  v_invite public.church_invites;
  v_church public.churches;
  v_user_id uuid;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    return jsonb_build_object('success', false, 'error', 'Authentication required to join church');
  end if;

  if coalesce(trim(invite_token), '') = '' then
    return jsonb_build_object('success', false, 'error', 'Invitation token cannot be empty');
  end if;

  v_hash := encode(digest(trim(invite_token), 'sha256'), 'hex');

  select * into v_invite
  from public.church_invites
  where token_hash = v_hash;

  if v_invite is null then
    return jsonb_build_object('success', false, 'error', 'This invitation link is not valid');
  end if;

  if not v_invite.is_active then
    return jsonb_build_object('success', false, 'error', 'This invitation link is no longer active');
  end if;

  if v_invite.expires_at is not null and v_invite.expires_at < now() then
    return jsonb_build_object('success', false, 'error', 'This invitation link has expired');
  end if;

  if v_invite.max_uses is not null and v_invite.use_count >= v_invite.max_uses then
    return jsonb_build_object('success', false, 'error', 'This invitation link has reached its usage limit');
  end if;

  select * into v_church from public.churches where id = v_invite.church_id;
  if v_church is null then
    return jsonb_build_object('success', false, 'error', 'Associated church not found');
  end if;

  -- Add to church_members (safe default role: invite.role or team_member)
  insert into public.church_members (church_id, user_id, role, status)
  values (v_invite.church_id, v_user_id, coalesce(v_invite.role, 'team_member'), 'active')
  on conflict (church_id, user_id)
  do update set status = 'active';

  -- Increment use count
  update public.church_invites
  set use_count = use_count + 1
  where id = v_invite.id;

  return jsonb_build_object(
    'success', true,
    'church_id', v_church.id,
    'church_name', v_church.name,
    'role', coalesce(v_invite.role, 'team_member')
  );
end;
$$;


-- ─── 8. INDEXES ───────────────────────────────────────────────────────────────
create index if not exists idx_church_members_user_id   on public.church_members(user_id);
create index if not exists idx_church_members_church_id on public.church_members(church_id);
create index if not exists idx_church_invites_hash      on public.church_invites(token_hash);
create index if not exists idx_church_invites_church    on public.church_invites(church_id);
create index if not exists idx_families_church_id       on public.families(church_id);
create index if not exists idx_groups_church_id         on public.groups(church_id);
create index if not exists idx_songs_church_id          on public.songs(church_id);
create index if not exists idx_routes_church_id         on public.routes(church_id);
create index if not exists idx_routes_group_id          on public.routes(group_id);


-- ─── 9. ROW LEVEL SECURITY (RLS) HARDENING ───────────────────────────────────

-- Enable RLS on all tables
alter table public.churches       enable row level security;
alter table public.church_members  enable row level security;
alter table public.church_invites  enable row level security;
alter table public.families       enable row level security;
alter table public.family_members enable row level security;
alter table public.groups         enable row level security;
alter table public.routes         enable row level security;
alter table public.songs          enable row level security;

-- Drop obsolete / insecure open policies
drop policy if exists "Allow all on families"       on public.families;
drop policy if exists "Allow all on family_members" on public.family_members;
drop policy if exists "Allow all on groups"         on public.groups;
drop policy if exists "Allow all on routes"         on public.routes;
drop policy if exists "Allow all on songs"          on public.songs;

-- Drop existing church-related policies if re-running
drop policy if exists "Church members can view their church"   on public.churches;
drop policy if exists "Authenticated users can create church"  on public.churches;
drop policy if exists "Admins can update their church"         on public.churches;
drop policy if exists "Admins can delete their church"         on public.churches;

drop policy if exists "Members can view church membership"     on public.church_members;
drop policy if exists "Admins can manage church members"       on public.church_members;
drop policy if exists "Users can leave church"                 on public.church_members;

drop policy if exists "Admins can manage church invites"       on public.church_invites;

drop policy if exists "Members can view church families"       on public.families;
drop policy if exists "Members can add church families"        on public.families;
drop policy if exists "Members can edit church families"       on public.families;
drop policy if exists "Admins can delete church families"      on public.families;

drop policy if exists "Members can view family members"        on public.family_members;
drop policy if exists "Members can add family members"         on public.family_members;
drop policy if exists "Members can edit family members"        on public.family_members;
drop policy if exists "Members can delete family members"      on public.family_members;

drop policy if exists "Members can view church groups"         on public.groups;
drop policy if exists "Public can view active group for live"  on public.groups;
drop policy if exists "Admins and drivers can update groups"   on public.groups;
drop policy if exists "Admins can insert groups"               on public.groups;
drop policy if exists "Admins can delete groups"               on public.groups;

drop policy if exists "Members can view church routes"         on public.routes;
drop policy if exists "Admins can manage church routes"        on public.routes;
drop policy if exists "Members can update stop status"         on public.routes;

drop policy if exists "Members can view church songs"          on public.songs;
drop policy if exists "Admins can manage church songs"         on public.songs;

-- ── Policies for churches ─────────────────────────────────────────────────────
create policy "Church members can view their church"
  on public.churches for select
  to authenticated
  using (public.is_church_member(id));

create policy "Authenticated users can create church"
  on public.churches for insert
  to authenticated
  with check (auth.uid() is not null);

create policy "Admins can update their church"
  on public.churches for update
  to authenticated
  using (public.is_church_admin(id))
  with check (public.is_church_admin(id));

create policy "Admins can delete their church"
  on public.churches for delete
  to authenticated
  using (public.is_church_admin(id));

-- ── Policies for church_members ───────────────────────────────────────────────
create policy "Members can view church membership"
  on public.church_members for select
  to authenticated
  using (public.is_church_member(church_id) or user_id = auth.uid());

create policy "Admins can manage church members"
  on public.church_members for all
  to authenticated
  using (public.is_church_admin(church_id))
  with check (public.is_church_admin(church_id));

create policy "Users can leave church"
  on public.church_members for delete
  to authenticated
  using (user_id = auth.uid());

-- ── Policies for church_invites ───────────────────────────────────────────────
create policy "Admins can manage church invites"
  on public.church_invites for all
  to authenticated
  using (public.is_church_admin(church_id))
  with check (public.is_church_admin(church_id));

-- ── Policies for families ─────────────────────────────────────────────────────
create policy "Members can view church families"
  on public.families for select
  to authenticated
  using (public.is_church_member(church_id));

create policy "Members can add church families"
  on public.families for insert
  to authenticated
  with check (public.is_church_member(church_id));

create policy "Members can edit church families"
  on public.families for update
  to authenticated
  using (public.is_church_member(church_id))
  with check (public.is_church_member(church_id));

create policy "Admins can delete church families"
  on public.families for delete
  to authenticated
  using (public.is_church_admin(church_id));

-- ── Policies for family_members ───────────────────────────────────────────────
create policy "Members can view family members"
  on public.family_members for select
  to authenticated
  using (
    exists (
      select 1 from public.families f
      where f.id = family_members.family_id
        and public.is_church_member(f.church_id)
    )
  );

create policy "Members can add family members"
  on public.family_members for insert
  to authenticated
  with check (
    exists (
      select 1 from public.families f
      where f.id = family_members.family_id
        and public.is_church_member(f.church_id)
    )
  );

create policy "Members can edit family members"
  on public.family_members for update
  to authenticated
  using (
    exists (
      select 1 from public.families f
      where f.id = family_members.family_id
        and public.is_church_member(f.church_id)
    )
  );

create policy "Members can delete family members"
  on public.family_members for delete
  to authenticated
  using (
    exists (
      select 1 from public.families f
      where f.id = family_members.family_id
        and public.is_church_member(f.church_id)
    )
  );

-- ── Policies for groups ───────────────────────────────────────────────────────
create policy "Members can view church groups"
  on public.groups for select
  to authenticated
  using (public.is_church_member(church_id));

-- Allow public read of active group by ID or slug for the live tracking page
create policy "Public can view active group for live"
  on public.groups for select
  to anon
  using (is_active = true);

create policy "Admins can insert groups"
  on public.groups for insert
  to authenticated
  with check (public.is_church_admin(church_id));

create policy "Admins and drivers can update groups"
  on public.groups for update
  to authenticated
  using (public.is_church_member(church_id))
  with check (public.is_church_member(church_id));

create policy "Admins can delete groups"
  on public.groups for delete
  to authenticated
  using (public.is_church_admin(church_id));

-- ── Policies for routes ───────────────────────────────────────────────────────
create policy "Members can view church routes"
  on public.routes for select
  to authenticated
  using (public.is_church_member(church_id));

create policy "Admins can manage church routes"
  on public.routes for all
  to authenticated
  using (public.is_church_admin(church_id))
  with check (public.is_church_admin(church_id));

create policy "Members can update stop status"
  on public.routes for update
  to authenticated
  using (public.is_church_member(church_id))
  with check (public.is_church_member(church_id));

-- ── Policies for songs ────────────────────────────────────────────────────────
create policy "Members can view church songs"
  on public.songs for select
  to authenticated
  using (public.is_church_member(church_id));

create policy "Admins can manage church songs"
  on public.songs for all
  to authenticated
  using (public.is_church_admin(church_id))
  with check (public.is_church_admin(church_id));
