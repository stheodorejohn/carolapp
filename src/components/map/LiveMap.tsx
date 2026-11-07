'use client';

import { useEffect, useRef, useState, useCallback, type RefObject } from 'react';
import L from 'leaflet';
import { Group, Route } from '@/types/database';
import { Maximize2, X, Navigation2 } from 'lucide-react';

// ─── Icons ────────────────────────────────────────────────────────────────────

const teamIcon = L.divIcon({
  className: '',
  html: `<div style="
    width:36px;height:36px;border-radius:50%;
    background:linear-gradient(135deg,#166534,#15803d);
    display:flex;align-items:center;justify-content:center;
    box-shadow:0 2px 8px rgba(22,101,52,.5);
    border:3px solid white;font-size:16px;
  ">🚐</div>`,
  iconSize: [36, 36],
  iconAnchor: [18, 18],
});

function makeStopIcon(status: string) {
  const bg =
    status === 'visited' ? '#166534' :
    status === 'in_progress' ? '#2563eb' :
    '#94a3b8';
  return L.divIcon({
    className: '',
    html: `<div style="
      width:28px;height:28px;border-radius:50%;
      background:${bg};
      display:flex;align-items:center;justify-content:center;
      box-shadow:0 2px 6px rgba(0,0,0,.25);
      border:2.5px solid white;color:white;font-size:11px;font-weight:700;
    "></div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

// ─── Component ────────────────────────────────────────────────────────────────

interface LiveMapProps {
  group: Group;
  routes: Route[];
  userLat: number;
  userLng: number;
}

export default function LiveMap({ group, routes, userLat, userLng }: LiveMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<L.Map | null>(null);
  const teamMarker   = useRef<L.Marker | null>(null);
  const stopsLayer   = useRef<L.LayerGroup | null>(null);
  const polylineRef  = useRef<L.Polyline | null>(null);

  const [isFullscreen, setIsFullscreen] = useState(false);

  // ── Initialize map once on mount, destroy on unmount ──────────────────────
  useEffect(() => {
    const container = containerRef.current;
    if (!container || mapRef.current) return;

    // Fix default icon paths for webpack/Next.js (safe to call multiple times)
    delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
      iconUrl:       'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
      shadowUrl:     'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
    });

    const map = L.map(container, { zoomControl: true, attributionControl: false })
      .setView([userLat, userLng], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    teamMarker.current = L.marker([userLat, userLng], { icon: teamIcon })
      .bindPopup(`<strong>${group.vehicle_number ?? 'Team Vehicle'}</strong>`)
      .addTo(map);

    stopsLayer.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current     = null;
      teamMarker.current = null;
      stopsLayer.current = null;
      polylineRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Invalidate map size after fullscreen transition completes ─────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    // Wait for the CSS transition (300 ms) before telling Leaflet the new size
    const t = setTimeout(() => {
      map.invalidateSize({ animate: false });
      map.setView([userLat, userLng], map.getZoom());
    }, 320);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFullscreen]);

  // ── Fly to new position when user moves ───────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    teamMarker.current?.setLatLng([userLat, userLng]);
    map.flyTo([userLat, userLng], map.getZoom(), { duration: 1, animate: true });
  }, [userLat, userLng]);

  // ── Rebuild stop markers + polyline when routes change ────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !stopsLayer.current) return;

    stopsLayer.current.clearLayers();
    polylineRef.current?.remove();
    polylineRef.current = null;

    routes.forEach((route, i) => {
      if (!route.family?.latitude || !route.family?.longitude) return;
      L.marker(
        [route.family.latitude, route.family.longitude],
        { icon: makeStopIcon(route.status) },
      )
        .bindPopup(
          `<strong>${i + 1}. ${route.family.name}</strong><br/>` +
          `<span style="text-transform:capitalize">${route.status.replace('_', ' ')}</span>`,
        )
        .addTo(stopsLayer.current!);
    });

    const coords: [number, number][] = routes
      .filter(r => r.family?.latitude && r.family?.longitude)
      .sort((a, b) => a.order_index - b.order_index)
      .map(r => [r.family!.latitude, r.family!.longitude]);

    if (coords.length > 1) {
      polylineRef.current = L.polyline(coords, {
        color: '#16a34a', weight: 3, dashArray: '6 4', opacity: 0.7,
      }).addTo(map);
    }
  }, [routes]);

  // ── Close fullscreen on Escape ────────────────────────────────────────────
  useEffect(() => {
    if (!isFullscreen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setIsFullscreen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isFullscreen]);

  const toggleFullscreen = useCallback(() => setIsFullscreen(f => !f), []);

  // ── Recenter on user location ─────────────────────────────────────────────
  const recenter = useCallback(() => {
    mapRef.current?.flyTo([userLat, userLng], 15, { duration: 0.8 });
  }, [userLat, userLng]);

  return (
    <>
      {/* ── Compact card map ─────────────────────────────────────────────── */}
      <div style={{ position: 'relative', borderRadius: 16, overflow: 'hidden' }}>
        <div
          ref={containerRef}
          style={{ height: 280, width: '100%' }}
        />

        {/* Fullscreen expand button */}
        <button
          id="map-fullscreen-btn"
          onClick={toggleFullscreen}
          aria-label="Expand map"
          style={{
            position: 'absolute',
            top: 10,
            right: 10,
            zIndex: 1000,
            width: 36,
            height: 36,
            borderRadius: '50%',
            background: 'white',
            border: '1px solid rgba(0,0,0,.12)',
            boxShadow: '0 2px 8px rgba(0,0,0,.18)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'transform 150ms ease',
          }}
          onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.1)')}
          onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
        >
          <Maximize2 size={16} color="#374151" />
        </button>
      </div>

      {/* ── Fullscreen overlay ───────────────────────────────────────────── */}
      {isFullscreen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: '#111827',
            display: 'flex',
            flexDirection: 'column',
            animation: 'mapFsIn 280ms cubic-bezier(.22,1,.36,1)',
          }}
        >
          {/* Top bar */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            background: 'rgba(17,24,39,.95)',
            backdropFilter: 'blur(12px)',
            borderBottom: '1px solid rgba(255,255,255,.08)',
            flexShrink: 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 8, height: 8, borderRadius: '50%', background: '#22c55e',
                boxShadow: '0 0 0 3px rgba(34,197,94,.3)',
                animation: 'pulse-ring 1.4s infinite',
              }} />
              <span style={{ color: 'white', fontWeight: 600, fontSize: '0.95rem' }}>
                Live Map
              </span>
              <span style={{ color: '#9ca3af', fontSize: '0.8rem' }}>
                · {group.vehicle_number ?? 'Team Vehicle'}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {/* Recenter */}
              <button
                id="map-recenter-btn"
                onClick={recenter}
                aria-label="Recenter map"
                style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: 'rgba(255,255,255,.1)',
                  border: '1px solid rgba(255,255,255,.15)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', transition: 'background 150ms',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,.2)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,.1)')}
              >
                <Navigation2 size={16} color="white" />
              </button>

              {/* Collapse */}
              <button
                id="map-collapse-btn"
                onClick={toggleFullscreen}
                aria-label="Exit fullscreen"
                style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: 'rgba(255,255,255,.1)',
                  border: '1px solid rgba(255,255,255,.15)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', transition: 'background 150ms',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(239,68,68,.35)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,.1)')}
              >
                <X size={16} color="white" />
              </button>
            </div>
          </div>

          {/* Map fill area — Leaflet re-uses the same DOM node via portal-like pointer */}
          <div style={{ flex: 1, position: 'relative' }}>
            <MapPortal containerRef={containerRef} />
          </div>

          {/* Bottom legend */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            padding: '10px 16px',
            background: 'rgba(17,24,39,.95)',
            backdropFilter: 'blur(12px)',
            borderTop: '1px solid rgba(255,255,255,.08)',
            flexShrink: 0,
          }}>
            {[
              { color: '#166534', label: 'Visited' },
              { color: '#2563eb', label: 'In Progress' },
              { color: '#94a3b8', label: 'Pending' },
            ].map(({ color, label }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: color }} />
                <span style={{ color: '#9ca3af', fontSize: '0.75rem' }}>{label}</span>
              </div>
            ))}
            <span style={{ marginLeft: 'auto', color: '#6b7280', fontSize: '0.72rem' }}>
              Press Esc to close
            </span>
          </div>
        </div>
      )}

      <style>{`
        @keyframes mapFsIn {
          from { opacity: 0; transform: scale(0.97); }
          to   { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </>
  );
}

// ─── MapPortal ────────────────────────────────────────────────────────────────
// Moves the existing map DOM node into the fullscreen overlay without
// re-initializing Leaflet (no teardown/remount).

function MapPortal({ containerRef }: { containerRef: RefObject<HTMLDivElement | null> }) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host      = hostRef.current;
    const mapNode   = containerRef.current;
    if (!host || !mapNode) return;

    // Save original parent so we can put it back
    const originalParent  = mapNode.parentElement!;
    const originalNextSib = mapNode.nextElementSibling;
    const originalStyle   = { height: mapNode.style.height, width: mapNode.style.width, borderRadius: mapNode.style.borderRadius };

    // Move node + stretch to fill overlay
    mapNode.style.height       = '100%';
    mapNode.style.width        = '100%';
    mapNode.style.borderRadius = '0';
    host.appendChild(mapNode);

    return () => {
      // Restore node to original position
      mapNode.style.height       = originalStyle.height;
      mapNode.style.width        = originalStyle.width;
      mapNode.style.borderRadius = originalStyle.borderRadius;
      if (originalNextSib) {
        originalParent.insertBefore(mapNode, originalNextSib);
      } else {
        originalParent.appendChild(mapNode);
      }
    };
  }, [containerRef]);

  return <div ref={hostRef} style={{ width: '100%', height: '100%' }} />;
}
