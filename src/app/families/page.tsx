'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { Plus, Search, RefreshCw } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { FamilyCard } from '@/components/cards/FamilyCard';
import type { Family } from '@/types/database';

export default function FamiliesPage() {
  const { currentChurch } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [families, setFamilies] = useState<Family[]>([]);
  const [filtered, setFiltered] = useState<Family[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Canonical slug route redirection
  useEffect(() => {
    if (pathname === '/families' && currentChurch?.slug) {
      router.replace(`/${currentChurch.slug}/families`);
    }
  }, [pathname, currentChurch?.slug, router]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      let query = supabase
        .from('families')
        .select('*, members:family_members(*)')
        .order('name', { ascending: true });

      if (currentChurch?.id) {
        query = query.eq('church_id', currentChurch.id);
      }

      const { data, error: err } = await query;

      if (err) throw err;
      setFamilies((data ?? []) as Family[]);
    } catch {
      setError('Could not load families. Check your Supabase connection.');
    } finally {
      setLoading(false);
    }
  }, [currentChurch?.id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const q = search.toLowerCase();
    setFiltered(
      q
        ? families.filter(
            f =>
              f.name.toLowerCase().includes(q) ||
              f.address.toLowerCase().includes(q) ||
              f.phone?.toLowerCase().includes(q)
          )
        : families
    );
  }, [search, families]);

  return (
    <div className="page-container bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-100 px-4 pt-14 pb-4 sticky top-0 z-20">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-bold text-slate-800">Families</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={load}
              className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 transition-colors"
              aria-label="Refresh"
            >
              <RefreshCw size={14} className={`text-slate-600 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <Link
              href={currentChurch?.slug ? `/${currentChurch.slug}/families/new` : '/families/new'}
              className="flex items-center gap-1.5 bg-green-700 text-white text-xs font-semibold px-3 py-2 rounded-full"
            >
              <Plus size={14} /> Add Family
            </Link>
          </div>
        </div>
        <div className="relative">
          <Search size={15} className="absolute left-3.5 inset-y-0 my-auto text-slate-400" />
          <input
            id="family-search"
            type="search"
            placeholder="Search families…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="carol-input !pl-9 py-3 text-sm"
          />
        </div>
      </div>

      <div className="px-4 pt-4 pb-6">
        {/* Error */}
        {error && (
          <div className="rounded-xl bg-red-50 border border-red-100 px-3 py-2 mb-3 text-xs text-red-600 font-medium">
            ⚠️ {error}
          </div>
        )}

        <p className="text-xs text-slate-400 mb-3">
          {loading
            ? 'Loading…'
            : `${filtered.length} ${filtered.length === 1 ? 'family' : 'families'}${search ? ' found' : ' total'}`}
        </p>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="carol-card p-4 animate-pulse">
                <div className="h-4 bg-slate-200 rounded w-2/3 mb-2" />
                <div className="h-3 bg-slate-100 rounded w-full mb-1" />
                <div className="h-3 bg-slate-100 rounded w-1/3" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-2xl mb-2">🏠</p>
            <p className="text-slate-600 font-semibold text-sm">
              {search ? 'No families found' : 'No families yet'}
            </p>
            <p className="text-slate-400 text-xs mt-1">
              {search ? 'Try a different search' : 'Tap "Add Family" to get started'}
            </p>
            {search && (
              <button
                onClick={() => setSearch('')}
                className="text-xs text-green-700 font-semibold mt-3"
              >
                Clear search
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(family => (
              <FamilyCard key={family.id} family={family} churchSlug={currentChurch?.slug} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
