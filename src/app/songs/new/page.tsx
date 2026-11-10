'use client';

/**
 * Add Carol Song Page
 *
 * Dedicated administrative interface to add a new song to the church songbook.
 * Accessible to authorized church administrators.
 * Designed for ages 14–70: clear labels, large inputs, obvious primary action.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, Music, Plus, AlertCircle, Eye, EyeOff, Globe } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';

export default function NewSongPage() {
  const router = useRouter();
  const { currentChurch, user, activeRole } = useAuth();

  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [category, setCategory] = useState('');
  const [lyrics, setLyrics] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [isHidden, setIsHidden] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isAdmin = activeRole === 'admin' || user?.churchRole === 'admin';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!isAdmin) {
      setError('Only church administrators can add songs to the songbook.');
      return;
    }

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError('Please enter a song title.');
      return;
    }

    if (!currentChurch?.id) {
      setError('Active church workspace not found.');
      return;
    }

    setLoading(true);
    try {
      // Find highest order index for the church
      const { data: existing } = await supabase
        .from('songs')
        .select('order_index')
        .eq('church_id', currentChurch.id)
        .order('order_index', { ascending: false })
        .limit(1);

      const nextOrder = (existing?.[0]?.order_index ?? 0) + 1;

      const { data: newSong, error: insertErr } = await supabase
        .from('songs')
        .insert({
          church_id: currentChurch.id,
          title: trimmedTitle,
          artist: artist.trim() || null,
          category: category.trim() || null,
          lyrics: lyrics.trim() || null,
          youtube_url: youtubeUrl.trim() || null,
          is_public: isPublic,
          is_hidden: isHidden,
          order_index: nextOrder,
          updated_by: user?.id ?? null,
        })
        .select('id')
        .single();

      if (insertErr) throw insertErr;

      router.push(`/songs/${newSong.id}`);
    } catch (err: unknown) {
      console.error('[NewSongPage] create error:', err);
      setError('Failed to create song. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  if (!isAdmin) {
    return (
      <div className="page-container bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <AlertCircle size={36} className="text-amber-500 mb-3" />
        <h2 className="text-lg font-bold text-slate-800">Administrator Access Required</h2>
        <p className="text-xs text-slate-500 mt-1 max-w-xs">
          Only church administrators can add new songs to the songbook.
        </p>
        <Link href="/songs" className="btn-primary mt-4 py-3 px-6 text-xs font-bold rounded-xl">
          ← Back to Songbook
        </Link>
      </div>
    );
  }

  return (
    <div className="page-container bg-slate-50">
      {/* Sticky Header */}
      <div className="bg-white border-b border-slate-100 px-4 pt-14 pb-4 sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <Link
            href="/songs"
            className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
          >
            <ChevronLeft size={18} />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="text-base font-bold text-slate-800">Add Carol Song</h1>
            <p className="text-xs text-slate-400">{currentChurch?.name ?? 'Church Songbook'}</p>
          </div>
        </div>
      </div>

      <div className="px-4 pt-4 pb-12">
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div
              role="alert"
              className="flex items-start gap-2.5 p-3.5 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs"
            >
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Song Details Card */}
          <div className="carol-card p-4 space-y-4">
            <div className="flex items-center gap-2 pb-1 border-b border-slate-100">
              <span className="p-2 rounded-xl bg-green-50 text-green-700">
                <Music size={18} />
              </span>
              <h2 className="text-sm font-bold text-slate-800">Song Information</h2>
            </div>

            <div>
              <label htmlFor="song-title" className="block text-xs font-semibold text-slate-700 mb-1">
                Song Title <span className="text-red-500">*</span>
              </label>
              <input
                id="song-title"
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="e.g. Silent Night, Holy Night"
                required
                className="carol-input w-full py-3 px-3.5 text-sm bg-white border border-slate-200 rounded-xl"
              />
            </div>

            <div>
              <label htmlFor="song-artist" className="block text-xs font-semibold text-slate-700 mb-1">
                Artist / Traditional Composer
              </label>
              <input
                id="song-artist"
                type="text"
                value={artist}
                onChange={e => setArtist(e.target.value)}
                placeholder="e.g. Franz Xaver Gruber / Traditional"
                className="carol-input w-full py-3 px-3.5 text-sm bg-white border border-slate-200 rounded-xl"
              />
            </div>

            <div>
              <label htmlFor="song-category" className="block text-xs font-semibold text-slate-700 mb-1">
                Category
              </label>
              <input
                id="song-category"
                type="text"
                value={category}
                onChange={e => setCategory(e.target.value)}
                placeholder="e.g. Traditional, Tamil Carol, Praise &amp; Worship"
                className="carol-input w-full py-3 px-3.5 text-sm bg-white border border-slate-200 rounded-xl"
              />
            </div>

            <div>
              <label htmlFor="song-lyrics" className="block text-xs font-semibold text-slate-700 mb-1">
                Lyrics
              </label>
              <textarea
                id="song-lyrics"
                rows={8}
                value={lyrics}
                onChange={e => setLyrics(e.target.value)}
                placeholder="Paste song verses and chorus here…"
                className="carol-input w-full p-3.5 text-sm font-sans leading-relaxed bg-white border border-slate-200 rounded-xl outline-none"
              />
            </div>

            <div>
              <label htmlFor="song-youtube" className="block text-xs font-semibold text-slate-700 mb-1">
                YouTube Audio / Video Link
              </label>
              <input
                id="song-youtube"
                type="url"
                value={youtubeUrl}
                onChange={e => setYoutubeUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
                className="carol-input w-full py-3 px-3.5 text-sm bg-white border border-slate-200 rounded-xl"
              />
            </div>
          </div>

          {/* Visibility Controls */}
          <div className="carol-card p-4 space-y-3">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Visibility &amp; Sharing</h3>

            {/* Public Live View Toggle */}
            <label className="flex items-center justify-between p-3 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-50 transition-colors">
              <div className="flex items-center gap-2.5">
                <Globe size={18} className="text-green-700 shrink-0" />
                <div>
                  <p className="text-xs font-bold text-slate-800">Public Live Songbook</p>
                  <p className="text-[11px] text-slate-400">Available to congregation on public live tracking</p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={isPublic}
                onChange={e => setIsPublic(e.target.checked)}
                className="w-5 h-5 accent-green-600 rounded"
              />
            </label>

            {/* Hidden Toggle */}
            <label className="flex items-center justify-between p-3 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-50 transition-colors">
              <div className="flex items-center gap-2.5">
                {isHidden ? (
                  <EyeOff size={18} className="text-amber-600 shrink-0" />
                ) : (
                  <Eye size={18} className="text-slate-500 shrink-0" />
                )}
                <div>
                  <p className="text-xs font-bold text-slate-800">Hide Song</p>
                  <p className="text-[11px] text-slate-400">Keep visible only to administrators for drafting</p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={isHidden}
                onChange={e => setIsHidden(e.target.checked)}
                className="w-5 h-5 accent-amber-600 rounded"
              />
            </label>
          </div>

          {/* Actions */}
          <div className="pt-2 space-y-2">
            <button
              type="submit"
              disabled={loading || !title.trim()}
              className="btn-primary w-full py-4 text-sm font-bold shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                'Saving Song…'
              ) : (
                <>
                  <Plus size={16} />
                  <span>Save Song</span>
                </>
              )}
            </button>

            <Link
              href="/songs"
              className="btn-outline w-full py-3 text-xs font-semibold text-center block rounded-xl"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}

