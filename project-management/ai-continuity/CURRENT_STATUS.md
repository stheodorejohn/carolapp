# CURRENT_STATUS.md — Let's Carol Role Simplification

> Update after every meaningful milestone.  
> Last updated: 2026-11-21

---

## Current Phase

**Phase 1 — Repository Audit** ✅ COMPLETE  
**Phase 2 — TypeScript Types** ⬜ NOT STARTED  

---

## Overall Completion

**Estimated: 5% complete** (Audit done, no implementation yet)

---

## Completed Tasks

- [x] Full repository audit performed
- [x] All existing AI continuity documents read
- [x] Repository structure documented
- [x] Every role reference identified and catalogued (see ROLE_DEPENDENCY_MAP below)
- [x] Existing tests run: **14/14 PASSED**
- [x] TypeScript check: **0 errors**
- [x] Project management directory created: `project-management/ai-continuity/`
- [x] All continuity documents written

---

## Partially Completed Tasks

None — no implementation started.

---

## Pending Tasks

See TASK_TRACKER.md for full checklist.

Summary:
- TypeScript role type simplification
- Auth context simplification (remove role switching)
- Remove RoleSwitcherModal
- Simplify BottomNav navigation
- Update GPS location authorization
- Restrict family creation (UI + API + RLS)
- Database migration (role constraint change, driver→team_member migration)
- Update invitation API
- Update test suite
- Production build verification

---

## Current Blockers

None. Ready to proceed to Phase 2.

---

## Last Successful Build

Previous session: `next build` succeeded across 55 routes (pre-simplification codebase).

---

## Last Successful Tests

- **Security tests:** 14/14 PASSED (`node src/test-security.mjs`) — 2026-11-21
- **TypeScript:** 0 errors (`npx tsc --noEmit`) — 2026-11-21

---

## Last Modified Files

None by this session. All files are unmodified from previous state.

---

## ROLE DEPENDENCY MAP

This maps every location where `driver`, `admin`, `team_member`, `activeRole`, `authorizedRoles`, `switchRole`, `isAdmin`, `isDriver`, or `isDriverOrAdmin` appears:

### Database Layer

| Location | Reference | Type | Action Required |
|----------|-----------|------|----------------|
| `supabase/schema.sql:101` | `role check ('admin','team_member','driver')` on `church_members` | DB constraint | Change to `('admin','team_member')` |
| `supabase/schema.sql:119` | `role check ('admin','team_member','driver')` on `church_invites` | DB constraint | Change to `('admin','team_member')` |
| `supabase/schema.sql:296-311` | `is_church_admin_or_driver()` function | DB function | Replace with `is_church_member()` for GPS, remove function |
| `supabase/schema.sql:313-345` | `check_group_update_permissions()` trigger | DB trigger | Simplify: allow all members to update GPS fields |
| `supabase/schema.sql:588-589` | `families INSERT` policy: `is_church_member` | RLS policy | Change to `is_church_admin` |
| `supabase/schema.sql:628-629` | `groups UPDATE` policy: `is_church_admin_or_driver` | RLS policy | Change to `is_church_member` |
| `supabase/migration_security_and_hardening.sql:27-50` | `is_church_admin_or_driver` redefined | Migration | Will be superseded by new migration |
| `supabase/migration_security_and_hardening.sql:53-85` | `check_group_update_permissions` trigger | Migration | Will be superseded |

### TypeScript Types

| Location | Reference | Action Required |
|----------|-----------|----------------|
| `src/types/database.ts:6` | `AppRole = 'admin' \| 'team_member' \| 'driver'` | Remove 'driver' |
| `src/types/database.ts:7` | `ChurchRole = 'admin' \| 'team_member' \| 'driver'` | Remove 'driver' |

### Auth Context

| Location | Reference | Action Required |
|----------|-----------|----------------|
| `src/lib/auth-context.tsx:34` | `authorizedRoles: AppRole[]` in AuthUser | Simplify or remove |
| `src/lib/auth-context.tsx:34` | `activeRole: AppRole` in AuthUser | Remove (or just = churchRole) |
| `src/lib/auth-context.tsx:49` | `switchRole: (role: AppRole) => boolean` in context | Remove |
| `src/lib/auth-context.tsx:70` | `STORAGE_KEY_ACTIVE_ROLE` localStorage key | Remove |
| `src/lib/auth-context.tsx:83-93` | `deriveAuthorizedRoles()` — includes driver logic | Simplify |
| `src/lib/auth-context.tsx:96-104` | `resolveActiveRole()` — reads localStorage for saved role | Remove |
| `src/lib/auth-context.tsx:184` | `const activeRole = resolveActiveRole(authorizedRoles)` | Remove |
| `src/lib/auth-context.tsx:261-278` | `switchRole` implementation | Remove |
| `src/lib/auth-context.tsx:393` | `localStorage.removeItem(STORAGE_KEY_ACTIVE_ROLE)` on sign-out | Remove |
| `src/lib/auth-context.tsx:405` | `const activeRole: AppRole = user?.activeRole ?? 'team_member'` | Simplify |
| `src/lib/auth-context.tsx:406` | `const authorizedRoles: AppRole[] = user?.authorizedRoles ?? [...]` | Simplify |
| `src/lib/auth-context.tsx:421` | `switchRole` in context value | Remove |

### Components

| Location | Reference | Action Required |
|----------|-----------|----------------|
| `src/components/auth/RoleSwitcherModal.tsx` | Entire file — driver role meta, role switching UI | Remove or gut entirely |
| `src/components/navigation/BottomNav.tsx:26-51` | `getNavItemsForRole()` switch with 'driver' case | Simplify to single nav |
| `src/components/navigation/BottomNav.tsx:81` | `const { activeRole, ... } = useAuth()` | Remove activeRole usage |

### App Pages

| Location | Reference | Action Required |
|----------|-----------|----------------|
| `src/app/location/page.tsx:35` | `const { ... authorizedRoles, activeRole, switchRole } = useAuth()` | Remove driver checks |
| `src/app/location/page.tsx:41` | `isAuthorizedToBroadcast = authorizedRoles.includes('driver') \|\| includes('admin')` | Change to: all members can broadcast |
| `src/app/location/page.tsx:201-218` | "Driver Authorization Required" block | Remove restriction |
| `src/app/families/page.tsx:83-88` | Add Family button — no role check | Add `churchMembership?.role === 'admin'` check |
| `src/app/songs/page.tsx:38` | `const isAdmin = activeRole === 'admin' \|\| user?.churchRole === 'admin'` | Simplify to `churchMembership?.role === 'admin'` |

### API Routes

| Location | Reference | Action Required |
|----------|-----------|----------------|
| `src/app/api/invites/generate/route.ts:9` | Comment: `role?: 'admin' \| 'team_member' \| 'driver'` | Update comment, add validation |
| `src/app/api/invites/generate/route.ts:40` | `const role = body.role ?? 'team_member'` | Add validation: reject 'driver' |
| `src/app/api/invites/accept/route.ts:113` | `role: invite.role ?? 'team_member'` | No change needed if DB handles it |

### Test Suite

| Location | Reference | Action Required |
|----------|-----------|----------------|
| `src/test-security.mjs:11-22` | `deriveAuthorizedRoles()` — includes driver logic | Update for two-role model |
| `src/test-security.mjs:29` | Tests admin includes driver | Update |
| `src/test-security.mjs:36-37` | Driver role tests | Remove/replace |
| `src/test-security.mjs:200-204` | Song query includes driver role | Update |
| `src/test-security.mjs:396-427` | `authorizeGroupUpdate` — driver vs team_member | Update |
| `src/test-security.mjs:434-456` | Driver-specific GPS tests | Replace with team_member GPS tests |

---

## Implementation State

No code has been changed. The application is in its pre-simplification state.
