'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, MapPin, Users, Music, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Suspense } from 'react';

const NAV_ITEMS = [
  { href: '/',                label: 'Home',     icon: Home     },
  { href: '/tracking', label: 'Tracking', icon: MapPin   },
  { href: '/families',        label: 'Families', icon: Users    },
  { href: '/songs',           label: 'Songs',    icon: Music    },
  { href: '/settings',        label: 'Settings', icon: Settings },
];

/** Inner component that reads usePathname — must be inside <Suspense> */
function NavItems() {
  const pathname = usePathname();
  return (
    <>
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || (href !== '/' && pathname.startsWith(href));
        return (
          <Link
            key={href}
            href={href}
            aria-label={label}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-colors min-w-[52px]',
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
              'text-[10px] font-medium',
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

/** Shell rendered during prerender — no active state, correct height */
function NavShell() {
  return (
    <>
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          aria-label={label}
          className="flex flex-col items-center gap-1 px-3 py-2 rounded-xl min-w-[52px] text-slate-400"
        >
          <span className="flex items-center justify-center w-10 h-7 rounded-full">
            <Icon size={20} strokeWidth={1.8} className="text-slate-400" />
          </span>
          <span className="text-[10px] font-medium">{label}</span>
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
