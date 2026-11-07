import Link from 'next/link';
import { Music, Play, ChevronRight } from 'lucide-react';
import { Song } from '@/types/database';
import { cn } from '@/lib/utils';

interface SongCardProps {
  song: Song;
  index: number;
  className?: string;
}

const ACCENT_COLORS = [
  'bg-green-50 text-green-700',
  'bg-amber-50 text-amber-700',
  'bg-blue-50 text-blue-700',
  'bg-purple-50 text-purple-700',
  'bg-rose-50 text-rose-700',
];

export function SongCard({ song, index, className }: SongCardProps) {
  const colorClass = ACCENT_COLORS[index % ACCENT_COLORS.length];

  return (
    <Link
      href={`/songs/${song.id}`}
      className={cn('carol-card carol-card-hover flex items-center gap-3 p-4 block', className)}
    >
      {/* Index / icon */}
      <span className={cn(
        'flex items-center justify-center w-11 h-11 rounded-2xl flex-shrink-0',
        colorClass
      )}>
        <Music size={18} />
      </span>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-slate-800 text-sm truncate">{song.title}</p>
        {song.artist && (
          <p className="text-xs text-slate-400 mt-0.5 truncate">{song.artist}</p>
        )}
      </div>

      {/* Play + chevron */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className="flex items-center justify-center w-7 h-7 rounded-full bg-slate-50 text-slate-400">
          <Play size={12} fill="currentColor" />
        </span>
        <ChevronRight size={14} className="text-slate-300" />
      </div>
    </Link>
  );
}
