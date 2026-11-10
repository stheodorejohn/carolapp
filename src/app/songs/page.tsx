'use client';

/**
 * Carol Songs Page
 *
 * Displays songs in the church songbook.
 * Non-admins:
 * - View available unhidden songs
 * - Search songs
 * - Open song lyrics
 * Admins:
 * - Add new songs
 * - Quick toggle Hide / Show
 * - Edit song details
 * - View hidden drafts
 */

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { Plus, Search, Music, EyeOff } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { SongCard } from '@/components/cards/SongCard';
import type { Song } from '@/types/database';

export default function SongsPage() {
  const { currentChurch, user, activeRole } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [songs, setSongs] = useState<Song[]>([]);
  const [filtered, setFiltered] = useState<Song[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const isAdmin = activeRole === 'admin' || user?.churchRole === 'admin';

  // Canonical slug route redirection
  useEffect(() => {
    if (pathname === '/songs' && currentChurch?.slug) {
      router.replace(`/${currentChurch.slug}/songs`);
    }
  }, [pathname, currentChurch?.slug, router]);

  const loadSongs = useCallback(async () => {
    try {
      let query = supabase
        .from('songs')
        .select('*')
        .order('order_index', { ascending: true });

      if (currentChurch?.id) {
        query = query.eq('church_id', currentChurch.id);
      }

      // If not admin, RLS and query both filter out hidden songs
      if (!isAdmin) {
        query = query.eq('is_hidden', false);
      }

      const { data, error: err } = await query;
      if (err) throw err;
      setSongs((data ?? []) as Song[]);
    } catch {
      setError('Could not load songs.');
    } finally {
      setLoading(false);
    }
  }, [currentChurch?.id, isAdmin]);

  useEffect(() => {
    loadSongs();
  }, [loadSongs]);

  useEffect(() => {
    const q = search.toLowerCase();
    setFiltered(
      q
        ? songs.filter(
          s =>
            s.title.toLowerCase().includes(q) ||
            s.artist?.toLowerCase().includes(q) ||
            s.category?.toLowerCase().includes(q)
        )
        : songs
    );
  }, [search, songs]);

  async function handleToggleHide(song: Song) {
    if (!isAdmin || togglingId) return;
    const newHidden = !song.is_hidden;
    setTogglingId(song.id);

    // Optimistic UI update
    setSongs(prev =>
      prev.map(s => (s.id === song.id ? { ...s, is_hidden: newHidden } : s))
    );

    try {
      const { error: err } = await supabase
        .from('songs')
        .update({
          is_hidden: newHidden,
          updated_by: user?.id ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', song.id);

      if (err) throw err;
    } catch (err) {
      console.error('[SongsPage] toggle hide error:', err);
      // Rollback on error
      setSongs(prev =>
        prev.map(s => (s.id === song.id ? { ...s, is_hidden: !newHidden } : s))
      );
    } finally {
      setTogglingId(null);
    }
  }

  return (
    <div className="page-container bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-100 px-4 pt-14 pb-4 sticky top-0 z-20">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-xl font-bold text-slate-800">Carol Songs</h1>
            <p className="text-xs text-slate-400">{currentChurch?.name ?? 'Church Songbook'}</p>
          </div>

          {isAdmin && (
            <Link
              href={currentChurch?.slug ? `/${currentChurch.slug}/songs/new` : '/songs/new'}
              className="flex items-center gap-1.5 bg-green-700 hover:bg-green-800 text-white text-xs font-semibold px-3.5 py-2.5 rounded-full shadow-sm transition-colors"
            >
              <Plus size={15} />
              <span>Add Song</span>
            </Link>
          )}
        </div>

        <div className="relative">
          <Search size={15} className="absolute left-3.5 inset-y-0 my-auto text-slate-400 pointer-events-none" />
          <input
            id="song-search"
            type="search"
            placeholder="Search songs by title, artist, or category…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="carol-input !pl-9 py-3 text-sm"
          />
        </div>
      </div>

      <div className="px-4 pt-4 pb-6">
        {error && (
          <div className="rounded-xl bg-red-50 border border-red-100 px-3 py-2 mb-3 text-xs text-red-600 font-medium">
            ⚠️ {error}
          </div>
        )}

        <div className="flex items-center justify-between text-xs text-slate-400 mb-3 px-1">
          <span>{loading ? 'Loading…' : `${filtered.length} songs available`}</span>
          {isAdmin && songs.some(s => s.is_hidden) && (
            <span className="text-[11px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full font-medium">
              {songs.filter(s => s.is_hidden).length} hidden
            </span>
          )}
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="carol-card p-4 animate-pulse">
                <div className="h-4 bg-slate-200 rounded w-1/2 mb-2" />
                <div className="h-3 bg-slate-100 rounded w-1/4" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 carol-card p-6">
            <span className="flex items-center justify-center w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 mx-auto mb-3">
              <Music size={24} />
            </span>
            <p className="text-slate-700 font-semibold text-sm">
              {search ? 'No songs match your search' : 'No songs in the songbook yet'}
            </p>
            <p className="text-slate-400 text-xs mt-1 max-w-xs mx-auto">
              {search
                ? 'Try a different song title, lyric word, or composer.'
                : isAdmin
                ? 'Tap "Add Song" above to begin adding carols to your church songbook.'
                : 'Your church administrators will add carol lyrics here soon.'}
            </p>
            {isAdmin && !search && (
              <Link
                href="/songs/new"
                className="btn-primary inline-flex items-center gap-1.5 mt-4 py-2.5 px-4 text-xs font-bold rounded-xl"
              >
                <Plus size={14} />
                <span>Add First Song</span>
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-2.5">
            {filtered.map((song, i) => (
              <SongCard
                key={song.id}
                song={song}
                index={i}
                isAdmin={isAdmin}
                onToggleHide={handleToggleHide}
                hideToggling={togglingId === song.id}
                churchSlug={currentChurch?.slug}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
