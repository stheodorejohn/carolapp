-- ============================================================
-- Let's Carol — Supabase Complete Multi-Church Schema
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- ─── Enable UUID / Crypto extension ──────────────────────────────────────────
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
  phone       text,
  avatar_url  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at
  before update on public.profiles
  for each row execute procedure public.set_updated_at();

-- Auto-sync trigger function: fires when a user signs up via Supabase Auth
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', '')
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


-- ─── CHURCHES ─────────────────────────────────────────────────────────────────
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

-- Case-insensitive unique index on churches.slug
create unique index if not exists idx_churches_slug_unique on public.churches (lower(slug));

drop trigger if exists churches_updated_at on public.churches;
create trigger churches_updated_at
  before update on public.churches
  for each row execute procedure public.set_updated_at();

-- ─── CHURCH SLUG HISTORY (For URL redirects on slug change) ────────────────────
create table if not exists public.church_slug_history (
  id          uuid primary key default gen_random_uuid(),
  church_id   uuid not null references public.churches(id) on delete cascade,
  slug        text not null,
  created_at  timestamptz not null default now()
);

create index if not exists idx_church_slug_history_slug
  on public.church_slug_history(lower(slug));


-- ─── CHURCH MEMBERS ───────────────────────────────────────────────────────────
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

drop trigger if exists church_members_updated_at on public.church_members;
create trigger church_members_updated_at
  before update on public.church_members
  for each row execute procedure public.set_updated_at();


-- ─── CHURCH INVITES ───────────────────────────────────────────────────────────
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


-- ─── FAMILIES ─────────────────────────────────────────────────────────────────
create table if not exists public.families (
  id          uuid primary key default gen_random_uuid(),
  church_id   uuid references public.churches(id) on delete cascade,
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

drop trigger if exists families_updated_at on public.families;
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


-- ─── GROUPS ───────────────────────────────────────────────────────────────────
create table if not exists public.groups (
  id                    uuid primary key default gen_random_uuid(),
  church_id             uuid references public.churches(id) on delete cascade,
  name                  text not null,
  leader_id             uuid,
  vehicle_number        text,
  slug                  text unique,
  is_active             boolean not null default true,
  is_public             boolean not null default true,
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
  church_id     uuid references public.churches(id) on delete cascade,
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

drop trigger if exists routes_updated_at on public.routes;
create trigger routes_updated_at
  before update on public.routes
  for each row execute procedure public.set_updated_at();

-- Route tenant consistency check trigger
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
    raise exception 'Group and Family must have valid church assignment';
  end if;

  if grp_church_id <> fam_church_id then
    raise exception 'Cross-church relationship rejected: Group and Family must belong to same church';
  end if;

  new.church_id = grp_church_id;
  return new;
end;
$$;

drop trigger if exists trg_validate_route_tenant on public.routes;
create trigger trg_validate_route_tenant
  before insert or update on public.routes
  for each row execute procedure public.validate_route_tenant();


-- ─── SONGS ────────────────────────────────────────────────────────────────────
create table if not exists public.songs (
  id          uuid primary key default gen_random_uuid(),
  church_id   uuid references public.churches(id) on delete cascade,
  title       text not null,
  artist      text,
  lyrics      text,
  youtube_url text,
  category    text,
  order_index integer not null default 0,
  is_hidden   boolean not null default false,
  is_public   boolean not null default true,
  updated_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_songs_church_visibility
  on public.songs(church_id, is_hidden, is_public);

drop trigger if exists songs_updated_at on public.songs;
create trigger songs_updated_at
  before update on public.songs
  for each row execute procedure public.set_updated_at();


-- ─── HELPER SECURITY DEFINER FUNCTIONS ─────────────────────────────────────
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

create or replace function public.is_church_admin_or_driver(target_church_id uuid)
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
      and cm.role in ('admin', 'driver')
      and cm.status = 'active'
  );
$$;

create or replace function public.check_group_update_permissions()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Admins can update all group configuration fields
  if public.is_church_admin(new.church_id) then
    return new;
  end if;

  -- Non-admin drivers are restricted: cannot modify structural group configuration
  if (
    new.name <> old.name or
    new.church_id <> old.church_id or
    new.vehicle_number is distinct from old.vehicle_number or
    new.slug is distinct from old.slug or
    new.leader_id is distinct from old.leader_id or
    new.is_active <> old.is_active or
    new.is_public <> old.is_public
  ) then
    raise exception 'Unauthorized: Only church administrators can modify group configuration or details.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_check_group_update on public.groups;
create trigger trg_check_group_update
  before update on public.groups
  for each row execute procedure public.check_group_update_permissions();

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
  v_slug text;
begin
  caller_id := auth.uid();
  if caller_id is null then
    raise exception 'Authentication required to create a church';
  end if;

  if coalesce(trim(church_name), '') = '' then
    raise exception 'Church name cannot be empty';
  end if;

  -- Validate and normalize slug if provided
  if church_slug is not null and trim(church_slug) <> '' then
    v_slug := lower(trim(church_slug));

    if length(v_slug) < 3 then
      raise exception 'Church URL must be at least 3 characters';
    end if;

    if length(v_slug) > 30 then
      raise exception 'Church URL cannot exceed 30 characters';
    end if;

    if exists (select 1 from public.churches where lower(slug) = v_slug) then
      raise exception 'Church URL "%" is already in use by another church', v_slug;
    end if;

    if exists (select 1 from public.church_slug_history where lower(slug) = v_slug) then
      raise exception 'Church URL "%" was previously used and is reserved', v_slug;
    end if;
  else
    v_slug := null;
  end if;

  -- Atomic transaction: create church record
  insert into public.churches (name, slug, created_by)
  values (trim(church_name), v_slug, caller_id)
  returning * into new_church;

  -- Atomic transaction: create admin membership
  insert into public.church_members (church_id, user_id, role, status)
  values (new_church.id, caller_id, 'admin', 'active')
  on conflict (church_id, user_id)
  do update set role = 'admin', status = 'active';

  return new_church;
end;
$$;

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

  insert into public.church_members (church_id, user_id, role, status)
  values (v_invite.church_id, v_user_id, coalesce(v_invite.role, 'team_member'), 'active')
  on conflict (church_id, user_id)
  do update set status = 'active';

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


-- ─── INDEXES ──────────────────────────────────────────────────────────────────
create index if not exists idx_church_members_user_id   on public.church_members(user_id);
create index if not exists idx_church_members_church_id on public.church_members(church_id);
create index if not exists idx_church_invites_hash      on public.church_invites(token_hash);
create index if not exists idx_church_invites_church    on public.church_invites(church_id);
create index if not exists idx_families_church_id       on public.families(church_id);
create index if not exists idx_groups_church_id         on public.groups(church_id);
create index if not exists idx_groups_church_visibility on public.groups(church_id, is_active, is_public);
create index if not exists idx_songs_church_id          on public.songs(church_id);
create index if not exists idx_routes_church_id         on public.routes(church_id);
create index if not exists idx_routes_group_id          on public.routes(group_id);


-- ─── ROW LEVEL SECURITY (RLS) ─────────────────────────────────────────────────
alter table public.profiles       enable row level security;
alter table public.churches       enable row level security;
alter table public.church_members  enable row level security;
alter table public.church_invites  enable row level security;
alter table public.families       enable row level security;
alter table public.family_members enable row level security;
alter table public.groups         enable row level security;
alter table public.routes         enable row level security;
alter table public.songs          enable row level security;

-- Profiles
create policy "Allow read on profiles for authenticated users"
  on public.profiles for select to authenticated using (true);

create policy "Allow users to update own profile"
  on public.profiles for update to authenticated using (auth.uid() = id);

-- Churches
create policy "Church members can view their church"
  on public.churches for select to authenticated using (public.is_church_member(id));

create policy "Authenticated users can create church"
  on public.churches for insert to authenticated with check (auth.uid() is not null);

create policy "Admins can update their church"
  on public.churches for update to authenticated using (public.is_church_admin(id)) with check (public.is_church_admin(id));

create policy "Admins can delete their church"
  on public.churches for delete to authenticated using (public.is_church_admin(id));

-- Church Members
create policy "Members can view church membership"
  on public.church_members for select to authenticated using (public.is_church_member(church_id) or user_id = auth.uid());

create policy "Admins can manage church members"
  on public.church_members for all to authenticated using (public.is_church_admin(church_id)) with check (public.is_church_admin(church_id));

create policy "Users can leave church"
  on public.church_members for delete to authenticated using (user_id = auth.uid());

-- Church Invites
create policy "Admins can manage church invites"
  on public.church_invites for all to authenticated using (public.is_church_admin(church_id)) with check (public.is_church_admin(church_id));

-- Families
create policy "Members can view church families"
  on public.families for select to authenticated using (public.is_church_member(church_id));

create policy "Members can add church families"
  on public.families for insert to authenticated with check (public.is_church_member(church_id));

create policy "Members can edit church families"
  on public.families for update to authenticated using (public.is_church_member(church_id)) with check (public.is_church_member(church_id));

create policy "Admins can delete church families"
  on public.families for delete to authenticated using (public.is_church_admin(church_id));

-- Family Members
create policy "Members can view family members"
  on public.family_members for select to authenticated using (
    exists (select 1 from public.families f where f.id = family_members.family_id and public.is_church_member(f.church_id))
  );

create policy "Members can add family members"
  on public.family_members for insert to authenticated with check (
    exists (select 1 from public.families f where f.id = family_members.family_id and public.is_church_member(f.church_id))
  );

create policy "Members can edit family members"
  on public.family_members for update to authenticated using (
    exists (select 1 from public.families f where f.id = family_members.family_id and public.is_church_member(f.church_id))
  );

create policy "Members can delete family members"
  on public.family_members for delete to authenticated using (
    exists (select 1 from public.families f where f.id = family_members.family_id and public.is_church_member(f.church_id))
  );

-- Groups
create policy "Members can view church groups"
  on public.groups for select to authenticated using (public.is_church_member(church_id));

create policy "Public can view active group for live"
  on public.groups for select to anon using (is_active = true and is_public = true);

create policy "Admins can insert groups"
  on public.groups for insert to authenticated with check (public.is_church_admin(church_id));

create policy "Admins and drivers can update groups"
  on public.groups for update to authenticated using (public.is_church_admin_or_driver(church_id)) with check (public.is_church_admin_or_driver(church_id));

create policy "Admins can delete groups"
  on public.groups for delete to authenticated using (public.is_church_admin(church_id));

-- Routes
create policy "Members can view church routes"
  on public.routes for select to authenticated using (public.is_church_member(church_id));

create policy "Admins can manage church routes"
  on public.routes for all to authenticated using (public.is_church_admin(church_id)) with check (public.is_church_admin(church_id));

create policy "Members can update stop status"
  on public.routes for update to authenticated using (public.is_church_member(church_id)) with check (public.is_church_member(church_id));

-- Songs
drop policy if exists "Members can view church songs" on public.songs;
create policy "Members can view active church songs"
  on public.songs for select to authenticated
  using (
    public.is_church_member(church_id) and (
      is_hidden = false or public.is_church_admin(church_id)
    )
  );

create policy "Admins can manage church songs"
  on public.songs for all to authenticated
  using (public.is_church_admin(church_id))
  with check (public.is_church_admin(church_id));

create policy "Public can view active public songs for live"
  on public.songs for select to anon
  using (is_hidden = false and is_public = true);

-- Public church slug resolution
drop policy if exists "Public can resolve church slug" on public.churches;
create policy "Public can resolve church slug"
  on public.churches for select to anon, authenticated
  using (slug is not null);


-- ─── PUBLIC LIVE SECURE RPCS ──────────────────────────────────────────────────

create or replace function public.get_public_live_data(
  p_church_slug text,
  p_group_slug text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_church record;
  v_group record;
  v_routes jsonb;
  v_clean_cslug text;
  v_clean_gslug text;
begin
  v_clean_cslug := lower(trim(p_church_slug));
  v_clean_gslug := lower(trim(p_group_slug));

  if v_clean_cslug is null or v_clean_cslug = '' or v_clean_gslug is null or v_clean_gslug = '' then
    return jsonb_build_object('valid', false, 'error', 'This live tracking link is unavailable.');
  end if;

  -- 1. Resolve church (canonical or historical redirect)
  select c.id, c.name, c.slug into v_church
  from public.churches c
  where lower(c.slug) = v_clean_cslug
  limit 1;

  if v_church.id is null then
    select c.id, c.name, c.slug into v_church
    from public.church_slug_history h
    join public.churches c on c.id = h.church_id
    where lower(h.slug) = v_clean_cslug
    order by h.created_at desc
    limit 1;
  end if;

  if v_church.id is null then
    return jsonb_build_object('valid', false, 'error', 'This live tracking link is unavailable.');
  end if;

  -- 2. Resolve group belonging to THIS church strictly
  select
    g.id,
    g.church_id,
    g.name,
    g.vehicle_number,
    g.current_latitude,
    g.current_longitude,
    g.current_speed,
    g.current_direction,
    g.last_location_update,
    g.is_active
  into v_group
  from public.groups g
  where g.church_id = v_church.id
    and (lower(coalesce(g.slug, '')) = v_clean_gslug or g.id::text = v_clean_gslug)
    and g.is_active = true
    and g.is_public = true
  limit 1;

  if v_group.id is null then
    return jsonb_build_object('valid', false, 'error', 'This live tracking link is unavailable.');
  end if;

  -- 3. Fetch routes with safe projection (NO notes, NO phone numbers)
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', r.id,
        'group_id', r.group_id,
        'status', r.status,
        'eta', r.eta,
        'order_index', r.order_index,
        'family', jsonb_build_object(
          'id', f.id,
          'name', f.name,
          'address', f.address
        )
      ) order by r.order_index asc
    ),
    '[]'::jsonb
  ) into v_routes
  from public.routes r
  join public.families f on f.id = r.family_id
  where r.group_id = v_group.id;

  return jsonb_build_object(
    'valid', true,
    'church', jsonb_build_object(
      'id', v_church.id,
      'name', v_church.name,
      'slug', v_church.slug
    ),
    'group', jsonb_build_object(
      'id', v_group.id,
      'church_id', v_group.church_id,
      'church_name', v_church.name,
      'name', v_group.name,
      'vehicle_number', v_group.vehicle_number,
      'current_latitude', v_group.current_latitude,
      'current_longitude', v_group.current_longitude,
      'current_speed', v_group.current_speed,
      'current_direction', v_group.current_direction,
      'last_location_update', v_group.last_location_update,
      'is_active', v_group.is_active
    ),
    'routes', v_routes
  );
end;
$$;

create or replace function public.get_public_live_songs(
  p_church_slug text
)
returns table (
  id uuid,
  title text,
  artist text,
  lyrics text,
  category text,
  order_index integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_church_id uuid;
  v_clean_cslug text;
begin
  v_clean_cslug := lower(trim(p_church_slug));
  if v_clean_cslug is null or v_clean_cslug = '' then
    return;
  end if;

  select c.id into v_church_id
  from public.churches c
  where lower(c.slug) = v_clean_cslug
  limit 1;

  if v_church_id is null then
    select h.church_id into v_church_id
    from public.church_slug_history h
    where lower(h.slug) = v_clean_cslug
    order by h.created_at desc
    limit 1;
  end if;

  if v_church_id is null then
    return;
  end if;

  return query
  select
    s.id,
    s.title,
    s.artist,
    s.lyrics,
    s.category,
    s.order_index
  from public.songs s
  where s.church_id = v_church_id
    and s.is_hidden = false
    and s.is_public = true
  order by s.order_index asc, s.title asc;
end;
$$;


-- ─── REALTIME ─────────────────────────────────────────────────────────────────
-- Groups published to realtime for live location tracking
alter publication supabase_realtime add table public.groups;
