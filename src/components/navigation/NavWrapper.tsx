'use client';

/**
 * NavWrapper — Conditionally renders BottomNav.
 * Hidden on /login, /signup, /forgot-password, /reset-password, /live/*, /join/*, and /church/setup.
 * Wrapped in <Suspense> so usePathname() does not block Next.js route prerendering.
 */

import { usePathname } from 'next/navigation';
import { Suspense } from 'react';
import { BottomNav } from '@/components/navigation/BottomNav';

function NavWrapperInner() {
  const pathname = usePathname();

  // Hide bottom navigation on auth screens, join/invite flow, church onboarding, and public live congregation view
  if (
    pathname === '/login' ||
    pathname === '/signup' ||
    pathname === '/forgot-password' ||
    pathname === '/reset-password' ||
    pathname === '/church/setup' ||
    pathname === '/live' ||
    pathname.startsWith('/live/') ||
    pathname === '/join' ||
    pathname.startsWith('/join/')
  ) {
    return null;
  }

  return <BottomNav />;
}

export function NavWrapper() {
  return (
    <Suspense fallback={null}>
      <NavWrapperInner />
    </Suspense>
  );
}
