'use client';

import { useEffect, useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { SongCard } from '@/components/cards/SongCard';
import type { Song } from '@/types/database';

export default function SongsPage() {
  const { currentChurch } = useAuth();
  const [songs, setSongs] = useState<Song[]>([]);
  const [filtered, setFiltered] = useState<Song[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      try {
        let query = supabase
          .from('songs')
          .select('*')
          .order('order_index', { ascending: true });

        if (currentChurch?.id) {
          query = query.eq('church_id', currentChurch.id);
        }

        const { data, error: err } = await query;
        if (err) throw err;
        setSongs((data ?? []) as Song[]);
      } catch {
        setError('Could not load songs.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [currentChurch?.id]);

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

  return (
    <div className="page-container bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-100 px-4 pt-14 pb-4 sticky top-0 z-20">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-bold text-slate-800">Carol Songs</h1>
          <a
            href="/songs/new"
            className="flex items-center gap-1.5 bg-green-700 text-white text-xs font-semibold px-3 py-2 rounded-full"
          >
            <Plus size={14} /> Add Song
          </a>
        </div>
        <div className="relative">
          <Search size={15} className="absolute left-3.5 inset-y-0 my-auto text-slate-400" />
          <input
            id="song-search"
            type="search"
            placeholder="Search songs…"
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

        <p className="text-xs text-slate-400 mb-3">
          {loading ? 'Loading…' : `${filtered.length} songs in the songbook`}
        </p>

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
          <div className="text-center py-16">
            <p className="text-2xl mb-2">🎵</p>
            <p className="text-slate-600 font-semibold text-sm">
              {search ? 'No songs found' : 'No songs yet'}
            </p>
            <p className="text-slate-400 text-xs mt-1">
              {search ? 'Try a different search' : 'Tap "Add Song" to get started'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((song, i) => (
              <SongCard key={song.id} song={song} index={i} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
