'use client';

/**
 * NavWrapper — Conditionally renders BottomNav.
 * Hidden on /login, /signup, /forgot-password, /reset-password, and public /live/* pages.
 * Wrapped in <Suspense> so usePathname() does not block Next.js route prerendering.
 */

import { usePathname } from 'next/navigation';
import { Suspense } from 'react';
import { BottomNav } from '@/components/navigation/BottomNav';

function NavWrapperInner() {
  const pathname = usePathname();

  // Hide bottom navigation on auth screens and public live congregation view
  if (
    pathname === '/login' ||
    pathname === '/signup' ||
    pathname === '/forgot-password' ||
    pathname === '/reset-password' ||
    pathname === '/live' ||
    pathname.startsWith('/live/')
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

