'use client';

/**
 * Church Tenant Scoped Layout
 *
 * Resolves [churchSlug] to the canonical church record.
 * Handles:
 * 1. Historical slug redirection (preserves previously shared URLs).
 * 2. Unauthenticated access on public routes (e.g. /[churchSlug]/live/*).
 * 3. Church existence validation ("We couldn't find this church").
 * 4. Tenant membership validation ("You don't have access to this church").
 */

import { useState, useEffect, use, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Church as ChurchIcon, AlertCircle, Home, LogOut } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import type { Church } from '@/types/database';

interface ChurchSlugLayoutProps {
  children: ReactNode;
  params: Promise<any>;
}

export default function ChurchSlugLayout({ children, params }: ChurchSlugLayoutProps) {
  const { churchSlug } = use(params);
  const pathname = usePathname();
  const router = useRouter();
  const { user, currentChurch, loading: authLoading, signOut } = useAuth();

  const [resolvedChurch, setResolvedChurch] = useState<Church | null>(null);
  const [resolving, setResolving] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [unauthorized, setUnauthorized] = useState(false);

  const isPublicLive = pathname.includes('/live');

  useEffect(() => {
    async function resolve() {
      const cleanSlug = churchSlug.trim().toLowerCase();

      try {
        // 1. Check if it's the current church in auth context
        if (currentChurch && currentChurch.slug?.toLowerCase() === cleanSlug) {
          setResolvedChurch(currentChurch);
          setResolving(false);
          return;
        }

        // 2. Query canonical church by slug
        const { data: canonical, error: canonErr } = await supabase
          .from('churches')
          .select('*')
          .eq('slug', cleanSlug)
          .maybeSingle();

        if (canonical) {
          setResolvedChurch(canonical as Church);
          setResolving(false);
          return;
        }

        // 3. Check historical slugs for redirect
        const { data: history } = await supabase
          .from('church_slug_history')
          .select('church_id, churches(*)')
          .eq('slug', cleanSlug)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (history) {
          const rawChurch = Array.isArray(history.churches)
            ? history.churches[0]
            : history.churches;

          if (rawChurch && rawChurch.slug) {
            // Seamlessly redirect from old slug to new canonical slug
            const newPath = pathname.replace(`/${churchSlug}`, `/${rawChurch.slug}`);
            router.replace(newPath);
            return;
          }
        }

        // Church does not exist
        setNotFound(true);
      } catch (err) {
        console.error('[ChurchSlugLayout] resolution error:', err);
        setNotFound(true);
      } finally {
        setResolving(false);
      }
    }

    resolve();
  }, [churchSlug, currentChurch, pathname, router]);

  // Check authorization for authenticated routes
  useEffect(() => {
    if (resolving || authLoading || isPublicLive || notFound || !resolvedChurch || !user) {
      return;
    }

    // Verify if user is an active member of this church
    async function checkMembership() {
      try {
        const { data: member } = await supabase
          .from('church_members')
          .select('id, role, status')
          .eq('church_id', resolvedChurch!.id)
          .eq('user_id', user!.id)
          .eq('status', 'active')
          .maybeSingle();

        if (!member) {
          setUnauthorized(true);
        } else {
          setUnauthorized(false);
        }
      } catch {
        setUnauthorized(true);
      }
    }

    checkMembership();
  }, [resolving, authLoading, isPublicLive, notFound, resolvedChurch, user]);

  // Loading state
  if (resolving) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <ChurchIcon size={36} className="text-green-600 animate-pulse mb-3" />
        <p className="text-xs text-slate-400">Loading church workspace…</p>
      </div>
    );
  }

  // Not Found State
  if (notFound) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <span className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-4">
          <AlertCircle size={28} />
        </span>
        <h1 className="text-xl font-bold text-slate-800">We couldn&apos;t find this church</h1>
        <p className="text-xs text-slate-500 mt-1.5 max-w-sm">
          The church address <code>/{churchSlug}</code> is not registered or may have been renamed.
        </p>
        <Link href="/" className="btn-primary mt-5 py-3 px-6 text-xs font-bold rounded-xl">
          Return to Home
        </Link>
      </div>
    );
  }

  // Unauthorized State (user belongs to another church)
  if (unauthorized && !isPublicLive) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <span className="w-14 h-14 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-4">
          <AlertCircle size={28} />
        </span>
        <h1 className="text-xl font-bold text-slate-800">You don&apos;t have access to this church</h1>
        <p className="text-xs text-slate-500 mt-1.5 max-w-sm leading-relaxed">
          Your account is not an active member of <strong>{resolvedChurch?.name}</strong>.
        </p>

        <div className="pt-4 flex flex-col gap-2.5 w-full max-w-xs">
          {currentChurch?.slug && (
            <Link
              href={`/${currentChurch.slug}/home`}
              className="btn-primary py-3.5 px-6 text-xs font-bold rounded-xl flex items-center justify-center gap-2"
            >
              <Home size={15} />
              <span>Go to My Church ({currentChurch.name})</span>
            </Link>
          )}

          <button
            type="button"
            onClick={() => signOut()}
            className="btn-outline py-3 px-6 text-xs font-semibold rounded-xl flex items-center justify-center gap-2 text-slate-600"
          >
            <LogOut size={14} />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
