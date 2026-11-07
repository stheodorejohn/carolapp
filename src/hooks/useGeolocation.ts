'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

export interface GeolocationState {
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  speed: number | null;
  heading: number | null;
  error: string | null;
  isTracking: boolean;
}

export interface GeolocationOptions {
  enableHighAccuracy?: boolean;
  timeout?: number;
  maximumAge?: number;
  onUpdate?: (position: GeolocationCoordinates) => void;
}

export function useGeolocation(options: GeolocationOptions = {}) {
  const {
    enableHighAccuracy = true,
    timeout = 10000,
    maximumAge = 0,
    onUpdate,
  } = options;

  const [state, setState] = useState<GeolocationState>({
    latitude: null,
    longitude: null,
    accuracy: null,
    speed: null,
    heading: null,
    error: null,
    isTracking: false,
  });

  const watchIdRef = useRef<number | null>(null);
  const onUpdateRef = useRef(onUpdate);

  // Keep onUpdate ref current without re-registering the watcher
  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  const startTracking = useCallback(() => {
    if (!navigator.geolocation) {
      setState((prev) => ({
        ...prev,
        error: 'Geolocation is not supported by this browser.',
      }));
      return;
    }

    if (watchIdRef.current !== null) return; // already watching

    setState((prev) => ({ ...prev, isTracking: true, error: null }));

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, accuracy, speed, heading } =
          position.coords;
        setState({
          latitude,
          longitude,
          accuracy,
          speed,
          heading,
          error: null,
          isTracking: true,
        });
        onUpdateRef.current?.(position.coords);
      },
      (error) => {
        setState((prev) => ({
          ...prev,
          error: error.message,
          isTracking: false,
        }));
      },
      { enableHighAccuracy, timeout, maximumAge }
    );
  }, [enableHighAccuracy, timeout, maximumAge]);

  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setState((prev) => ({ ...prev, isTracking: false }));
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  return { ...state, startTracking, stopTracking };
}
