/**
 * GPS Tracker Service
 * Fires every 500ms for real-time tracking.
 * POSTs to backend using INSERT ON DUPLICATE KEY UPDATE (upsert) —
 * first call inserts, every subsequent call updates the same row.
 */

import * as Location from 'expo-location';
import { API_BASE_URL } from '../constants/config';
import { getToken } from '../hooks/use-auth';

export interface Coords {
  latitude: number;
  longitude: number;
  accuracy: number | null;
}

export interface LocationUpdate {
  coords: Coords | null;
  unavailable: boolean;
}

type LocationCallback = (update: LocationUpdate) => void;

let subscription: Location.LocationSubscription | null = null;
let lastCoords: Coords | null = null;
let callbacks: Set<LocationCallback> = new Set();
let startCount = 0;
let posting = false; // prevent overlapping POSTs

function notifyCallbacks(update: LocationUpdate) {
  callbacks.forEach((cb) => cb(update));
}

async function postLocation(coords: Coords): Promise<void> {
  if (posting) return; // skip if previous POST still in flight
  posting = true;
  const token = await getToken();
  if (!token) { posting = false; return; }
  try {
    await fetch(`${API_BASE_URL}/api/locations/post`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ lat: coords.latitude, lng: coords.longitude }),
    });
  } catch {
    // non-fatal — next tick will retry
  } finally {
    posting = false;
  }
}

export async function start(): Promise<void> {
  startCount++;

  if (subscription) {
    if (lastCoords) notifyCallbacks({ coords: lastCoords, unavailable: false });
    return;
  }

  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') {
    notifyCallbacks({ coords: null, unavailable: true });
    return;
  }

  // Fast initial fix
  try {
    const initial = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });
    const coords: Coords = {
      latitude: initial.coords.latitude,
      longitude: initial.coords.longitude,
      accuracy: initial.coords.accuracy,
    };
    lastCoords = coords;
    notifyCallbacks({ coords, unavailable: false });
    postLocation(coords);
  } catch { /* watcher will provide first fix */ }

  // 500ms continuous watch — real-time tracking
  subscription = await Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.BestForNavigation,
      timeInterval: 500,       // fire every 500ms
      distanceInterval: 0,     // fire on time, not just distance
    },
    (location: Location.LocationObject) => {
      const coords: Coords = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy,
      };
      lastCoords = coords;
      notifyCallbacks({ coords, unavailable: false });
      postLocation(coords); // upsert — server handles insert vs update
    },
  );
}

export function stop(): void {
  startCount = Math.max(0, startCount - 1);
  if (startCount > 0) return;
  subscription?.remove();
  subscription = null;
  lastCoords = null;
  posting = false;
}

export function getLastCoords(): Coords | null {
  return lastCoords;
}

export function onLocationUpdate(callback: LocationCallback): () => void {
  callbacks.add(callback);
  if (lastCoords) callback({ coords: lastCoords, unavailable: false });
  return () => callbacks.delete(callback);
}
