-- ============================================================
-- Migration: Role Simplification — Remove Driver Role
-- Date: 2026-11-21
-- Purpose: Simplify Let's Carol from 3 roles to 2 roles.
--          admin and team_member are the only valid roles.
--          GPS is an operational capability, not a user role.
-- ============================================================
-- REVIEW BEFORE EXECUTION: This migration modifies constraints
-- and RLS policies. Run in a transaction for safety.
-- ============================================================

BEGIN;

-- ── Step 1: Migrate driver members → team_member ─────────────────────────────
-- Existing driver memberships become team_member so users retain access.
UPDATE public.church_members
  SET role = 'team_member',
      updated_at = now()
  WHERE role = 'driver';

-- ── Step 2: Migrate driver invitations → team_member ─────────────────────────
-- Outstanding invitations with role='driver' are converted to team_member.
-- This is safe because team_member has the same operational access.
UPDATE public.church_invites
  SET role = 'team_member'
  WHERE role = 'driver';

-- ── Step 3: Update church_members role constraint ─────────────────────────────
ALTER TABLE public.church_members
  DROP CONSTRAINT IF EXISTS church_members_role_check;

ALTER TABLE public.church_members
  ADD CONSTRAINT church_members_role_check
  CHECK (role IN ('admin', 'team_member'));

-- ── Step 4: Update church_invites role constraint ─────────────────────────────
ALTER TABLE public.church_invites
  DROP CONSTRAINT IF EXISTS church_invites_role_check;

ALTER TABLE public.church_invites
  ADD CONSTRAINT church_invites_role_check
  CHECK (role IN ('admin', 'team_member'));

-- ── Step 5: Restrict family creation to admin only (CRITICAL) ─────────────────
-- This is the core permission boundary of the two-role model.
-- Team members CAN view/edit families but CANNOT create new ones.

DROP POLICY IF EXISTS "Members can add church families" ON public.families;
DROP POLICY IF EXISTS "Admins can add church families" ON public.families;

CREATE POLICY "Admins can add church families"
  ON public.families
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_church_admin(church_id));

-- Ensure team members can still view and edit families
-- (These policies should already exist but are documented here for clarity)
-- DROP POLICY IF EXISTS "Members can view church families" ON public.families;
-- CREATE POLICY "Members can view church families"
--   ON public.families FOR SELECT TO authenticated
--   USING (public.is_church_member(church_id));

-- ── Step 6: Update GPS/group update policy ────────────────────────────────────
-- GPS sharing is now an operational capability for all active members.
-- Both admin and team_member can update GPS location fields on groups.

DROP POLICY IF EXISTS "Admins and drivers can update groups" ON public.groups;
DROP POLICY IF EXISTS "Members can update groups" ON public.groups;

CREATE POLICY "Members can update groups"
  ON public.groups
  FOR UPDATE
  TO authenticated
  USING (public.is_church_member(church_id))
  WITH CHECK (public.is_church_member(church_id));

-- ── Step 7: Update check_group_update_permissions trigger ─────────────────────
-- The trigger previously restricted GPS updates to admins/drivers only.
-- Now all active members can update GPS location fields.
-- Only admin can update group configuration (name, vehicle, etc.)

CREATE OR REPLACE FUNCTION public.check_group_update_permissions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_role TEXT;
  v_location_only_change BOOLEAN;
  LOCATION_FIELDS TEXT[] := ARRAY[
    'current_latitude', 'current_longitude', 'current_speed',
    'current_direction', 'last_location_update'
  ];
BEGIN
  -- Get calling user's role in this church
  SELECT role INTO v_user_role
    FROM public.church_members
    WHERE church_id = NEW.church_id
      AND user_id = auth.uid()
      AND status = 'active'
    LIMIT 1;

  IF v_user_role IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: Not an active church member';
  END IF;

  -- Admin can update anything
  IF v_user_role = 'admin' THEN
    RETURN NEW;
  END IF;

  -- Team member: may only update GPS location fields
  IF v_user_role = 'team_member' THEN
    -- Check if any non-location field changed
    IF (OLD.name IS DISTINCT FROM NEW.name) OR
       (OLD.vehicle_number IS DISTINCT FROM NEW.vehicle_number) OR
       (OLD.is_active IS DISTINCT FROM NEW.is_active) OR
       (OLD.is_public IS DISTINCT FROM NEW.is_public) THEN
      RAISE EXCEPTION 'Unauthorized: Only administrators can modify group configuration';
    END IF;
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Unauthorized: Unknown role';
END;
$$;

-- ── Step 8: Drop the is_church_admin_or_driver helper function ─────────────────
-- This function is no longer needed with the two-role model.
-- Callers should use is_church_admin() or is_church_member() instead.
DROP FUNCTION IF EXISTS public.is_church_admin_or_driver(uuid);

COMMIT;

-- ============================================================
-- ROLLBACK PLAN (if needed):
-- BEGIN;
-- UPDATE public.church_members SET role = 'driver' WHERE ...  -- manual restore
-- ALTER TABLE public.church_members DROP CONSTRAINT church_members_role_check;
-- ALTER TABLE public.church_members ADD CONSTRAINT church_members_role_check
--   CHECK (role IN ('admin', 'team_member', 'driver'));
-- -- Restore old policies similarly
-- COMMIT;
-- ============================================================
