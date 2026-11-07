# 🎄 Let's Carol — Church Carol Tracking PWA

> Real-time tracking and route management for community caroling groups.  
> **Spread the joy. Share the love.**

---

## 🗂 Project Structure

```
src/
├── app/
│   ├── layout.tsx               # Root layout with BottomNav
│   ├── page.tsx                 # Home / Admin Dashboard
│   ├── login/page.tsx           # Login screen (email + password)
│   ├── admin/dashboard/page.tsx # Full admin dashboard with stats
│   ├── tracking/[groupId]/      # Live tracking map + sharing
│   ├── route/page.tsx           # Team route timeline
│   ├── route/[stopId]/page.tsx  # Check-in / Check-out screen
│   ├── stop/[stopId]/page.tsx   # Stop details (read-only timeline)
│   ├── families/page.tsx        # Families list
│   ├── families/[familyId]/     # Family detail + members
│   ├── songs/page.tsx           # Carol songs list
│   ├── songs/[songId]/page.tsx  # Song detail + lyrics
│   ├── share/page.tsx           # Generate & share live link
│   ├── location/page.tsx        # Current GPS location view
│   ├── live/[groupId]/page.tsx  # Public read-only live map
│   └── settings/page.tsx        # App settings
│
├── components/
│   ├── navigation/BottomNav.tsx # Mobile bottom tab bar
│   ├── cards/
│   │   ├── RouteCard.tsx        # Timeline route stop card
│   │   ├── FamilyCard.tsx       # Family list card
│   │   └── SongCard.tsx         # Song list card
│   ├── map/LiveMap.tsx          # React-Leaflet map (SSR-safe)
│   └── ui/StatusBadge.tsx       # Visited / Pending / Live badges
│
├── hooks/
│   └── useGeolocation.ts        # navigator.geolocation.watchPosition
│
├── lib/
│   ├── supabase.ts              # Supabase client (+ server admin)
│   ├── mock-data.ts             # Full mock data for UI preview
│   └── utils.ts                 # cn(), formatTime(), formatDate()
│
└── types/
    └── database.ts              # All TypeScript interfaces
```

---

## 🚀 Quick Start

### 1. Install dependencies
```bash
npm install
```

### 2. Set up environment variables
```bash
cp .env.local .env.local   # already created — just fill in your keys
```

Edit `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_MAPBOX_TOKEN=your-mapbox-token  # optional, OSM is default
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 3. Set up the database
Run `schema.sql` in your Supabase SQL Editor to create all tables, RLS policies, and realtime subscriptions.

### 4. Start development
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## 🔑 Key Pages & Routes

| Route | Screen |
|-------|--------|
| `/` | Home dashboard with stats & quick actions |
| `/login` | Login screen |
| `/admin/dashboard` | Admin view with progress bar |
| `/tracking/grp-1` | Live map tracking + location sharing |
| `/route/[stopId]` | Check-in / Check-out screen |
| `/stop/[stopId]` | Stop details timeline (read-only) |
| `/families` | Families list with search |
| `/families/[id]` | Family detail + members |
| `/songs` | Carol songbook list |
| `/songs/[id]` | Song lyrics + YouTube link |
| `/share` | Generate shareable tracking link |
| `/location` | Current GPS location view |
| `/live/[groupId]` | Public read-only live map (for congregation) |
| `/settings` | App settings |

---

## 🏗 Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 |
| Icons | Lucide React |
| Mapping | React-Leaflet + OpenStreetMap |
| Backend | Supabase (Auth + Postgres + Realtime) |
| PWA | Web App Manifest |

---

## 🗄 Database Schema

All tables are defined in [`schema.sql`](./schema.sql):

- **`users`** — Auth users with `admin` / `leader` roles
- **`families`** — Family records with GPS coordinates
- **`family_members`** — Members linked to families
- **`groups`** — Carol teams with live GPS position
- **`routes`** — Stop assignments with `pending / in_progress / visited` status
- **`songs`** — Digital songbook with lyrics and YouTube links

RLS policies ensure leaders can only update their own group's data. Realtime is enabled on `groups` and `routes` tables.

---

## 📍 Live Location Flow

```
Leader device                    Supabase DB              Congregation
     │                               │                        │
     │── useGeolocation.watchPosition ──>                      │
     │── supabase.from('groups').update(lat, lng) ──>          │
     │                               │── Realtime broadcast ──>│
     │                               │                        │── /live/[groupId] updates map
```

---

## 🎨 Design System

| Token | Value |
|-------|-------|
| Primary green | `#166534` (emerald-800) |
| Card background | `#ffffff` |
| App background | `#f8fafc` (slate-50) |
| Card radius | `16px` |
| Card shadow | `shadow-sm` |
| Font | Inter (Google Fonts) |

Badge variants: `visited` (green outline), `pending` (orange outline), `in_progress` (blue outline), `live` (green pulse dot)

---

## 🔌 Wiring Up Supabase (Production)

Replace the mock data calls in each page with Supabase queries:

```typescript
// Example: fetch routes for a group
const { data: routes } = await supabase
  .from('routes')
  .select('*, family:families(*)')
  .eq('group_id', groupId)
  .order('order_index');

// Example: realtime location subscription
supabase.channel('group-location')
  .on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'groups',
    filter: `id=eq.${groupId}`,
  }, (payload) => {
    setGroup(payload.new as Group);
  })
  .subscribe();
```

---

## 📱 PWA Installation

The app includes a `manifest.json` with:
- Standalone display mode
- Green theme color (`#166534`)
- App shortcuts for Live Tracking and Songs
- Icon references (`/icons/icon-192.png`, `/icons/icon-512.png`)

> **Note:** Add your own PNG icons to `public/icons/` before deploying.
