# Carol Application — Prioritized Next Steps

> Updated: 2026-11-10  
> Status: Phase 13 Completed (Church Slugs, Slug-Based Routing, Song Administration, Public Live Songbook)

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
- [x] **P26 — Security & Build Validation**: Automated test suite (`src/test-security.mjs`) 100% passing; TypeScript compilation 0 errors; Next.js production build 0 errors across all 55 routes.

---

## NEXT IMMEDIATE TASK:

### Task 1 — Production SQL Migration Execution
**Priority:** High  
**Goal:** Run `supabase/migration_slugs_and_songs.sql` in the production Supabase SQL Editor to apply:
1. `public.church_slug_history` table and `idx_church_slug_history_slug` index.
2. Case-insensitive unique index `idx_churches_slug_unique` on `public.churches (lower(slug))`.
3. `is_hidden`, `is_public`, and `updated_by` columns on `public.songs`.
4. `resolve_church_by_slug` and `change_church_slug` PostgreSQL functions.
5. Scoped RLS policies for songs and public church slug resolution.

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
