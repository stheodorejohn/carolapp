'use client';

import { useEffect, useRef, useState, useCallback, type RefObject } from 'react';
import L from 'leaflet';
import { Group, Route } from '@/types/database';
import { Maximize2, X, LocateFixed, Users, LoaderCircle } from 'lucide-react';

// ─── Icons ────────────────────────────────────────────────────────────────────

const teamIcon = L.divIcon({
  className: '',
  html: `<div style="
    width:38px;height:38px;border-radius:50%;
    background:linear-gradient(135deg,#166534,#15803d);
    display:flex;align-items:center;justify-content:center;
    box-shadow:0 3px 10px rgba(22,101,52,.45);
    border:3px solid white;font-size:17px;
    cursor:pointer;
    user-select:none;
  ">🚐</div>`,
  iconSize: [38, 38],
  iconAnchor: [19, 19],
  popupAnchor: [0, -20],
});

const deviceIcon = L.divIcon({
  className: '',
  html: `<div style="
    position:relative;
    width:32px;height:32px;
    display:flex;align-items:center;justify-content:center;
    cursor:pointer;
    user-select:none;
  ">
    <div style="
      position:absolute;inset:0;
      border-radius:50%;
      background:rgba(37,99,235,0.25);
      animation:devicePulse 2s infinite ease-out;
    "></div>
    <div style="
      width:14px;height:14px;border-radius:50%;
      background:#2563eb;
      border:2.5px solid white;
      box-shadow:0 2px 6px rgba(0,0,0,0.35);
      position:relative;
      z-index:2;
    "></div>
  </div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 16],
  popupAnchor: [0, -16],
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

function makeTeamPopupContent(group: Group) {
  return `<div style="padding:4px 2px;min-width:140px;text-align:center;">
    <div style="font-size:10px;font-weight:700;color:#166534;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:2px;">
      Active Group Location
    </div>
    <div style="font-weight:700;color:#1e293b;font-size:13px;line-height:1.2;">
      ${group.name || 'Carol Team'}
    </div>
    ${group.vehicle_number ? `<div style="color:#64748b;font-size:11px;margin-top:2px;">🚐 ${group.vehicle_number}</div>` : ''}
    ${group.current_speed != null ? `<div style="color:#16a34a;font-size:11px;font-weight:600;margin-top:3px;">Speed: ${group.current_speed} km/h</div>` : ''}
  </div>`;
}

function makeDevicePopupContent() {
  return `<div style="padding:4px 2px;min-width:130px;text-align:center;">
    <div style="font-size:10px;font-weight:700;color:#2563eb;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:2px;">
      Device Location
    </div>
    <div style="font-weight:700;color:#1e293b;font-size:13px;line-height:1.2;">
      📱 Your Device
    </div>
    <div style="color:#64748b;font-size:11px;margin-top:2px;">
      Current device GPS
    </div>
  </div>`;
}

// ─── Component ────────────────────────────────────────────────────────────────

interface LiveMapProps {
  group: Group;
  routes: Route[];
  userLat?: number;
  userLng?: number;
  deviceLat?: number | null;
  deviceLng?: number | null;
}

export default function LiveMap({
  group,
  routes,
  userLat,
  userLng,
  deviceLat,
  deviceLng,
}: LiveMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<L.Map | null>(null);
  const teamMarker   = useRef<L.Marker | null>(null);
  const deviceMarker = useRef<L.Marker | null>(null);
  const stopsLayer   = useRef<L.LayerGroup | null>(null);
  const polylineRef  = useRef<L.Polyline | null>(null);
  const watchIdRef   = useRef<number | null>(null);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLocatingDevice, setIsLocatingDevice] = useState(false);
  const [locationNotice, setLocationNotice] = useState<string | null>(null);
  const [internalDeviceCoords, setInternalDeviceCoords] = useState<{ lat: number; lng: number } | null>(
    deviceLat != null && deviceLng != null ? { lat: deviceLat, lng: deviceLng } : null
  );

  // Group active location coordinates
  const groupLat = group.current_latitude ?? (userLat ?? 13.0827);
  const groupLng = group.current_longitude ?? (userLng ?? 80.2707);

  // Device current coordinates (from prop or internal state)
  const activeDeviceCoords = (deviceLat != null && deviceLng != null)
    ? { lat: deviceLat, lng: deviceLng }
    : internalDeviceCoords;

  // Sync prop changes for device coordinates
  useEffect(() => {
    if (deviceLat != null && deviceLng != null) {
      setInternalDeviceCoords({ lat: deviceLat, lng: deviceLng });
    }
  }, [deviceLat, deviceLng]);

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

    const initialLat = groupLat;
    const initialLng = groupLng;

    const map = L.map(container, { zoomControl: true, attributionControl: false })
      .setView([initialLat, initialLng], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    // Group Marker (active location of the group)
    teamMarker.current = L.marker([groupLat, groupLng], { icon: teamIcon })
      .bindPopup(makeTeamPopupContent(group))
      .addTo(map);

    // Device Marker (current location of device if already known)
    if (activeDeviceCoords) {
      deviceMarker.current = L.marker([activeDeviceCoords.lat, activeDeviceCoords.lng], { icon: deviceIcon })
        .bindPopup(makeDevicePopupContent())
        .addTo(map);
    }

    stopsLayer.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    return () => {
      if (watchIdRef.current !== null && typeof navigator !== 'undefined' && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      map.remove();
      mapRef.current       = null;
      teamMarker.current   = null;
      deviceMarker.current = null;
      stopsLayer.current   = null;
      polylineRef.current  = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Keep group marker position updated ───────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || !teamMarker.current) return;
    teamMarker.current.setLatLng([groupLat, groupLng]);
    teamMarker.current.setPopupContent(makeTeamPopupContent(group));
  }, [groupLat, groupLng, group]);

  // ── Keep device marker updated as device moves ────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !activeDeviceCoords) return;

    if (deviceMarker.current) {
      deviceMarker.current.setLatLng([activeDeviceCoords.lat, activeDeviceCoords.lng]);
    } else {
      deviceMarker.current = L.marker([activeDeviceCoords.lat, activeDeviceCoords.lng], { icon: deviceIcon })
        .bindPopup(makeDevicePopupContent())
        .addTo(map);
    }
  }, [activeDeviceCoords]);

  // ── Invalidate map size after fullscreen transition completes ─────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const t = setTimeout(() => {
      map.invalidateSize({ animate: false });
      map.setView([groupLat, groupLng], map.getZoom());
    }, 320);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFullscreen]);

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

  const showNotice = (msg: string) => {
    setLocationNotice(msg);
    setTimeout(() => {
      setLocationNotice(prev => (prev === msg ? null : prev));
    }, 2500);
  };

  // ── Action: See Active Location of the Group ──────────────────────────────
  const goToGroupLocation = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    map.flyTo([groupLat, groupLng], 15, { duration: 0.8 });
    teamMarker.current?.openPopup();
    showNotice(`Group: ${group.name || 'Carol Team'}`);
  }, [groupLat, groupLng, group.name]);

  // ── Action: See Current Location of Device ────────────────────────────────
  const goToDeviceLocation = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;

    if (activeDeviceCoords) {
      map.flyTo([activeDeviceCoords.lat, activeDeviceCoords.lng], 16, { duration: 0.8 });
      deviceMarker.current?.openPopup();
      showNotice('Centered on Your Device');
      return;
    }

    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      showNotice('Geolocation not supported by device');
      return;
    }

    setIsLocatingDevice(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocatingDevice(false);
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setInternalDeviceCoords({ lat, lng });

        if (mapRef.current) {
          if (deviceMarker.current) {
            deviceMarker.current.setLatLng([lat, lng]);
          } else {
            deviceMarker.current = L.marker([lat, lng], { icon: deviceIcon })
              .bindPopup(makeDevicePopupContent())
              .addTo(mapRef.current);
          }
          mapRef.current.flyTo([lat, lng], 16, { duration: 0.8 });
          deviceMarker.current.openPopup();
        }
        showNotice('Centered on Your Device');

        // Watch device position to keep marker updated if location changes
        if (watchIdRef.current === null) {
          watchIdRef.current = navigator.geolocation.watchPosition(
            (watchPos) => {
              const wLat = watchPos.coords.latitude;
              const wLng = watchPos.coords.longitude;
              setInternalDeviceCoords({ lat: wLat, lng: wLng });
              deviceMarker.current?.setLatLng([wLat, wLng]);
            },
            () => {},
            { enableHighAccuracy: true, maximumAge: 5000 }
          );
        }
      },
      (err) => {
        setIsLocatingDevice(false);
        if (err.code === err.PERMISSION_DENIED) {
          showNotice('Location permission denied on device');
        } else {
          showNotice('Unable to retrieve device location');
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, [activeDeviceCoords]);

  return (
    <>
      {/* ── Compact card map ─────────────────────────────────────────────── */}
      <div style={{ position: 'relative', borderRadius: 16, overflow: 'hidden' }}>
        <div
          ref={containerRef}
          style={{ height: 280, width: '100%' }}
        />

        {/* Map Control Buttons: Fullscreen, Active Group Location, Current Device Location */}
        <div
          style={{
            position: 'absolute',
            top: 10,
            right: 10,
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          {/* Fullscreen expand button */}
          <button
            id="map-fullscreen-btn"
            onClick={toggleFullscreen}
            aria-label="Expand map"
            title="Expand map"
            style={{
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
              transition: 'transform 150ms ease, background 150ms ease',
            }}
            onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.08)')}
            onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
          >
            <Maximize2 size={16} color="#374151" />
          </button>

          {/* Active Group Location button */}
          <button
            id="map-group-loc-btn"
            onClick={goToGroupLocation}
            aria-label="See active location of the group"
            title="See active location of the group"
            style={{
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
              transition: 'transform 150ms ease, background 150ms ease',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.transform = 'scale(1.08)';
              e.currentTarget.style.background = '#f0fdf4';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.background = 'white';
            }}
          >
            <Users size={16} color="#166534" />
          </button>

          {/* Current Device Location button */}
          <button
            id="map-device-loc-btn"
            onClick={goToDeviceLocation}
            aria-label="See current location of device"
            title="See current location of device"
            disabled={isLocatingDevice}
            style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              background: isLocatingDevice ? '#eff6ff' : 'white',
              border: '1px solid rgba(0,0,0,.12)',
              boxShadow: '0 2px 8px rgba(0,0,0,.18)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: isLocatingDevice ? 'wait' : 'pointer',
              transition: 'transform 150ms ease, background 150ms ease',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.transform = 'scale(1.08)';
              e.currentTarget.style.background = '#eff6ff';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.background = isLocatingDevice ? '#eff6ff' : 'white';
            }}
          >
            {isLocatingDevice ? (
              <LoaderCircle size={16} color="#2563eb" className="animate-spin" />
            ) : (
              <LocateFixed size={16} color="#2563eb" />
            )}
          </button>
        </div>

        {/* Floating status toast */}
        {locationNotice && (
          <div
            style={{
              position: 'absolute',
              bottom: 12,
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 1000,
              background: 'rgba(15,23,42,0.85)',
              color: 'white',
              padding: '6px 14px',
              borderRadius: 20,
              fontSize: '0.75rem',
              fontWeight: 500,
              backdropFilter: 'blur(6px)',
              boxShadow: '0 2px 10px rgba(0,0,0,0.25)',
              pointerEvents: 'none',
              whiteSpace: 'nowrap',
              animation: 'mapFsIn 180ms ease',
            }}
          >
            {locationNotice}
          </div>
        )}
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
                · {group.name || 'Carol Team'} {group.vehicle_number ? `(${group.vehicle_number})` : ''}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {/* Active Group Location button */}
              <button
                id="map-fs-group-btn"
                onClick={goToGroupLocation}
                aria-label="See active location of the group"
                title="See active location of the group"
                style={{
                  height: 34,
                  padding: '0 10px',
                  borderRadius: 17,
                  background: 'rgba(22,101,52,.35)',
                  border: '1px solid rgba(34,197,94,.4)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  cursor: 'pointer',
                  color: '#86efac',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  transition: 'background 150ms',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(22,101,52,.5)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'rgba(22,101,52,.35)')}
              >
                <Users size={14} color="#86efac" />
                <span>Group</span>
              </button>

              {/* Current Device Location button */}
              <button
                id="map-fs-device-btn"
                onClick={goToDeviceLocation}
                aria-label="See current location of device"
                title="See current location of device"
                disabled={isLocatingDevice}
                style={{
                  height: 34,
                  padding: '0 10px',
                  borderRadius: 17,
                  background: 'rgba(37,99,235,.3)',
                  border: '1px solid rgba(59,130,246,.4)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  cursor: isLocatingDevice ? 'wait' : 'pointer',
                  color: '#93c5fd',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  transition: 'background 150ms',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(37,99,235,.45)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'rgba(37,99,235,.3)')}
              >
                {isLocatingDevice ? (
                  <LoaderCircle size={14} color="#93c5fd" className="animate-spin" />
                ) : (
                  <LocateFixed size={14} color="#93c5fd" />
                )}
                <span>Device</span>
              </button>

              {/* Collapse */}
              <button
                id="map-collapse-btn"
                onClick={toggleFullscreen}
                aria-label="Exit fullscreen"
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: '50%',
                  background: 'rgba(255,255,255,.1)',
                  border: '1px solid rgba(255,255,255,.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'background 150ms',
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
            overflowX: 'auto',
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 13, lineHeight: 1 }}>🚐</span>
              <span style={{ color: '#86efac', fontSize: '0.75rem' }}>Active Group</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#2563eb', border: '1.5px solid white' }} />
              <span style={{ color: '#93c5fd', fontSize: '0.75rem' }}>Your Device</span>
            </div>
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
        @keyframes devicePulse {
          0% { transform: scale(0.8); opacity: 0.9; }
          50% { transform: scale(1.6); opacity: 0.2; }
          100% { transform: scale(0.8); opacity: 0.9; }
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
