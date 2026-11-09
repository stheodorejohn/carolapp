'use client';

import dynamic from 'next/dynamic';
import { useState, useCallback, useEffect, use, Suspense } from 'react';
import Link from 'next/link';
import { ChevronLeft, RefreshCw, Clock, Navigation } from 'lucide-react';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { formatTime } from '@/lib/utils';
import { useGeolocation } from '@/hooks/useGeolocation';
import { supabase } from '@/lib/supabase';
import type { Group, Route } from '@/types/database';

// Leaflet must be loaded client-side only
const LiveMap = dynamic(() => import('@/components/map/LiveMap'), {
  ssr: false,
  loading: () => (
    <div className="skeleton w-full rounded-2xl" style={{ height: 280 }} />
  ),
});

const DURATION_OPTIONS = [
  { label: '1 hour',  value: 60  },
  { label: '2 hours', value: 120 },
  { label: '4 hours', value: 240 },
  { label: 'Custom',  value: -1  },
];

interface TrackingPageProps {
  params: Promise<{ groupId: string }>;
}

function TrackingContent({ params }: TrackingPageProps) {
  const { groupId } = use(params);
  const [sharingDuration, setSharingDuration] = useState<number | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [group, setGroup] = useState<Group | null>(null);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
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

      const activeGroup = groupRes.data as Group | null;
      setGroup(activeGroup);

      const targetGroupId = activeGroup?.id ?? groupId;

      const { data: routeData } = await supabase
        .from('routes')
        .select('*, family:families(*)')
        .eq('group_id', targetGroupId)
        .order('order_index', { ascending: true });

      setRoutes((routeData ?? []) as Route[]);
    } catch (err) {
      console.error('[TrackingPage] error loading data:', err);
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    loadData();

    const channel = supabase
      .channel(`tracking-group-${groupId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'groups', filter: `id=eq.${groupId}` },
        payload => {
          if (payload.new) {
            setGroup(payload.new as Group);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [groupId, loadData]);

  const handleLocationUpdate = useCallback(
    async (coords: GeolocationCoordinates) => {
      const activeId = group?.id ?? groupId;
      try {
        await supabase
          .from('groups')
          .update({
            current_latitude: coords.latitude,
            current_longitude: coords.longitude,
            current_speed: coords.speed ? Math.round(coords.speed * 3.6) : null,
            last_location_update: new Date().toISOString(),
          })
          .eq('id', activeId);
      } catch {
        // ignore
      }
    },
    [group?.id, groupId]
  );

  const { latitude, longitude, isTracking, startTracking, stopTracking } =
    useGeolocation({ enableHighAccuracy: true, onUpdate: handleLocationUpdate });

  function handleStartSharing() {
    if (!sharingDuration) return;
    startTracking();
    setIsSharing(true);
  }

  const nextStop = routes.find(r => r.status !== 'visited');

  const currentGroup: Group = group ?? {
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

  const userLat = latitude ?? currentGroup.current_latitude ?? 13.0827;
  const userLng = longitude ?? currentGroup.current_longitude ?? 80.2707;

  return (
    <div className="page-container bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-100 px-4 pt-14 pb-4 sticky top-0 z-30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-100">
              <ChevronLeft size={18} className="text-slate-600" />
            </Link>
            <div>
              <h1 className="text-base font-bold text-slate-800">Live Tracking</h1>
              <p className="text-xs text-slate-400">
                {currentGroup.name} {currentGroup.vehicle_number ? `· ${currentGroup.vehicle_number}` : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={currentGroup.is_active ? 'live' : 'pending'} />
            <button
              onClick={loadData}
              className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 transition-colors"
              aria-label="Refresh"
            >
              <RefreshCw size={14} className={`text-slate-500 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      <div className="px-4 pt-4 space-y-4">
        {/* Map */}
        <LiveMap
          group={currentGroup}
          routes={routes}
          deviceLat={latitude}
          deviceLng={longitude}
          userLat={userLat}
          userLng={userLng}
        />

        {/* Next stop card */}
        {nextStop?.family && (
          <div className="carol-card p-4">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Next Stop</p>
            <div className="flex items-start gap-3">
              <span className="flex items-center justify-center w-10 h-10 rounded-xl bg-green-50 flex-shrink-0">
                <Navigation size={18} className="text-green-700" />
              </span>
              <div className="flex-1">
                <p className="font-semibold text-slate-800">{nextStop.family.name}</p>
                <p className="text-xs text-slate-400">{nextStop.family.address}</p>
                {nextStop.eta && (
                  <div className="flex items-center gap-4 mt-3">
                    <div className="text-center">
                      <div className="flex items-center gap-1 text-slate-700 font-bold">
                        <Clock size={13} className="text-slate-400" />
                        <span>{formatTime(nextStop.eta)}</span>
                      </div>
                      <p className="text-xs text-slate-400">ETA</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <Link href={`/route/${nextStop.id}`} className="btn-primary mt-4 rounded-2xl py-3">
              View Details →
            </Link>
          </div>
        )}

        {/* Share Location */}
        <div className="carol-card p-4">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
            Share Your Location
          </p>
          <p className="text-xs text-slate-500 mb-3">
            Share your live location with the team for the selected duration.
          </p>

          {/* Duration pills */}
          <div className="flex gap-2 flex-wrap mb-4">
            {DURATION_OPTIONS.map(opt => (
              <button
                key={opt.value}
                id={`duration-${opt.value}`}
                onClick={() => setSharingDuration(opt.value)}
                className={`px-4 py-2 rounded-full text-xs font-semibold border transition-colors ${
                  sharingDuration === opt.value
                    ? 'bg-green-700 text-white border-green-700'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-green-400'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {isSharing ? (
            <button
              id="stop-sharing-btn"
              onClick={() => { stopTracking(); setIsSharing(false); }}
              className="btn-primary bg-red-600 hover:bg-red-700"
            >
              Stop Sharing
            </button>
          ) : (
            <button
              id="start-sharing-btn"
              onClick={handleStartSharing}
              disabled={!sharingDuration}
              className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isTracking ? '📍 Sharing Live…' : '🟢 Start Sharing'}
            </button>
          )}
          <p className="text-xs text-slate-400 mt-2 text-center">
            Location will be shared with the live tracking page. You can stop it anytime.
          </p>
        </div>

        {/* Route overview */}
        <div className="carol-card p-4">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Today&apos;s Route</p>
          {routes.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-4">No stops assigned yet.</p>
          ) : (
            <div className="space-y-2">
              {routes.map((route, i) => (
                <Link key={route.id} href={`/route/${route.id}`} className="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-50 transition-colors">
                  <span className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold flex-shrink-0 ${
                    route.status === 'visited'     ? 'bg-green-700 text-white' :
                    route.status === 'in_progress' ? 'bg-blue-600 text-white'  :
                                                     'bg-slate-200 text-slate-500'
                  }`}>{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-700 truncate">{route.family?.name}</p>
                    <p className="text-xs text-slate-400">{formatTime(route.eta)}</p>
                  </div>
                  <StatusBadge status={route.status} />
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function TrackingPage(props: TrackingPageProps) {
  return (
    <Suspense
      fallback={
        <div className="page-container bg-slate-50 p-4 space-y-4 pt-14">
          <div className="skeleton w-full rounded-2xl h-14" />
          <div className="skeleton w-full rounded-2xl h-64" />
        </div>
      }
    >
      <TrackingContent {...props} />
    </Suspense>
  );
}
