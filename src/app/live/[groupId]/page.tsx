'use client';

/**
 * Public Congregation Live Tracking & Songbook Page
 *
 * Congregation view for live caroling event:
 * - Tab 1: Live Tracking (map, speed, stops completed, next stop)
 * - Tab 2: Songs (public carols for congregation to sing along, instant search, lyrics viewer)
 *
 * Security & Privacy:
 * - NO silent group fallback: invalid/missing group links fail safely with friendly unavailable state
 * - Explicit field projection: no select('*')
 * - Strictly excludes private phone numbers, member notes, and non-public data
 * - Filters songs to matching church, is_hidden = false, and is_public = true
 */

import dynamic from 'next/dynamic';
import { useEffect, useState, use, useCallback, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import {
  Clock, Navigation, Music, Search, X, BookOpen, AlertCircle, RefreshCw, CheckCircle2
} from 'lucide-react';
import type { Group, Route, Song } from '@/types/database';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { formatTime } from '@/lib/utils';
import { supabase } from '@/lib/supabase';

const LiveMap = dynamic(() => import('@/components/map/LiveMap'), {
  ssr: false,
  loading: () => <div className="skeleton w-full rounded-2xl" style={{ height: '100dvh' }} />,
});

interface LiveTrackingPageProps {
  params: Promise<{ groupId: string; churchSlug?: string }>;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function LiveTrackingContent({ params }: LiveTrackingPageProps) {
  const { groupId, churchSlug } = use(params);
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<'live' | 'songs'>('live');
  const [group, setGroup] = useState<(Group & { church_name?: string }) | null>(null);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [songs, setSongs] = useState<Song[]>([]);
  const [songSearch, setSongSearch] = useState('');
  const [selectedSong, setSelectedSong] = useState<Song | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string>(new Date().toISOString());

  const loadData = useCallback(async () => {
    try {
      let resolvedChurchId: string | null = null;
      let resolvedChurchName: string | null = null;
      let resolvedChurchSlug: string | null = null;

      // 1. Resolve church if churchSlug is provided in the route
      if (churchSlug) {
        const cleanSlug = churchSlug.trim().toLowerCase();

        // Check canonical church
        const { data: canon } = await supabase
          .from('churches')
          .select('id, name, slug')
          .eq('slug', cleanSlug)
          .maybeSingle();

        if (canon) {
          resolvedChurchId = canon.id;
          resolvedChurchName = canon.name;
          resolvedChurchSlug = canon.slug;
        } else {
          // Check slug history
          const { data: hist } = await supabase
            .from('church_slug_history')
            .select('church_id, churches(id, name, slug)')
            .eq('slug', cleanSlug)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          const raw = hist && Array.isArray(hist.churches) ? hist.churches[0] : (hist as any)?.churches;
          if (raw) {
            resolvedChurchId = raw.id;
            resolvedChurchName = raw.name;
            resolvedChurchSlug = raw.slug;
          }
        }

        // Church slug does not exist -> fail safely immediately
        if (!resolvedChurchId) {
          setNotFound(true);
          setLoading(false);
          return;
        }
      }

      // 2. Fetch group by UUID or slug with strict church boundary
      let query = supabase
        .from('groups')
        .select(`
          id,
          church_id,
          name,
          vehicle_number,
          slug,
          current_latitude,
          current_longitude,
          current_speed,
          current_direction,
          is_active,
          last_location_update,
          churches ( id, name, slug )
        `)
        .eq('is_active', true);

      // Multi-church isolation: require group to belong to the resolved church
      if (resolvedChurchId) {
        query = query.eq('church_id', resolvedChurchId);
      }

      if (UUID_REGEX.test(groupId)) {
        query = query.or(`id.eq.${groupId},slug.eq.${groupId}`);
      } else {
        query = query.eq('slug', groupId);
      }

      const { data: groupData, error: groupErr } = await query.maybeSingle();

      // STRICT SECURITY: Fail safely if group is missing, inactive, or belongs to another church
      if (groupErr || !groupData) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      const rawChurch = Array.isArray(groupData.churches)
        ? groupData.churches[0]
        : groupData.churches;

      // Legacy redirect: if visited via un-scoped /live/[groupId], redirect to canonical /[churchSlug]/live/[groupSlug]
      if (!churchSlug && rawChurch?.slug) {
        const canonicalGroup = groupData.slug || groupData.id;
        router.replace(`/${rawChurch.slug}/live/${canonicalGroup}`);
        return;
      }

      const loadedGroup = {
        id: groupData.id,
        church_id: groupData.church_id,
        name: groupData.name,
        leader_id: '',
        vehicle_number: groupData.vehicle_number,
        is_active: groupData.is_active,
        current_latitude: groupData.current_latitude,
        current_longitude: groupData.current_longitude,
        current_speed: groupData.current_speed,
        current_direction: groupData.current_direction,
        last_location_update: groupData.last_location_update,
        created_at: new Date().toISOString(),
        church_name: rawChurch?.name ?? resolvedChurchName ?? 'Let’s Carol',
      };

      setGroup(loadedGroup);
      setUpdatedAt(new Date().toISOString());
      setNotFound(false);

      // 3. Fetch routes with minimal public fields
      const { data: routeData } = await supabase
        .from('routes')
        .select('id, group_id, status, eta, order_index, family:families(id, name, address)')
        .eq('group_id', groupData.id)
        .order('order_index', { ascending: true });

      if (routeData) {
        setRoutes((routeData as unknown) as Route[]);
      }

      // 4. Fetch public carols for this church (only unhidden and public)
      const targetChurchId = resolvedChurchId || groupData.church_id;
      if (targetChurchId) {
        const { data: songData } = await supabase
          .from('songs')
          .select('id, title, artist, lyrics, category, order_index')
          .eq('church_id', targetChurchId)
          .eq('is_hidden', false)
          .eq('is_public', true)
          .order('order_index', { ascending: true });

        if (songData) {
          setSongs(songData as Song[]);
        }
      }
    } catch (err) {
      console.error('[LiveTrackingPage] load error:', err);
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [groupId, churchSlug, router]);

  useEffect(() => {
    loadData();

    if (!group?.id) return;

    // Realtime location updates for the active group only
    const channel = supabase
      .channel(`group-${group.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'groups', filter: `id=eq.${group.id}` },
        payload => {
          if (payload.new) {
            setGroup(prev => (prev ? { ...prev, ...(payload.new as Group) } : null));
            setUpdatedAt(new Date().toISOString());
          }
        }
      )
      .subscribe();

    // Poll every 30 seconds for route status transitions
    const interval = setInterval(loadData, 30000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [groupId, group?.id, loadData]);

  // Filter songs by search term
  const filteredSongs = songSearch.trim()
    ? songs.filter(s => {
      const q = songSearch.toLowerCase();
      return (
        s.title.toLowerCase().includes(q) ||
        s.artist?.toLowerCase().includes(q) ||
        s.category?.toLowerCase().includes(q) ||
        s.lyrics?.toLowerCase().includes(q)
      );
    })
    : songs;

  // Safe Failure State — never silently show another church's carol team
  if (!loading && (notFound || !group)) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-center text-white">
        <span className="flex items-center justify-center w-16 h-16 rounded-3xl bg-white/10 text-amber-400 mb-4 shadow-lg">
          <AlertCircle size={32} />
        </span>
        <h1 className="text-xl font-bold">This Live Tracking Link is Unavailable</h1>
        <p className="text-xs text-slate-400 mt-2 max-w-sm leading-relaxed">
          The requested carol team tracking link may have ended, is inactive, or the link is incorrect.
          Please check with your church coordinator for the latest link.
        </p>
      </div>
    );
  }

  const nextStop = routes.find(r => r.status !== 'visited');
  const visited = routes.filter(r => r.status === 'visited').length;

  return (
    <div className="relative min-h-screen bg-slate-900 flex flex-col">
      {/* ── Floating Header & Tabs ── */}
      <div className="relative z-30 p-4 pt-10 bg-gradient-to-b from-slate-950/90 to-transparent">
        <div className="max-w-md mx-auto space-y-3">
          {/* Church & Status Banner */}
          <div className="carol-card px-4 py-3 flex items-center justify-between gap-3 shadow-lg">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="text-2xl">🎄</span>
              <div className="min-w-0">
                <p className="font-bold text-slate-800 text-sm truncate">
                  {group?.church_name ?? 'Let’s Carol'}
                </p>
                <p className="text-[11px] text-slate-400 truncate">
                  {group?.name} • Updated {formatTime(updatedAt)}
                </p>
              </div>
            </div>
            <StatusBadge status={group?.is_active ? 'live' : 'pending'} />
          </div>

          {/* Simple Two-Tab Selector */}
          <div className="grid grid-cols-2 p-1 bg-slate-800/80 backdrop-blur-md rounded-2xl border border-white/10 shadow-md">
            <button
              type="button"
              onClick={() => setActiveTab('live')}
              className={`py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                activeTab === 'live'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Navigation size={14} className={activeTab === 'live' ? 'text-green-700' : ''} />
              <span>Live Tracking</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('songs')}
              className={`py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                activeTab === 'songs'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Music size={14} className={activeTab === 'songs' ? 'text-green-700' : ''} />
              <span>Carol Songs ({songs.length})</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── TAB 1: LIVE TRACKING ── */}
      {activeTab === 'live' && (
        <div className="flex-1 relative">
          {/* Full-screen Leaflet Map */}
          {group && (
            <div className="absolute inset-0">
              <LiveMap
                group={group}
                routes={routes}
                userLat={group.current_latitude ?? 13.0827}
                userLng={group.current_longitude ?? 80.2707}
              />
            </div>
          )}

          {/* Floating Bottom Stop Card */}
          <div className="absolute bottom-0 left-0 right-0 z-20 p-4 pb-8 pointer-events-none">
            <div className="max-w-md mx-auto carol-card p-4 shadow-2xl pointer-events-auto space-y-3">
              {/* Vehicle info */}
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-xl">🚐</span>
                  <div>
                    <p className="font-bold text-slate-800">{group?.vehicle_number ?? group?.name}</p>
                    <p className="text-[11px] text-slate-400">
                      {visited} of {routes.length} stops visited
                    </p>
                  </div>
                </div>

                {group?.current_speed != null && (
                  <div className="text-right">
                    <p className="font-bold text-slate-800 text-sm">{group.current_speed} km/h</p>
                    <p className="text-[10px] text-slate-400">{group.current_direction ?? 'Moving'}</p>
                  </div>
                )}
              </div>

              {/* Next stop */}
              {nextStop?.family ? (
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    Current Destination
                  </p>
                  <div className="flex items-center gap-3">
                    <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-green-50 text-green-700 shrink-0">
                      <Navigation size={16} />
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-slate-800 text-sm truncate">
                        {nextStop.family.name}
                      </p>
                      <p className="text-xs text-slate-400 truncate">
                        {nextStop.family.address}
                      </p>
                    </div>
                    {nextStop.eta && (
                      <div className="text-right shrink-0">
                        <span className="text-xs text-green-700 font-semibold flex items-center gap-1 justify-end">
                          <Clock size={11} /> {formatTime(nextStop.eta)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="py-2 text-center text-xs text-green-700 font-semibold flex items-center justify-center gap-1.5">
                  <CheckCircle2 size={15} />
                  <span>All planned carol visits completed!</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 2: PUBLIC CAROL SONGS ── */}
      {activeTab === 'songs' && (
        <div className="flex-1 overflow-y-auto px-4 pb-12 z-20">
          <div className="max-w-md mx-auto space-y-3 pt-2">
            {/* Search Input */}
            <div className="relative">
              <Search size={15} className="absolute left-3.5 inset-y-0 my-auto text-slate-400 pointer-events-none" />
              <input
                type="search"
                value={songSearch}
                onChange={e => setSongSearch(e.target.value)}
                placeholder="Search lyrics, song title, or category…"
                className="carol-input !pl-9 py-3 text-xs w-full bg-white shadow-md rounded-2xl"
              />
            </div>

            {/* Song Cards List */}
            {filteredSongs.length === 0 ? (
              <div className="carol-card p-8 text-center text-slate-500 text-xs shadow-md">
                <Music size={28} className="mx-auto text-slate-300 mb-2" />
                <p className="font-semibold text-slate-700">No songs found</p>
                <p className="text-slate-400 mt-0.5">
                  {songSearch ? 'Try a different search word.' : 'No public songs available yet.'}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredSongs.map((song, i) => (
                  <button
                    key={song.id}
                    type="button"
                    onClick={() => setSelectedSong(song)}
                    className="carol-card w-full p-3.5 flex items-center justify-between text-left hover:border-green-600 transition-all shadow-sm"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-9 h-9 rounded-xl bg-green-50 text-green-700 font-bold text-xs flex items-center justify-center shrink-0">
                        {i + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="font-bold text-slate-800 text-sm truncate">{song.title}</p>
                        <p className="text-xs text-slate-400 truncate">
                          {song.artist ?? song.category ?? 'Carol'}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs text-green-700 font-semibold px-2 py-1 bg-green-50 rounded-lg shrink-0">
                      Lyrics →
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Song Lyrics Modal ── */}
      {selectedSong && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in">
          <div className="w-full max-w-lg bg-white rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl max-h-[85vh] flex flex-col space-y-4">
            <div className="flex items-start justify-between pb-2 border-b border-slate-100">
              <div className="min-w-0 pr-2">
                <h3 className="font-bold text-slate-900 text-lg leading-tight truncate">
                  {selectedSong.title}
                </h3>
                {selectedSong.artist && (
                  <p className="text-xs text-slate-400 mt-0.5">{selectedSong.artist}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setSelectedSong(null)}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:text-slate-800 flex items-center justify-center shrink-0"
                aria-label="Close lyrics"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto pr-1">
              {selectedSong.lyrics ? (
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <pre className="text-sm font-sans text-slate-800 whitespace-pre-wrap leading-relaxed">
                    {selectedSong.lyrics}
                  </pre>
                </div>
              ) : (
                <div className="py-8 text-center text-xs text-slate-400">
                  Lyrics for this song have not been added yet.
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setSelectedSong(null)}
              className="btn-primary w-full py-3.5 text-xs font-bold rounded-xl shadow-md"
            >
              Back to Song List
            </button>
          </div>
        </div>
      )}
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
