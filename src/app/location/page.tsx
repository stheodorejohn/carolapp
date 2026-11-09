'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { ChevronLeft, Gauge, Compass, Clock, Navigation } from 'lucide-react';
import { useGeolocation } from '@/hooks/useGeolocation';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { formatTime } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import type { Group } from '@/types/database';

const LiveMap = dynamic(() => import('@/components/map/LiveMap'), {
  ssr: false,
  loading: () => <div className="skeleton w-full rounded-2xl" style={{ height: 220 }} />,
});

export default function CurrentLocationPage() {
  const [group, setGroup] = useState<Group | null>(null);

  useEffect(() => {
    async function loadGroup() {
      try {
        const { data } = await supabase
          .from('groups')
          .select('*')
          .eq('is_active', true)
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle();

        if (data) setGroup(data as Group);
      } catch (err) {
        console.error('[CurrentLocationPage] error loading group:', err);
      }
    }
    loadGroup();
  }, []);

  const { latitude, longitude, speed, heading, isTracking, startTracking } =
    useGeolocation({
      enableHighAccuracy: true,
      onUpdate: async coords => {
        if (!group?.id) return;
        try {
          await supabase
            .from('groups')
            .update({
              current_latitude: coords.latitude,
              current_longitude: coords.longitude,
              current_speed: coords.speed ? Math.round(coords.speed * 3.6) : null,
              last_location_update: new Date().toISOString(),
            })
            .eq('id', group.id);
        } catch {
          // ignore
        }
      },
    });

  const defaultGroup: Group = {
    id: group?.id ?? '',
    name: group?.name ?? 'Carol Team',
    leader_id: '',
    vehicle_number: group?.vehicle_number ?? null,
    is_active: group?.is_active ?? true,
    current_latitude: group?.current_latitude ?? 13.0827,
    current_longitude: group?.current_longitude ?? 80.2707,
    current_speed: group?.current_speed ?? 0,
    current_direction: group?.current_direction ?? 'N',
    last_location_update: group?.last_location_update ?? null,
    created_at: group?.created_at ?? new Date().toISOString(),
  };

  const displayLat = latitude ?? defaultGroup.current_latitude ?? 13.0827;
  const displayLng = longitude ?? defaultGroup.current_longitude ?? 80.2707;
  const displaySpeed = speed != null ? Math.round(speed * 3.6) : (defaultGroup.current_speed ?? 0);

  return (
    <div className="page-container bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-100 px-4 pt-14 pb-4">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-100">
            <ChevronLeft size={18} className="text-slate-600" />
          </Link>
          <h1 className="text-base font-bold text-slate-800 flex-1">Current Location</h1>
          <StatusBadge status="live" />
        </div>
      </div>

      <div className="px-4 pt-4 space-y-4">
        {/* Map */}
        <LiveMap
          group={defaultGroup}
          routes={[]}
          deviceLat={latitude}
          deviceLng={longitude}
          userLat={displayLat}
          userLng={displayLng}
        />

        {/* Vehicle info */}
        <div className="carol-card p-4">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-3xl">🚐</span>
            <div>
              <p className="font-semibold text-slate-800">{defaultGroup.vehicle_number ?? defaultGroup.name}</p>
              <StatusBadge status={isTracking ? 'live' : 'pending'} />
            </div>
          </div>

          {/* Coordinates */}
          <div className="bg-slate-50 rounded-xl p-3 mb-4 border border-slate-100">
            <p className="text-xs text-slate-400 mb-1">Current Location</p>
            <p className="font-mono text-sm text-slate-700">
              {displayLat.toFixed(6)}, {displayLng.toFixed(6)}
            </p>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-3 gap-3">
            <LocationStat
              icon={<Gauge size={16} className="text-blue-600" />}
              label="Speed"
              value={`${displaySpeed} km/h`}
              bg="bg-blue-50"
            />
            <LocationStat
              icon={<Compass size={16} className="text-purple-600" />}
              label="Direction"
              value={defaultGroup.current_direction ?? 'N/A'}
              bg="bg-purple-50"
            />
            <LocationStat
              icon={<Clock size={16} className="text-amber-600" />}
              label="Updated"
              value={formatTime(defaultGroup.last_location_update)}
              bg="bg-amber-50"
            />
          </div>
        </div>

        {/* Start tracking button */}
        {!isTracking && (
          <button id="start-location-btn" onClick={startTracking} className="btn-primary">
            <Navigation size={18} />
            Start GPS Tracking
          </button>
        )}
        {isTracking && (
          <div className="carol-card p-4 text-center">
            <div className="flex items-center justify-center gap-2 text-green-700 font-semibold">
              <span className="pulse-dot" />
              GPS Active – Sharing Location
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function LocationStat({ icon, label, value, bg }: {
  icon: React.ReactNode; label: string; value: string; bg: string;
}) {
  return (
    <div className={`${bg} rounded-2xl p-3 text-center`}>
      <div className="flex justify-center mb-1">{icon}</div>
      <p className="text-xs font-bold text-slate-700">{value}</p>
      <p className="text-xs text-slate-400">{label}</p>
    </div>
  );
}
