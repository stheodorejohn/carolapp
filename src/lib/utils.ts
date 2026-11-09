import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatTime(dateString: string | null): string {
  if (!dateString) return '--:--';
  return new Date(dateString).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

export function formatDate(dateString: string | null): string {
  if (!dateString) return '--';
  return new Date(dateString).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Resolves the absolute application URL based on current environment:
 * - In the browser: uses window.location.origin (e.g. http://localhost:3000 locally, or https://<project>.vercel.app on Vercel)
 * - In SSR/build: falls back to NEXT_PUBLIC_SITE_URL or NEXT_PUBLIC_VERCEL_URL or http://localhost:3000
 */
export function getAppURL(path: string = ''): string {
  const cleanPath = path.startsWith('/') ? path : path ? `/${path}` : '';
  if (typeof window !== 'undefined' && window.location.origin) {
    return `${window.location.origin}${cleanPath}`;
  }

  let base =
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.NEXT_PUBLIC_VERCEL_URL ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}` : null) ??
    'http://localhost:3000';

  if (!base.startsWith('http://') && !base.startsWith('https://')) {
    base = `https://${base}`;
  }
  base = base.replace(/\/+$/, '');

  return `${base}${cleanPath}`;
}
