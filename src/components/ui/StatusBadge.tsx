import { cn } from '@/lib/utils';
import { RouteStatus } from '@/types/database';

interface StatusBadgeProps {
  status: RouteStatus | 'live';
  className?: string;
}

const CONFIG = {
  visited:     { label: 'Visited',     cls: 'badge-visited'     },
  pending:     { label: 'Pending',     cls: 'badge-pending'     },
  in_progress: { label: 'In Progress', cls: 'badge-in-progress' },
  live:        { label: 'Live',        cls: 'badge-live',       pulse: true },
} as const;

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const cfg = CONFIG[status];
  return (
    <span className={cn('badge', cfg.cls, className)}>
      {'pulse' in cfg && cfg.pulse && <span className="pulse-dot" />}
      {cfg.label}
    </span>
  );
}
