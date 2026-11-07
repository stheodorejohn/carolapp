'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState, use, useCallback, Suspense } from 'react';
import { Clock, Navigation } from 'lucide-react';
import type { Group, Route } from '@/types/database';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { formatTime } from '@/lib/utils';
import { supabase } from '@/lib/supabase';

const LiveMap = dynamic(() => import('@/components/map/LiveMap'), {
  ssr: false,
  loading: () => <div className="skeleton w-full rounded-2xl" style={{ height: '100dvh' }} />,
});

interface LiveTrackingPageProps {
  params: Promise<{ groupId: string }>;
}

function LiveTrackingContent({ params }: LiveTrackingPageProps) {
  const { groupId } = use(params);
  const [group, setGroup] = useState<Group | null>(null);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [updatedAt, setUpdatedAt] = useState<string>(new Date().toISOString());

  const loadData = useCallback(async () => {
    try {
      let groupRes = await supabase
        .from('groups')
        .select('*')
        .eq('id', groupId)
        .maybeSingle();

      if (!groupRes.data) {
        groupRes = await supabase
          .from('groups')
          .select('*')
          .eq('is_active', true)
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle();
      }

      if (groupRes.data) {
        setGroup(groupRes.data as Group);
        setUpdatedAt(new Date().toISOString());
      }

      const activeId = groupRes.data?.id ?? groupId;

      const { data: routeData } = await supabase
        .from('routes')
        .select('*, family:families(*)')
        .eq('group_id', activeId)
        .order('order_index', { ascending: true });

      if (routeData) {
        setRoutes(routeData as Route[]);
      }
    } catch (err) {
      console.error('[LiveTrackingPage] load error:', err);
    }
  }, [groupId]);

  useEffect(() => {
    loadData();

    const channel = supabase
      .channel(`group-${groupId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'groups', filter: `id=eq.${groupId}` },
        payload => {
          if (payload.new) {
            setGroup(payload.new as Group);
            setUpdatedAt(new Date().toISOString());
          }
        }
      )
      .subscribe();

    const interval = setInterval(loadData, 30000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [groupId, loadData]);

  const defaultGroup: Group = {
    id: groupId,
    name: 'Carol Team',
    leader_id: '',
    vehicle_number: null,
    is_active: true,
    current_latitude: 13.0827,
    current_longitude: 80.2707,
    current_speed: 0,
    current_direction: 'N',
    last_location_update: null,
    created_at: new Date().toISOString(),
  };

  const currentGroup = group ?? defaultGroup;
  const nextStop = routes.find(r => r.status !== 'visited');
  const visited = routes.filter(r => r.status === 'visited').length;

  return (
    <div className="relative min-h-screen bg-slate-900">
      {/* Full-screen map */}
      <div className="absolute inset-0">
        <LiveMap
          group={currentGroup}
          routes={routes}
          userLat={currentGroup.current_latitude ?? 13.0827}
          userLng={currentGroup.current_longitude ?? 80.2707}
        />
      </div>

      {/* Floating header */}
      <div className="absolute top-0 left-0 right-0 z-20 p-4 pt-12">
        <div className="carol-card px-4 py-3 flex items-center gap-3">
          <span className="text-xl">🎄</span>
          <div className="flex-1">
            <p className="font-bold text-slate-800 text-sm">Let&apos;s Carol – Live Tracking</p>
            <p className="text-xs text-slate-400">Updated {formatTime(updatedAt)}</p>
          </div>
          <StatusBadge status={currentGroup.is_active ? 'live' : 'pending'} />
        </div>
      </div>

      {/* Floating bottom overlay */}
      <div className="absolute bottom-0 left-0 right-0 z-20 p-4 pb-8">
        <div className="carol-card p-4">
          {/* Vehicle strip */}
          <div className="flex items-center gap-3 mb-3 pb-3 border-b border-slate-100">
            <span className="text-2xl">🚐</span>
            <div className="flex-1">
              <p className="font-semibold text-slate-800 text-sm">
                {currentGroup.vehicle_number ?? currentGroup.name}
              </p>
              <p className="text-xs text-slate-400">{visited}/{routes.length} stops visited</p>
            </div>
            {currentGroup.current_speed != null && (
              <div className="text-right">
                <p className="font-bold text-slate-800">{currentGroup.current_speed} km/h</p>
                <p className="text-xs text-slate-400">{currentGroup.current_direction}</p>
              </div>
            )}
          </div>

          {/* Next stop */}
          {nextStop?.family && (
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Next Stop
              </p>
              <div className="flex items-center gap-3">
                <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-green-50">
                  <Navigation size={16} className="text-green-700" />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-800 text-sm truncate">{nextStop.family.name}</p>
                  <p className="text-xs text-slate-400 truncate">{nextStop.family.address}</p>
                </div>
                {nextStop.eta && (
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs text-slate-400 flex items-center gap-0.5 justify-end">
                      <Clock size={9} /> {formatTime(nextStop.eta)}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function LiveTrackingPage(props: LiveTrackingPageProps) {
  return (
    <Suspense fallback={<div className="skeleton w-full min-h-screen bg-slate-900" />}>
      <LiveTrackingContent {...props} />
    </Suspense>
  );
}
