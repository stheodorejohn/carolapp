# HANDOVER.md — Let's Carol Role Simplification

> **This is the most critical file. Read this first.**  
> The next AI model (or developer) must read this BEFORE touching any code.  
> Last updated: 2026-11-21

---

## 1. Project Objective

Simplify Let's Carol from **three roles** (admin / team_member / driver) to **two roles** (admin / team_member).

The only mandatory permission difference:
- `admin` CAN add new families
- `team_member` CANNOT add new families
- Both roles have identical operational privileges otherwise (including GPS sharing)

---

## 2. Current Implementation Phase

**Phase 1 (Audit) — COMPLETE**  
**Phase 2 (TypeScript Types) — NOT STARTED**

---

## 3. Exact Completed Work

1. Full repository audit completed
2. Role dependency map created (see CURRENT_STATUS.md)
3. All continuity documents written
4. Existing tests confirmed: 14/14 passing
5. TypeScript confirmed: 0 errors
6. No application code has been modified

---

## 4. Exact Incomplete Work

Everything in the implementation. No code has been changed.

The following phases remain:
- Phase 2: TypeScript type changes
- Phase 3: Auth context simplification
- Phase 4: Component updates (BottomNav, RoleSwitcherModal)
- Phase 5: GPS location permission change
- Phase 6: Family creation restriction
- Phase 7: Database migration SQL
- Phase 8: Invitation API update
- Phase 9: Test suite update
- Phase 10: Build verification

---

## 5. Last Task Being Worked On

Completing the audit and writing continuity documents.  
The next task is **Phase 2: TypeScript type changes** in `src/types/database.ts`.

---

## 6. Last Files Modified

**None in this session.** The application code is unmodified from the previous session's state (Phase 14 complete).

---

## 7. Current Git Branch

`main` (tracking `carolapp/main`)

---

## 8. Uncommitted Changes

- **Deleted:** `docs.zip` (staged as deleted by git but not committed — do not discard, it was already deleted)
- **Untracked:** `tsconfig.zip` (not part of application code, ignore)
- **New untracked:** `project-management/ai-continuity/` (all 7 continuity documents) — commit these

**Suggested first commit:**
```
git add project-management/
git commit -m "docs: add ai continuity management documents for role simplification"
```

---

## 9. Last Successful Tests

- Security tests: **14/14 PASSED** — 2026-11-21 — `node src/test-security.mjs`
- TypeScript: **0 errors** — 2026-11-21 — `npx tsc --noEmit`
- Previous build: 55 routes, 0 errors (Phase 14 — undated, previous session)

---

## 10. Outstanding Errors

None. Application is in a clean state.

---

## 11. Known Risks

| Risk | Severity | Mitigation |
|------|----------|-----------|
| Existing users with `role='driver'` lose ability to do driver-specific UI | Low | They gain team_member which has same ops access |
| Active driver invitations become team_member invitations | Low | Migration converts them; functionally equivalent |
| `families INSERT` RLS change breaks existing team_member family creation | High | INTENTIONAL per business requirements — verify after migration |
| `is_church_admin_or_driver` function used in multiple places | Medium | Must update ALL callers before dropping function |
| `check_group_update_permissions` trigger may need careful update | Medium | Must allow team_member to update GPS but not structural fields |

---

## 12. Exact Next Action

**Step 1:** Commit the continuity documents:
```powershell
Set-Location d:\Theo\git\caroltracker
git add project-management/
git commit -m "docs: add ai continuity management documents for role simplification"
```

**Step 2:** Begin Phase 2 — Edit `src/types/database.ts`:
- Line 6: Change `AppRole = 'admin' | 'team_member' | 'driver'` → `'admin' | 'team_member'`
- Line 7: Change `ChurchRole = 'admin' | 'team_member' | 'driver'` → `'admin' | 'team_member'`

**Step 3:** Run `npx tsc --noEmit` and fix all type errors revealed by the type change.

**Step 4:** Proceed through remaining phases per TASK_TRACKER.md.

---

## 13. Instructions for the Next Model

### CRITICAL RULES
1. **Read HANDOVER.md first** (you are reading it)
2. Read CURRENT_STATUS.md second
3. Check git status: `Set-Location d:\Theo\git\caroltracker; git status`
4. Run tests to confirm baseline: `node src/test-security.mjs`
5. Run TypeScript check: `npx tsc --noEmit`

### DO NOT
- Rewrite the application from scratch
- Modify Supabase schema directly — write a migration file first
- Remove any working functionality (GPS, songs, routes, sharing, invitations)
- Merge any AI branches unless tests pass
- Commit partial/broken changes

### DO
- Work through phases in order
- Run tests after each phase
- Update TASK_TRACKER.md and CURRENT_STATUS.md after each phase
- Document any new architectural decisions in ARCHITECTURE_DECISIONS.md
- Write a new migration file; don't modify existing schema.sql directly

### Key File Locations
- Application types: `src/types/database.ts`
- Auth logic: `src/lib/auth-context.tsx`
- Role switching UI: `src/components/auth/RoleSwitcherModal.tsx`
- Navigation: `src/components/navigation/BottomNav.tsx`
- GPS page: `src/app/location/page.tsx` AND `src/app/[churchSlug]/location/page.tsx`
- Families: `src/app/families/page.tsx` AND `src/app/[churchSlug]/families/page.tsx`
- Database schema: `supabase/schema.sql`
- New migration: `supabase/migration_role_simplification.sql` (CREATE THIS)
- Tests: `src/test-security.mjs`

### PowerShell Commands (Windows)
```powershell
# Check git status
Set-Location d:\Theo\git\caroltracker; git status

# Run tests
Set-Location d:\Theo\git\caroltracker; node src/test-security.mjs

# TypeScript check
Set-Location d:\Theo\git\caroltracker; npx tsc --noEmit

# Build
Set-Location d:\Theo\git\caroltracker; npx next build
```
