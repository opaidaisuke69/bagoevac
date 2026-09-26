/**
 * Geo helpers — point-in-polygon against the Bago City barangay boundaries.
 * Mirrors the web app's lib/geo.js so the mobile map can scope centers to the
 * barangay the evacuee is currently standing in.
 */

import { BARANGAY_BOUNDARIES } from '../constants/barangayBoundaries';

type Ring = number[][]; // array of [lng, lat]

function pointInRing(lat: number, lng: number, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1]; // [lng, lat]
    const xj = ring[j][0], yj = ring[j][1];
    const intersect =
      (yi > lat) !== (yj > lat) &&
      lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function coordsContain(lat: number, lng: number, coords: any): boolean {
  // Multi-polygon: coords is [ring1, ring2, ...]
  if (Array.isArray(coords[0]?.[0]) && Array.isArray(coords[0][0])) {
    return coords.some((ring: Ring) => pointInRing(lat, lng, ring));
  }
  return pointInRing(lat, lng, coords as Ring);
}

/** Returns the barangay name a point falls inside, or null. */
export function getBarangayAtPoint(lat?: number | null, lng?: number | null): string | null {
  if (lat == null || lng == null) return null;
  for (const brgy of BARANGAY_BOUNDARIES as any[]) {
    if (coordsContain(lat, lng, brgy.coords)) return brgy.name;
  }
  return null;
}

/** True if the point is inside the named barangay's boundary. */
export function isInsideBarangay(
  lat?: number | null,
  lng?: number | null,
  barangayName?: string | null,
): boolean {
  if (lat == null || lng == null || !barangayName) return false;
  const brgy = (BARANGAY_BOUNDARIES as any[]).find(
    (b) => b.name.toLowerCase() === barangayName.toLowerCase(),
  );
  if (!brgy) return false;
  return coordsContain(lat, lng, brgy.coords);
}
