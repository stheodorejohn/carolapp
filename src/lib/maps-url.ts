/**
 * Google Maps URL Parser — All Formats
 *
 * Supports all Google Maps URL formats including:
 *   1. Shortened links  — maps.app.goo.gl/... | goo.gl/maps/... (require server-side resolution)
 *   2. Full place URLs  — google.com/maps/place/Name/@lat,lng,zoom
 *   3. Coordinate URLs  — google.com/maps?q=lat,lng | search/?query=lat,lng
 *   4. Data-param URLs  — google.com/maps/place/...!3dlat!4dlng
 *   5. Directions URLs  — google.com/maps/dir/.../data=... (extract via !3d/!4d)
 *   6. Embed URLs       — google.com/maps/embed?pb=...
 *   7. Live/list links  — resolve as short URL; lat/lng extracted if present
 */

export type ParseResult =
  | { ok: true; lat: number; lng: number; source: string }
  | { ok: false; needsResolution: true; reason: 'short_url' }
  | { ok: false; needsResolution: false; reason: string };

/**
 * Returns true when the URL is a short link that must be resolved
 * server-side before coordinates can be extracted.
 */
export function isShortMapsUrl(url: string): boolean {
  return (
    url.includes('maps.app.goo.gl') ||
    url.includes('goo.gl/maps') ||
    // Live-location and trip-progress short links use the same domain
    /^https?:\/\/goo\.gl\//.test(url)
  );
}

/**
 * Synchronously parse a *long* Google Maps URL to extract coordinates.
 * Does NOT follow redirects. Call resolveAndParse() for short URLs.
 */
export function parseLongMapsUrl(url: string): ParseResult {
  if (!url.trim()) {
    return { ok: false, needsResolution: false, reason: 'empty_url' };
  }

  try {
    // ── Pattern 1: !3dlat!4dlng — exact dropped-pin coords (highest accuracy) ──
    // e.g. ...data=!4m5!...!3d13.082700!4d80.270700
    // Prioritised over @lat,lng because !3d/!4d encode the actual pin, whereas
    // @lat,lng is the camera viewport centre which can be slightly offset.
    const dataMatch = url.match(/!3d(-?\d+\.?\d*)!4d(-?\d+\.?\d*)/);
    if (dataMatch) {
      const lat = parseFloat(dataMatch[1]);
      const lng = parseFloat(dataMatch[2]);
      if (isValidCoord(lat, lng)) {
        return { ok: true, lat, lng, source: '!3d!4d data params' };
      }
    }

    // ── Pattern 2: /@lat,lng,zoom — camera viewport (fallback) ─────────────────
    // e.g. https://www.google.com/maps/place/Foo/@13.0827,80.2707,17z/data=...
    // Used when no !3d!4d pin is encoded (search results, directions viewport).
    const atMatch = url.match(/@(-?\d{1,3}\.?\d*),(-?\d{1,3}\.?\d*)/);
    if (atMatch) {
      const lat = parseFloat(atMatch[1]);
      const lng = parseFloat(atMatch[2]);
      if (isValidCoord(lat, lng)) {
        return { ok: true, lat, lng, source: '@lat,lng' };
      }
    }

    // ── Pattern 3: ?q=lat,lng  or  &q=lat,lng ───────────────────────────────────
    // e.g. https://maps.google.com/?q=13.0827,80.2707
    const qMatch = url.match(/[?&]q=(-?\d+\.?\d*),(-?\d+\.?\d*)/);
    if (qMatch) {
      const lat = parseFloat(qMatch[1]);
      const lng = parseFloat(qMatch[2]);
      if (isValidCoord(lat, lng)) {
        return { ok: true, lat, lng, source: '?q= param' };
      }
    }

    // ── Pattern 4: ?query=lat,lng  or  &query=lat,lng ───────────────────────────
    // e.g. https://www.google.com/maps/search/?api=1&query=13.0827,80.2707
    const queryMatch = url.match(/[?&]query=(-?\d+\.?\d*),(-?\d+\.?\d*)/);
    if (queryMatch) {
      const lat = parseFloat(queryMatch[1]);
      const lng = parseFloat(queryMatch[2]);
      if (isValidCoord(lat, lng)) {
        return { ok: true, lat, lng, source: '?query= param' };
      }
    }

    // ── Pattern 5: ?ll=lat,lng — legacy Google Maps ──────────────────────────────
    const llMatch = url.match(/[?&]ll=(-?\d+\.?\d*),(-?\d+\.?\d*)/);
    if (llMatch) {
      const lat = parseFloat(llMatch[1]);
      const lng = parseFloat(llMatch[2]);
      if (isValidCoord(lat, lng)) {
        return { ok: true, lat, lng, source: '?ll= param' };
      }
    }

    // ── Pattern 6: ?center=lat,lng — embed/static maps ──────────────────────────
    const centerMatch = url.match(/[?&]center=(-?\d+\.?\d*),(-?\d+\.?\d*)/);
    if (centerMatch) {
      const lat = parseFloat(centerMatch[1]);
      const lng = parseFloat(centerMatch[2]);
      if (isValidCoord(lat, lng)) {
        return { ok: true, lat, lng, source: '?center= param' };
      }
    }

    // ── Pattern 7: ?destination=lat,lng — directions destination ────────────────
    const destMatch = url.match(/[?&]destination=(-?\d+\.?\d*),(-?\d+\.?\d*)/);
    if (destMatch) {
      const lat = parseFloat(destMatch[1]);
      const lng = parseFloat(destMatch[2]);
      if (isValidCoord(lat, lng)) {
        return { ok: true, lat, lng, source: '?destination= param' };
      }
    }

    // ── Pattern 8: Bare lat,lng in /dir/ paths ───────────────────────────────────
    // Directions like /dir/13.0827,80.2707/Chennai — pick the last coord pair
    const dirMatch = [...url.matchAll(/\/(-?\d{1,3}\.\d{4,}),(-?\d{1,3}\.\d{4,})/g)];
    if (dirMatch.length > 0) {
      const last = dirMatch[dirMatch.length - 1];
      const lat = parseFloat(last[1]);
      const lng = parseFloat(last[2]);
      if (isValidCoord(lat, lng)) {
        return { ok: true, lat, lng, source: 'dir/ path coords' };
      }
    }

  } catch {
    // fall through
  }

  return {
    ok: false,
    needsResolution: false,
    reason: 'no_coords_found',
  };
}

/**
 * Client-side entry point.
 * - Short URLs → returns needsResolution: true (caller must call API)
 * - Long URLs  → parses synchronously and returns coords or error
 */
export function classifyAndParse(url: string): ParseResult {
  const trimmed = url.trim();
  if (!trimmed) return { ok: false, needsResolution: false, reason: 'empty_url' };

  if (isShortMapsUrl(trimmed)) {
    return { ok: false, needsResolution: true, reason: 'short_url' };
  }

  return parseLongMapsUrl(trimmed);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isValidCoord(lat: number, lng: number): boolean {
  return (
    !isNaN(lat) && !isNaN(lng) &&
    lat >= -90 && lat <= 90 &&
    lng >= -180 && lng <= 180 &&
    // Exclude 0,0 — almost certainly a parse error
    !(lat === 0 && lng === 0)
  );
}
