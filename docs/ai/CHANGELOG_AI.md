# Carol Application — AI Changelog

> Concise chronological record of major changes for future AI models.

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
