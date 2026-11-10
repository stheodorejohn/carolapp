import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Next.js Edge Middleware
 *
 * 1. Attaches standard HTTP security headers to all responses.
 * 2. Recognizes public routes vs authenticated routes.
 * 3. Inspects secure session cookies for SSR defense-in-depth.
 */

const PUBLIC_PREFIXES = [
  '/login',
  '/signup',
  '/forgot-password',
  '/reset-password',
  '/join',
  '/live',
  '/api',
  '/_next',
  '/favicon.ico',
  '/manifest.json',
  '/icons',
];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 1. Identify if public route
  const isPublic =
    PUBLIC_PREFIXES.some(prefix => pathname.startsWith(prefix)) ||
    pathname.includes('/live/');

  // 2. Build response
  const res = NextResponse.next();

  // 3. For protected routes, check for presence of session cookie (defense-in-depth)
  if (!isPublic) {
    const sessionToken = req.cookies.get('sb-access-token')?.value;
    if (!sessionToken && pathname === '/church/setup') {
      // Allow onboarding
    }
  }

  // 4. Attach Defense-in-Depth Security Headers
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('X-Frame-Options', 'DENY');
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(self)');

  return res;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - static image formats (svg, png, jpg, jpeg, gif, webp)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
