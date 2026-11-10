'use client';

/**
 * Song Detail / Lyrics View
 *
 * Displays full lyrics, artist, category, and YouTube audio for a carol.
 * Admins can jump to edit/manage the song.
 */

import { useEffect, useState, use, Suspense } from 'react';
import Link from 'next/link';
import { ChevronLeft, ExternalLink, BookOpen, Music, Edit2, EyeOff, Globe } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import type { Song } from '@/types/database';

interface Props {
  params: Promise<{ songId: string }>;
}

function SongDetailContent({ params }: Props) {
  const { songId } = use(params);
  const { user, activeRole } = useAuth();
  const [song, setSong]             = useState<Song | null>(null);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');
  const [showLyrics, setShowLyrics] = useState(true);

  const isAdmin = activeRole === 'admin' || user?.churchRole === 'admin';

  useEffect(() => {
    async function load() {
      try {
        const { data, error: err } = await supabase
          .from('songs')
          .select('*')
          .eq('id', songId)
          .single();

        if (err || !data) throw err ?? new Error('Song not found');

        const s = data as Song;

        // If song is hidden and user is not admin, do not display
        if (s.is_hidden && !isAdmin) {
          setError('This song is currently unavailable.');
          return;
        }

        setSong(s);
      } catch {
        setError('Song not found.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [songId, isAdmin]);

  if (loading) {
    return (
      <div className="page-container bg-slate-50">
        <div className="bg-white border-b border-slate-100 px-4 pt-14 pb-4">
          <div className="flex items-center gap-3">
            <Link href="/songs" className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-100">
              <ChevronLeft size={18} className="text-slate-600" />
            </Link>
            <div className="h-5 w-32 bg-slate-200 rounded animate-pulse" />
          </div>
        </div>
        <div className="px-4 pt-4 space-y-3">
          <div className="carol-card p-4 animate-pulse">
            <div className="h-5 bg-slate-200 rounded w-1/2 mb-3" />
            <div className="h-3 bg-slate-100 rounded w-1/4 mb-6" />
            <div className="space-y-2">
              {[1, 2, 3, 4].map(i => <div key={i} className="h-3 bg-slate-100 rounded" />)}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !song) {
    return (
      <div className="page-container bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <p className="text-slate-500 text-sm">{error || 'Song not found'}</p>
        <Link href="/songs" className="btn-primary mt-4 py-2.5 px-5 text-xs font-semibold rounded-xl">
          ← Back to Songs
        </Link>
      </div>
    );
  }

  return (
    <div className="page-container bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-100 px-4 pt-14 pb-4 sticky top-0 z-20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href="/songs"
              className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors shrink-0"
            >
              <ChevronLeft size={18} />
            </Link>
            <h1 className="text-base font-bold text-slate-800 truncate">Song Details</h1>
          </div>

          {isAdmin && (
            <Link
              href={`/songs/${song.id}/edit`}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 hover:bg-green-100 text-green-700 text-xs font-semibold rounded-xl transition-colors"
            >
              <Edit2 size={13} />
              <span>Edit</span>
            </Link>
          )}
        </div>
      </div>

      <div className="px-4 pt-4 space-y-4 pb-12">
        {/* Hidden Song Notice for Admin */}
        {song.is_hidden && (
          <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-xs flex items-center gap-2">
            <EyeOff size={16} className="text-amber-600 shrink-0" />
            <span>This song is currently hidden from team members and the public live songbook.</span>
          </div>
        )}

        {/* Song info card */}
        <div className="carol-card p-4 space-y-4">
          <div className="flex items-center gap-3">
            <span className="flex items-center justify-center w-12 h-12 rounded-2xl bg-green-50 text-green-700 shrink-0">
              <Music size={22} />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="font-bold text-slate-800 text-lg leading-tight truncate">{song.title}</h2>
              {song.artist && <p className="text-sm text-slate-400 mt-0.5 truncate">{song.artist}</p>}
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                {song.category && (
                  <span className="text-[11px] bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded-full font-medium">
                    {song.category}
                  </span>
                )}
                {song.is_public ? (
                  <span className="text-[11px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Globe size={11} /> Public
                  </span>
                ) : (
                  <span className="text-[11px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                    Members Only
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Lyrics */}
          {song.lyrics ? (
            <div className="pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Lyrics</p>
                <button
                  id="toggle-lyrics"
                  onClick={() => setShowLyrics(v => !v)}
                  className="text-xs text-green-700 font-semibold flex items-center gap-1 hover:underline"
                >
                  <BookOpen size={12} />
                  <span>{showLyrics ? 'Hide Lyrics' : 'View Lyrics'}</span>
                </button>
              </div>

              {showLyrics && (
                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                  <pre className="text-sm text-slate-800 font-sans whitespace-pre-wrap leading-relaxed">
                    {song.lyrics}
                  </pre>
                </div>
              )}
            </div>
          ) : (
            <div className="p-4 bg-slate-50 rounded-2xl text-center text-xs text-slate-400">
              No lyrics added for this song yet.
            </div>
          )}

          {/* YouTube link */}
          {song.youtube_url && (
            <div className="pt-2 border-t border-slate-100">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Listen &amp; Practice</p>
              <a
                id="youtube-link"
                href={song.youtube_url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 text-sm text-blue-600 hover:underline break-all"
              >
                <ExternalLink size={14} className="shrink-0" />
                <span>{song.youtube_url}</span>
              </a>
            </div>
          )}
        </div>

        <Link
          href="/songs"
          className="btn-outline w-full py-3.5 text-xs font-semibold block text-center rounded-xl"
        >
          ← Back to Songbook
        </Link>
      </div>
    </div>
  );
}

export default function SongDetailPage(props: Props) {
  return (
    <Suspense
      fallback={
        <div className="page-container bg-slate-50 p-4 space-y-4 pt-14">
          <div className="skeleton w-full rounded-2xl h-14" />
          <div className="skeleton w-full rounded-2xl h-48" />
        </div>
      }
    >
      <SongDetailContent {...props} />
    </Suspense>
  );
}
