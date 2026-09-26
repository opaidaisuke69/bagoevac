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

  // Fast initial fix — shown to the user right away, but only posted if it's
  // reasonably accurate. A coarse first fix (cell/wifi before GPS locks) is
  // often far off, so we don't want to broadcast it as the rescuer's position.
  try {
    const initial = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Highest,
    });
    const coords: Coords = {
      latitude: initial.coords.latitude,
      longitude: initial.coords.longitude,
      accuracy: initial.coords.accuracy,
    };
    lastCoords = coords;
    notifyCallbacks({ coords, unavailable: false });
    if (isAcceptable(coords)) postLocation(coords);
  } catch { /* watcher will provide first fix */ }

  // Continuous watch — real-time tracking. We keep the most ACCURATE fix rather
  // than blindly overwriting, so the marker converges on the true position and
  // never gets stuck on a bad early reading.
  subscription = await Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.Highest,
      timeInterval: 1000,      // fire up to once per second
      distanceInterval: 0,     // also fire when stationary so accuracy can improve
    },
    (location: Location.LocationObject) => {
      const coords: Coords = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy,
      };
      if (!shouldAccept(coords)) return;
      lastCoords = coords;
      notifyCallbacks({ coords, unavailable: false });
      if (isAcceptable(coords)) postLocation(coords); // upsert
    },
  );
}

// A fix is "acceptable" to broadcast if its reported accuracy is within GOOD_ACCURACY_M.
const GOOD_ACCURACY_M = 30;
function isAcceptable(coords: Coords): boolean {
  return coords.accuracy == null || coords.accuracy <= GOOD_ACCURACY_M;
}

// Decide whether a new watch reading should replace the current one.
// - Always accept if we have nothing yet.
// - Accept when the new fix is at least as accurate (with small tolerance),
//   OR when the device has clearly moved (so real movement is never ignored),
//   OR when the current fix is coarse and the new one is any better.
function shouldAccept(next: Coords): boolean {
  if (!lastCoords) return true;
  const prevAcc = lastCoords.accuracy ?? Number.POSITIVE_INFINITY;
  const nextAcc = next.accuracy ?? Number.POSITIVE_INFINITY;

  // Prefer better (or comparable) accuracy.
  if (nextAcc <= prevAcc + 5) return true;

  // If the previous fix was coarse, take any improvement.
  if (prevAcc > GOOD_ACCURACY_M && nextAcc < prevAcc) return true;

  // Otherwise accept only if the position genuinely changed a lot (real movement).
  const moved = haversineMeters(lastCoords, next);
  return moved > Math.max(prevAcc, 20);
}

function haversineMeters(a: Coords, b: Coords): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
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
