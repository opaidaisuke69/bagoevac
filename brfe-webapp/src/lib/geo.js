import { BARANGAY_BOUNDARIES } from '../data/barangayBoundaries';

/**
 * Ray-casting algorithm for point-in-polygon detection.
 * @param {number} lat - Latitude of the point
 * @param {number} lng - Longitude of the point
 * @param {Array} polygon - Array of [lng, lat] coordinate pairs
 * @returns {boolean}
 */
function pointInPolygon(lat, lng, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = [polygon[i][0], polygon[i][1]]; // [lng, lat]
    const [xj, yj] = [polygon[j][0], polygon[j][1]];

    const intersect =
      yi > lat !== yj > lat &&
      lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;

    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Determine which barangay a point (lat, lng) falls inside,
 * using the actual polygon boundary data.
 * @param {number} lat
 * @param {number} lng
 * @returns {string|null} Barangay name or null if outside all boundaries
 */
export function getBarangayAtPoint(lat, lng) {
  if (lat == null || lng == null) return null;

  for (const brgy of BARANGAY_BOUNDARIES) {
    const coords = brgy.coords;

    // Handle multi-polygon (e.g., Lag-Asan has multiple rings)
    if (Array.isArray(coords[0]?.[0]) && Array.isArray(coords[0][0])) {
      // Multi-polygon: coords is [ring1, ring2, ...]
      for (const ring of coords) {
        if (pointInPolygon(lat, lng, ring)) return brgy.name;
      }
    } else {
      // Single polygon: coords is [[lng, lat], ...]
      if (pointInPolygon(lat, lng, coords)) return brgy.name;
    }
  }

  return null;
}

/**
 * Enrich an array of evacuees with a `current_barangay` field
 * calculated from actual polygon boundaries instead of nearest-center.
 * @param {Array} evacuees - Array of evacuee objects with latitude/longitude
 * @returns {Array} Same array with `current_barangay` updated
 */
export function enrichWithBoundaryBarangay(evacuees) {
  return evacuees.map((u) => {
    if (u.latitude != null && u.longitude != null) {
      const detected = getBarangayAtPoint(u.latitude, u.longitude);
      return { ...u, current_barangay: detected };
    }
    return { ...u, current_barangay: null };
  });
}

/**
 * Check if a point is inside a specific barangay's boundary.
 * @param {number} lat
 * @param {number} lng
 * @param {string} barangayName
 * @returns {boolean}
 */
export function isInsideBarangay(lat, lng, barangayName) {
  if (lat == null || lng == null || !barangayName) return false;

  const brgy = BARANGAY_BOUNDARIES.find(
    (b) => b.name.toLowerCase() === barangayName.toLowerCase()
  );
  if (!brgy) return false;

  const coords = brgy.coords;

  if (Array.isArray(coords[0]?.[0]) && Array.isArray(coords[0][0])) {
    for (const ring of coords) {
      if (pointInPolygon(lat, lng, ring)) return true;
    }
    return false;
  }

  return pointInPolygon(lat, lng, coords);
}
