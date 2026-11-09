'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, MapPin, Music, MoreHorizontal, Users, Navigation } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Suspense } from 'react';
import { useAuth } from '@/lib/auth-context';
import type { AppRole } from '@/types/database';

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
}

function getNavItemsForRole(role: AppRole): NavItem[] {
  switch (role) {
    case 'admin':
      return [
        { href: '/',                label: 'Today',    icon: Home          },
        { href: '/families',        label: 'Families', icon: Users         },
        { href: '/route',           label: 'Route',    icon: MapPin        },
        { href: '/admin/dashboard', label: 'More',     icon: MoreHorizontal },
      ];
    case 'driver':
      return [
        { href: '/',                label: 'Today',    icon: Home          },
        { href: '/route',           label: 'Route',    icon: MapPin        },
        { href: '/location',        label: 'Live',     icon: Navigation    },
        { href: '/admin/dashboard', label: 'More',     icon: MoreHorizontal },
      ];
    case 'team_member':
    default:
      return [
        { href: '/',                label: 'Today',    icon: Home          },
        { href: '/route',           label: 'Route',    icon: MapPin        },
        { href: '/songs',           label: 'Songs',    icon: Music         },
        { href: '/admin/dashboard', label: 'More',     icon: MoreHorizontal },
      ];
  }
}

/** Inner component that reads usePathname and active role — must be inside <Suspense> */
function NavItems() {
  const pathname = usePathname();
  const { activeRole } = useAuth();
  const navItems = getNavItemsForRole(activeRole);

  return (
    <>
      {navItems.map(({ href, label, icon: Icon }) => {
        const active =
            pathname === href ||
            (href !== '/' && pathname.startsWith(href)) ||
            // Treat /settings/* routes as active for the More tab
            (href === '/admin/dashboard' && (pathname.startsWith('/settings') || pathname.startsWith('/admin')));
        return (
          <Link
            key={href}
            href={href}
            aria-label={label}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-colors min-w-[56px]',
              active ? 'text-green-700' : 'text-slate-400 hover:text-slate-600'
            )}
          >
            <span className={cn(
              'flex items-center justify-center w-10 h-7 rounded-full transition-all',
              active && 'bg-green-50'
            )}>
              <Icon
                size={20}
                strokeWidth={active ? 2.5 : 1.8}
                className={active ? 'text-green-700' : 'text-slate-400'}
              />
            </span>
            <span className={cn(
              'text-[11px] font-medium leading-tight',
              active ? 'text-green-700' : 'text-slate-400'
            )}>
              {label}
            </span>
          </Link>
        );
      })}
    </>
  );
}

/** Shell rendered during prerender — default team member layout */
function NavShell() {
  const defaultItems = getNavItemsForRole('team_member');
  return (
    <>
      {defaultItems.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          aria-label={label}
          className="flex flex-col items-center gap-1 px-3 py-2 rounded-xl min-w-[56px] text-slate-400"
        >
          <span className="flex items-center justify-center w-10 h-7 rounded-full">
            <Icon size={20} strokeWidth={1.8} className="text-slate-400" />
          </span>
          <span className="text-[11px] font-medium leading-tight">{label}</span>
        </Link>
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
