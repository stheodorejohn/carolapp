# MODEL_INSTRUCTIONS.md — Universal AI Continuation Guide

> These instructions work with any AI coding model: Claude Code, OpenAI Codex,
> ChatGPT, Gemini, or any repository-aware agent.
> Last updated: 2026-11-21

---

## What This Project Is

**Let's Carol** is a church carol-event management PWA.  
Technology: Next.js 16 (App Router) + React 19 + TypeScript + Supabase + Tailwind v4.  
Repository: `d:\Theo\git\caroltracker` — single branch: `main`.

---

## What This Task Is

Simplify the application role model from **three roles** (admin/team_member/driver) to **two roles** (admin/team_member).

The only permission difference between the two new roles:
- **admin** can create new families
- **team_member** cannot create new families
- Both can do everything else including GPS sharing

---

## How to Start a New Session

**Always do this in order before writing any code:**

```bash
# 1. Navigate to the project
cd d:\Theo\git\caroltracker   # Windows/PowerShell
# or
cd /d/Theo/git/caroltracker   # Git Bash

# 2. Check git state
git status
git log --oneline -5

# 3. Read the handover
# Read: project-management/ai-continuity/HANDOVER.md
# Read: project-management/ai-continuity/CURRENT_STATUS.md
# Read: project-management/ai-continuity/TASK_TRACKER.md

# 4. Verify baseline (must pass before any changes)
node src/test-security.mjs
npx tsc --noEmit
```

---

## Repository Structure

```
caroltracker/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── [churchSlug]/       # Multi-tenant church-scoped routes
│   │   ├── api/                # API route handlers
│   │   │   └── invites/        # Invitation management
│   │   ├── families/           # Family management pages
│   │   ├── location/           # GPS sharing page
│   │   ├── songs/              # Song management pages
│   │   └── ...
│   ├── components/
│   │   ├── auth/               # AuthGuard, RoleSwitcherModal
│   │   └── navigation/         # BottomNav, NavWrapper
│   ├── hooks/                  # useGeolocation
│   ├── lib/
│   │   ├── auth-context.tsx    # Main auth/role context (KEY FILE)
│   │   └── supabase.ts         # Supabase client
│   └── types/
│       └── database.ts         # TypeScript types (KEY FILE)
├── supabase/
│   ├── schema.sql              # Base schema
│   ├── migration_*.sql         # Incremental migrations
│   └── migration_role_simplification.sql  # CREATE THIS (Phase 7)
└── project-management/
    └── ai-continuity/          # These files
```

---

## Implementation Phases

Work through these in order. Do not skip phases.

### Phase 2 — TypeScript Types (`src/types/database.ts`)

Change:
```typescript
// BEFORE
export type AppRole = 'admin' | 'team_member' | 'driver';
export type ChurchRole = 'admin' | 'team_member' | 'driver';

// AFTER
export type AppRole = 'admin' | 'team_member';
export type ChurchRole = 'admin' | 'team_member';
```

After this change, run `npx tsc --noEmit` to find all type errors to fix.

---

### Phase 3 — Auth Context (`src/lib/auth-context.tsx`)

Key changes:
1. Remove `STORAGE_KEY_ACTIVE_ROLE` constant
2. Remove `resolveActiveRole()` function
3. Simplify `deriveAuthorizedRoles()` — no longer needed if we eliminate role switching
4. Remove `switchRole` from context interface and implementation
5. Remove `activeRole` from `AuthUser` interface (or simplify: `activeRole = churchRole`)
6. Remove `authorizedRoles` array (or simplify: just `['admin']` or `['team_member']`)

Simple replacement for `isAdmin` checks in components:
```typescript
const { churchMembership } = useAuth();
const isAdmin = churchMembership?.role === 'admin';
```

---

### Phase 4 — Components

**BottomNav** (`src/components/navigation/BottomNav.tsx`):
- Remove `switch (role)` with driver case
- Use a single nav set for all authenticated users:
  - Today (`/home`)
  - Families (`/families`)
  - Route (`/route`)
  - Songs (`/songs`)
  - More (`/admin/dashboard`)
- If needed, Admin can see an extra "Settings" or admin indicator, but the core nav is the same

**RoleSwitcherModal** (`src/components/auth/RoleSwitcherModal.tsx`):
- Remove `driver` from `ROLE_METAS`
- Remove the switching mechanism entirely
- Replace with a simple user identity display (name + role badge)
- Or delete the file and remove its import from wherever it's used

---

### Phase 5 — GPS Permission (`src/app/location/page.tsx` and `src/app/[churchSlug]/location/page.tsx`)

Change:
```typescript
// BEFORE
const isAuthorizedToBroadcast = authorizedRoles.includes('driver') || authorizedRoles.includes('admin');

// AFTER
const isAuthorizedToBroadcast = hasChurch; // any active church member
// OR
const isAuthorizedToBroadcast = !!churchMembership; // explicit null check
```

Remove the "Driver Authorization Required" message block.

---

### Phase 6 — Family Creation Restriction

**UI** (`src/app/families/page.tsx`):
```typescript
const { churchMembership } = useAuth();
const isAdmin = churchMembership?.role === 'admin';
// ... in JSX:
{isAdmin && <Link href="...">Add Family</Link>}
```

**API** (if a family creation API route exists): add admin check server-side.

---

### Phase 7 — Database Migration

Create file: `supabase/migration_role_simplification.sql`

The migration must:
1. Convert existing `driver` memberships to `team_member`
2. Convert existing `driver` invitations to `team_member`
3. Update the `church_members.role` CHECK constraint
4. Update the `church_invites.role` CHECK constraint
5. Update `families INSERT` RLS: `is_church_member` → `is_church_admin`
6. Update `groups UPDATE` RLS: `is_church_admin_or_driver` → `is_church_member`
7. Update the `check_group_update_permissions` trigger to use `is_church_member` logic
8. Drop or replace `is_church_admin_or_driver` function

**TEMPLATE:**
```sql
-- migration_role_simplification.sql
-- Purpose: Remove driver role, simplify to admin/team_member

BEGIN;

-- Step 1: Migrate existing driver members to team_member
UPDATE public.church_members
  SET role = 'team_member', updated_at = now()
  WHERE role = 'driver';

-- Step 2: Migrate outstanding driver invites to team_member
UPDATE public.church_invites
  SET role = 'team_member'
  WHERE role = 'driver';

-- Step 3: Update church_members role constraint
ALTER TABLE public.church_members
  DROP CONSTRAINT IF EXISTS church_members_role_check;
ALTER TABLE public.church_members
  ADD CONSTRAINT church_members_role_check
  CHECK (role IN ('admin', 'team_member'));

-- Step 4: Update church_invites role constraint
ALTER TABLE public.church_invites
  DROP CONSTRAINT IF EXISTS church_invites_role_check;
ALTER TABLE public.church_invites
  ADD CONSTRAINT church_invites_role_check
  CHECK (role IN ('admin', 'team_member'));

-- Step 5: Update families INSERT RLS (admin only can create families)
DROP POLICY IF EXISTS "Members can add church families" ON public.families;
CREATE POLICY "Admins can add church families"
  ON public.families FOR INSERT
  TO authenticated
  WITH CHECK (public.is_church_admin(church_id));

-- Step 6: Update groups UPDATE RLS (all members can update GPS)
DROP POLICY IF EXISTS "Admins and drivers can update groups" ON public.groups;
CREATE POLICY "Members can update groups"
  ON public.groups FOR UPDATE
  TO authenticated
  USING (public.is_church_member(church_id))
  WITH CHECK (public.is_church_member(church_id));

-- Step 7: Update group update trigger (admin can change config, all members can update GPS)
CREATE OR REPLACE FUNCTION public.check_group_update_permissions()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF public.is_church_admin(new.church_id) THEN
    RETURN new;
  END IF;
  -- Non-admin members: can only update live location fields
  IF (
    new.name <> old.name OR
    new.church_id <> old.church_id OR
    new.vehicle_number IS DISTINCT FROM old.vehicle_number OR
    new.slug IS DISTINCT FROM old.slug OR
    new.leader_id IS DISTINCT FROM old.leader_id OR
    new.is_active <> old.is_active OR
    new.is_public <> old.is_public
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Only church administrators can modify group configuration.';
  END IF;
  RETURN new;
END;
$$;

COMMIT;
```

> **DO NOT EXECUTE** without review and without running in a test/staging environment first.

---

### Phase 8 — Invitation API

In `src/app/api/invites/generate/route.ts`, add role validation:
```typescript
const VALID_ROLES: string[] = ['admin', 'team_member'];
const role = body.role && VALID_ROLES.includes(body.role) ? body.role : 'team_member';
```

---

### Phase 9 — Tests

Update `src/test-security.mjs`:
1. Remove all `driver` role references from `deriveAuthorizedRoles`
2. Remove Test 12 driver section or replace with team_member GPS test
3. Add tests for:
   - admin CAN create family (simulated)
   - team_member CANNOT create family (simulated)
   - both roles CAN share GPS

---

### Phase 10 — Verification

```bash
node src/test-security.mjs    # all tests pass
npx tsc --noEmit              # 0 errors
npx next build                # 0 errors
```

---

## Rules for All Models

1. Work in `d:\Theo\git\caroltracker` on branch `main`
2. Never rewrite entire components unless necessary
3. Preserve all existing functionality except the driver persona
4. Use PowerShell syntax for Windows commands (`Set-Location`, not `cd`)
5. Never commit secrets or `.env` files
6. Update TASK_TRACKER.md and CURRENT_STATUS.md after each phase
7. Write a new migration file; never modify `schema.sql` directly
8. Test before marking a task complete
