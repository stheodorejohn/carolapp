import Link from 'next/link';
import { ChevronRight, Home, MapPin, Clock } from 'lucide-react';
import { Route } from '@/types/database';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { cn } from '@/lib/utils';
import { formatTime } from '@/lib/utils';

interface RouteCardProps {
  route: Route;
  index: number;
  isLast?: boolean;
  compact?: boolean;
}

export function RouteCard({ route, index, isLast = false, compact = false }: RouteCardProps) {
  const { family, status } = route;

  return (
    <div className="relative flex gap-3">
      {/* Timeline column */}
      <div className="flex flex-col items-center flex-shrink-0 pt-1">
        <span className={cn(
          'flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold z-10 transition-colors',
          status === 'visited'     && 'bg-green-700 text-white shadow-xs',
          status === 'in_progress' && 'bg-blue-600 text-white ring-2 ring-blue-300 ring-offset-1',
          status === 'arrived'     && 'bg-amber-600 text-white ring-2 ring-amber-300 ring-offset-1',
          status === 'pending'     && 'bg-slate-200 text-slate-500'
        )}>
          {status === 'visited' ? '✓' : index}
        </span>
        {!isLast && (
          <div className="w-0.5 flex-1 mt-1 bg-gradient-to-b from-slate-300 to-slate-100 min-h-4" />
        )}
      </div>

      {/* Card body */}
      <Link
        href={`/route/${route.id}`}
        className={cn(
          'carol-card carol-card-hover flex-1 mb-3 p-4 block transition-all',
          compact && 'p-3',
          status === 'in_progress' && 'border-blue-300 ring-2 ring-blue-100 bg-blue-50/20 shadow-xs',
          status === 'arrived'     && 'border-amber-300 ring-2 ring-amber-100 bg-amber-50/20 shadow-xs'
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <span className={cn(
              'flex items-center justify-center w-9 h-9 rounded-xl flex-shrink-0 mt-0.5',
              status === 'visited'     && 'bg-green-50 text-green-700',
              status === 'in_progress' && 'bg-blue-50 text-blue-600',
              status === 'arrived'     && 'bg-amber-50 text-amber-600',
              status === 'pending'     && 'bg-slate-50 text-slate-400'
            )}>
              <Home size={16} />
            </span>
            <div className="min-w-0">
              <p className="font-semibold text-slate-800 text-sm leading-tight truncate">
                {family?.name ?? 'Unknown Family'}
              </p>
              <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">
                {family?.address ?? '—'}
              </p>
              {route.eta && (
                <div className="flex items-center gap-1 mt-1.5 text-xs text-slate-500">
                  <Clock size={11} />
                  <span>{formatTime(route.eta)}</span>
                </div>
              )}
            </div>
          </div>
          <div className="flex flex-col items-end gap-2 flex-shrink-0">
            <StatusBadge status={status} />
            <ChevronRight size={14} className="text-slate-300" />
          </div>
        </div>
      </Link>
    </div>
  );
}
