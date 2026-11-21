import { NextRequest, NextResponse } from 'next/server';
import { parseLongMapsUrl } from '@/lib/maps-url';

/**
 * POST /api/resolve-maps-url
 * Body: { url: string }
 *
 * Resolves a short Google Maps URL (maps.app.goo.gl/..., goo.gl/maps/...) by
 * following the redirect server-side, then extracts lat/lng from the final URL.
 *
 * We follow the redirect server-side because:
 *  - Client-side fetch of goo.gl URLs is blocked by CORS
 *  - The Location header is only visible on the server
 *
 * Security:
 *  - Only Google Maps / Google domains are allowed
 *  - Max 5 redirect hops
 *  - 5-second timeout
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const rawUrl: string = typeof body.url === 'string' ? body.url.trim() : '';

    if (!rawUrl) {
      return NextResponse.json(
        { ok: false, error: 'url is required' },
        { status: 400 }
      );
    }

    // ── Safety: only allow Google Maps domains ──────────────────────────────────
    const ALLOWED_PATTERNS = [
      /^https?:\/\/maps\.app\.goo\.gl\//,
      /^https?:\/\/goo\.gl\/maps\//,
      /^https?:\/\/goo\.gl\//,
      /^https?:\/\/(www\.)?google\.(com|co\.[a-z]{2})\/maps\//,
      /^https?:\/\/maps\.google\.(com|co\.[a-z]{2})\//,
    ];

    const isAllowed = ALLOWED_PATTERNS.some(p => p.test(rawUrl));
    if (!isAllowed) {
      return NextResponse.json(
        { ok: false, error: 'Only Google Maps URLs are supported.' },
        { status: 400 }
      );
    }

    // ── Follow redirects (up to 5 hops) with a 5-second timeout ────────────────
    const finalUrl = await followRedirects(rawUrl, 5);

    if (!finalUrl) {
      return NextResponse.json(
        { ok: false, error: 'Could not resolve the URL — it may have expired or be a live-location link.' },
        { status: 422 }
      );
    }

    // ── Parse coordinates from the resolved long URL ────────────────────────────
    const result = parseLongMapsUrl(finalUrl);

    if (result.ok) {
      return NextResponse.json({
        ok: true,
        lat: result.lat,
        lng: result.lng,
        source: result.source,
        resolvedUrl: finalUrl,
      });
    }

    // Coords not found in resolved URL (e.g. live-location, saved list, My Maps)
    return NextResponse.json({
      ok: false,
      resolvedUrl: finalUrl,
      error: urlTypeHint(finalUrl),
    }, { status: 422 });

  } catch (err) {
    console.error('[resolve-maps-url] Error:', err);
    return NextResponse.json(
      { ok: false, error: 'Failed to resolve URL.' },
      { status: 500 }
    );
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function followRedirects(url: string, maxHops: number): Promise<string | null> {
  let current = url;

  for (let hop = 0; hop < maxHops; hop++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(current, {
        method: 'HEAD',
        redirect: 'manual',          // We handle redirects ourselves
        signal: controller.signal,
        headers: {
          // Mimic a mobile browser — Google serves different redirects for bots
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
        },
      });

      clearTimeout(timer);

      const status = response.status;

      // If we landed on a final page (200, 404, etc.) — stop
      if (status < 300 || status >= 400) {
        return current;
      }

      // Follow the redirect
      const location = response.headers.get('location');
      if (!location) return current;

      // Resolve relative redirects
      try {
        current = new URL(location, current).toString();
      } catch {
        return current;
      }

    } catch (err: unknown) {
      // On timeout or network error, return what we have so far
      if (err instanceof Error && err.name === 'AbortError') {
        return current;
      }
      return null;
    }
  }

  return current;
}

/**
 * Returns a helpful error message based on what type of Google Maps URL
 * the resolved URL looks like (live location, saved list, My Maps, etc.)
 */
function urlTypeHint(url: string): string {
  if (url.includes('/maps/d/')) {
    return 'This is a Google My Maps link. Open the map and copy a pin\'s coordinates manually.';
  }
  if (url.includes('maps/rpc/locationsharing') || url.includes('locationsharing')) {
    return 'This is a Live Location sharing link. Location changes in real time — enter coordinates manually.';
  }
  if (url.includes('/maps/contrib') || url.includes('/maps/placelists')) {
    return 'This is a Saved Places list link. Open the list and copy individual pin coordinates.';
  }
  if (url.includes('/maps/dir/')) {
    return 'This is a Directions link. Use the destination address coordinates, or pin the destination to get coords.';
  }
  return 'No GPS coordinates found in this URL. Try pasting the full browser URL from Google Maps, or enter lat/lng manually.';
}
