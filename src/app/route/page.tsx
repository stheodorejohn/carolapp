'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { RouteCard } from '@/components/cards/RouteCard';
import { StatusBadge } from '@/components/ui/StatusBadge';
import type { Group, Route } from '@/types/database';

export default function TeamRoutePage() {
  const [group, setGroup]   = useState<Group | null>(null);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        // Load the first active group
        const { data: groupData } = await supabase
          .from('groups')
          .select('*')
          .eq('is_active', true)
          .order('created_at', { ascending: true })
          .limit(1)
          .single();

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
  }, []);

  const visited = routes.filter(r => r.status === 'visited').length;

  return (
    <div className="page-container bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-100 px-4 pt-14 pb-4 sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-100">
            <ChevronLeft size={18} className="text-slate-600" />
          </Link>
          <div className="flex-1">
            <h1 className="text-base font-bold text-slate-800">Team Route</h1>
            <p className="text-xs text-slate-400">
              {loading ? 'Loading…' : `${visited}/${routes.length} stops visited`}
            </p>
          </div>
        </div>

        {group && (
          <div className="flex items-center gap-2 mt-3">
            <span className="text-lg">🚐</span>
            <div>
              <p className="text-sm font-semibold text-slate-700">{group.vehicle_number ?? 'No vehicle'}</p>
            </div>
            <div className="ml-auto">
              <StatusBadge status={group.is_active ? 'live' : 'pending'} />
            </div>
          </div>
        )}
      </div>

      <div className="px-4 pt-4 pb-6">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="carol-card p-4 animate-pulse">
                <div className="h-4 bg-slate-200 rounded w-2/3 mb-2" />
                <div className="h-3 bg-slate-100 rounded w-full" />
              </div>
            ))}
          </div>
        ) : routes.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-2xl mb-2">🗺️</p>
            <p className="text-slate-600 font-semibold text-sm">No stops in route yet</p>
            <p className="text-slate-400 text-xs mt-1">Add families to this group's route</p>
          </div>
        ) : (
          routes.map((route, i) => (
            <RouteCard
              key={route.id}
              route={route}
              index={i + 1}
              isLast={i === routes.length - 1}
            />
          ))
        )}
      </div>
    </div>
  );
}
