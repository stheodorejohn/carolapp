import Link from 'next/link';
import { Phone, MapPin, Users, ChevronRight } from 'lucide-react';
import { Family } from '@/types/database';
import { cn } from '@/lib/utils';

interface FamilyCardProps {
  family: Family;
  className?: string;
  compact?: boolean;
}

export function FamilyCard({ family, className, compact = false }: FamilyCardProps) {
  return (
    <Link
      href={`/families/${family.id}`}
      className={cn('carol-card carol-card-hover block', compact ? 'p-3' : 'p-4', className)}
    >
      <div className="flex items-center gap-3">
        {/* Avatar */}
        <span className="flex items-center justify-center w-11 h-11 rounded-2xl bg-green-50 flex-shrink-0">
          <Users size={20} className="text-green-700" />
        </span>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-slate-800 text-sm truncate">{family.name}</p>
          <div className="flex items-center gap-1 mt-0.5 text-xs text-slate-400">
            <MapPin size={10} />
            <span className="truncate">{family.address}</span>
          </div>
          {family.phone && (
            <div className="flex items-center gap-1 mt-0.5 text-xs text-slate-400">
              <Phone size={10} />
              <span>{family.phone}</span>
            </div>
          )}
        </div>

        <ChevronRight size={16} className="text-slate-300 flex-shrink-0" />
      </div>
    </Link>
  );
}
