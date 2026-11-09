# Carol Application — UX Audit

> Performed: 2026-11-09  
> Auditor: AI (Antigravity)  
> Scope: Full application based on code inspection

---

## UX-001 — Viewport Zoom Disabled (Accessibility Critical)

**Severity:** Critical  
**Affected users:** All users, especially older adults, visually impaired users

**Current problem:**  
In `src/app/layout.tsx`:
```typescript
export const viewport: Viewport = {
  maximumScale: 1,
  userScalable: false, // ← BLOCKS ZOOM
};
```

**Cognitive/accessibility impact:**  
Users aged 50+ frequently rely on browser zoom. This blocks them from enlarging text or UI elements. This is an accessibility violation per WCAG 1.4.4 (Resize text).

**Recommendation:**  
Remove `maximumScale: 1` and `userScalable: false`. Allow natural pinch-to-zoom.

**Status:** Not started

---

## UX-002 — BottomNav Visible on Login Page

**Severity:** High  
**Affected users:** All unauthenticated users

**Current problem:**  
`BottomNav` is rendered unconditionally in `RootLayout` and appears on the `/login` page. This creates visual confusion: a navigation bar with links to protected pages appears before the user is authenticated.

**Cognitive impact:**  
Users see navigation options before they've logged in. Clicking these would take them to functional pages (no auth guard exists). The login experience feels broken and unprofessional.

**Recommendation:**  
Conditionally hide `BottomNav` on the login and signup pages. This can be done by checking the pathname in the layout or using a layout group.

**Status:** Not started

---

## UX-003 — Navigation Label "Manage" is Vague

**Severity:** Medium  
**Affected users:** All users

**Current problem:**  
Bottom nav fourth item is labeled "Manage" pointing to `/settings/groups`. Users cannot predict what "Manage" contains without navigating there.

**Cognitive impact:**  
"Manage" could mean "manage anything". Users must guess what this section contains. This increases cognitive load and reduces discoverability.

**Recommendation:**  
Rename to something task-oriented. Options: "Groups", "Admin", "More". Given the overlap between admin dashboard and settings groups, consolidate admin functionality under a clear label.

**Status:** Not started

---

## UX-004 — Navigation Label Text Too Small

**Severity:** High  
**Affected users:** Older users, users with visual impairment

**Current problem:**  
In `BottomNav.tsx`:
```tsx
<span className={cn('text-[10px] font-medium', ...)}>
  {label}
</span>
```

`10px` text is below the recommended minimum of 12px for navigation labels. For users 50+, this may be unreadable without zooming (which is also blocked — see UX-001).

**Recommendation:**  
Use at least `text-xs` (12px) for navigation labels. Consider `text-[11px]` as a minimum if space is constrained.

**Status:** Not started

---

## UX-005 — Four Overlapping Location Concepts

**Severity:** High  
**Affected users:** Carol team, drivers, admin

**Current problem:**  
Four separate pages serve overlapping location purposes:
- `/location` — Driver starts GPS sharing
- `/tracking` → `/tracking/[groupId]` — Team views live map
- `/live/[groupId]` — Public congregation view  
- `/share` — Generates share link

Users must understand all four concepts to understand live location.

**Cognitive impact:**  
When a driver wants to share their location AND let the team track them AND let the congregation see them, they encounter three different screens with no clear relationship between them.

**Recommendation:**  
Create a unified "Live Location" experience that consolidates:
- Current sharing status (ON/OFF)
- Start/stop sharing controls
- Link to congregation view
- Link generation

The internal team tracking view and public view can remain separate pages but should be linked cohesively.

**Status:** Not started

---

## UX-006 — Share Page Duration Selector Has No Functional Effect

**Severity:** High  
**Affected users:** All users who share location

**Current problem:**  
In `/share/page.tsx`, a "Sharing Duration" picker offers 1 hour, 2 hours, 4 hours, Custom. The selected duration is stored in state but **never used** — no timer is set, no expiration logic exists, no actual location sharing is started when "Start Sharing" is pressed.

The button calls `navigator.share()` or copies the link — it does NOT start GPS tracking.

**Cognitive impact:**  
Users believe they are starting timed location sharing. They are actually just generating a shareable link. The GPS tracking must be started separately via `/location`. The UI lies to the user.

**Recommendation:**  
Either:
1. Remove the duration picker and clarify the button just shares a link to the live tracking page
2. Actually implement timed location sharing with proper start/stop/expiration logic

Option 2 is preferred but requires a consolidated Live Location experience (see UX-005).

**Status:** Not started

---

## UX-007 — Login Page Has No Real Authentication

**Severity:** Critical  
**Affected users:** All users

**Current problem:**  
`/login/page.tsx` simulates a 1200ms loading state then shows a "You're In!" message. It does not:
- Call Supabase Auth
- Create a session
- Protect any routes
- Redirect to appropriate page based on role

**Cognitive impact:**  
Any user can navigate directly to any page without logging in. The login page creates false confidence in security.

**Recommendation:**  
Implement full Supabase Auth integration:
- `signInWithPassword()` for login
- `signUp()` for registration
- Session management via auth context
- Protected route middleware

**Status:** In progress (Phase 2 of implementation plan)

---

## UX-008 — Home Page Says "Good morning, Admin" Hardcoded

**Severity:** Medium  
**Affected users:** All users

**Current problem:**  
`src/app/page.tsx` has hardcoded:
```tsx
<p className="text-green-300 text-sm font-medium">Good morning, Admin</p>
<h1 className="text-white text-2xl font-bold mt-1">Let's Carol 🎄</h1>
```

The greeting is hardcoded to "Admin" regardless of who is logged in, and the time-of-day check is not implemented.

**Recommendation:**  
Once auth is implemented, use the actual user's name. Implement time-aware greeting (morning/afternoon/evening).

**Status:** Dependent on UX-007 (Auth implementation)

---

## UX-009 — Route Page Lacks Clear "Current Stop" Visual Hierarchy

**Severity:** Medium  
**Affected users:** Carol team, drivers

**Current problem:**  
The route page at `/route` shows all stops in a timeline, but the "current" or "next" stop has no prominent visual differentiation beyond a subtle blue ring on `in_progress` stops.

Users navigating during a carol event need to immediately see: **WHERE AM I NOW? WHERE NEXT?**

**Recommendation:**  
- Add a sticky "Now" banner showing current stop prominently
- Distinguish "next stop" from future stops more clearly
- Use larger text and stronger visual treatment for the current stop

**Status:** Not started

---

## UX-010 — Add Family Form Has No Multi-Step Structure

**Severity:** Medium  
**Affected users:** Admin

**Current problem:**  
The add family form at `/families/new` is a large single-page form with many fields. Users are presented with all complexity at once.

**Recommendation:**  
Structure as logical sections:
1. Basic Info (name, phone)
2. Location (address, map pin)
3. Family Members
4. Review and Save

**Status:** Not started (lower priority)

---

## UX-011 — Public Live Tracking Page Has No Context

**Severity:** Medium  
**Affected users:** Public (congregation)

**Current problem:**  
The `/live/[groupId]` page shows a map but it's unclear to a congregation member:
- Which carol group they're viewing
- What the team's status is
- When the team will arrive at their home

**Recommendation:**  
Add clear context: team name, current status, next stop information if appropriate.

**Status:** Not started

---

## UX-012 — No Empty State for Route (Before Groups Created)

**Severity:** Medium  
**Affected users:** New users, admin

**Current problem:**  
When no group exists, `/tracking` shows a decent empty state. But `/route` currently shows a confusing experience.

**Status:** Partial — tracking has empty state, route may need work

---

## UX-013 — No Signup Page

**Severity:** Critical  
**Affected users:** New users

**Current problem:**  
No signup page exists. The login page has no link to create an account.

**Recommendation:**  
Create `/signup` page with:
- Username field
- Password field with strength meter + requirements checklist
- Confirm password field
- Password visibility toggle

**Status:** Not started

---

## Accessibility Issues Summary

| Issue | Severity | Location |
|-------|----------|----------|
| Zoom disabled (`userScalable: false`) | Critical | `layout.tsx` |
| Nav labels 10px | High | `BottomNav.tsx` |
| BottomNav on login page | High | `layout.tsx` |
| Hardcoded "Admin" greeting | Medium | `page.tsx` |
| Small label text (`text-xs` on form labels) | Medium | Multiple pages |
| Missing ARIA labels on some icon buttons | Medium | Multiple pages |
| No `role="status"` on loading states | Low | Multiple pages |
| Placeholder text used as supplementary label | Low | Form fields |

