# Carol Application — Architecture Documentation

---

## Application Structure Overview

```
caroltracker/
├── src/
│   ├── app/                    # Next.js App Router pages
│   ├── components/             # Shared React components
│   ├── hooks/                  # Custom React hooks
│   ├── lib/                    # Utilities and client setup
│   └── types/                  # TypeScript type definitions
├── supabase/                   # Database schema and migrations
├── public/                     # Static assets (icons, manifests)
└── docs/ai/                    # AI handoff documentation (this directory)
```

---

## Routing Architecture

### Next.js App Router
All routes use the App Router (`src/app/` directory).

### Route Map

| Route | File | Description | Auth Required |
|-------|------|-------------|---------------|
| `/` | `app/page.tsx` | Home / Today screen (redirects to `/[slug]/home`) | Authenticated |
| `/[churchSlug]/home` | `app/[churchSlug]/home/page.tsx` | Today screen scoped to church | Authenticated |
| `/[churchSlug]/families` | `app/[churchSlug]/families/page.tsx` | Family list & search | Authenticated |
| `/[churchSlug]/families/new` | `app/[churchSlug]/families/new/page.tsx` | Add family wizard | Authenticated |
| `/[churchSlug]/families/[familyId]` | `app/[churchSlug]/families/[familyId]/page.tsx` | Family detail | Authenticated |
| `/[churchSlug]/route` | `app/[churchSlug]/route/page.tsx` | Route stops list | Authenticated |
| `/[churchSlug]/route/[stopId]` | `app/[churchSlug]/route/[stopId]/page.tsx` | Stop detail / visit flow | Authenticated |
| `/[churchSlug]/songs` | `app/[churchSlug]/songs/page.tsx` | Church songbook (Admin controls or Member view) | Authenticated |
| `/[churchSlug]/songs/new` | `app/[churchSlug]/songs/new/page.tsx` | Admin: Add new song | Authenticated (Admin) |
| `/[churchSlug]/songs/[songId]` | `app/[churchSlug]/songs/[songId]/page.tsx` | Song lyrics detail | Authenticated |
| `/[churchSlug]/songs/[songId]/edit` | `app/[churchSlug]/songs/[songId]/edit/page.tsx` | Admin: Edit, hide, or delete song | Authenticated (Admin) |
| `/[churchSlug]/location` | `app/[churchSlug]/location/page.tsx` | Driver GPS broadcast | Authenticated (Driver/Admin) |
| `/[churchSlug]/share` | `app/[churchSlug]/share/page.tsx` | Congregation tracking share link generator | Authenticated |
| `/[churchSlug]/tracking` | `app/[churchSlug]/tracking/page.tsx` | Team live map redirect | Authenticated |
| `/[churchSlug]/tracking/[groupId]` | `app/[churchSlug]/tracking/[groupId]/page.tsx` | Team live tracking map | Authenticated |
| `/[churchSlug]/admin/dashboard` | `app/[churchSlug]/admin/dashboard/page.tsx` | Admin / More hub | Authenticated |
| `/[churchSlug]/church/settings` | `app/[churchSlug]/church/settings/page.tsx` | Church slug, name, members & invites | Authenticated (Admin) |
| `/[churchSlug]/live` | `app/[churchSlug]/live/page.tsx` | Public live entrance | Public |
| `/[churchSlug]/live/[groupId]` | `app/[churchSlug]/live/[groupId]/page.tsx` | Public Live Tracking & Songs (no silent fallback) | Public |
| `/login` | `app/login/page.tsx` | Login page with Supabase Auth & invite banner | Public |
| `/signup` | `app/signup/page.tsx` | Registration with strength meter & church join | Public |
| `/join/[token]` | `app/join/[token]/page.tsx` | Secure church invitation landing & join screen | Public / Auth |
| `/church/setup` | `app/church/setup/page.tsx` | Church onboarding, smart slug suggestion & setup | Authenticated |
| `/church/settings` | `app/church/settings/page.tsx` | Legacy redirect to church settings | Authenticated (Admin) |
| `/forgot-password` | `app/forgot-password/page.tsx` | Password reset request | Public |
| `/reset-password` | `app/reset-password/page.tsx` | Set new password from recovery link | Public / Recovery |
| `/admin/dashboard` | `app/admin/dashboard/page.tsx` | Central "More" hub & role switcher | Authenticated |
| `/api/churches/check-slug` | `app/api/churches/check-slug/route.ts` | Real-time debounced slug availability check | Public |
| `/api/invites/validate` | `app/api/invites/validate/route.ts` | Validates invite token without exposing secrets | Public |
| `/api/invites/accept` | `app/api/invites/accept/route.ts` | Accepts invite & creates church membership | Authenticated |
| `/api/invites/generate` | `app/api/invites/generate/route.ts` | Generates random token & stores token hash | Admin |
| `/api/invites/deactivate` | `app/api/invites/deactivate/route.ts` | Deactivates invite link | Admin |

### Planned Routes (Not Yet Created)
| Route | Purpose |
|-------|---------|
| `/signup` | User registration |
| `/auth/callback` | Supabase Auth OAuth callback |

---

## Main Layouts

### Root Layout (`src/app/layout.tsx`)
```
html
└── body
    ├── main (children)      ← page content
    └── BottomNav            ← always rendered (even on /login — ISSUE)
```

**Issues:**
- `BottomNav` renders on **all pages** including login — should be conditional
- `maximumScale: 1` and `userScalable: false` in viewport metadata — accessibility violation
- Fonts and Leaflet CSS loaded via `<head>` links in layout

---

## Page Structure Patterns

### Standard Page Pattern
```tsx
'use client'  // all pages are client components currently

// 1. useState for data, loading, error
// 2. useEffect → supabase query
// 3. Return JSX:
//    - div.page-container (full viewport height scroll)
//    - Sticky header div
//    - Content div with padding
```

### CSS Layout Classes (from globals.css)
```css
.page-container    /* min-height: 100dvh, padding-bottom for nav */
.hero-gradient     /* dark green gradient header */
.carol-card        /* white card with border radius + shadow */
.carol-card-hover  /* adds hover/active scale transform */
.bottom-nav        /* fixed bottom navigation bar */
.safe-bottom       /* env(safe-area-inset-bottom) padding */
```

---

## Shared Components

### Bottom Navigation (`BottomNav.tsx`)
Current 4 items:
- Home (`/`)
- Tracking (`/tracking`)
- Songs (`/songs`)
- Manage (`/settings/groups`)

**Issues:**
- "Tracking" is ambiguous (is it driver tracking or admin live view?)
- "Manage" is vague
- Label text is `text-[10px]` — too small (accessibility issue)
- Rendered on login page — should be hidden there

### Cards
- `FamilyCard` — Links to `/families/[id]`, shows name, address, phone
- `RouteCard` — Timeline-style card, links to `/route/[id]`, shows status badge
- `SongCard` — Links to `/songs/[id]`

### UI Components
- `StatusBadge` — Pill badge: `visited`, `pending`, `arrived`, `in_progress`, `live`
- `TodayDate` — Renders today's date string

---

## State Management

**Pattern: Local state per page — no global store**

Each page component manages its own:
- `loading` boolean
- `error` string
- Domain data (families, routes, etc.)

Data is fetched fresh on each page mount via `useEffect`.

**No shared auth state** — this needs to be added.

### Planned Auth State Shape
```typescript
// New: src/lib/auth-context.tsx (to be created)
interface AuthContext {
  user: User | null;
  activeRole: UserRole | null;
  loading: boolean;
  signIn: (username: string, password: string) => Promise<void>;
  signUp: (username: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  switchRole: (role: UserRole) => void;
}
```

---

## API / Data Fetching Patterns

All data fetching uses the **Supabase JavaScript client** directly in client components.

### Pattern
```typescript
const { data, error } = await supabase
  .from('table_name')
  .select('*, relation:other_table(*)')
  .eq('field', value)
  .order('field', { ascending: true })
  .limit(n)
  .single(); // or .maybeSingle() or no method for arrays
```

### Active Group Pattern (used in multiple pages)
```typescript
// Get the first active group — used on: home, tracking, location, share pages
const { data: activeGroup } = await supabase
  .from('groups')
  .select('id')
  .eq('is_active', true)
  .order('created_at', { ascending: true })
  .limit(1)
  .single();
```

This pattern is **duplicated across 4+ pages** — should be centralized.

### Realtime Pattern (used in live tracking)
```typescript
const channel = supabase.channel('groups')
  .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'groups' },
    (payload) => { /* update state */ }
  )
  .subscribe();
// cleanup: supabase.removeChannel(channel)
```

---

## Authentication / Authorization Architecture

### Current State
- **Supabase Auth** available but not implemented
- Login page is a stub
- No session context
- No protected route middleware
- RLS policies are open (`for all using (true)`)

### Required Implementation

#### Client Setup
```typescript
// supabase.ts already has:
export const supabase = createClient(url, anonKey);
// Auth methods available: supabase.auth.signInWithPassword(), signUp(), signOut(), getSession()
```

#### Middleware (to be created)
```typescript
// src/middleware.ts
// Use Supabase SSR auth to protect routes
// Redirect unauthenticated users to /login
```

#### Auth Context (to be created)
```typescript
// src/lib/auth-context.tsx
// React context providing user, role, auth actions
```

---

## Map / Location Architecture

### Map Component
- **Leaflet** via `react-leaflet`
- `LiveMap.tsx` — dynamically imported (`ssr: false`) to avoid SSR issues
- Shows group location marker + route stop markers
- Loaded from CDN CSS in root layout

### Location Tracking
- `useGeolocation` custom hook — wraps `navigator.geolocation.watchPosition`
- Writes updates to Supabase `groups` table (lat/lng/speed)
- Used in `/location` page (driver GPS sharing)

### Location Sharing Flow
```
Driver opens /location
    ↓
startTracking() → navigator.geolocation.watchPosition
    ↓  
onUpdate callback → supabase.update('groups', { lat, lng, speed })
    ↓
Realtime → Other clients receive update
    ↓
/tracking/[groupId] or /live/[groupId] → map updates
```

### Tracking vs Live vs Location vs Share
Currently four **separate** concepts that confuse users:

| Route | Purpose | Audience |
|-------|---------|----------|
| `/location` | DRIVER shares GPS | Driver |
| `/tracking/[groupId]` | TEAM views live map | Team members |
| `/live/[groupId]` | PUBLIC views live map | Congregation |
| `/share` | Generates share link | Admin / Team |

**Recommendation:** Consolidate under a "Live Location" concept (see UX_AUDIT.md)

---

## Tracking Architecture (Visit States)

```
Route Status State Machine:
pending → arrived → in_progress → visited
```

Each state transition updates `routes.status` and corresponding timestamp:
- `pending` → `arrived`: sets `arrived_at`
- `arrived` → `in_progress`: sets `checked_in_at`
- `in_progress` → `visited`: sets `checked_out_at`

---

## Important Domain Concepts

### Active Group
- `groups.is_active = true` — only one group should be active at a time (not enforced by DB)
- Multiple pages query for the "active group" and redirect/display based on it

### Visit Flow
```
Team arrives at address
    ↓ [Mark Arrived]
status = 'arrived'
    ↓ [Start Carol Visit]
status = 'in_progress'
    ↓ [Complete Visit]
status = 'visited'
```

### Public Sharing
- Groups have optional `slug` field (short URL segment)
- `/live/[groupId]` works with either UUID or slug
- Share link generated at `/share` page points to `/live/[groupId]`

---

## Database Architecture & Auth Synchronization

### Tables
- `auth.users` — Supabase managed internal auth table (stores credentials, email, password hash, user_metadata).
- `public.profiles` — Application user profiles synced automatically from `auth.users` via `on_auth_user_created` trigger. Contains `id` (PK, FK to `auth.users`), `email`, `full_name`, `role` (`admin | leader | team_member | driver`), `phone`, `avatar_url`.
- `public.families` — Carol recipient families.
- `public.family_members` — Family members with age and relationship.
- `public.groups` — Caroling teams/vehicles, includes `leader_id` referencing `profiles(id)`.
- `public.routes` — Stops/visits for a group (`pending`, `arrived`, `in_progress`, `visited`).
- `public.songs` — Hymn/song lyrics book.

### Auth Synchronization Trigger
When `supabase.auth.signUp()` runs, `on_auth_user_created` fires in PostgreSQL and automatically creates or updates the user's corresponding entry in `public.profiles`.




---

## Multi-Church Architecture & Security Model

```
Church (public.churches)
    ├── Church Members (public.church_members) [role: admin | team_member | driver]
    ├── Church Invites (public.church_invites) [token_hash, role, expiry, max_uses]
    ├── Families (public.families.church_id)
    │     └── Family Members (public.family_members.family_id)
    ├── Carol Groups (public.groups.church_id)
    ├── Routes (public.routes.church_id) [group_id, family_id]
    └── Songs (public.songs.church_id)
```

### Tenant Isolation & Row Level Security (RLS)

1. **Database-Controlled Membership Roles**:
   `church_members.role` is the single source of truth for authorization. User-controlled JWT metadata or frontend state cannot grant elevated privileges.
2. **PostgreSQL Helper Functions**:
   - `is_church_member(church_id uuid)`: Verifies caller (`auth.uid()`) has an active membership.
   - `is_church_admin(church_id uuid)`: Verifies caller has an active `admin` membership.
   - `validate_route_tenant()` Trigger: Prevents cross-church corruption by ensuring `routes.church_id = groups.church_id = families.church_id`.
3. **Secure Invitation Architecture**:
   - Generates cryptographically secure 24-byte random tokens.
   - Stores only SHA-256 `token_hash` in `church_invites`.
   - Never exposes internal database UUIDs or secrets on the join screen.
   - Idempotently creates/activates `church_members` records with safe non-admin default roles (`team_member`).
4. **Public Live Tracking Boundaries**:
   - `/live/[groupId]` allows unauthenticated congregation access to active group GPS coordinates and progress.
   - Sensitive family phone numbers, notes, and other church records are strictly excluded from anon queries.
