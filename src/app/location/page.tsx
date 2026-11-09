'use client';

/**
 * Live Location Page
 *
 * Consolidated live location management:
 * - Real-time GPS broadcast for drivers / team
 * - Clear ON / OFF state with persistent indicator
 * - One-tap Start Sharing and Stop Sharing controls
 * - Built-in Congregation Share Link generator
 * - Clear privacy messaging
 */

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import {
  ChevronLeft, Gauge, Compass, Clock, Navigation,
  Share2, Copy, Check, Shield, AlertCircle, StopCircle
} from 'lucide-react';
import { useGeolocation } from '@/hooks/useGeolocation';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { formatTime } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import type { Group } from '@/types/database';

const LiveMap = dynamic(() => import('@/components/map/LiveMap'), {
  ssr: false,
  loading: () => <div className="skeleton w-full rounded-2xl" style={{ height: 240 }} />,
});

export default function CurrentLocationPage() {
  const [group, setGroup] = useState<Group | null>(null);
  const [copied, setCopied] = useState(false);

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
        console.error('[LiveLocationPage] error loading group:', err);
      }
    }
    loadGroup();
  }, []);

  const { latitude, longitude, speed, heading, error, isTracking, startTracking, stopTracking } =
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
          // ignore network glitches
        }
      },
    });

  const defaultGroup: Group = {
    id: group?.id ?? '',
    name: group?.name ?? 'Carol Team Alpha',
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

  const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
  const shareIdentifier = group?.slug || group?.id || '';
  const publicShareUrl = `${origin}/live/${shareIdentifier}`;

  async function handleCopy() {
    await navigator.clipboard.writeText(publicShareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleShare() {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Let's Carol – Live Tracking",
          text: `Follow our carol team live on the map:`,
          url: publicShareUrl,
        });
      } catch {
        // User cancelled share
      }
    } else {
      handleCopy();
    }
  }

  return (
    <div className="page-container bg-slate-50">
      {/* ── Header ── */}
      <div className="bg-white border-b border-slate-100 px-4 pt-14 pb-4 sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-100" aria-label="Back to Home">
            <ChevronLeft size={18} className="text-slate-600" />
          </Link>
          <div className="flex-1">
            <h1 className="text-base font-bold text-slate-800">Live Location</h1>
            <p className="text-xs text-slate-400">
              {isTracking ? 'Broadcasting live GPS' : 'Location sharing inactive'}
            </p>
          </div>
          <StatusBadge status={isTracking ? 'live' : 'pending'} />
        </div>
      </div>

      <div className="px-4 pt-4 space-y-4 pb-10">
        {/* ── Error Banner ── */}
        {error && (
          <div role="alert" className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-red-50 border border-red-200">
            <AlertCircle size={18} className="text-red-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-xs font-semibold text-red-800">Location Access Error</p>
              <p className="text-xs text-red-600 mt-0.5">{error}. Please enable GPS permissions in your browser.</p>
            </div>
          </div>
        )}

        {/* ── Prominent Status & Control Banner ── */}
        <div className={`carol-card p-5 border-2 transition-all ${
          isTracking ? 'border-green-600 bg-green-50/40 shadow-sm' : 'border-slate-200 bg-white'
        }`}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className={`w-3 h-3 rounded-full ${isTracking ? 'bg-green-600 animate-pulse' : 'bg-slate-300'}`} />
              <p className="text-sm font-bold text-slate-800">
                {isTracking ? 'Location Sharing is ON' : 'Location Sharing is OFF'}
              </p>
            </div>
            <span className="text-[11px] text-slate-400 font-medium">
              {isTracking ? 'Updated just now' : 'Standby'}
            </span>
          </div>

          <p className="text-xs text-slate-500 mb-4 leading-relaxed">
            {isTracking
              ? 'Your device coordinates are being broadcast to the carol team map and congregation live link.'
              : 'Start sharing when you begin travelling to family homes. Stop sharing when the event concludes.'}
          </p>

          {isTracking ? (
            <button
              id="stop-location-btn"
              onClick={stopTracking}
              className="w-full py-3.5 px-4 rounded-full text-sm font-bold text-red-600 bg-red-50 border-2 border-red-200 hover:bg-red-100 active:scale-98 transition-all flex items-center justify-center gap-2 shadow-sm"
            >
              <StopCircle size={18} />
              Stop Location Sharing
            </button>
          ) : (
            <button
              id="start-location-btn"
              onClick={startTracking}
              className="btn-primary py-3.5 text-sm font-bold shadow-md flex items-center justify-center gap-2"
            >
              <Navigation size={18} />
              Start Live GPS Sharing
            </button>
          )}
        </div>

        {/* ── Live Map ── */}
        <div className="rounded-2xl overflow-hidden shadow-sm border border-slate-200">
          <LiveMap
            group={defaultGroup}
            routes={[]}
            deviceLat={latitude}
            deviceLng={longitude}
            userLat={displayLat}
            userLng={displayLng}
          />
        </div>

        {/* ── Vehicle & Telemetry Card ── */}
        <div className="carol-card p-4">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-2xl">🚐</span>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-slate-800 text-sm truncate">
                {defaultGroup.name}
              </p>
              <p className="text-xs text-slate-400">
                {defaultGroup.vehicle_number ? `Vehicle: ${defaultGroup.vehicle_number}` : 'No vehicle assigned'}
              </p>
            </div>
            <StatusBadge status={isTracking ? 'live' : 'pending'} />
          </div>

          {/* Coordinates */}
          <div className="bg-slate-50 rounded-xl p-3 mb-3 border border-slate-100 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Coordinates</p>
              <p className="font-mono text-xs font-semibold text-slate-700 mt-0.5">
                {displayLat.toFixed(5)}, {displayLng.toFixed(5)}
              </p>
            </div>
            <span className="text-[11px] text-slate-400">GPS WGS84</span>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-3 gap-2.5">
            <LocationStat
              icon={<Gauge size={16} className="text-blue-600" />}
              label="Speed"
              value={`${displaySpeed} km/h`}
              bg="bg-blue-50"
            />
            <LocationStat
              icon={<Compass size={16} className="text-purple-600" />}
              label="Direction"
              value={defaultGroup.current_direction ?? 'N'}
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

        {/* ── Share with Congregation ── */}
        <div className="carol-card p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Share2 size={16} className="text-green-700" />
            <p className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Public Tracking Link
            </p>
          </div>
          <p className="text-xs text-slate-500">
            Share this link with church families so they can see when the carol team is approaching their home.
          </p>

          <div className="flex items-center gap-2 bg-slate-50 rounded-xl p-2.5 border border-slate-200">
            <p className="flex-1 text-xs text-slate-600 truncate font-mono">{publicShareUrl}</p>
            <button
              onClick={handleCopy}
              className="flex items-center justify-center w-8 h-8 rounded-lg bg-white border border-slate-200 flex-shrink-0 text-slate-600 hover:text-green-700 transition-colors"
              aria-label="Copy link"
              title="Copy link"
            >
              {copied ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
            </button>
          </div>

          <button
            onClick={handleShare}
            className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold text-green-700 bg-green-50 hover:bg-green-100 active:scale-98 transition-all flex items-center justify-center gap-2 border border-green-200"
          >
            <Share2 size={14} />
            {copied ? 'Link Copied to Clipboard!' : 'Share Tracking Link with Congregation'}
          </button>
        </div>

        {/* ── Privacy Guarantee ── */}
        <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-slate-100 text-slate-500 text-xs">
          <Shield size={16} className="text-slate-400 flex-shrink-0 mt-0.5" />
          <p>
            <strong>Privacy boundary:</strong> Location is only broadcast while active. Sensitive details such as family notes and member data are never shared on the public tracking link.
          </p>
        </div>
      </div>
    </div>
  );
}

function LocationStat({ icon, label, value, bg }: {
  icon: React.ReactNode; label: string; value: string; bg: string;
}) {
  return (
    <div className={`${bg} rounded-2xl p-2.5 text-center`}>
      <div className="flex justify-center mb-1">{icon}</div>
      <p className="text-xs font-bold text-slate-800 truncate">{value}</p>
      <p className="text-[10px] text-slate-400 font-medium mt-0.5">{label}</p>
    </div>
  );
}
