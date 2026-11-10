# Carol Application — Implementation Status

> **This file is the most important handoff document.**  
> Update after every significant change.

---

## Current Status

**Current phase:** Phase 14 (Security Audit, RLS Hardening, Public Live Security, QR Share Card & Route Consolidation COMPLETED)

**Last completed task:**  
- **Phase 14 (Security Hardening, QR Share Card & Route Consolidation):**
  - **Public RLS & Visibility Hardening (`supabase/schema.sql`, `supabase/migration_security_and_hardening.sql`):**
    - Extended `public.groups` with `is_public boolean not null default true` and `idx_groups_church_visibility` index.
    - Updated anon select policy on `public.groups` to strictly require `is_active = true and is_public = true`.
    - Created dedicated secure PostgreSQL RPC `public.get_public_live_data(p_church_slug, p_group_slug)` and `public.get_public_live_songs(p_church_slug)` for safe projection without exposing private notes, phone numbers, or member details.
  - **Joint ChurchSlug + GroupSlug Route Resolution (`src/app/live/[groupId]/page.tsx`, `src/app/[churchSlug]/live/[groupId]/page.tsx`):**
    - `src/app/[churchSlug]/live/[groupId]/page.tsx` passes both identifiers into `LiveTrackingContent`.
    - Resolves church first via canonical slug or `church_slug_history`, then resolves group strictly belonging to that church (`church_id = resolvedChurch.id`).
    - Cross-church URL manipulation (`/church-a/live/group-from-church-b`) fails safely with a friendly "This live tracking link is unavailable." notice without fallback or silent redirect.
    - Legacy `/live/[groupId]` route without churchSlug automatically redirects to canonical `/[churchSlug]/live/[groupSlug]`.
    - Added defense-in-depth API route at `src/app/api/live/[churchSlug]/[groupSlug]/route.ts`.
  - **Driver & Location Update Permission Hardening:**
    - Replaced overly broad `is_church_member` update policy on `public.groups` with `is_church_admin_or_driver(church_id)`.
    - Added PostgreSQL trigger `trg_check_group_update` enforcing that non-admin drivers can ONLY update live location coordinates (`current_latitude`, `current_longitude`, `current_speed`, `current_direction`, `last_location_update`). Drivers are blocked from modifying structural group configuration (name, vehicle number, slug, church_id).
    - Protected GPS broadcasting controls on `/location` and `/[churchSlug]/location`: non-driver/non-admin team members cannot start broadcast.
  - **Authoritative Atomic Church Creation:**
    - Removed non-atomic client-side fallback in `src/lib/auth-context.tsx`.
    - Authoritative path is `create_church_with_admin` RPC: creates church and assigns initial admin membership in a single atomic database transaction with slug uniqueness, length, and reserved route checks.
  - **Session Architecture & Next.js Edge Middleware:**
    - Added `src/middleware.ts` attaching security headers (`X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`).
    - Implemented `syncSessionCookie` in `auth-context.tsx` synchronizing access token to `sb-access-token` secure cookie on sign-in and clearing on sign-out.
    - Server invite API routes support both Bearer authorization headers and session cookies.
  - **Deterministic QR Share Card & Native Sharing (`src/lib/share-card.ts`, `src/app/share/page.tsx`):**
    - Created `src/lib/share-card.ts` using `qrcode` and HTML5 offscreen canvas with the authentic Let's Carol Christmas acrylic template (`public/share-card-template.jpg`, 682x1024).
    - Card dynamically composites: Church Name (warm ivory serif), Team Name, Ribbon title ("Follow the Carol Team Live"), large scannable QR code (260x260, centered in golden acrylic frame), feature subtitle ("Live location • Carol songs"), bottom URL capsule, and gold script branding ("Let's Carol").
    - **Omitted "Scan with your phone camera" text and phone icon per user design directive**, keeping the frosted acrylic pane clean, spacious, and uncluttered.
    - QR code points strictly to canonical URL `https://[domain]/[churchSlug]/live/[groupSlug]`.
    - Native Web Share integration with file attachments (`navigator.canShare({ files: [cardFile] })`), formatted message text, and fallback Copy Link, Download Card, Download QR buttons.
    - Designed with low cognitive load for ages 14–70.
  - **Legacy Route Consolidation:**
    - Legacy routes (`/families`, `/route`, `/songs`, `/location`, `/share`, `/admin/dashboard`) automatically redirect to canonical `/[churchSlug]/...` routes when user has an active church.
    - Shared cards (`FamilyCard`, `RouteCard`, `SongCard`) accept optional `churchSlug` and generate slug-prefixed links.
  - **Testing & Verification:**
    - Extended automated security test suite `src/test-security.mjs` to 14 comprehensive test suites covering public RLS, joint route resolution, driver permissions, atomic creation, canonical URL generation, and share message text. 100% passing.
    - TypeScript compilation (`tsc --noEmit`): 0 errors.
  - **Church Slug Architecture (`src/lib/slug.ts`, `supabase/migration_slugs_and_songs.sql`):**
    - Deterministic slug suggestion algorithm prioritizing memorable initials/acronyms (`Grace Community Church` → `gcc`, `St. Mary's Church Chennai` → `smcc`, `Holy Trinity Church` → `htc`).
    - Slug normalization: lowercase, strips punctuation/apostrophes, converts non-alphanumeric to hyphens, deduplicates and strips boundary hyphens.
    - Slug validation rules: 3–30 characters, alphanumeric with single hyphens, rejects leading/trailing hyphens, consecutive hyphens, spaces, and unsafe symbols.
    - 40+ reserved system slugs protected (`admin`, `api`, `login`, `signup`, `songs`, `route`, `live`, etc.).
    - Case-insensitive unique index: `create unique index idx_churches_slug_unique on public.churches (lower(slug))`.
    - Created `public.church_slug_history` table for seamless redirect of previously shared links when slugs change.
    - Added `resolve_church_by_slug` and `change_church_slug` PostgreSQL functions.
  - **Slug Availability API (`src/app/api/churches/check-slug/route.ts`):**
    - Debounced real-time endpoint (350ms) returning `{ available: boolean, reason?: string, normalized: string }`.
    - Supports `excludeChurchId` for safe self-edits.
    - Safe race condition handling: database unique constraint remains the ultimate authority.
  - **Church Setup & Settings UX Integration:**
    - `src/app/church/setup/page.tsx`: Auto-generates suggested slug as admin types church name; real-time debounced feedback (`Checking…`, `✓ [slug] is available`, `✕ Unavailable`, `Reserved`); URL preview; handles database unique constraint races gracefully.
    - `src/app/church/settings/page.tsx`: Admin can edit slug with debounced availability check; consequential change confirmation modal warning of link changes before saving.
  - **Admin Song Management & Two-Tier Visibility:**
    - Extended `public.songs` with `is_hidden` (boolean default false), `is_public` (boolean default true), and `updated_by` (uuid).
    - `src/app/songs/new/page.tsx`: Dedicated admin page to add carols (title, artist, category, lyrics, YouTube URL, public/hidden toggles).
    - `src/app/songs/[songId]/edit/page.tsx`: Admin edit page with lyrics editing, draft/hide toggle, and permanent deletion with confirmation modal.
    - `src/app/songs/page.tsx`: Role-aware songbook: Admins see `+ Add Song`, quick `Hide` / `Show` toggles, `Edit` links, and "Hidden" badges; non-admins (team members/drivers) only see active unhidden songs with no administrative buttons.
    - `src/app/songs/[songId]/page.tsx`: Detail view with lyrics and YouTube preview; admins see `Edit` button and hidden indicator; hidden songs blocked for non-admins.
    - Supabase RLS updated: Members view unhidden songs; admins manage all songs; public live viewers view unhidden, public songs.
  - **Public Live Experience with Songs & Fallback Elimination (`src/app/live/[groupId]/page.tsx`):**
    - Two clean tabs: `[ Live Tracking ] [ Songs ]`.
    - Public Live Songs tab: Instant search, lyrics viewer modal, and carols filtered strictly to the matching church where `is_hidden = false` and `is_public = true`.
    - **Eliminated silent group fallback**: Removed legacy logic that substituted another group or dummy coordinates; now shows a calm, friendly "This live tracking link is unavailable." state.
    - Privacy hardening: selects only non-sensitive fields; never exposes phone numbers, notes, or internal member data.
  - **Slug-Based App Router Architecture (`src/app/[churchSlug]/`):**
    - Created `src/app/[churchSlug]/layout.tsx`: Resolves canonical and historical slugs, redirects old slugs, validates church existence ("We couldn't find this church"), and enforces active tenant membership for authenticated routes ("You don't have access to this church").
    - Church-scoped subpages created:
      `/[churchSlug]/home`, `/[churchSlug]/families`, `/[churchSlug]/families/new`, `/[churchSlug]/families/[familyId]`, `/[churchSlug]/route`, `/[churchSlug]/route/[stopId]`, `/[churchSlug]/songs`, `/[churchSlug]/songs/new`, `/[churchSlug]/songs/[songId]`, `/[churchSlug]/songs/[songId]/edit`, `/[churchSlug]/location`, `/[churchSlug]/share`, `/[churchSlug]/tracking`, `/[churchSlug]/tracking/[groupId]`, `/[churchSlug]/admin/dashboard`, `/[churchSlug]/church/settings`, `/[churchSlug]/live`, `/[churchSlug]/live/[groupId]`.
    - `BottomNav.tsx`: Automatically formats navigation links with the church slug prefix (`/[churchSlug]/home`, etc.) and highlights tabs correctly.
    - `AuthGuard.tsx` & `NavWrapper.tsx`: Configured to recognize `/[churchSlug]/live/*` as public unauthenticated routes without bottom navigation.
    - Root `/` and legacy paths: Redirect authenticated users to `/[currentChurch.slug]/home`; share links point to `/[currentChurch.slug]/live/[groupId]`.
  - **Testing & Verification:**
    - Automated security test suite (`src/test-security.mjs`): 100% tests passed (9 test suites covering privilege escalation, token hashing, expiration, tenant isolation, slug generation/validation, reserved slugs, case-insensitive uniqueness, song authorization & visibility, elimination of silent fallback, and public projection).
    - TypeScript compilation (`tsc --noEmit`): 0 errors.
    - Next.js production build (`next build`): Succeeded across all 55 routes.

---

## Phase Checklist

```
Phase 0 — Repository Understanding & Inspection
  [x] All handoff documentation inspected in order
  [x] Git status and log inspected
  [x] Architecture, types, and schema inspected
  [x] Security test suite verified

Phase 1 to Phase 11 — UX, Auth & Core Carol Features
  [x] Viewport accessibility fix (zoom restored)
  [x] Supabase Auth, login, signup, password strength meter, forgot/reset password
  [x] Three authorized roles (admin, team_member, driver) with anti-privilege escalation
  [x] Role-aware BottomNav and More hub
  [x] Today experience with time-aware greeting and operational Next Stop card
  [x] Route stop state transitions (Arrived, Start Visit, Complete Visit)
  [x] Family 4-step wizard & progressive disclosure
  [x] Live location sharing consolidation

Phase 12 — Multi-Church Architecture & Tenant Security
  [x] Multi-tenant database schema (churches, church_members, church_invites)
  [x] Database membership roles as source of truth
  [x] Row Level Security (RLS) policies scoped per church
  [x] Cross-tenant route validation trigger
  [x] Cryptographic invitation links with SHA-256 token hashing
  [x] Admin church setup and member management

Phase 13 — Church Slugs, Slug-Based Routing & Song Administration
  [x] Centralized slug normalization and deterministic abbreviation utility (src/lib/slug.ts)
  [x] 40+ reserved system route protection
  [x] Case-insensitive unique slug enforcement in database schema
  [x] Church slug history table (church_slug_history) for URL redirects
  [x] Debounced slug availability API (/api/churches/check-slug)
  [x] Church setup onboarding with automatic suggested slug and real-time validation
  [x] Church settings slug editing with warning confirmation modal
  [x] Database fields for song administration (is_hidden, is_public, updated_by)
  [x] Admin song creation form (/songs/new)
  [x] Admin song edit form with delete confirmation modal (/songs/[songId]/edit)
  [x] Role-aware songbook with Hide/Show quick toggles (/songs)
  [x] Public congregation live page with Live Tracking and Songs tabs
  [x] Elimination of silent group fallback in public live tracking
  [x] Slug-based App Router layout and pages (src/app/[churchSlug]/...)
  [x] Church-slug aware BottomNav navigation
  [x] AuthGuard and NavWrapper updates for public church live links
  [x] Security test suite covering all slug, song, and tenant boundaries
  [x] TypeScript check: 0 errors
  [x] Production build: 0 errors across all 55 routes
```

---

## Modified & Created Files

### Files Created:
- `src/lib/share-card.ts` (Deterministic 1080x1400 canvas card and QR generator)
- `src/middleware.ts` (Next.js Edge Middleware for HTTP security headers and SSR session inspection)
- `src/app/api/live/[churchSlug]/[groupSlug]/route.ts` (Safe public live tracking endpoint)
- `supabase/migration_security_and_hardening.sql` (Public RLS hardening, atomic church creation, driver location update triggers)
- `src/lib/slug.ts` (Centralized slug normalization, acronym suggestion, and reserved routes)
- `src/app/api/churches/check-slug/route.ts` (Debounced slug availability API)
- `src/app/songs/new/page.tsx` (Admin song creation page)
- `src/app/songs/[songId]/edit/page.tsx` (Admin song edit & delete page)
- `src/app/[churchSlug]/layout.tsx` (Slug resolution, redirect, and tenant authorization layout)
- `src/app/[churchSlug]/page.tsx`
- `src/app/[churchSlug]/home/page.tsx`
- `src/app/[churchSlug]/families/page.tsx`
- `src/app/[churchSlug]/families/new/page.tsx`
- `src/app/[churchSlug]/families/[familyId]/page.tsx`
- `src/app/[churchSlug]/route/page.tsx`
- `src/app/[churchSlug]/route/[stopId]/page.tsx`
- `src/app/[churchSlug]/songs/page.tsx`
- `src/app/[churchSlug]/songs/new/page.tsx`
- `src/app/[churchSlug]/songs/[songId]/page.tsx`
- `src/app/[churchSlug]/songs/[songId]/edit/page.tsx`
- `src/app/[churchSlug]/location/page.tsx`
- `src/app/[churchSlug]/share/page.tsx`
- `src/app/[churchSlug]/tracking/page.tsx`
- `src/app/[churchSlug]/tracking/[groupId]/page.tsx`
- `src/app/[churchSlug]/admin/page.tsx`
- `src/app/[churchSlug]/admin/dashboard/page.tsx`
- `src/app/[churchSlug]/church/settings/page.tsx`
- `src/app/[churchSlug]/live/page.tsx`
- `src/app/[churchSlug]/live/[groupId]/page.tsx`
- `supabase/migration_slugs_and_songs.sql`

### Files Modified:
- `supabase/schema.sql` (Added slug history, case-insensitive index, songs visibility fields, and RLS)
- `src/types/database.ts` (Added ChurchSlugHistory, is_hidden, is_public, updated_by to Song)
- `src/lib/auth-context.tsx` (Normalized church slug handling in createChurch)
- `src/app/church/setup/page.tsx` (Smart default slug suggestion, debounced availability feedback)
- `src/app/church/settings/page.tsx` (Slug editing with confirmation modal, URL preview)
- `src/app/songs/page.tsx` (Role-aware songbook with admin Add/Hide/Show/Edit controls)
- `src/app/songs/[songId]/page.tsx` (Admin edit shortcut and hidden draft notices)
- `src/components/cards/SongCard.tsx` (Admin Hide/Show toggles, Edit link, and Hidden badge)
- `src/app/live/[groupId]/page.tsx` (Two-tab Live Tracking + Songs, eliminated silent fallback)
- `src/components/auth/AuthGuard.tsx` (Permitted public access to `/[churchSlug]/live/*`)
- `src/components/navigation/NavWrapper.tsx` (Hides nav on `/[churchSlug]/live/*`)
- `src/components/navigation/BottomNav.tsx` (Church slug prefixed URLs and active tab indicators)
- `src/app/page.tsx` (Canonical church slug route redirection and slug-prefixed links)
- `src/app/share/page.tsx` (Slug-based congregation live tracking link generation)
- `src/app/tracking/page.tsx` (Scoped to current church and slug routing)
- `src/test-security.mjs` (Full security and architecture test suite)
- `docs/ai/DECISIONS.md` (Added D-021 through D-024)
- `docs/ai/ARCHITECTURE.md` (Updated route map)
- `docs/ai/PROJECT_CONTEXT.md` (Updated domain model)
- `docs/ai/CHANGELOG_AI.md` (Documented Phase 13)

---

## Next Steps

1. Execute `supabase/migration_slugs_and_songs.sql` in the production Supabase SQL Editor.
2. PWA offline song lyrics caching for low-reception caroling areas.
