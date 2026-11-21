# TASK_TRACKER.md — Let's Carol Role Simplification

> Mark tasks complete ONLY after verification.  
> Last updated: 2026-11-21

---

## Phase 1 — Audit

- [x] Read all existing AI continuity documents
- [x] Inspect git status and log
- [x] Read package.json, tsconfig.json
- [x] Read all TypeScript type definitions
- [x] Read auth-context.tsx completely
- [x] Read middleware.ts
- [x] Read RoleSwitcherModal.tsx
- [x] Read BottomNav.tsx and NavWrapper.tsx
- [x] Read AuthGuard.tsx
- [x] Read all API invite routes (generate, accept, validate, deactivate)
- [x] Read supabase/schema.sql (complete)
- [x] Read supabase/migration_security_and_hardening.sql
- [x] Read src/app/location/page.tsx
- [x] Read src/app/families/page.tsx
- [x] Read src/app/songs/page.tsx
- [x] Read src/app/[churchSlug]/families/page.tsx
- [x] Read src/test-security.mjs
- [x] Run existing test suite — 14/14 PASSED
- [x] Run TypeScript check — 0 errors
- [x] Create role dependency map
- [x] Create project-management/ai-continuity/ directory
- [x] Write PROJECT_MASTER.md
- [x] Write CURRENT_STATUS.md
- [x] Write TASK_TRACKER.md (this file)
- [x] Write ARCHITECTURE_DECISIONS.md
- [x] Write CHANGELOG.md
- [x] Write HANDOVER.md
- [x] Write MODEL_INSTRUCTIONS.md

---

## Phase 2 — TypeScript Role Types

- [ ] Update `src/types/database.ts`: Remove `'driver'` from `AppRole` type
- [ ] Update `src/types/database.ts`: Remove `'driver'` from `ChurchRole` type
- [ ] Verify no TypeScript errors after type change

---

## Phase 3 — Auth Context Simplification

- [ ] Remove `STORAGE_KEY_ACTIVE_ROLE` constant and all usages
- [ ] Remove `resolveActiveRole()` function
- [ ] Simplify `deriveAuthorizedRoles()` to return only `['admin','team_member']` subset
- [ ] Remove `switchRole` function from context
- [ ] Remove `switchRole` from `AuthContextValue` interface
- [ ] Remove `activeRole` from `AuthUser` interface (or simplify to equal `churchRole`)
- [ ] Remove `authorizedRoles` from `AuthUser` interface (or simplify)
- [ ] Remove `activeRole` and `authorizedRoles` from context value provider
- [ ] Update `signOut` to remove role localStorage cleanup (already no-op)
- [ ] Verify TypeScript still compiles

---

## Phase 4 — Component Updates

- [ ] Update `src/components/auth/RoleSwitcherModal.tsx`: Remove driver role meta
- [ ] Remove `driver` case from `ROLE_METAS`
- [ ] Remove `switchRole` usage from `RoleSwitcherModal`
- [ ] Remove `UserRoleBadge` switcher functionality (or simplify to static display)
- [ ] Consider whether to delete `RoleSwitcherModal.tsx` entirely
- [ ] Update `src/components/navigation/BottomNav.tsx`: Remove `getNavItemsForRole()` switch
- [ ] Create single nav item set for all authenticated users (admin+team_member same nav)
- [ ] Remove `driver` case from BottomNav
- [ ] Remove `activeRole` import from BottomNav
- [ ] Update `NavItems` to use `churchMembership?.role` for any needed admin-specific items
- [ ] Verify BottomNav renders correctly

---

## Phase 5 — GPS Location Permission

- [ ] Update `src/app/location/page.tsx`: Remove `authorizedRoles`/`switchRole` from useAuth()
- [ ] Change `isAuthorizedToBroadcast` to: `hasChurch` (all members can broadcast)
- [ ] Remove "Driver Authorization Required" block from location page
- [ ] Update `src/app/[churchSlug]/location/page.tsx` with same changes (if separate from above)
- [ ] Verify GPS sharing works for team_member role

---

## Phase 6 — Family Creation Restriction

- [ ] Update `src/app/families/page.tsx`: Add role check to hide "Add Family" for team_member
- [ ] Update `src/app/[churchSlug]/families/page.tsx`: Same check
- [ ] Update `src/app/api/invites/generate/route.ts`: Validate role not 'driver'
- [ ] Add family creation check to any family NEW API route (if exists)
- [ ] Verify family creation is blocked for team_member at UI level

---

## Phase 7 — Database Migration

- [ ] Create `supabase/migration_role_simplification.sql`
- [ ] Add: Migrate `driver` members → `team_member` in `church_members`
- [ ] Add: Migrate `driver` invites → `team_member` in `church_invites`
- [ ] Add: Drop `is_church_admin_or_driver` function (after updating callers)
- [ ] Add: Simplify/remove `check_group_update_permissions` trigger
- [ ] Add: Update `church_members.role` CHECK constraint to `('admin','team_member')`
- [ ] Add: Update `church_invites.role` CHECK constraint to `('admin','team_member')`
- [ ] Add: Update `families INSERT` RLS policy from `is_church_member` to `is_church_admin`
- [ ] Add: Update `groups UPDATE` RLS policy from `is_church_admin_or_driver` to `is_church_member`
- [ ] Add: Create `is_church_member_active` alias or verify `is_church_member` covers GPS
- [ ] Document rollback strategy in migration file
- [ ] Review migration file before execution (DO NOT execute without review)

---

## Phase 8 — Invitation API Update

- [ ] Update `src/app/api/invites/generate/route.ts`: Add role validation rejecting 'driver'
- [ ] Update `src/app/api/invites/generate/route.ts`: Update JSDoc comment
- [ ] Update `src/app/api/invites/accept/route.ts`: Handle any residual 'driver' invites gracefully
- [ ] Check `src/app/api/invites/validate/route.ts` for driver references
- [ ] Check `src/app/api/invites/deactivate/route.ts` for driver references
- [ ] Check church settings page for invitation role selector in UI

---

## Phase 9 — Test Suite Update

- [ ] Update `deriveAuthorizedRoles()` in test-security.mjs to two-role model
- [ ] Remove driver-specific tests (Test 1, Test 12)
- [ ] Add team_member GPS authorization test
- [ ] Add admin GPS authorization test
- [ ] Add family creation: admin CAN create (test)
- [ ] Add family creation: team_member CANNOT create (test)
- [ ] Add family creation: direct API bypass attempt by team_member fails (test)
- [ ] Add invitation role validation test: 'driver' role rejected
- [ ] Add existing user migration simulation test
- [ ] Run full test suite: all pass

---

## Phase 10 — Verification

- [ ] `npx tsc --noEmit` → 0 errors
- [ ] `next build` → success  
- [ ] All tests pass
- [ ] Review all pages in browser/mobile viewport
- [ ] Verify admin can add family
- [ ] Verify team_member cannot add family
- [ ] Verify both can share GPS
- [ ] Verify navigation is same for both roles
- [ ] Update CURRENT_STATUS.md to 100%
- [ ] Update HANDOVER.md final state

---

## Governance Checklist (Final)

- [ ] Exactly two active roles: `admin` and `team_member`
- [ ] No `driver` role anywhere in active code or database
- [ ] No role switching mechanism
- [ ] Both roles have identical operational navigation
- [ ] Only admin can add families (enforced at DB + API + UI)
- [ ] GPS works for both roles
- [ ] Existing users safely migrated
- [ ] No broken tests
- [ ] No TypeScript errors
- [ ] Production build passes
