# ARCHITECTURE_DECISIONS.md — Let's Carol

> Append-only. Never delete entries. Mark as superseded if a decision changes.

---

## D-R-001 — Remove Driver Role from Application

**Decision ID:** D-R-001  
**Date:** 2026-11-21  
**Status:** APPROVED, NOT YET IMPLEMENTED

**Problem:**  
The application has three roles (`admin`, `team_member`, `driver`) creating a role-switching mechanism that confuses users. The `driver` role is effectively a GPS capability, not a distinct user identity. Users must switch roles to access different operational screens, creating cognitive load.

**Options Considered:**

| Option | Description | Risk |
|--------|-------------|------|
| A — Remove driver role entirely | GPS becomes a capability for all members | Low risk, clean |
| B — Keep driver as hidden internal role | Maintain driver in DB but hide from UI | Confusing, deferred problem |
| C — Merge driver into team_member | team_member absorbs all driver capabilities | Same as A, preferred approach |

**Selected Approach:** Option A/C — Remove driver role. Convert existing driver members to team_member. GPS broadcasting becomes available to all authenticated church members.

**Reason:**  
GPS is an operational tool, not an identity. Any carol team member should be able to start the GPS tracker for their group. The only meaningful security boundary is `admin` vs `team_member` (family creation).

**Files Affected:**
- `src/types/database.ts` — remove 'driver' from types
- `src/lib/auth-context.tsx` — remove role switching, deriveAuthorizedRoles simplification
- `src/components/auth/RoleSwitcherModal.tsx` — remove or gut
- `src/components/navigation/BottomNav.tsx` — remove driver nav case
- `src/app/location/page.tsx` — remove driver authorization check
- `supabase/schema.sql` — role constraint change
- `supabase/migration_role_simplification.sql` — NEW migration file

**Migration Implications:**  
All existing `church_members.role = 'driver'` rows must be updated to `'team_member'`.  
All existing `church_invites.role = 'driver'` rows must be updated to `'team_member'`.  
Database CHECK constraints must be updated to remove 'driver'.

**Consequences:**
- Former drivers gain all team_member capabilities
- No existing functionality is lost (GPS still works)
- Invitation system supports admin/team_member only

---

## D-R-002 — Family Creation Restricted to Admin Only

**Decision ID:** D-R-002  
**Date:** 2026-11-21  
**Status:** APPROVED, NOT YET IMPLEMENTED

**Problem:**  
Currently any church member can create families (`is_church_member` insert policy on `families` table). The business requirement is that only admins can create families, while team members can view/edit/delete existing families per the operational policy.

**Options Considered:**

| Option | Description |
|--------|-------------|
| A — UI-only restriction (hide Add Family button) | Insufficient — API bypass possible |
| B — API route check only | Better, but RLS bypass possible if app evolves |
| C — RLS policy change + API check + UI | Defense in depth — correct approach |

**Selected Approach:** Option C — Change RLS `families INSERT` policy from `is_church_member()` to `is_church_admin()`, plus API-level check, plus UI button visibility.

**Reason:**  
Defense in depth. The requirement specifically states: "Direct API requests and database operations must also enforce the restriction."

**Files Affected:**
- `supabase/schema.sql` — `families INSERT` policy change
- `supabase/migration_role_simplification.sql` — migration
- `src/app/families/page.tsx` — hide Add Family button for team_member
- `src/app/[churchSlug]/families/page.tsx` — same

**Rollback:**  
Revert RLS policy to `is_church_member` to restore previous behavior.

---

## D-R-003 — GPS Broadcasting Available to All Members

**Decision ID:** D-R-003  
**Date:** 2026-11-21  
**Status:** APPROVED, NOT YET IMPLEMENTED

**Problem:**  
Currently GPS broadcasting is restricted to users whose `authorizedRoles` includes `'driver'` or `'admin'`. After removing the driver role, team members would lose GPS capability entirely, which is incorrect per business requirements.

**Options Considered:**

| Option | Description |
|--------|-------------|
| A — GPS only for admin | Too restrictive |
| B — GPS for all authenticated church members | Matches operational reality |
| C — Separate GPS permission field | Overly complex |

**Selected Approach:** Option B — Any active church member (admin or team_member) can start and stop GPS sharing.

**Reason:**  
In a caroling event, any team member may be in a vehicle and need to share location. Making GPS an identity (the driver "persona") was the original design mistake.

**Files Affected:**
- `src/app/location/page.tsx` — change `isAuthorizedToBroadcast` check
- `src/app/[churchSlug]/location/page.tsx` — same
- `supabase/schema.sql` — `groups UPDATE` policy: change `is_church_admin_or_driver` to `is_church_member`
- Database trigger `check_group_update_permissions` — update or remove driver-specific logic

**Security Note:**  
The trigger `check_group_update_permissions` currently blocks non-admin/non-driver from updating structural group fields. After simplification, we should allow all members to update GPS coordinates but keep the restriction on structural fields (name, slug, etc.) to admin-only. The trigger needs to be updated, not removed.

---

## D-R-004 — Remove Role Switching Mechanism

**Decision ID:** D-R-004  
**Date:** 2026-11-21  
**Status:** APPROVED, NOT YET IMPLEMENTED

**Problem:**  
The current `switchRole` function, `authorizedRoles` array, `activeRole` state, `RoleSwitcherModal`, and `UserRoleBadge` switcher create complexity that confuses users. These exist to support the driver role persona.

**Options Considered:**

| Option | Description |
|--------|-------------|
| A — Remove entirely | Clean, reduces code complexity |
| B — Keep for future use | Unnecessary complexity |

**Selected Approach:** Remove `switchRole`, `authorizedRoles`, `activeRole` from context. User's effective role is simply their `churchMembership.role`.

**Migration Implications:**  
The `STORAGE_KEY_ACTIVE_ROLE` localStorage key `'carol_active_role'` becomes obsolete. Remove on next sign-in (non-breaking; stale key harmless if removed from code).

**Consequences:**
- `useAuth()` becomes simpler
- Components using `activeRole` need to switch to `churchMembership?.role`
- `isAdmin` helper: `churchMembership?.role === 'admin'`

---

## Prior Decisions (from previous sessions, still active)

See `docs/ai/DECISIONS.md` for D-001 through D-030, all still valid except:

- **D-011** (Three Operational Roles) is **superseded** by D-R-001
- **D-026** (Driver & Admin Permission Differentiation) is **superseded** by D-R-003

All other decisions (D-001 through D-029 except D-011 and D-026) remain in force.
