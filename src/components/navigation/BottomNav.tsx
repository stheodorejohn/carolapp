'use client';

/**
 * Bottom Navigation Bar
 *
 * Role-aware and Church-slug aware bottom navigation.
 * Generates /[churchSlug]/... links when current church is active.
 * Tailors items to active role (Admin, Driver, Team Member).
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, MapPin, Music, MoreHorizontal, Users, Navigation } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Suspense } from 'react';
import { useAuth } from '@/lib/auth-context';
import type { AppRole } from '@/types/database';

interface NavItem {
  id: 'today' | 'families' | 'route' | 'songs' | 'live' | 'more';
  label: string;
  subpath: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
}

function getNavItemsForRole(role: AppRole): NavItem[] {
  switch (role) {
    case 'admin':
      return [
        { id: 'today',    label: 'Today',    subpath: '/home',            icon: Home },
        { id: 'families', label: 'Families', subpath: '/families',        icon: Users },
        { id: 'route',    label: 'Route',    subpath: '/route',           icon: MapPin },
        { id: 'more',     label: 'More',     subpath: '/admin/dashboard', icon: MoreHorizontal },
      ];
    case 'driver':
      return [
        { id: 'today', label: 'Today', subpath: '/home',            icon: Home },
        { id: 'route', label: 'Route', subpath: '/route',           icon: MapPin },
        { id: 'live',  label: 'Live',  subpath: '/location',        icon: Navigation },
        { id: 'more',  label: 'More',  subpath: '/admin/dashboard', icon: MoreHorizontal },
      ];
    case 'team_member':
    default:
      return [
        { id: 'today', label: 'Today', subpath: '/home',            icon: Home },
        { id: 'route', label: 'Route', subpath: '/route',           icon: MapPin },
        { id: 'songs', label: 'Songs', subpath: '/songs',           icon: Music },
        { id: 'more',  label: 'More',  subpath: '/admin/dashboard', icon: MoreHorizontal },
      ];
  }
}

function isTabActive(id: NavItem['id'], pathname: string, slug?: string | null): boolean {
  if (id === 'today') {
    return (
      pathname === '/' ||
      (!!slug && (pathname === `/${slug}` || pathname === `/${slug}/home`))
    );
  }
  if (id === 'families') {
    return pathname.includes('/families');
  }
  if (id === 'route') {
    return pathname.includes('/route');
  }
  if (id === 'songs') {
    return pathname.includes('/songs');
  }
  if (id === 'live') {
    return pathname.includes('/location');
  }
  if (id === 'more') {
    return pathname.includes('/admin') || pathname.includes('/settings') || pathname.includes('/church/settings');
  }
  return false;
}

/** Inner component that reads usePathname, currentChurch, and active role */
function NavItems() {
  const pathname = usePathname();
  const { activeRole, currentChurch } = useAuth();
  const slug = currentChurch?.slug;
  const navItems = getNavItemsForRole(activeRole);

  return (
    <>
      {navItems.map(item => {
        const Icon = item.icon;
        const active = isTabActive(item.id, pathname, slug);
        const href = slug
          ? `/${slug}${item.subpath}`
          : item.subpath === '/home' ? '/' : item.subpath;

        return (
          <Link
            key={item.id}
            href={href}
            aria-label={item.label}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-colors min-w-[56px]',
              active ? 'text-green-700' : 'text-slate-400 hover:text-slate-600'
            )}
          >
            <span
              className={cn(
                'flex items-center justify-center w-10 h-7 rounded-full transition-all',
                active && 'bg-green-50'
              )}
            >
              <Icon
                size={20}
                strokeWidth={active ? 2.5 : 1.8}
                className={active ? 'text-green-700' : 'text-slate-400'}
              />
            </span>
            <span
              className={cn(
                'text-[11px] font-medium leading-tight',
                active ? 'text-green-700' : 'text-slate-400'
              )}
            >
              {item.label}
            </span>
          </Link>
        );
      })}
    </>
  );
}

/** Shell rendered during prerender */
function NavShell() {
  const defaultItems = getNavItemsForRole('team_member');
  return (
    <>
      {defaultItems.map(({ id, label, icon: Icon }) => (
        <div
          key={id}
          className="flex flex-col items-center gap-1 px-3 py-2 rounded-xl min-w-[56px] text-slate-400"
        >
          <span className="flex items-center justify-center w-10 h-7 rounded-full">
            <Icon size={20} strokeWidth={1.8} className="text-slate-400" />
          </span>
          <span className="text-[11px] font-medium leading-tight">{label}</span>
        </div>
      ))}
    </>
  );
}

export function BottomNav() {
  return (
    <nav className="bottom-nav safe-bottom" aria-label="Main navigation">
      <Suspense fallback={<NavShell />}>
        <NavItems />
      </Suspense>
    </nav>
  );
}
