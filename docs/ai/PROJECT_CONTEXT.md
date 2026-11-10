# Carol Application — Project Context

> **Purpose of this file:** Concise technical context for any AI model resuming work on this project. Read this first.

---

## What the Application Does

**Let's Carol** (`letscarol`) is a real-time **church carol tracking and route management application** for community caroling events (Christmas carol visits to families' homes).

The application helps a carol team:
- Plan and manage a route of family homes to visit
- Track which families have been visited
- Share live GPS location with the congregation
- Manage songs for the event
- Coordinate across multiple carol groups

---

## Primary User Types

| User Type | Primary Question | Key Features Needed |
|-----------|-----------------|---------------------|
| **Admin** | How is the carol event progressing? | Dashboard, family management, group management, route management |
| **Carol Team Member** | Where do we go next? | Route, next stop, visit status updates |
| **Driver / Location Sharer** | What is our next destination and is location sharing active? | Route, live location |
| **Public / Congregation** | Where is the carol team now? | Public live tracking page |

---

## Technology Stack

| Technology | Version / Package |
|------------|-------------------|
| Framework | **Next.js 16.4.3** (App Router) |
| React | 19.3.0 |
| TypeScript | ^5 |
| Styling | **Tailwind CSS v4** (no config file — uses CSS `@import "tailwindcss"`) |
| Icons | **Lucide React** ^0.511.0 |
| Database / Backend | **Supabase** (PostgreSQL + Realtime + Auth) |
| Supabase Client | @supabase/supabase-js ^2.49.8 |
| Map Library | **Leaflet** + React-Leaflet |
| Excel Import | xlsx ^0.18.5 |
| Utility | clsx + tailwind-merge |
| Package Manager | **pnpm** |
| Build | Turbopack (dev) |

**No form library** — forms are built with native HTML + React state.  
**No testing framework** currently configured.  
**No global state management** (Zustand, Redux, etc.) — data is fetched per-page via Supabase client.

---

## Application Architecture

### Routing (Next.js App Router)

```
src/app/
├── page.tsx                    — Home / Today screen (dashboard for team)
├── layout.tsx                  — Root layout (BottomNav always visible)
├── loading.tsx                 — Global loading state
├── login/page.tsx              — Login page (currently stub — no real auth)
├── admin/dashboard/page.tsx    — Admin dashboard (tab-based: Groups, Families, Settings)
├── families/
│   ├── page.tsx                — Families list (search, add link)
│   ├── new/page.tsx            — Add family form (multi-section)
│   └── [familyId]/page.tsx    — Family detail view
├── route/
│   ├── page.tsx                — Route list (stops for active group)
│   └── [stopId]/page.tsx      — Route stop detail / visit management
├── tracking/
│   ├── page.tsx                — Redirects to /tracking/[groupId]
│   └── [groupId]/page.tsx     — Live tracking map view
├── location/page.tsx           — GPS location sharing (driver view)
├── live/[groupId]/page.tsx    — Public tracking page (congregation view)
├── share/page.tsx              — Share link generator
├── songs/
│   ├── page.tsx                — Songs list
│   └── [songId]/page.tsx      — Song detail / lyrics
├── settings/
│   ├── page.tsx                — Settings (redirects to /settings/groups)
│   └── groups/
│       ├── page.tsx            — Groups management (live in admin/dashboard now)
│       └── new/page.tsx        — Create group form
└── stop/[stopId]/page.tsx     — Stop management (file exists in directory listing but not found)
```

### Key Observations on Current Routing
- `/admin/dashboard` and `/settings/groups` serve overlapping admin functionality
- The main admin page at `/admin/dashboard` has tabs: Groups, Families, Settings
- `/tracking` is for the internal team; `/live/[groupId]` is the public congregation view
- **No auth guards** currently — all pages are publicly accessible
- **No auth implemented** — login page is a stub with simulated delay

### Component Structure

```
src/components/
├── cards/
│   ├── FamilyCard.tsx      — Family list item card
│   ├── RouteCard.tsx       — Route stop card (with timeline visualization)
│   └── SongCard.tsx        — Song list card
├── map/
│   └── LiveMap.tsx         — Leaflet map component (dynamic import, SSR disabled)
├── navigation/
│   └── BottomNav.tsx       — Bottom navigation bar (4 items)
└── ui/
    ├── StatusBadge.tsx     — Status pill badge (visited/pending/in_progress/live)
    └── TodayDate.tsx       — Today's date display component
```

### State Management Pattern
- **Local `useState` per page** — no shared/global state
- **Data fetching in `useEffect`** with Supabase client
- **No caching** — fresh fetch on each page mount
- `useGeolocation` custom hook for GPS tracking

---

## Multi-Church Architecture & Security

### Multi-Tenancy Foundation
The application uses a secure **Multi-Church Tenant Model**:
- **Organization (Tenant)**: `public.churches` (`id`, `name`, `slug`, `created_by`, `created_at`).
- **User Identity**: Supabase `auth.users` synced to `public.profiles`.
- **Church Membership**: `public.church_members` (`church_id`, `user_id`, `role`, `status`).
- **Invitations**: `public.church_invites` (`church_id`, `token_hash`, `role`, `expires_at`, `max_uses`, `use_count`, `is_active`).
- **Tenant-Scoped Entities**: `families.church_id`, `groups.church_id`, `songs.church_id`, `routes.church_id`.
- **Tenant Integrity**: PostgreSQL trigger `trg_validate_route_tenant` ensures route's group and family belong to the identical church.

### Row Level Security (RLS)
Open policies (`using (true)`) are completely removed. Access is strictly scoped:
- `is_church_member(church_id)`: Verifies user has active membership.
- `is_church_admin(church_id)`: Verifies user is an active admin.
- Sensitive mutations (groups, songs, routes, church settings) restricted to verified church admins.

### Role Model
- Authoritative database source of truth: `church_members.role` (`admin | team_member | driver`).
- Client UI roles: `activeRole` switches only within verified `authorizedRoles`. Selecting `admin` in UI cannot grant unauthorized administrative privileges.

---

## Authentication Architecture

### Production Implementation
- **Supabase Auth**: Real email + password authentication with persistent sessions.
- **Route Protection**: `src/components/auth/AuthGuard.tsx` protects private routes, redirects unauthenticated users to `/login`, and directs users without a church to `/church/setup`.
- **Onboarding & Invitations**:
  - Initial admin onboarding at `/church/setup`.
  - Secure invitation links `/join/[token]` validate token hashes via `/api/invites/validate` without exposing internal secrets.
  - New and existing users join via `/api/invites/accept`.
- **Password Security**: Real-time 5-criterion checklist and strength meter (8+ chars, upper, lower, number, special).
- **Forgot & Reset Password**: Complete flow at `/forgot-password` and `/reset-password`.


---

## Domain Model

### Core Entities

**Family** — A household to be visited during carol
- `id`, `name`, `address`, `latitude`, `longitude`, `phone`, `notes`, `spouse`, `children`
- Has many `FamilyMember` (adults and children)

**Group** — A carol team (vehicle + members)
- `id`, `name`, `leader_id`, `vehicle_number`, `slug`, `is_active`
- Real-time location fields: `current_latitude`, `current_longitude`, `current_speed`, `current_direction`, `last_location_update`

**Route** — An ordered list of family stops for a group
- `id`, `group_id`, `family_id`, `status`, `order_index`
- Status flow: `pending` → `arrived` → `in_progress` → `visited`
- Timestamps: `arrived_at`, `checked_in_at`, `checked_out_at`

**Song** — Carol songs for the event
- `id`, `church_id`, `title`, `artist`, `lyrics`, `youtube_url`, `category`, `order_index`, `is_hidden`, `is_public`, `updated_by`

**Church Slug History** — URL history for backward-compatible redirects
- `id`, `church_id`, `slug`, `created_at`

---

## Key UX Goals

1. **Mobile-first** — primarily used on phones during active carol events
2. **Low cognitive load** — users should know exactly what to do next
3. **Clear visit state** — pending → arrived → in progress → visited
4. **Accessible** — users aged 14–70, including older adults
5. **Real-time** — live location sharing via Supabase Realtime

---

## Accessibility Goals

- Minimum 44×44px touch targets
- Minimum 16px body text, 14px secondary text
- Remove `userScalable: false` from viewport (currently set — KNOWN ISSUE)
- Remove `maximumScale: 1` from viewport (currently set — KNOWN ISSUE)
- Visible focus indicators
- Proper semantic HTML
- Form labels associated with inputs
- ARIA labels on icon-only buttons

---

## Important Constraints

- **Tailwind v4** — Uses CSS `@import "tailwindcss"` syntax, NOT `tailwind.config.js`
- **Custom CSS classes** in `globals.css` — `carol-card`, `carol-card-hover`, `btn-primary`, `btn-outline`, `carol-input`, `badge-*`, `page-container`, `hero-gradient`, `bottom-nav`, `pulse-dot`
- **Leaflet** requires dynamic import with `ssr: false` (browser-only API)
- **Supabase Realtime** used for live location updates
- Fonts loaded via Google Fonts (Inter) in layout head
- Leaflet CSS loaded via CDN in layout head

---

## Available Scripts

```bash
pnpm dev      # Next.js dev server (Turbopack)
pnpm build    # Production build
pnpm start    # Production server
pnpm lint     # ESLint
```

No `typecheck` script — use `npx tsc --noEmit` to type check.

