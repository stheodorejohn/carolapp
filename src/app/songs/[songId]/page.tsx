'use client';

import { useEffect, useState, use, Suspense } from 'react';
import Link from 'next/link';
import { ChevronLeft, ExternalLink, BookOpen, Music } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Song } from '@/types/database';

interface Props {
  params: Promise<{ songId: string }>;
}

function SongDetailContent({ params }: Props) {
  const { songId } = use(params);
  const [song, setSong]             = useState<Song | null>(null);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');
  const [showLyrics, setShowLyrics] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const { data, error: err } = await supabase
          .from('songs')
          .select('*')
          .eq('id', songId)
          .single();
        if (err) throw err;
        setSong(data as Song);
      } catch {
        setError('Song not found.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [songId]);

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
      <div className="page-container bg-slate-50 flex flex-col items-center justify-center">
        <p className="text-slate-500 text-sm">{error || 'Song not found'}</p>
        <Link href="/songs" className="text-green-700 font-semibold text-sm mt-3">← Back to Songs</Link>
      </div>
    );
  }

  return (
    <div className="page-container bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-100 px-4 pt-14 pb-4">
        <div className="flex items-center gap-3">
          <Link href="/songs" className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-100">
            <ChevronLeft size={18} className="text-slate-600" />
          </Link>
          <h1 className="text-base font-bold text-slate-800 flex-1">Song Details</h1>
        </div>
      </div>

      <div className="px-4 pt-4 space-y-4 pb-8">
        {/* Song info card */}
        <div className="carol-card p-4">
          <div className="flex items-center gap-3 mb-4">
            <span className="flex items-center justify-center w-12 h-12 rounded-2xl bg-green-50 flex-shrink-0">
              <Music size={22} className="text-green-700" />
            </span>
            <div>
              <h2 className="font-bold text-slate-800 text-lg leading-tight">{song.title}</h2>
              {song.artist && <p className="text-sm text-slate-400 mt-0.5">{song.artist}</p>}
              {song.category && (
                <span className="inline-block mt-1 text-xs bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded-full font-medium">
                  {song.category}
                </span>
              )}
            </div>
          </div>

          {/* Lyrics */}
          {song.lyrics && (
            <>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Lyrics</p>
                <button
                  id="toggle-lyrics"
                  onClick={() => setShowLyrics(v => !v)}
                  className="text-xs text-green-700 font-semibold flex items-center gap-1"
                >
                  <BookOpen size={12} />
                  {showLyrics ? 'Hide' : 'View Lyrics'}
                </button>
              </div>
              {showLyrics && (
                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                  <pre className="text-sm text-slate-700 font-sans whitespace-pre-wrap leading-relaxed">
                    {song.lyrics}
                  </pre>
                </div>
              )}
            </>
          )}

          {/* YouTube link */}
          {song.youtube_url && (
            <div className="mt-4">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">YouTube Link</p>
              <a
                id="youtube-link"
                href={song.youtube_url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 text-sm text-blue-600 hover:underline break-all"
              >
                <ExternalLink size={13} className="flex-shrink-0" />
                {song.youtube_url}
              </a>
            </div>
          )}
        </div>

        <Link href="/songs" className="btn-outline w-full block text-center">← Back to Songs</Link>
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
