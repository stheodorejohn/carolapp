# Carol Application — Decision Log

> Append-only. Never delete entries. Mark as superseded if a decision changes.

---

## D-001 — Authentication Provider: Supabase Auth

**Date:** 2026-11-09

**Decision:**  
Use Supabase Auth (`supabase.auth.signInWithPassword` / `signUp`) for all authentication.

**Reason:**  
The project already uses Supabase for the database. Supabase Auth is built-in, free, and integrates with the existing RLS setup. Adding a separate auth provider would create unnecessary complexity.

**Affected areas:**
- `/login` page
- New `/signup` page
- `src/lib/supabase.ts`
- New `src/lib/auth-context.tsx`
- New `src/middleware.ts`

**Alternatives considered:**
- NextAuth.js — adds complexity, overkill for this project
- Magic link / OTP — more complex UX than username+password for the target age range
- Custom auth — explicitly not recommended (security risk)

**Status:** Implemented

---

## D-002 — Username vs Email for Login

**Date:** 2026-11-09

**Decision:**  
Use **email as the identifier** for Supabase Auth login (Supabase Auth natively uses email). Present it to the user as "Username / Email" in the UI to reduce friction.

**Reason:**  
Supabase Auth's `signInWithPassword` requires an email. Rather than building a complex username-to-email lookup layer, use email as the identifier. The UI can call it "Username / Email" to match the product spec requirements.

**Affected areas:**
- `/login` page — label says "Username / Email", input type `email`
- `/signup` page — primary identifier is email

**Alternatives considered:**
- Pure username lookup table — extra complexity, extra DB query on each login
- Phone number — not appropriate for this application

**Status:** Implemented

---

## D-003 — User Roles: Minimal Role Set

**Date:** 2026-11-09

**Decision:**  
Implement two roles matching the existing TypeScript type: `admin` and `leader`. Map "leader" to the "Carol Team Member / Driver" UX persona.

**Reason:**  
The existing codebase defines `UserRole = 'admin' | 'leader'`. The database groups table has `leader_id`. Extending to 3+ roles would require DB schema changes. The leader role covers both "carol team member" and "driver" scenarios — the driver distinction is behavioral, not a separate DB role.

**Affected areas:**
- `src/types/database.ts` — UserRole type
- Auth context — role handling
- Navigation — role-aware items
- Route guards

**Alternatives considered:**
- 3 roles: admin, team_member, driver — requires schema change, more complexity
- 4 roles including public — public users are unauthenticated, not a role

**Status:** Superseded by D-011 and D-017

---

## D-004 — Role Storage: Supabase User Metadata

**Date:** 2026-11-09

**Decision:**  
Store user role in Supabase Auth `user_metadata` (`{ role: 'admin' | 'leader' }`). Set role during signup via `signUp({ data: { role: 'leader' } })`. Admin role is set manually via Supabase dashboard or server-side admin client.

**Reason:**  
Avoids needing a separate `users` table in the application database for auth purposes. Role is accessible immediately from the auth session without an extra DB query. New users default to 'leader'. Admins are created out-of-band.

**Security note:**  
The Supabase service role key is required to modify user metadata server-side. Regular users cannot elevate their own role via the client SDK (Supabase prevents this for `app_metadata`; `user_metadata` is user-editable — consider using `app_metadata` for roles if security is critical).

**Affected areas:**
- Signup flow — sets initial role
- Auth context — reads role from session
- RLS policies — can use `auth.jwt() -> 'user_metadata' -> 'role'` for enforcement

**Status:** Superseded by D-017

---

## D-005 — Navigation Structure

**Date:** 2026-11-09

**Decision:**  
Update bottom navigation to 4 items with clearer labels:

| Tab | Label | Route | Visible to |
|-----|-------|-------|-----------|
| Today | Today | `/` | All |
| Route | Route | `/route` | All authenticated |
| Songs | Songs | `/songs` | All authenticated |
| More | More | `/admin/dashboard` | Admin shows full admin; leader shows limited |

Remove "Tracking" from primary nav (it's a secondary action, not primary navigation).

**Reason:**  
"Tracking" is confusing — does it mean the team tracks their location, or admin tracks the team? Moving it to the Today screen as a card/action is cleaner. "Manage" → "More" is more universal. "Home" → "Today" matches the operational context.

**Affected areas:**
- `src/components/navigation/BottomNav.tsx`
- Role-aware visibility logic needed

**Alternatives considered:**
- 5 items: Today, Route, Live, Songs, More — adds complexity, 5 items on small screens is crowded
- Keep "Tracking" in nav — confusing label as identified in audit

**Status:** Implemented

---

## D-006 — BottomNav Hidden on Auth Pages

**Date:** 2026-11-09

**Decision:**  
Hide `BottomNav` on `/login` and `/signup` pages. Implement via route group or pathname check in the layout.

**Implementation approach:**  
Use Next.js route groups: create `(auth)` group for login/signup without BottomNav, and `(app)` group for authenticated pages with BottomNav. This is cleaner than conditional rendering based on pathname.

**Affected areas:**
- `src/app/layout.tsx`
- Route directory structure (may need reorganization)

**Status:** Implemented

---

## D-007 — Password Requirements

**Date:** 2026-11-09

**Decision:**  
Require passwords to meet ALL of:
- Minimum 8 characters
- At least one uppercase letter (A-Z)
- At least one lowercase letter (a-z)
- At least one number (0-9)
- At least one special character (!@#$%^&*...)

**Reason:**  
Balances security with usability. These are standard modern password requirements. Length 8 is achievable by most users while providing reasonable security.

**Affected areas:**
- `/signup` page — client-side validation + strength meter
- Supabase Auth — has server-side minimum length enforcement (default 6; will configure to 8)

**Note:**  
Client-side validation is for UX only. Backend (Supabase) enforces the actual constraint.

**Status:** Implemented

---

## D-008 — Viewport: Enable User Scaling

**Date:** 2026-11-09

**Decision:**  
Remove `maximumScale: 1` and `userScalable: false` from viewport metadata in `layout.tsx`.

**Reason:**  
WCAG 1.4.4 requires text resizing up to 200% without loss of functionality. Disabling zoom prevents users from adjusting text size. The target user age range (14–70) includes users who routinely use zoom.

**Affected areas:**
- `src/app/layout.tsx` — viewport export

**Status:** Implemented

---

## D-009 — Tailwind v4 Styling Convention

**Date:** 2026-11-09

**Decision:**  
Continue using Tailwind v4 CSS import pattern (`@import "tailwindcss"` in `globals.css`). Do not introduce a `tailwind.config.js`. Extend design tokens using CSS custom properties already established in `globals.css`.

**Reason:**  
The project uses Tailwind v4 which has a different configuration approach. Mixing v3 config patterns would break the build. The existing `globals.css` already defines a solid design token system via CSS variables.

**Affected areas:**
- All new CSS — follow existing pattern
- Do not add `@layer` or `theme()` calls that require v3-style config

**Status:** Active convention

---

## D-010 — New Files vs. Modifying Existing Files

**Date:** 2026-11-09

**Decision:**  
Prefer **modifying existing files** over creating parallel replacement files. When a page needs significant restructuring, refactor in place with incremental commits rather than creating a new file and deleting the old one.

**Reason:**  
Keeps Git history clean, reduces risk of leaving orphan files, and allows partial rollback.

**Exception:**  
New feature files (auth context, signup page, middleware) are genuinely new files.

**Status:** Active convention

---

## D-011 — Three Operational Roles with Anti-Privilege Escalation

**Date:** 2026-11-09

**Decision:**  
Expanded operational roles to:
- `admin` (Administrator)
- `team_member` (Carol Team Member)
- `driver` (Driver / Location Sharer)

Enforced strict anti-privilege escalation:
- Users with `admin` metadata can switch between `['admin', 'team_member', 'driver']`.
- Standard users (`leader`) can ONLY switch between `['team_member', 'driver']`. They can NEVER switch to `admin`.
- Role switching is validated client-side against the server-verified JWT metadata before updating state, preventing malicious localStorage manipulation.

**Affected areas:**
- `src/lib/auth-context.tsx`
- `src/components/auth/RoleSwitcherModal.tsx`
- `src/components/navigation/BottomNav.tsx`
- `src/app/page.tsx`
- `src/app/admin/dashboard/page.tsx`

**Status:** Implemented

---

## D-012 — Client-Side Route Protection via AuthGuard

**Date:** 2026-11-09

**Decision:**  
Implemented route protection via a dedicated `<AuthGuard>` component in `src/app/layout.tsx`.
- Public routes: `/login`, `/signup`, `/live/*`, `/join/*`, `/[churchSlug]/live/*`
- Private routes: all other application pages.
- Unauthenticated users attempting to access private routes are redirected to `/login?redirect=<target>`.
- Authenticated users attempting to access `/login` or `/signup` are redirected to `/` or `/[churchSlug]/home`.

**Reason:**  
Next.js App Router with Supabase client-side sessions manages tokens in browser storage. An AuthGuard in the root layout guarantees no protected view or data query mounts without an authenticated session.

**Affected areas:**
- `src/components/auth/AuthGuard.tsx`
- `src/app/layout.tsx`

**Status:** Implemented

---

## D-013 — Activity-Oriented Terminology for Carol Route Stops

**Date:** 2026-11-09

**Decision:**  
Replaced generic technical database terminology ("Check In", "Check Out") with human-centered, carol-event language:
- Step 1: `📍 I'm Here — Mark Arrived`
- Step 2: `🎵 Start Carol Visit`
- Step 3: `✅ Complete Carol Visit`
- Step 4: `Continue to Next Family →`

**Reason:**  
Significantly reduces cognitive load for volunteers and older team members who are not software professionals. Matches the physical activity of a church caroling event.

**Affected areas:**
- `src/app/route/[stopId]/page.tsx`
- `src/app/route/page.tsx`
- `src/components/cards/RouteCard.tsx`
- `src/app/page.tsx` (Next Stop card)

**Status:** Implemented

---

## D-014 — 4-Step Guided Wizard for Family Data Entry

**Date:** 2026-11-09

**Decision:**  
Restructured the manual family creation form into a 4-step wizard:
`1. Basics` → `2. Location` → `3. Members` → `4. Review & Save`.

**Reason:**  
Prevents visual overload on mobile screens. Enables incremental validation and gives users a review checkpoint before writing to the database.

**Affected areas:**
- `src/app/families/new/page.tsx`

**Status:** Implemented

---

## D-015 — Environment-Aware Dynamic Auth Redirect URLs

**Date:** 2026-11-09

**Decision:**  
Use `getAppURL('/login')` to dynamically pass `emailRedirectTo` during `supabase.auth.signUp()`.
- Locally (development): evaluates to `http://localhost:3000/login`.
- On Vercel (production & preview): evaluates to `https://<project-or-branch>.vercel.app/login`.
- In Supabase Dashboard: whitelist `http://localhost:3000/**` and `https://*.vercel.app/**`.

**Reason:**  
Ensures confirmation emails and auth links automatically redirect to the exact environment where the action originated without requiring separate Supabase projects or hardcoded URLs.

**Affected areas:**
- `src/lib/utils.ts` (`getAppURL`)
- `src/lib/auth-context.tsx` (`signUp`)
- Supabase Dashboard URL Configuration

**Status:** Implemented

---

## D-016 — Multi-Church Tenant Model via Church Memberships

**Date:** 2026-11-10

**Decision:**  
The application uses **Church** as the core multi-tenant security boundary. Separated user identity (`auth.users` / `profiles`) from tenant membership (`church_members` linked to `churches`). Every business entity (`families`, `groups`, `songs`, `routes`) contains a direct foreign key `church_id uuid references public.churches(id) on delete cascade`.

**Reason:**  
Enforces strict database-level data isolation via Supabase RLS. Prevents cross-church data leakage where users of Church A could access Church B data. Allows future flexibility for users belonging to multiple churches while maintaining clear tenant isolation.

**Affected areas:**
- `supabase/schema.sql`, `supabase/migration_multi_church.sql`
- `src/types/database.ts`
- `src/lib/auth-context.tsx`
- All data-fetching pages (`families`, `routes`, `songs`, `groups`)

**Status:** Implemented

---

## D-017 — Authoritative Database-Controlled Roles vs UI Experience

**Date:** 2026-11-10

**Decision:**  
Moved the source of truth for authorization from client-controlled `user_metadata.role` to `church_members.role`. Role hierarchy:
- If `church_members.role = 'admin'`: authorized for `['admin', 'team_member', 'driver']`
- If `church_members.role = 'driver'`: authorized for `['driver', 'team_member']`
- If `church_members.role = 'team_member'`: authorized for `['team_member', 'driver']`
UI role switching (`activeRole`) only toggles within the user's `authorizedRoles`. Selecting `admin` in the UI cannot grant admin permissions unless the database membership record genuinely authorizes administration. All sensitive actions are protected by PostgreSQL RLS functions (`is_church_admin`, `is_church_member`).

**Reason:**  
Completely prevents privilege escalation through localStorage tampering, client state manipulation, or forged requests.

**Affected areas:**
- `src/lib/auth-context.tsx`
- `src/components/auth/RoleSwitcherModal.tsx`
- PostgreSQL helper functions & RLS policies

**Status:** Implemented

---

## D-018 — Cryptographic Invitation Tokens with Token Hashing

**Date:** 2026-11-10

**Decision:**  
Church invitation links (`/join/<token>`) use 24-byte cryptographically secure random tokens. Raw secret tokens are NEVER stored in the database; only their deterministic SHA-256 hash (`token_hash`) is stored in `church_invites`. Validation and acceptance endpoints compute the SHA-256 hash server-side.

**Reason:**  
Prevents token exposure or database leaks from compromising active invitation links. Protects church integrity and guarantees that only persons possessing the raw invite link can join.

**Affected areas:**
- `church_invites` table
- `src/app/api/invites/generate/route.ts`
- `src/app/api/invites/validate/route.ts`
- `src/app/api/invites/accept/route.ts`
- `src/app/api/invites/deactivate/route.ts`

**Status:** Implemented

---

## D-019 — Church Name Prominence in Onboarding & Invitations

**Date:** 2026-11-10

**Decision:**  
When an invited user opens `/join/<token>`, the church name is fetched and displayed prominently before registration:
"Welcome to [Church Name]. You have been invited to join the [Church Name] Carol team."
Additionally, signing up or logging in with `?invite=<token>` preserves the church context and displays an informational confirmation banner.

**Reason:**  
Target audience (ages 14–70) needs immediate reassurance that they are joining the correct congregation. Hides technical parameters (UUIDs, tokens, database IDs) in favor of clear human church identity.

**Affected areas:**
- `src/app/join/[token]/page.tsx`
- `src/app/signup/page.tsx`
- `src/app/login/page.tsx`

**Status:** Implemented

---

## D-020 — Public Live Tracking Privacy Hardening

**Date:** 2026-11-10

**Decision:**  
The public congregation live tracking route `/live/[groupId]` was hardened to only query non-sensitive group location and progress fields (`id, name, vehicle_number, current_latitude, current_longitude, current_speed, current_direction, is_active, last_location_update`) and minimal stop progress (`id, status, eta, order_index, family(name, address)`). Private notes, phone numbers, family member details, and other church records are strictly excluded from public queries.

**Reason:**  
Protects congregation families' private contact details from public exposure while still providing real-time caroling progress.

**Affected areas:**
- `src/app/live/[groupId]/page.tsx`
- `supabase/schema.sql` (RLS policies for anon users)

**Status:** Implemented

---

## D-021 — Memorable Church Slugs with Smart Acronym/Initial Generation

**Date:** 2026-11-10

**Decision:**  
Every church has a unique, memorable, human-readable slug (e.g. `smc`, `gcc`, `htc`). Implemented a deterministic slug suggestion algorithm that:
1. Normalizes the church name (lowercase, strips apostrophes, replaces symbols).
2. Prioritizes memorable initials/acronyms (e.g. "Grace Community Church" → `gcc`, "St. Mary's Church Chennai" → `smcc`).
3. Enforces strict validation: 3–30 characters, alphanumeric with single hyphens, no leading/trailing hyphens, no consecutive hyphens, no spaces.
4. Protects 40+ reserved system routes (`admin`, `api`, `login`, `songs`, `route`, `live`, etc.).
5. Validates availability in real-time via debounced API (`/api/churches/check-slug`) with database unique constraints as ultimate authority.

**Reason:**  
Target audience (ages 14–70) needs short, memorable URLs they can easily type or share via WhatsApp/SMS without cumbersome UUIDs.

**Affected areas:**
- `src/lib/slug.ts`
- `src/app/api/churches/check-slug/route.ts`
- `src/app/church/setup/page.tsx`
- `src/app/church/settings/page.tsx`
- `supabase/migration_slugs_and_songs.sql`

**Status:** Implemented

---

## D-022 — Multi-Tenant Slug-Based Routing & Historical Redirection

**Date:** 2026-11-10

**Decision:**  
Introduced `src/app/[churchSlug]/` scoped App Router infrastructure (`/[churchSlug]/home`, `/[churchSlug]/families`, `/[churchSlug]/route`, `/[churchSlug]/songs`, `/[churchSlug]/location`, `/[churchSlug]/admin/dashboard`, `/[churchSlug]/live/[groupId]`).
Added `public.church_slug_history` table:
When an administrator changes the church slug in Church Settings, the old slug is archived in history, and subsequent visits to the old URL are seamlessly redirected to the canonical slug without breaking previously shared bookmarks or links.
The route layout validates church existence ("We couldn't find this church") and checks tenant membership for authenticated routes ("You don't have access to this church").
Bottom navigation dynamically adapts links to use the active church slug prefix.

**Reason:**  
Ensures clean tenant-aware URLs, prevents IDOR/privilege escalation, maintains deep link compatibility, and preserves legacy URLs.

**Affected areas:**
- `src/app/[churchSlug]/layout.tsx`
- `src/app/[churchSlug]/*` (all subpages)
- `src/components/navigation/BottomNav.tsx`
- `src/components/auth/AuthGuard.tsx`
- `src/components/navigation/NavWrapper.tsx`
- `supabase/schema.sql`, `supabase/migration_slugs_and_songs.sql`

**Status:** Implemented

---

## D-023 — Song Administration & Two-Tier Visibility Model

**Date:** 2026-11-10

**Decision:**  
Created role-aware song management and a two-tier visibility model:
1. `songs.is_hidden`: `false` (default) means visible to members; `true` hides the song from ordinary users and public live views (used for drafts).
2. `songs.is_public`: `true` (default) allows the song to be sung by congregation on the public live page when not hidden.
3. Church administrators can Add, Edit, Hide, Show, and Permanently Delete songs (with a mandatory confirmation dialog).
4. Non-admin members (team members, drivers) can only view active, unhidden songs and search/read lyrics; all administrative controls are hidden from their UI and blocked by database RLS.

**Reason:**  
Prevents confusion during caroling events, protects incomplete drafts, and ensures administrative capabilities are strictly authorized at both the UI and database levels.

**Affected areas:**
- `src/types/database.ts`
- `src/app/songs/page.tsx`
- `src/app/songs/new/page.tsx`
- `src/app/songs/[songId]/page.tsx`
- `src/app/songs/[songId]/edit/page.tsx`
- `src/components/cards/SongCard.tsx`
- `supabase/schema.sql`, `supabase/migration_slugs_and_songs.sql`

**Status:** Implemented

---

## D-024 — Public Live Experience with Songs & Silent Fallback Elimination

**Date:** 2026-11-10

**Decision:**  
Enhanced the public congregation live page (`/[churchSlug]/live/[groupId]` and `/live/[groupId]`):
1. Integrated simple two-tab UI: `[ Live Tracking ] [ Songs ]`.
2. Public Live Songs tab allows congregation members to search and sing along with lyrics for all active, unhidden, public carols belonging to that church.
3. **Eliminated silent group fallback**: Removed legacy logic that silently substituted another active group if the requested group was missing or inactive. Now displays a calm, friendly "This live tracking link is unavailable." notice.
4. Strict field projection: Never uses `select('*')` on public endpoints; excludes phone numbers, private notes, and internal member data.

**Reason:**  
Prevents data leakage across churches, prevents misleading tracking data from broken links, and delivers a complete caroling experience for church congregations.

**Affected areas:**
- `src/app/live/[groupId]/page.tsx`
- `src/app/[churchSlug]/live/[groupId]/page.tsx`
- `src/app/[churchSlug]/live/page.tsx`
- `src/test-security.mjs`

**Status:** Implemented
