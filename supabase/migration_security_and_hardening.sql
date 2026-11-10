-- ============================================================
-- Let's Carol — Security Audit, RLS Hardening & Atomic Church Creation Migration
-- ============================================================

-- ─── 1. GROUPS PUBLIC VISIBILITY FIELD & INDEX ────────────────────────────────

alter table public.groups
  add column if not exists is_public boolean not null default true;

create index if not exists idx_groups_church_visibility
  on public.groups(church_id, is_active, is_public);


-- ─── 2. GROUPS PUBLIC RLS HARDENING ──────────────────────────────────────────

-- Update anon select policy: active AND explicitly public
drop policy if exists "Public can view active group for live" on public.groups;
create policy "Public can view active group for live"
  on public.groups for select
  to anon
  using (is_active = true and is_public = true);


-- ─── 3. DRIVER AND ADMIN LOCATION UPDATE PERMISSIONS ─────────────────────────

-- Helper function: checks if user is active admin or driver of the church
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

-- Replace overly broad is_church_member check with is_church_admin_or_driver
drop policy if exists "Admins and drivers can update groups" on public.groups;
create policy "Admins and drivers can update groups"
  on public.groups for update
  to authenticated
  using (public.is_church_admin_or_driver(church_id))
  with check (public.is_church_admin_or_driver(church_id));

-- Trigger enforcing drivers can ONLY update live location fields
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


-- ─── 4. ATOMIC CHURCH CREATION RPC ───────────────────────────────────────────

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

    -- Check slug uniqueness in active churches
    if exists (select 1 from public.churches where lower(slug) = v_slug) then
      raise exception 'Church URL "%" is already in use by another church', v_slug;
    end if;

    -- Check slug uniqueness in slug history
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


-- ─── 5. SECURE PUBLIC LIVE DATA RPC (NO OVER-EXPOSURE) ───────────────────────

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


-- ─── 6. SECURE PUBLIC LIVE SONGS RPC ─────────────────────────────────────────

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

