# PROJECT_MASTER.md — Let's Carol: Role Simplification

> Primary source of project truth. Read this first on every session.  
> Last updated: 2026-11-21

---

## 1. Project Overview

**Application:** Let's Carol (caroltracker)  
**Repository:** `d:\Theo\git\caroltracker` (remote: `carolapp/main`)  
**Branch:** `main`  
**Framework:** Next.js 16.4.3 (App Router), React 19, TypeScript, Tailwind v4  
**Database:** Supabase (PostgreSQL + RLS + Realtime)  
**Hosting target:** Vercel  

**Current state at audit:** Fully working production-grade PWA. 14 security tests passing. TypeScript 0 errors.

---

## 2. Business Objective

Simplify the application from **three roles** (admin / team_member / driver) to **exactly two roles**:

| Role | Key Restriction |
|------|----------------|
| `admin` | Can do everything including **add new families** |
| `team_member` | Can do everything **except add new families** |

GPS/location sharing is an **operational capability**, not a user role. Both roles must be able to share GPS.

---

## 3. Technology Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16 App Router, React 19, TypeScript 5 |
| Styling | Tailwind CSS v4 (CSS-variable design tokens, no config file) |
| Auth | Supabase Auth (email+password) |
| Database | Supabase PostgreSQL |
| ORM/Client | `@supabase/supabase-js` v2 |
| Maps | Leaflet + react-leaflet |
| Icons | lucide-react |
| State | React Context (AuthContext) |
| Deployment | Vercel |

---

## 4. Architecture

### Multi-Tenant Model
- **Church** is the security boundary (tenancy unit)
- Every entity (`families`, `groups`, `songs`, `routes`) has `church_id` FK
- RLS enforced at the PostgreSQL layer via `is_church_member()` and `is_church_admin()` helper functions
- Cross-tenant access is physically impossible via RLS

### Authentication Flow
1. User signs in → Supabase session
2. `auth-context.tsx` queries `church_members` for the user's memberships
3. `church_members.role` is the **authoritative source of truth** for permissions
4. `authorizedRoles` array is derived from `churchRole`
5. `activeRole` is selected from `authorizedRoles` (supports role switching)

### Current Role Architecture (PRE-SIMPLIFICATION)
```typescript
type ChurchRole = 'admin' | 'team_member' | 'driver';   // DB column type
type AppRole = 'admin' | 'team_member' | 'driver';       // UI state type
```

Admin derives: `['admin', 'team_member', 'driver']`  
Driver derives: `['driver', 'team_member']`  
Team Member derives: `['team_member', 'driver']`  
→ Both team_member and driver can switch between team_member↔driver  
→ This role switching is what creates complexity

### Target Role Architecture (POST-SIMPLIFICATION)
```typescript
type ChurchRole = 'admin' | 'team_member';   // DB and app type
```

Admin gets: full access including family creation  
Team Member gets: all operational access except family creation  
No role switching. No driver identity.

---

## 5. Database Schema Summary

### Key Tables
- `profiles` — user identity linked to auth.users
- `churches` — tenancy root entity
- `church_slug_history` — for URL redirect on slug change
- `church_members` — membership with role; role column = `'admin'|'team_member'|'driver'` (NEEDS CHANGE)
- `church_invites` — cryptographic invitation tokens; role column = same (NEEDS CHANGE)
- `families` — carol visit families (church-scoped)
- `family_members` — members within a family
- `groups` — carol groups with GPS fields
- `routes` — links group→family with visit status
- `songs` — church songbook with visibility flags

### Key PostgreSQL Functions
- `is_church_member(church_id)` — boolean, checks active membership
- `is_church_admin(church_id)` — boolean, checks admin role
- `is_church_admin_or_driver(church_id)` — boolean, **NEEDS REMOVAL/REPLACEMENT**
- `create_church_with_admin(name, slug)` — atomic church creation
- `validate_church_invite(token)` — validates invite before use
- `accept_church_invite(token)` — accepts invite, creates membership
- `get_public_live_data(church_slug, group_slug)` — safe public projection
- `get_public_live_songs(church_slug)` — public song list
- `check_group_update_permissions()` trigger — restricts driver updates (NEEDS CHANGE)

### Critical RLS Policies That Need Change
- `church_members.role` check constraint: currently `('admin','team_member','driver')` → must become `('admin','team_member')`
- `church_invites.role` check constraint: same change
- `groups` UPDATE policy: currently `is_church_admin_or_driver` → must become `is_church_member`
- Groups trigger: currently blocks non-admin drivers; must be removed or allow all members to update GPS

---

## 6. Security Requirements (NON-NEGOTIABLE)

1. Never bypass Supabase RLS
2. Never rely solely on frontend permission checks
3. Maintain server-side authorization
4. Protect cross-tenant data isolation
5. Family creation must be enforced at DB level (not just UI)
6. Only admins can generate invitations
7. Cryptographic token hashing must be preserved
8. Public live tracking must never expose phone/notes/private data

---

## 7. Non-Negotiable Development Rules

1. Preserve existing working features
2. Never rewrite entire application unnecessarily
3. Understand business logic before modifying
4. Maintain backward compatibility
5. Protect existing user data
6. No TypeScript errors
7. No broken imports
8. No unused role references after migration
9. Document every architectural decision
10. Keep mobile usability

---

## 8. Implementation Plan (High Level)

### Phase 1 — Audit (COMPLETE — this document)
Document every role dependency. No code changes.

### Phase 2 — TypeScript Types
- Remove `driver` from `ChurchRole`, `AppRole`
- Remove `switchRole`, `authorizedRoles`, `activeRole` complexity
- Simplify `AuthUser` interface
- Simplify `deriveAuthorizedRoles` → single role lookup

### Phase 3 — Auth Context Simplification
- Remove role switching logic
- Remove `STORAGE_KEY_ACTIVE_ROLE` persistence
- Remove `switchRole` function
- Load `churchRole` → map to simple `isAdmin` boolean

### Phase 4 — UI Component Updates
- Remove `RoleSwitcherModal` (or repurpose as user info display)
- Remove `UserRoleBadge` switcher
- Simplify `BottomNav` to single nav for all authenticated users
- Remove driver-specific nav items

### Phase 5 — GPS/Location Permission Update
- Change `isAuthorizedToBroadcast` check in `/location` page
- Currently: `authorizedRoles.includes('driver') || authorizedRoles.includes('admin')`
- New: `churchMembership?.role === 'admin' || churchMembership?.role === 'team_member'` (all members)

### Phase 6 — Family Creation Restriction
- Hide "Add Family" button from team_member (UI)
- Block family creation at API route level
- Update Supabase RLS: `families INSERT` policy → `is_church_admin(church_id)`

### Phase 7 — Database Migration
- Change `church_members.role` CHECK constraint: remove 'driver'
- Change `church_invites.role` CHECK constraint: remove 'driver'
- Migrate existing `driver` members → `team_member`
- Migrate existing `driver` invites → `team_member`
- Replace `is_church_admin_or_driver` function → update callers to use `is_church_member`
- Update `check_group_update_permissions` trigger
- Update `families INSERT` RLS to admin-only

### Phase 8 — Invitation Update
- Remove driver option from invite generation
- Validate invite roles at API level

### Phase 9 — Test Suite Update
- Update existing tests to reflect two-role model
- Add family creation authorization tests
- Add GPS authorization tests for both roles
- Run full regression

### Phase 10 — Build Verification
- `tsc --noEmit` → 0 errors
- `next build` → success
- All tests pass
