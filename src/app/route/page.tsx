'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { ChevronLeft, MapPin, Navigation, CheckCircle2, Clock3 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { RouteCard } from '@/components/cards/RouteCard';
import { StatusBadge } from '@/components/ui/StatusBadge';
import type { Group, Route } from '@/types/database';

type RouteFilter = 'all' | 'pending' | 'visited';

export default function TeamRoutePage() {
  const { currentChurch } = useAuth();
  const [group, setGroup]   = useState<Group | null>(null);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [filter, setFilter] = useState<RouteFilter>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        // Load the first active group for this church
        let groupQuery = supabase
          .from('groups')
          .select('*')
          .eq('is_active', true);

        if (currentChurch?.id) {
          groupQuery = groupQuery.eq('church_id', currentChurch.id);
        }

        const { data: groupData } = await groupQuery
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle();

        if (!groupData) return;
        setGroup(groupData as Group);

        // Load all routes for this group with family details
        const { data: routeData } = await supabase
          .from('routes')
          .select('*, family:families(*)')
          .eq('group_id', groupData.id)
          .order('order_index', { ascending: true });

        setRoutes((routeData ?? []) as Route[]);
      } catch (err) {
        console.error('[TeamRoute] load error:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [currentChurch?.id]);

  const visitedCount = useMemo(() => routes.filter(r => r.status === 'visited').length, [routes]);
  const pendingCount = useMemo(() => routes.filter(r => r.status !== 'visited').length, [routes]);

  // Current active stop (in progress, arrived, or first pending)
  const currentStop = useMemo(() => {
    return routes.find(r => r.status === 'in_progress' || r.status === 'arrived') ||
           routes.find(r => r.status === 'pending');
  }, [routes]);

  const filteredRoutes = useMemo(() => {
    if (filter === 'visited') return routes.filter(r => r.status === 'visited');
    if (filter === 'pending') return routes.filter(r => r.status !== 'visited');
    return routes;
  }, [routes, filter]);

  return (
    <div className="page-container bg-slate-50">
      {/* ── Sticky Header ── */}
      <div className="bg-white border-b border-slate-100 px-4 pt-14 pb-3 sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-100" aria-label="Back to Home">
            <ChevronLeft size={18} className="text-slate-600" />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-bold text-slate-800">Team Route</h1>
            <p className="text-xs text-slate-400">
              {loading ? 'Loading…' : `${visitedCount}/${routes.length} stops visited · ${pendingCount} remaining`}
            </p>
          </div>
          {group && (
            <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-full border border-slate-200">
              <span className="text-xs">🚐</span>
              <span className="text-xs font-semibold text-slate-700 truncate max-w-[80px]">
                {group.vehicle_number || group.name}
              </span>
            </div>
          )}
        </div>

        {/* ── Filter Tabs ── */}
        <div className="flex gap-2 mt-3 pt-2 border-t border-slate-100">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
              filter === 'all'
                ? 'bg-slate-800 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            All ({routes.length})
          </button>
          <button
            onClick={() => setFilter('pending')}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
              filter === 'pending'
                ? 'bg-green-700 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Remaining ({pendingCount})
          </button>
          <button
            onClick={() => setFilter('visited')}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
              filter === 'visited'
                ? 'bg-green-700 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Visited ({visitedCount})
          </button>
        </div>
      </div>

      <div className="px-4 pt-4 pb-10 space-y-4">
        {/* ── Prominent Current Stop Callout ── */}
        {currentStop?.family && filter !== 'visited' && (
          <div className="carol-card p-4 border-l-4 border-l-green-600 bg-white shadow-xs">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded-full uppercase tracking-wider">
                {currentStop.status === 'in_progress' ? 'Active Visit Now' :
                 currentStop.status === 'arrived' ? 'Currently Arrived' :
                 'Next Destination'}
              </span>
              <StatusBadge status={currentStop.status} />
            </div>

            <p className="font-bold text-slate-800 text-base">{currentStop.family.name}</p>
            <p className="text-xs text-slate-400 truncate mt-0.5">{currentStop.family.address}</p>

            <div className="flex gap-2 mt-3 pt-2.5 border-t border-slate-100">
              {(currentStop.family.latitude !== 0 || currentStop.family.longitude !== 0) && (
                <a
                  href={`https://maps.google.com/?q=${currentStop.family.latitude},${currentStop.family.longitude}`}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-outline flex-1 py-2 text-xs font-semibold gap-1 rounded-xl border-slate-200 text-slate-700 text-center justify-center inline-flex"
                >
                  <Navigation size={13} className="text-blue-600" /> Directions
                </a>
              )}
              <Link
                href={`/route/${currentStop.id}`}
                className="btn-primary flex-1 py-2 text-xs font-bold gap-1 rounded-xl text-center justify-center inline-flex"
              >
                Open Stop →
              </Link>
            </div>
          </div>
        )}

        {/* ── Route Timeline List ── */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="carol-card p-4 animate-pulse">
                <div className="h-4 bg-slate-200 rounded w-2/3 mb-2" />
                <div className="h-3 bg-slate-100 rounded w-full" />
              </div>
            ))}
          </div>
        ) : filteredRoutes.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-3xl mb-2">🗺️</p>
            <p className="text-slate-700 font-semibold text-sm">
              {filter === 'visited' ? 'No stops visited yet' :
               filter === 'pending' ? 'All stops completed! 🎉' :
               'No stops in route yet'}
            </p>
            <p className="text-slate-400 text-xs mt-1">
              {filter !== 'all' ? 'Tap "All" to view the full route' : 'Add families to this group from Manage'}
            </p>
          </div>
        ) : (
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 px-1">
              {filter === 'all' ? 'Full Route Sequence' :
               filter === 'pending' ? 'Upcoming Stops' :
               'Completed Visits'}
            </p>
            {filteredRoutes.map((route, i) => (
              <RouteCard
                key={route.id}
                route={route}
                index={routes.findIndex(r => r.id === route.id) + 1}
                isLast={i === filteredRoutes.length - 1}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
