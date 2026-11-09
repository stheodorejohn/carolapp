# Carol Application — Prioritized Next Steps

> Updated: 2026-11-09  
> Status: Major Phases 2 through 9 Completed

---

## Completed Tasks Summary

- [x] **P0 — Viewport Accessibility Fix**: Removed `userScalable: false` and `maximumScale: 1` in `src/app/layout.tsx`.
- [x] **P1 — Auth Context**: Created `src/lib/auth-context.tsx` with Supabase Auth, persistent session, and role switching.
- [x] **P2 — Wrap App in AuthProvider**: Added `AuthProvider` in `src/app/layout.tsx`.
- [x] **P3 — Hide BottomNav on Auth & Public Pages**: Added `NavWrapper.tsx` hiding nav on `/login`, `/signup`, and `/live/*`.
- [x] **P4 — Real Login Implementation**: Full Supabase Auth sign-in with show/hide password, friendly errors, return redirect, and Suspense wrapper in `src/app/login/page.tsx`.
- [x] **P5 — Signup Page**: Created `src/app/signup/page.tsx` with 5-rule password checklist, real-time strength meter, confirm password match, and auto sign-in.
- [x] **P6 — Route Protection**: Created `src/components/auth/AuthGuard.tsx` guarding all private routes and redirecting to login.
- [x] **P7 — Logout Functionality**: Implemented secure sign out across Home (`/`), More (`/admin/dashboard`), and Settings (`/settings/groups`).
- [x] **P8 — Navigation Label Size Fix**: Increased bottom nav font size to 11px with medium weight.
- [x] **P9 — Navigation Restructure**: Role-aware tabs (Today, Route, Songs/Live/Families, More).
- [x] **P10 — Role Management & Switching**: Created `RoleSwitcherModal` and `UserRoleBadge` with strict anti-escalation security check.
- [x] **P11 — Today Screen Redesign**: Time-aware greeting, UserRoleBadge, operational Next Stop card with Directions and status-driven actions, role-adapted Quick Actions.
- [x] **P12 — Route Experience & Terminology**: Added Current Stop banner and All/Remaining/Visited filter tabs on `/route`; human-centered visit activity buttons (`I'm Here`, `Start Carol Visit`, `Complete Carol Visit`) on `/route/[stopId]`.
- [x] **P13 — Family Details Progressive Disclosure**: Fixed back buttons to `/families` and tucked raw GPS coordinates behind an expandable details block.
- [x] **P14 — Add Family Wizard**: 4-step wizard (`1. Basics` → `2. Location` → `3. Members` → `4. Review & Save`).
- [x] **P15 — Live Location Consolidation**: Persistent ON/OFF indicator, Stop Tracking control, congregation share preview, removed non-functional duration selector in `/share`.

---

## Remaining Backlog & Future Enhancements

### Task 1 — Offline PWA & Song Caching
**Priority:** Medium  
**Goal:** Enhance service worker in `public/manifest.json` so caroling teams can view song lyrics and today's route offline when entering areas with low mobile reception.  
**Files:** `public/manifest.json`, `src/app/songs/page.tsx`.

### Task 2 — Supabase Row Level Security (RLS) Hardening
**Priority:** Medium (Production readiness)  
**Goal:** Replace open RLS policies (`for all using (true)`) in `supabase/schema.sql` with authenticated `auth.uid()` checks and admin role checks once moving from demo mode to multi-church production.  
**Files:** `supabase/schema.sql`.

### Task 3 — Congregation Arrival Notification
**Priority:** Low  
**Goal:** Allow families viewing the public `/live/[groupId]` page to request an optional browser push notification or audio chime when the carol group arrives at their home.  
**Files:** `src/app/live/[groupId]/page.tsx`.
