'use client';

/**
 * Edit Carol Song Page
 *
 * Dedicated administrative interface to edit, hide/unhide, or delete a song.
 * Accessible only to authorized church administrators.
 */

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ChevronLeft, Music, Save, Trash2, AlertCircle, Eye, EyeOff, Globe, RefreshCw
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import type { Song } from '@/types/database';

interface EditSongPageProps {
  params: Promise<{ songId: string }>;
}

export default function EditSongPage({ params }: EditSongPageProps) {
  const { songId } = use(params);
  const router = useRouter();
  const { currentChurch, user, activeRole } = useAuth();

  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [category, setCategory] = useState('');
  const [lyrics, setLyrics] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [isHidden, setIsHidden] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

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
        setTitle(s.title);
        setArtist(s.artist ?? '');
        setCategory(s.category ?? '');
        setLyrics(s.lyrics ?? '');
        setYoutubeUrl(s.youtube_url ?? '');
        setIsPublic(s.is_public ?? true);
        setIsHidden(s.is_hidden ?? false);
      } catch {
        setError('Song could not be loaded.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [songId]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!isAdmin) {
      setError('Only church administrators can edit songs.');
      return;
    }

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError('Please enter a song title.');
      return;
    }

    setSaving(true);
    try {
      const { error: updateErr } = await supabase
        .from('songs')
        .update({
          title: trimmedTitle,
          artist: artist.trim() || null,
          category: category.trim() || null,
          lyrics: lyrics.trim() || null,
          youtube_url: youtubeUrl.trim() || null,
          is_public: isPublic,
          is_hidden: isHidden,
          updated_by: user?.id ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', songId);

      if (updateErr) throw updateErr;

      router.push(`/songs/${songId}`);
    } catch (err: unknown) {
      console.error('[EditSongPage] update error:', err);
      setError('Failed to save changes. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!isAdmin) return;
    setDeleting(true);
    try {
      const { error: delErr } = await supabase
        .from('songs')
        .delete()
        .eq('id', songId);

      if (delErr) throw delErr;

      router.push('/songs');
    } catch (err) {
      console.error('[EditSongPage] delete error:', err);
      setError('Failed to delete song.');
      setShowDeleteModal(false);
    } finally {
      setDeleting(false);
    }
  }

  if (!isAdmin) {
    return (
      <div className="page-container bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <AlertCircle size={36} className="text-amber-500 mb-3" />
        <h2 className="text-lg font-bold text-slate-800">Administrator Access Required</h2>
        <p className="text-xs text-slate-500 mt-1 max-w-xs">
          Only church administrators can edit songs in the songbook.
        </p>
        <Link href={`/songs/${songId}`} className="btn-primary mt-4 py-3 px-6 text-xs font-bold rounded-xl">
          ← Back to Song
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="page-container bg-slate-50 p-6 flex flex-col items-center justify-center text-slate-400">
        <RefreshCw size={24} className="animate-spin text-green-600 mb-2" />
        <p className="text-xs">Loading song details…</p>
      </div>
    );
  }

  return (
    <div className="page-container bg-slate-50">
      {/* Sticky Header */}
      <div className="bg-white border-b border-slate-100 px-4 pt-14 pb-4 sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <Link
            href={`/songs/${songId}`}
            className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
          >
            <ChevronLeft size={18} />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="text-base font-bold text-slate-800">Edit Song</h1>
            <p className="text-xs text-slate-400">{currentChurch?.name ?? 'Church Songbook'}</p>
          </div>
          <button
            type="button"
            onClick={() => setShowDeleteModal(true)}
            className="w-9 h-9 rounded-xl bg-red-50 text-red-600 flex items-center justify-center hover:bg-red-100 transition-colors"
            title="Delete Song"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      <div className="px-4 pt-4 pb-12">
        <form onSubmit={handleSave} className="space-y-4">
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
              <label htmlFor="edit-song-title" className="block text-xs font-semibold text-slate-700 mb-1">
                Song Title <span className="text-red-500">*</span>
              </label>
              <input
                id="edit-song-title"
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                required
                className="carol-input w-full py-3 px-3.5 text-sm bg-white border border-slate-200 rounded-xl"
              />
            </div>

            <div>
              <label htmlFor="edit-song-artist" className="block text-xs font-semibold text-slate-700 mb-1">
                Artist / Traditional Composer
              </label>
              <input
                id="edit-song-artist"
                type="text"
                value={artist}
                onChange={e => setArtist(e.target.value)}
                className="carol-input w-full py-3 px-3.5 text-sm bg-white border border-slate-200 rounded-xl"
              />
            </div>

            <div>
              <label htmlFor="edit-song-category" className="block text-xs font-semibold text-slate-700 mb-1">
                Category
              </label>
              <input
                id="edit-song-category"
                type="text"
                value={category}
                onChange={e => setCategory(e.target.value)}
                className="carol-input w-full py-3 px-3.5 text-sm bg-white border border-slate-200 rounded-xl"
              />
            </div>

            <div>
              <label htmlFor="edit-song-lyrics" className="block text-xs font-semibold text-slate-700 mb-1">
                Lyrics
              </label>
              <textarea
                id="edit-song-lyrics"
                rows={8}
                value={lyrics}
                onChange={e => setLyrics(e.target.value)}
                className="carol-input w-full p-3.5 text-sm font-sans leading-relaxed bg-white border border-slate-200 rounded-xl outline-none"
              />
            </div>

            <div>
              <label htmlFor="edit-song-youtube" className="block text-xs font-semibold text-slate-700 mb-1">
                YouTube Audio / Video Link
              </label>
              <input
                id="edit-song-youtube"
                type="url"
                value={youtubeUrl}
                onChange={e => setYoutubeUrl(e.target.value)}
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
              disabled={saving || !title.trim()}
              className="btn-primary w-full py-4 text-sm font-bold shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {saving ? (
                'Saving Changes…'
              ) : (
                <>
                  <Save size={16} />
                  <span>Save Changes</span>
                </>
              )}
            </button>

            <Link
              href={`/songs/${songId}`}
              className="btn-outline w-full py-3 text-xs font-semibold text-center block rounded-xl"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl space-y-4 animate-scale-up">
            <div className="flex items-center gap-2.5 text-red-600">
              <span className="p-2 rounded-xl bg-red-50">
                <Trash2 size={20} />
              </span>
              <h3 className="font-bold text-slate-800 text-base">Permanently Delete Song?</h3>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to permanently delete <strong>&ldquo;{title}&rdquo;</strong> from your church songbook?
            </p>

            <div className="bg-red-50 border border-red-200/60 p-3 rounded-2xl text-[11px] text-red-800">
              <p className="font-semibold">This action cannot be undone.</p>
              <p className="mt-0.5">If you only want to temporarily remove it from members, use <strong>Hide Song</strong> instead.</p>
            </div>

            <div className="flex items-center gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="btn-outline flex-1 py-3 text-xs font-semibold rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="bg-red-600 hover:bg-red-700 text-white font-bold flex-1 py-3 text-xs rounded-xl shadow-sm transition-colors"
              >
                {deleting ? 'Deleting…' : 'Delete Song'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

