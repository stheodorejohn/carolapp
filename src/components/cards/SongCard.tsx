import Link from 'next/link';
import { Music, Play, ChevronRight, Eye, EyeOff, Edit2 } from 'lucide-react';
import type { Song } from '@/types/database';
import { cn } from '@/lib/utils';

interface SongCardProps {
  song: Song;
  index: number;
  className?: string;
  isAdmin?: boolean;
  onToggleHide?: (song: Song, e: React.MouseEvent) => void;
  hideToggling?: boolean;
}

const ACCENT_COLORS = [
  'bg-green-50 text-green-700',
  'bg-amber-50 text-amber-700',
  'bg-blue-50 text-blue-700',
  'bg-purple-50 text-purple-700',
  'bg-rose-50 text-rose-700',
];

export function SongCard({
  song,
  index,
  className,
  isAdmin = false,
  onToggleHide,
  hideToggling = false,
}: SongCardProps) {
  const colorClass = ACCENT_COLORS[index % ACCENT_COLORS.length];

  return (
    <div
      className={cn(
        'carol-card transition-all p-3.5 flex items-center justify-between gap-3',
        song.is_hidden ? 'opacity-85 border-amber-200 bg-amber-50/20' : '',
        className
      )}
    >
      <Link
        href={`/songs/${song.id}`}
        className="flex items-center gap-3 flex-1 min-w-0"
      >
        {/* Index / icon */}
        <span
          className={cn(
            'flex items-center justify-center w-11 h-11 rounded-2xl flex-shrink-0',
            colorClass
          )}
        >
          <Music size={18} />
        </span>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="font-semibold text-slate-800 text-sm truncate">{song.title}</p>
            {song.is_hidden && (
              <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full shrink-0">
                Hidden
              </span>
            )}
            {!song.is_public && (
              <span className="text-[10px] font-medium bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded shrink-0">
                Members Only
              </span>
            )}
          </div>
          {song.artist && (
            <p className="text-xs text-slate-400 mt-0.5 truncate">{song.artist}</p>
          )}
        </div>
      </Link>

      {/* Admin Controls or Chevron */}
      {isAdmin ? (
        <div className="flex items-center gap-1 shrink-0">
          {onToggleHide && (
            <button
              type="button"
              onClick={e => onToggleHide(song, e)}
              disabled={hideToggling}
              className={cn(
                'px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors',
                song.is_hidden
                  ? 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                  : 'text-slate-500 hover:bg-slate-100'
              )}
              title={song.is_hidden ? 'Make visible to members' : 'Hide from ordinary users'}
            >
              {song.is_hidden ? (
                <>
                  <Eye size={13} />
                  <span>Show</span>
                </>
              ) : (
                <>
                  <EyeOff size={13} />
                  <span>Hide</span>
                </>
              )}
            </button>
          )}

          <Link
            href={`/songs/${song.id}/edit`}
            className="p-2 text-slate-400 hover:text-green-700 hover:bg-green-50 rounded-lg transition-colors"
            title="Edit song"
          >
            <Edit2 size={14} />
          </Link>
        </div>
      ) : (
        <Link
          href={`/songs/${song.id}`}
          className="flex items-center gap-2 flex-shrink-0 pl-2 text-slate-300 hover:text-slate-500"
        >
          <span className="flex items-center justify-center w-7 h-7 rounded-full bg-slate-50 text-slate-400">
            <Play size={12} fill="currentColor" />
          </span>
          <ChevronRight size={14} />
        </Link>
      )}
    </div>
  );
}
