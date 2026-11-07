'use client';

import { useEffect, useState, use, Suspense } from 'react';
import Link from 'next/link';
import { ChevronLeft, Clock, Check } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { formatTime } from '@/lib/utils';
import type { Route } from '@/types/database';

interface StopDetailsPageProps {
  params: Promise<{ stopId: string }>;
}

function StopDetailsContent({ params }: StopDetailsPageProps) {
  const { stopId } = use(params);
  const [route, setRoute] = useState<Route | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const { data } = await supabase
          .from('routes')
          .select('*, family:families(*)')
          .eq('id', stopId)
          .maybeSingle();

        if (data) setRoute(data as Route);
      } catch (err) {
        console.error('[StopDetailsPage] error:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [stopId]);

  if (loading) {
    return (
      <div className="page-container bg-slate-50">
        <div className="bg-white border-b border-slate-100 px-4 pt-14 pb-4">
          <div className="flex items-center gap-3">
            <Link href="/route" className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-100">
              <ChevronLeft size={18} className="text-slate-600" />
            </Link>
            <div className="h-5 w-32 bg-slate-200 rounded animate-pulse" />
          </div>
        </div>
        <div className="px-4 pt-4 space-y-3">
          <div className="carol-card p-4 animate-pulse">
            <div className="h-5 bg-slate-200 rounded w-1/2 mb-2" />
            <div className="h-3 bg-slate-100 rounded w-3/4" />
          </div>
        </div>
      </div>
    );
  }

  if (!route || !route.family) {
    return (
      <div className="page-container bg-slate-50 flex flex-col items-center justify-center">
        <p className="text-slate-500 text-sm">Stop not found</p>
        <Link href="/route" className="text-green-700 font-semibold text-sm mt-3">← Back to Route</Link>
      </div>
    );
  }

  const family = route.family;

  const TIMELINE = [
    { label: 'Arrived',     time: formatTime(route.checked_in_at), done: route.status !== 'pending' },
    { label: 'Checked In',  time: formatTime(route.checked_in_at), done: route.checked_in_at != null || route.status === 'visited' },
    { label: 'Checked Out', time: formatTime(route.checked_out_at), done: route.status === 'visited' },
  ];

  return (
    <div className="page-container bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-100 px-4 pt-14 pb-4">
        <div className="flex items-center gap-3">
          <Link href="/route" className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-100">
            <ChevronLeft size={18} className="text-slate-600" />
          </Link>
          <h1 className="text-base font-bold text-slate-800 flex-1">Stop Details</h1>
        </div>
      </div>

      <div className="px-4 pt-4 space-y-4">
        {/* Family header */}
        <div className="carol-card p-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="font-bold text-slate-800 text-base">{family.name}</h2>
              <p className="text-sm text-slate-400 mt-0.5">{family.address}</p>
            </div>
            <StatusBadge status={route.status} />
          </div>
        </div>

        {/* Visit Timeline */}
        <div className="carol-card p-4">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">
            Visit Timeline
          </p>
          <div className="relative space-y-5">
            {TIMELINE.map((event, i) => (
              <div key={event.label} className="flex gap-4 items-start relative">
                {i < TIMELINE.length - 1 && (
                  <div className="absolute left-[9px] top-5 w-0.5 h-full bg-slate-100" />
                )}
                <span className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center mt-0.5 z-10 ${
                  event.done
                    ? 'bg-green-700 border-green-700'
                    : 'bg-white border-slate-300'
                }`}>
                  {event.done && <Check size={10} color="white" strokeWidth={3} />}
                </span>
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-700">{event.label}</p>
                  {event.done && event.time && (
                    <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                      <Clock size={10} /> {event.time}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Notes */}
        {route.visit_notes && (
          <div className="carol-card p-4">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Notes</p>
            <p className="text-sm text-slate-700">{route.visit_notes}</p>
          </div>
        )}

        {/* CTA */}
        <Link href={`/families/${family.id}`} className="btn-primary block text-center">
          View Family Details →
        </Link>
      </div>
    </div>
  );
}

export default function StopDetailsPage(props: StopDetailsPageProps) {
  return (
    <Suspense
      fallback={
        <div className="page-container bg-slate-50 p-4 space-y-4 pt-14">
          <div className="skeleton w-full rounded-2xl h-14" />
          <div className="skeleton w-full rounded-2xl h-48" />
        </div>
      }
    >
      <StopDetailsContent {...props} />
    </Suspense>
  );
}
