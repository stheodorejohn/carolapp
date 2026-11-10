# Carol Application — Prioritized Next Steps

> Updated: 2026-11-10  
> Status: Phase 14 Completed (Security Audit, RLS Hardening, Public Live Security, QR Share Card & Route Consolidation)

---

## Completed Tasks Summary

- [x] **P16 — Multi-Church Architecture & Tenant RLS**: Multi-tenant database schema (`churches`, `church_members`, `church_invites`, tenant foreign keys, tenant trigger, security definer functions).
- [x] **P17 — Cryptographic Invitation System**: 24-byte random tokens, SHA-256 token hashing, expiration & usage limits, join landing page (`/join/[token]`).
- [x] **P18 — Church Onboarding & Settings**: Initial setup (`/church/setup`) and member administration (`/church/settings`).
- [x] **P21 — Centralized Slug Utilities & Rules**: `src/lib/slug.ts` with deterministic acronym suggestion, 3–30 char validation, 40+ reserved routes protection, and database case-insensitive uniqueness (`supabase/migration_slugs_and_songs.sql`).
- [x] **P22 — Slug Availability API & Setup Integration**: Debounced API (`/api/churches/check-slug`) connected to `/church/setup` and `/church/settings` with confirmation modal before changing URLs.
- [x] **P23 — Slug-Based Routing Infrastructure**: Next.js App Router structure under `src/app/[churchSlug]/` with canonical and historical slug resolution (`public.church_slug_history`), tenant membership verification, and church-prefixed navigation (`BottomNav.tsx`).
- [x] **P24 — Role-Aware Song Administration**: `is_hidden`, `is_public`, and `updated_by` columns on `songs`; dedicated creation (`/songs/new`) and editing (`/songs/[songId]/edit`) pages; role-scoped songbook (`/songs`) with admin Hide/Show quick toggles and delete confirmation.
- [x] **P25 — Public Live Tracking & Songbook**: Two-tab congregation view (`[ Live Tracking ] [ Songs ]`) with instant lyric search; eliminated silent group fallback with friendly unavailable notice; privacy hardening on all public data queries.
- [x] **P27 — Public RLS Exposure & Groups Visibility Hardening**: `is_public` boolean column on `public.groups`, anon select policy requiring `is_active = true and is_public = true`, dedicated secure RPCs `get_public_live_data` and `get_public_live_songs` (`supabase/migration_security_and_hardening.sql`).
- [x] **P28 — Joint ChurchSlug + GroupSlug Route Resolution**: Joint validation in `LiveTrackingContent` and `/api/live/[churchSlug]/[groupSlug]`. Cross-church manipulation (`/church-a/live/group-from-church-b`) strictly fails safely. Legacy `/live/[groupId]` automatically redirects to canonical `/[churchSlug]/live/[groupSlug]`.
- [x] **P29 — Driver Location Update Permissions Hardening**: Replaced broad `is_church_member` update policy with `is_church_admin_or_driver`. Added PostgreSQL trigger `trg_check_group_update` enforcing that non-admin drivers can ONLY update live location coordinates and cannot alter group configuration.
- [x] **P30 — Authoritative Atomic Church Creation**: Made `create_church_with_admin` RPC the authoritative atomic path, eliminating non-atomic client-side fallback.
- [x] **P31 — Next.js Edge Middleware & SSR Session Cookie**: Added `src/middleware.ts` with HTTP security headers (`X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`). Added `syncSessionCookie` in `auth-context.tsx`.
- [x] **P32 — Deterministic QR Share Card & Native Sharing**: `src/lib/share-card.ts` HTML5 offscreen canvas generator producing 1080x1400 high-contrast cards. Web Share API integration in `src/app/share/page.tsx` with file sharing, formatted message text, and fallback Copy Link / Download buttons.
- [x] **P33 — Legacy Route Consolidation**: Automatic canonical redirection from `/families`, `/route`, `/songs`, `/location`, `/share`, `/admin/dashboard` to `/[churchSlug]/...` when church is active.
- [x] **P34 — Automated Security Testing**: Expanded test suite `src/test-security.mjs` to 14 test suites, 100% passing. TypeScript `tsc --noEmit` 0 errors.

---

## NEXT IMMEDIATE TASK:

### Task 1 — Production SQL Migration Execution
**Priority:** High  
**Goal:** Run `supabase/migration_security_and_hardening.sql` (and `supabase/migration_slugs_and_songs.sql` if not yet executed) in the production Supabase SQL Editor to apply:
1. `is_public` column and `idx_groups_church_visibility` on `public.groups`.
2. Hardened anon select policy on `public.groups` (`is_active = true and is_public = true`).
3. `is_church_admin_or_driver` function and `trg_check_group_update` trigger on `public.groups`.
4. Atomic `create_church_with_admin` PostgreSQL function.
5. `get_public_live_data` and `get_public_live_songs` secure projection RPC functions.

---

## Remaining Backlog & Future Enhancements

### Task 2 — Offline PWA & Song Caching
**Priority:** Medium  
**Goal:** Enhance service worker in `public/manifest.json` and client cache so caroling teams can view song lyrics and today's route offline when entering low-reception areas during visits.  
**Files:** `public/manifest.json`, `src/app/songs/page.tsx`, `src/app/[churchSlug]/songs/page.tsx`.

### Task 3 — Congregation Arrival Push Notification
**Priority:** Low  
**Goal:** Allow families viewing the public `/[churchSlug]/live/[groupId]` page to request an optional browser push notification or audio chime when the carol team arrives at their home.  
**Files:** `src/app/live/[groupId]/page.tsx`, `src/app/[churchSlug]/live/[groupId]/page.tsx`.
