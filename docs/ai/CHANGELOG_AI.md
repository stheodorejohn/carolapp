# Carol Application — AI Changelog

> Concise chronological record of major changes for future AI models.

---

## 2026-11-10 — Church Slugs, Slug-Based Routing, Song Administration & Public Live Songbook

- **Church Slug Architecture & Generation Utility (`src/lib/slug.ts`, `supabase/migration_slugs_and_songs.sql`)**:
  - Implemented centralized slug normalization and smart abbreviation algorithm (e.g. "Grace Community Church" → `gcc`, "St. Mary's Church Chennai" → `smcc`).
  - Added strict validation rules: 3–30 characters, lowercase alphanumeric and single hyphens, rejects leading/trailing hyphens, double hyphens, and spaces.
  - Enforced 40+ reserved system route protection (`admin`, `api`, `login`, `signup`, `songs`, `route`, `live`, etc.).
  - Added case-insensitive unique index on `churches (lower(slug))` in PostgreSQL schema.
  - Created `church_slug_history` table and `resolve_church_by_slug` / `change_church_slug` PostgreSQL functions for redirect preservation when slugs change.
- **Slug Availability API & Church Setup Integration**:
  - Created `/api/churches/check-slug` endpoint with debounced availability validation (350ms) and `excludeChurchId` support.
  - Enhanced `/church/setup` onboarding with automatic slug suggestion, real-time availability feedback (Checking…, Available, Unavailable, Reserved), URL preview, and race condition handling.
  - Enhanced `/church/settings` with slug editing, debounced validation, and a consequential change confirmation modal ("Change Church URL?").
- **Song Administration & Two-Tier Visibility Model**:
  - Extended `public.songs` with `is_hidden` (boolean default false), `is_public` (boolean default true), and `updated_by` (uuid).
  - Created `/songs/new` administrative page with title, artist, category, formatted lyrics, YouTube URL, and visibility toggles.
  - Created `/songs/[songId]/edit` page for modifying songs, toggling draft/hidden status, and permanent deletion with confirmation modal.
  - Updated `/songs` songbook with role-aware controls: admins can add songs, quick-toggle Hide/Show, and edit; non-admins only see active unhidden songs with no administrative controls.
  - Updated `/songs/[songId]` with admin edit shortcut and hidden draft indicator.
  - Updated Supabase RLS: members view unhidden songs; admins manage all songs; public live viewers view unhidden, public songs.
- **Public Congregation Live Experience with Songs & Fallback Elimination**:
  - Enhanced `/live/[groupId]` and `/[churchSlug]/live/[groupId]` with an accessible two-tab interface: `[ Live Tracking ] [ Songs ]`.
  - Added integrated public songbook with instant search and full lyrics modal for congregation sing-along.
  - **Eliminated silent group fallback**: Removed insecure legacy fallback that silently substituted other groups or dummy coordinates when a link was missing or inactive; now shows a calm, friendly "This live tracking link is unavailable." notice.
  - Privacy hardening: strictly queries non-sensitive fields; excludes phone numbers, private notes, and internal records.
- **Slug-Based App Router Architecture (`src/app/[churchSlug]/`)**:
  - Implemented `src/app/[churchSlug]/layout.tsx` resolving canonical and historical slugs, validating church existence, and enforcing active tenant membership.
  - Created church-scoped subpages: `home`, `families`, `families/new`, `families/[familyId]`, `route`, `route/[stopId]`, `songs`, `songs/new`, `songs/[songId]`, `songs/[songId]/edit`, `location`, `share`, `tracking`, `tracking/[groupId]`, `admin/dashboard`, `church/settings`, `live`, `live/[groupId]`.
  - Updated `BottomNav.tsx` to generate church-slug prefixed URLs (`/[churchSlug]/home`, `/[churchSlug]/families`, etc.) with role-aware and slug-aware active tab indicators.
  - Updated `AuthGuard.tsx` and `NavWrapper.tsx` to recognize `/[churchSlug]/live/*` as public unauthenticated routes without navigation bars.
  - Backward compatibility: root `/` redirects to canonical `/[currentChurch.slug]/home` when church is loaded; share links format as `/[churchSlug]/live/[groupId]`.
- **Validation & Security Verification**:
  - Automated test suite `src/test-security.mjs`: 100% tests passed across privilege escalation, token hashing, expiration, route tenant integrity, slug generation, reserved routes, song authorization boundaries, elimination of silent fallback, and public projection.
  - TypeScript compilation (`tsc --noEmit`): 0 errors.
  - Next.js production build (`next build`): Succeeded across all 55 routes.

---

## 2026-11-10 — Multi-Church Architecture, Secure Onboarding, Invitation Signup & RLS

- **Multi-Church Database Architecture**:
  - Created `churches` table (id, name, slug, address, city, phone, created_by).
  - Created `church_members` table (church_id, user_id, role, status) as the single authoritative source of truth for authorization.
  - Created `church_invites` table (church_id, token_hash, role, created_by, expires_at, max_uses, use_count, is_active) storing SHA-256 token hashes.
  - Added `church_id` tenant keys to `families`, `groups`, `songs`, and `routes`.
  - Added PostgreSQL trigger `trg_validate_route_tenant` to strictly prevent cross-church route linking.
  - Replaced open `using (true)` policies with strict tenant RLS functions (`is_church_member`, `is_church_admin`, `create_church_with_admin`, `validate_church_invite`, `accept_church_invite`).
- **Auth & Privilege Escalation Hardening**:
  - Updated `src/lib/auth-context.tsx`: derives `authorizedRoles` strictly from database `church_members.role`.
  - Blocked privilege escalation: selecting 'admin' in UI cannot elevate permissions unless authorized in DB.
  - Exposed `currentChurch`, `churchMembership`, `createChurch()`, and `joinChurchWithInvite()`.
- **First-Time Admin Setup & Onboarding**:
  - Created `/church/setup` page with friendly, accessible church name setup for users aged 14–70.
  - Automatically makes creating user initial church administrator; alternative option to join with code.
- **Cryptographic Invitation Link System**:
  - Implemented `/api/invites/generate`: generates 24-byte random token, stores SHA-256 hash in DB, returns link.
  - Implemented `/api/invites/validate`: validates token hash, checks expiry and max uses, returns church identity without leaking secrets.
  - Implemented `/api/invites/accept`: joins authenticated user to church, increments usage.
  - Implemented `/api/invites/deactivate`: permits admins to deactivate links.
- **Invitation Landing & Signup Integration**:
  - Created `/join/[token]` landing page displaying prominent church name before signup/join.
  - Enhanced `/signup` and `/login` to detect `?invite=...`, display church banner, and auto-join.
- **Church Administration & Member Management**:
  - Created `/church/settings` for updating church name, viewing members, changing member roles, toggling status, and generating/deactivating invitation links.
  - Added Church Workspace card to More hub (`/admin/dashboard`) and Church Settings link in `/settings/groups`.
- **Privacy & Security Hardening**:
  - Hardened `/live/[groupId]` public tracking to only query non-sensitive group coordinates and stop progress, strictly hiding private notes and phone numbers.
  - Executed automated security test suite `src/test-security.mjs` verifying privilege escalation prevention, deterministic token hashing, expiration boundaries, and cross-tenant guards.
  - Verified `pnpm exec tsc --noEmit` and `pnpm run build` succeed with 0 errors across all 32 routes.

---

## 2026-11-09 — Phase 2 to Phase 9 Implementation

- **Accessibility**: Removed `userScalable: false` and `maximumScale: 1` in `src/app/layout.tsx` (restored pinch-to-zoom WCAG 1.4.4).
- **Authentication**:
  - Implemented `src/lib/auth-context.tsx` with Supabase Auth, persistent session state, and user role management.
  - Built real Login page (`src/app/login/page.tsx`) with email/password, toggle, friendly error mapping, redirect parameter, and Suspense wrapper.
  - Built new Signup page (`src/app/signup/page.tsx`) with real-time 5-criterion checklist, dynamic strength meter, confirm password match, and toggle.
  - Implemented `src/components/auth/AuthGuard.tsx` to guard private pages and allow public `/live/*`, `/login`, and `/signup`.
  - Added secure logout across Home, More, and Settings pages.
- **Roles & Role Switching**:
  - Added `AppRole` type (`'admin' | 'team_member' | 'driver'`).
  - Created `RoleSwitcherModal` and `UserRoleBadge` (`src/components/auth/RoleSwitcherModal.tsx`).
  - Strictly enforced server-based privilege validation: normal users cannot switch to Admin.
  - Made `BottomNav.tsx` role-aware, tailoring tabs per active role (Admin, Driver, Team Member).
- **Today Screen**:
  - Added user's name and time-aware greeting in `src/app/page.tsx`.
  - Displayed `UserRoleBadge` in header with one-tap role switcher modal.
  - Transformed Next Stop into an operational card with directions and state-aware primary action.
  - Customized Quick Actions per active role.
- **Route & Visit Flow**:
  - Redesigned `src/app/route/page.tsx` with Active Stop callout and All/Remaining/Visited filter tabs.
  - Updated `RouteCard.tsx` with support for `arrived` status and active rings.
  - Updated `src/app/route/[stopId]/page.tsx` with activity language: "I'm Here — Mark Arrived", "Start Carol Visit", "Complete Carol Visit", "Continue to Next Family".
- **Family Experience**:
  - Fixed family back links in `src/app/families/[familyId]/page.tsx` to return to `/families`.
  - Hidden raw coordinates behind progressive disclosure details block.
  - Converted `src/app/families/new/page.tsx` into a 4-step wizard: Basics → Location → Members → Review.
- **Live Location Consolidation**:
  - Enhanced `src/app/location/page.tsx` with clear ON/OFF indicator, Stop Tracking control, and built-in congregation link sharing.
  - Removed misleading non-functional duration selector in `src/app/share/page.tsx`.
- **Admin Hub**:
  - Transformed `src/app/admin/dashboard/page.tsx` into a central "More" hub for account, role switching, tools, and sign out.
  - Redirected `/settings` to `/admin/dashboard`.
- **Input Styling Defect Fix (Overlap of Leading Icon and Input Text)**:
  - Fixed issue where leading icons (e.g. Mail in `login` and `signup`, Search in `families` and `songs`) were overlapped by placeholder and user-typed text.
  - Root cause: In Tailwind CSS v4, `.carol-input` in `globals.css` set `padding: 14px 16px;` which overwrote utility classes (`pl-11`, `pl-9`) because `.carol-input` had equal specificity and appeared after `@import "tailwindcss";` in stylesheet cascade.
  - Fix: Added `!pl-11` on email inputs, `!pr-14` on password inputs, `!pl-9` on search inputs, and added global input modifier classes `.carol-input.has-icon` / `.carol-input-with-icon` (`padding-left: 44px !important;`) and `.carol-input.has-action` / `.carol-input-with-action` (`padding-right: 48px !important;`) in `src/app/globals.css`.
- **Environment-Aware Auth Redirection**:
  - Added `getAppURL()` in `src/lib/utils.ts` and wired `emailRedirectTo: getAppURL('/login')` into `signUp` in `src/lib/auth-context.tsx`.
  - Automatically redirects to `http://localhost:3000/login` during local development, and to `https://*.vercel.app/login` when running on Vercel.
  - Added `supabase/migration_add_profiles.sql` and updated `supabase/schema.sql` with `public.profiles` table and `on_auth_user_created` PostgreSQL trigger.
- **Forgot & Reset Password Flow**:
  - Implemented `/forgot-password` (`src/app/forgot-password/page.tsx`) with accessible email input, rate limit handling, and clear delivery guidance.
  - Implemented `/reset-password` (`src/app/reset-password/page.tsx`) with recovery session detection, 5-criterion password validation checklist, strength meter, confirm password match, and expired link recovery handling.
  - Added "Forgot password?" link on `/login` (`src/app/login/page.tsx`).
  - Added `requestPasswordReset` and `updatePassword` to `src/lib/auth-context.tsx`.
  - Updated `AuthGuard.tsx` and `NavWrapper.tsx` to permit and style `/forgot-password` and `/reset-password`.
- **Next.js Instant Navigation / Unrendered Segment Fix**:
  - Resolved `instant-unrendered-segment` warning on `/` (`page.tsx ← dropped from rendering`).
  - Cause: In Next.js App Router, layout wrappers (`AuthGuard` in `layout.tsx`) must unconditionally render the `children` prop. `AuthGuard` was previously returning early with loading/redirecting divs and omitting `{children}` when `loading` or unauthenticated, causing Next.js to drop child segments from validation.
  - Fix: Updated `src/components/auth/AuthGuard.tsx` to unconditionally render `{children}` in the tree, hiding it visually with `display: none` and `aria-hidden="true"` during authentication checks.
- **Next.js Prerender / usePathname() Suspense Boundary Fix**:
  - Resolved `blocking-prerender-client-hook` error (`Next.js encountered URL data usePathname() in a Client Component outside of <Suspense>`).
  - Cause: `AuthGuard` and `NavWrapper` were accessing runtime URL data (`usePathname()`) at the layout level without being wrapped in a `<Suspense>` boundary, which blocked Next.js from prerendering dynamic segments such as `/families/[familyId]`.
  - Fix: Wrapped `AuthGuardInner` in `<Suspense fallback={<>{children}</>}>` and `NavWrapperInner` in `<Suspense fallback={null}>`.
- **Continuity Documentation**:
  - Updated `IMPLEMENTATION_STATUS.md`, `NEXT_STEPS.md`, `DECISIONS.md`, `PROJECT_CONTEXT.md`, and `CHANGELOG_AI.md`.

---

## 2026-11-09 — Initial Analysis and Documentation

- Performed full codebase audit of caroltracker (Next.js 16, React 19, Tailwind v4, Supabase)
- Identified 13 UX issues including critical: zoom disabled, no real auth, no signup page
- Created initial AI handoff documentation structure in `docs/ai/`.
