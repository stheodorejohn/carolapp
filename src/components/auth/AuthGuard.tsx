'use client';

/**
 * AuthGuard Component
 *
 * Protects application routes on the client side:
 * - Allows public routes: /login, /signup, /forgot-password, /reset-password, /live/*, /join/*
 * - Redirects unauthenticated users to /login?redirect=<path>
 * - Redirects authenticated users without a church to /church/setup
 * - Redirects authenticated users with a church away from /login, /signup, /forgot-password to /
 * - Wrapped in <Suspense> so usePathname() does not block Next.js route prerendering
 */

import { useEffect, Suspense, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { TreePine } from 'lucide-react';

const PUBLIC_PREFIXES = ['/login', '/signup', '/forgot-password', '/reset-password', '/live', '/join'];

function isPublicRoute(pathname: string | null): boolean {
  if (!pathname) return false;
  return PUBLIC_PREFIXES.some(prefix => pathname === prefix || pathname.startsWith(prefix + '/'));
}

function AuthGuardInner({ children }: { children: ReactNode }) {
  const { user, loading, hasChurch } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    const isPublic = isPublicRoute(pathname);

    // Unauthenticated user attempting to access a protected route
    if (!user && !isPublic) {
      const redirectUrl = `/login?redirect=${encodeURIComponent(pathname)}`;
      router.replace(redirectUrl);
      return;
    }

    // Authenticated user attempting to visit login/signup/forgot-password
    if (user && (pathname === '/login' || pathname === '/signup' || pathname === '/forgot-password')) {
      if (!hasChurch) {
        router.replace('/church/setup');
      } else {
        router.replace('/');
      }
      return;
    }

    // Authenticated user with NO church attempting to access internal pages (other than onboarding or join)
    if (user && !hasChurch && !isPublic && pathname !== '/church/setup') {
      router.replace('/church/setup');
      return;
    }

    // Authenticated user WITH church attempting to access church setup page
    if (user && hasChurch && pathname === '/church/setup') {
      router.replace('/');
      return;
    }
  }, [user, loading, hasChurch, pathname, router]);

  const isPublic = isPublicRoute(pathname);
  const showSpinner = loading && !isPublic;
  const showRedirecting = !loading && !user && !isPublic;

  return (
    <>
      {showSpinner && (
        <div className="flex flex-col items-center justify-center min-h-screen gap-4 bg-slate-50">
          <TreePine size={40} className="text-green-600 animate-pulse" />
          <p className="text-slate-500 text-sm">Loading…</p>
        </div>
      )}

      {showRedirecting && (
        <div className="flex flex-col items-center justify-center min-h-screen gap-4 bg-slate-50">
          <TreePine size={40} className="text-green-600 animate-pulse" />
          <p className="text-slate-500 text-sm">Redirecting to login…</p>
        </div>
      )}

      {/* 
        Always render children in the layout tree so Next.js layout validation 
        and Instant Navigation checks succeed without dropping segments.
        Hide visually when unauthenticated or loading on a protected route.
      */}
      <div
        style={showSpinner || showRedirecting ? { display: 'none' } : undefined}
        aria-hidden={showSpinner || showRedirecting ? 'true' : undefined}
      >
        {children}
      </div>
    </>
  );
}

export function AuthGuard({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<>{children}</>}>
      <AuthGuardInner>{children}</AuthGuardInner>
    </Suspense>
  );
}
