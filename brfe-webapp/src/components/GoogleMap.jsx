import { useCallback, useRef, useEffect, useMemo } from 'react';
import { GoogleMap as GMap, useJsApiLoader, Marker, InfoWindow, Polygon, OverlayView } from '@react-google-maps/api';
import { useState } from 'react';
import { BARANGAY_BOUNDARIES } from '../data/barangayBoundaries';
import { enrichWithBoundaryBarangay } from '../lib/geo';
import defaultHallImg from '../assets/images/logo.png';

const GOOGLE_MAPS_API_KEY = 'AIzaSyAYMxiPynLx-KZ7udjt382QPsgadmzh7HM';

const containerStyle = { width: '100%', height: '100%' };
const defaultCenter = { lat: 10.51, lng: 122.92 };

// Barangay Hall coordinates with labels
const BARANGAY_HALLS = [
  { name: 'Abuanan Brgy. Hall', lat: 10.525348, lng: 122.992381 },
  { name: 'Alianza Brgy. Hall', lat: 10.473141, lng: 122.930246 },
  { name: 'Atipuluan Brgy. Hall', lat: 10.511460, lng: 122.955350 },
  { name: 'Bacong-Montilla Brgy. Hall', lat: 10.518851, lng: 123.034313 },
  { name: 'Bagroy Brgy. Hall', lat: 10.476942, lng: 122.872296 },
  { name: 'Balingasag Brgy. Hall', lat: 10.532732, lng: 122.842850 },
  { name: 'Binubuhan Brgy. Hall', lat: 10.460453, lng: 122.992656 },
  { name: 'Busay Brgy. Hall', lat: 10.536833, lng: 122.888264 },
  { name: 'Calumangan Brgy. Hall', lat: 10.559610, lng: 122.876397 },
  { name: 'Caridad Brgy. Hall', lat: 10.481850, lng: 122.905801 },
  { name: 'Dulao Brgy. Hall', lat: 10.548719, lng: 122.951530 },
  { name: 'Ilijan Brgy. Hall', lat: 10.454040, lng: 123.051053 },
  { name: 'Jorge L. Araneta Brgy. Hall', lat: 10.476058, lng: 122.945884 },
  { name: 'Lag-Asan Brgy. Hall', lat: 10.530152, lng: 122.838610 },
  { name: 'Ma-ao Barrio Brgy. Hall', lat: 10.489306, lng: 122.990125 },
  { name: 'Mailum Brgy. Hall', lat: 10.461599, lng: 123.049324 },
  { name: 'Malingin Brgy. Hall', lat: 10.493705, lng: 122.917898 },
  { name: 'Napoles Brgy. Hall', lat: 10.512650, lng: 122.897945 },
  { name: 'Pacol Brgy. Hall', lat: 10.495584, lng: 122.868219 },
  { name: 'Poblacion Brgy. Hall', lat: 10.540239, lng: 122.836382 },
  { name: 'Sagasa Brgy. Hall', lat: 10.470820, lng: 122.892302 },
  { name: 'Sampinit Brgy. Hall', lat: 10.543128, lng: 122.851652 },
  { name: 'Tabunan Brgy. Hall', lat: 10.576290, lng: 122.936989 },
  { name: 'Taloc Brgy. Hall', lat: 10.586904, lng: 122.909612 },
];

// Barangay centers for name labels (approximate center of each barangay area)
const BARANGAYS = [
  { name: 'Abuanan', lat: 10.5254, lng: 122.9915 },
  { name: 'Alianza', lat: 10.4734, lng: 122.9301 },
  { name: 'Atipuluan', lat: 10.5109, lng: 122.9564 },
  { name: 'Bacong-Montilla', lat: 10.5190, lng: 123.0351 },
  { name: 'Bagroy', lat: 10.4761, lng: 122.8738 },
  { name: 'Balingasag', lat: 10.5309, lng: 122.8440 },
  { name: 'Binubuhan', lat: 10.460453, lng: 122.992656 },
  { name: 'Busay', lat: 10.5372, lng: 122.8847 },
  { name: 'Calumangan', lat: 10.5598, lng: 122.8765 },
  { name: 'Caridad', lat: 10.4812, lng: 122.9084 },
  { name: 'Dulao', lat: 10.5482, lng: 122.9537 },
  { name: 'Ilijan', lat: 10.4526, lng: 123.0553 },
  { name: 'Lag-Asan', lat: 10.5233, lng: 122.8395 },
  { name: 'Ma-ao Barrio', lat: 10.4896, lng: 122.9897 },
  { name: 'Jorge L. Araneta', lat: 10.4765, lng: 122.9466 },
  { name: 'Mailum', lat: 10.4618, lng: 123.0493 },
  { name: 'Malingin', lat: 10.4933, lng: 122.9175 },
  { name: 'Napoles', lat: 10.5128, lng: 122.8980 },
  { name: 'Pacol', lat: 10.4953, lng: 122.8672 },
  { name: 'Poblacion', lat: 10.5381, lng: 122.8359 },
  { name: 'Sagasa', lat: 10.4709, lng: 122.8924 },
  { name: 'Sampinit', lat: 10.5428, lng: 122.8515 },
  { name: 'Tabunan', lat: 10.5739, lng: 122.9393 },
  { name: 'Taloc', lat: 10.5716, lng: 122.9119 },
];

// Border will be loaded from the API (real GeoJSON data)
// Disabled — the GeoJSON includes maritime boundary which looks wrong on map

const statusColors = {
  Safe: '#10b981',
  Need_Assistance: '#f59e0b',
  In_Danger: '#ef4444',
};

// Human/person marker (SVG data URI) — colored by evacuee status.
function personIcon(color) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="30" height="38" viewBox="0 0 30 38">
      <path d="M15 0C7.3 0 1 6.3 1 14c0 9.7 12.2 22.6 12.7 23.1a1.8 1.8 0 0 0 2.6 0C16.8 36.6 29 23.7 29 14 29 6.3 22.7 0 15 0z" fill="${color}" stroke="#fff" stroke-width="1.5"/>
      <circle cx="15" cy="11" r="4" fill="#fff"/>
      <path d="M8.5 21c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6z" fill="#fff"/>
    </svg>`;
  return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg.trim());
}

// Firetruck marker (SVG data URI) — for rescuers. Green when responding, gray otherwise.
function firetruckIcon(active) {
  const body = active ? '#dc2626' : '#94a3b8';
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="42" height="30" viewBox="0 0 42 30">
      <rect x="1" y="8" width="26" height="13" rx="2" fill="${body}" stroke="#fff" stroke-width="1.5"/>
      <rect x="27" y="12" width="13" height="9" rx="2" fill="${body}" stroke="#fff" stroke-width="1.5"/>
      <rect x="29" y="13.5" width="5" height="4" rx="1" fill="#bfdbfe"/>
      <rect x="4" y="4" width="12" height="5" rx="1" fill="${body}" stroke="#fff" stroke-width="1"/>
      <circle cx="10" cy="23" r="4" fill="#1f2937" stroke="#fff" stroke-width="1.5"/>
      <circle cx="32" cy="23" r="4" fill="#1f2937" stroke="#fff" stroke-width="1.5"/>
      <rect x="18" y="1" width="6" height="3" rx="1" fill="#fbbf24"/>
    </svg>`;
  return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg.trim());
}

// Consider "offline" if last GPS update was more than 5 minutes ago
function isOffline(lastLocationAt) {
  if (!lastLocationAt) return true;
  const diff = Date.now() - new Date(lastLocationAt).getTime();
  return diff > 5 * 60 * 1000; // 5 minutes
}

function getMarkerColor(user) {
  if (isOffline(user.last_location_at)) return '#9ca3af'; // gray — offline (any status)
  if (user.status === 'Need_Assistance') return '#f59e0b'; // orange
  if (user.status === 'In_Danger') return '#ef4444'; // red
  return '#10b981'; // green for online + safe
}

function getStatusLabel(user) {
  if (isOffline(user.last_location_at)) return 'Offline';
  if (user.status === 'Need_Assistance') return 'Need Help';
  if (user.status === 'In_Danger') return 'In Danger';
  return 'Online · Safe';
}

export default function GoogleMapView({ evacuees = [], centers = [], rescuers = [], zoom = 13, filterBarangay = null, onHallClick = null, hideOfflineEvacuees = false }) {
  const { isLoaded } = useJsApiLoader({ id: 'google-map', googleMapsApiKey: GOOGLE_MAPS_API_KEY });
  const mapRef = useRef(null);
  const hasFittedRef = useRef(false);
  const [selectedMarker, setSelectedMarker] = useState(null);
  const [isSatellite, setIsSatellite] = useState(false);

  // Enrich evacuees with boundary-based current_barangay (replaces nearest-center)
  const enrichedEvacuees = useMemo(() => enrichWithBoundaryBarangay(evacuees), [evacuees]);

  // Compute initial center from barangay boundary if available
  const initialCenter = useMemo(() => {
    if (filterBarangay) {
      const brgy = BARANGAY_BOUNDARIES.find(
        (b) => b.name.toLowerCase() === filterBarangay.toLowerCase()
      );
      if (brgy) {
        const coords = Array.isArray(brgy.coords[0]?.[0]) && Array.isArray(brgy.coords[0][0])
          ? brgy.coords.flat()
          : brgy.coords;
        const sumLat = coords.reduce((s, c) => s + c[1], 0);
        const sumLng = coords.reduce((s, c) => s + c[0], 0);
        return { lat: sumLat / coords.length, lng: sumLng / coords.length };
      }
    }
    return defaultCenter;
  }, [filterBarangay]);

  const onLoad = useCallback((map) => {
    mapRef.current = map;
  }, []);

  // Fit map to barangay boundary or all data — runs once
  useEffect(() => {
    if (!mapRef.current || hasFittedRef.current) return;

    // For barangay page: fit to the barangay polygon boundary
    if (filterBarangay) {
      const brgy = BARANGAY_BOUNDARIES.find(
        (b) => b.name.toLowerCase() === filterBarangay.toLowerCase()
      );
      if (brgy) {
        const bounds = new window.google.maps.LatLngBounds();
        const coords = brgy.coords;
        if (Array.isArray(coords[0]?.[0]) && Array.isArray(coords[0][0])) {
          coords.forEach((ring) => {
            ring.forEach(([lng, lat]) => bounds.extend({ lat, lng }));
          });
        } else {
          coords.forEach(([lng, lat]) => bounds.extend({ lat, lng }));
        }
        if (!bounds.isEmpty()) {
          mapRef.current.fitBounds(bounds, { top: 20, bottom: 20, left: 20, right: 20 });
          hasFittedRef.current = true;
        }
      }
      return;
    }

    // For LGU page: don't zoom in, just stay at default view
    hasFittedRef.current = true;
  }, [filterBarangay]);

  if (!isLoaded) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-slate-100 rounded-2xl">
        <p className="text-sm text-slate-400">Loading map...</p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      <GMap
      mapContainerStyle={containerStyle}
      center={initialCenter}
      zoom={zoom}
      onLoad={onLoad}
      options={{
        disableDefaultUI: true,
        zoomControl: true,
        mapTypeControl: false,
        mapTypeId: isSatellite ? 'satellite' : 'roadmap',
        streetViewControl: false,
        fullscreenControl: false,
        rotateControl: false,
        scaleControl: false,
        styles: [
          { elementType: 'labels', stylers: [{ visibility: 'off' }] },
          { featureType: 'poi', stylers: [{ visibility: 'off' }] },
          { featureType: 'transit', stylers: [{ visibility: 'off' }] },
        ],
      }}
    >
      {/* Evacuee (user) markers — human icon colored by status.
          When hideOfflineEvacuees is set, offline users are removed from the map. */}
      {enrichedEvacuees.map((u) => {
        if (!u.latitude || !u.longitude) return null;
        if (hideOfflineEvacuees && isOffline(u.last_location_at)) return null;
        return (
          <Marker
            key={`user-${u.id}`}
            position={{ lat: u.latitude, lng: u.longitude }}
            onClick={() => setSelectedMarker(u)}
            icon={{
              url: personIcon(getMarkerColor(u)),
              scaledSize: new window.google.maps.Size(30, 38),
              anchor: new window.google.maps.Point(15, 38),
            }}
            zIndex={20}
          />
        );
      })}

      {/* Rescuer markers — firetruck icon */}
      {rescuers.map((r) => {
        if (r.latitude == null || r.longitude == null) return null;
        const responding = r.status === 'Responding';
        return (
          <Marker
            key={`rescuer-${r.id}`}
            position={{ lat: r.latitude, lng: r.longitude }}
            onClick={() => setSelectedMarker({ ...r, _isRescuer: true })}
            icon={{
              url: firetruckIcon(responding),
              scaledSize: new window.google.maps.Size(42, 30),
              anchor: new window.google.maps.Point(21, 30),
            }}
            zIndex={30}
          />
        );
      })}

      {/* Center markers */}
      {centers.map((c) => {
        if (!c.latitude || !c.longitude) return null;
        return (
          <Marker
            key={`center-${c.id}`}
            position={{ lat: parseFloat(c.latitude), lng: parseFloat(c.longitude) }}
            onClick={() => setSelectedMarker({ ...c, _isCenter: true })}
            icon={{
              url: c.op_status === 'Open'
                ? 'https://maps.google.com/mapfiles/ms/icons/green-dot.png'
                : c.op_status === 'Full'
                ? 'https://maps.google.com/mapfiles/ms/icons/orange-dot.png'
                : 'https://maps.google.com/mapfiles/ms/icons/red-dot.png',
              scaledSize: new window.google.maps.Size(32, 32),
            }}
          />
        );
      })}

      {/* Barangay boundary polygons — each with unique color */}
      {/* Barangay boundary polygons — filter by barangay for brgy accounts */}
      {[...BARANGAY_BOUNDARIES]
        .filter((brgy) => !filterBarangay || brgy.name.toLowerCase().includes(filterBarangay.toLowerCase()) || filterBarangay.toLowerCase().includes(brgy.name.toLowerCase()))
        .sort((a, b) => {
          const areaA = a.coords.flat?.().length || a.coords.length;
          const areaB = b.coords.flat?.().length || b.coords.length;
          return areaB - areaA; // larger first = rendered behind
        })
        .map((brgy) => {
        const paths = Array.isArray(brgy.coords[0]?.[0])
          ? brgy.coords.map((ring) => ring.map(([lng, lat]) => ({ lat, lng })))
          : [brgy.coords.map(([lng, lat]) => ({ lat, lng }))];
        return paths.map((path, i) => (
          <Polygon
            key={`brgy-poly-${brgy.name}-${i}`}
            paths={path}
            options={{
              strokeColor: brgy.color,
              strokeOpacity: 0.9,
              strokeWeight: 2,
              fillColor: brgy.color,
              fillOpacity: isSatellite ? 0.25 : 0.4,
              clickable: false,
              zIndex: 1,
            }}
          />
        ));
      })}

      {/* Barangay name labels — only show on LGU view (not for single-barangay view) */}
      {!filterBarangay && BARANGAYS
        .map((brgy) => (
        <Marker
          key={`label-${brgy.name}`}
          position={{ lat: brgy.lat, lng: brgy.lng }}
          icon={{
            path: 'M 0,0 z',
            scale: 0,
          }}
          label={{
            text: brgy.name,
            color: isSatellite ? '#fff' : '#133458',
            fontSize: '6px',
            fontWeight: '500',
            className: 'map-brgy-label',
          }}
          clickable={false}
        />
      ))}

      {/* Barangay Hall markers — custom pin with image */}
      {BARANGAY_HALLS
        .filter((hall) => {
          if (!filterBarangay) return true;
          const hallBase = hall.name.replace(' Brgy. Hall', '').toLowerCase();
          const filter = filterBarangay.toLowerCase();
          return hallBase.includes(filter) || filter.includes(hallBase);
        })
        .map((hall) => {
        const hallBase = hall.name.replace(' Brgy. Hall', '').toLowerCase();

        return (
          <OverlayView
            key={`hall-${hall.name}`}
            position={{ lat: hall.lat, lng: hall.lng }}
            mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
            getPixelPositionOffset={() => ({ x: -20, y: -52 })}
          >
            <div
              onClick={() => setSelectedMarker({ ...hall, _isHall: true })}
              style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', width: 40 }}
            >
              {/* Circle image */}
              <div style={{
                width: 32, height: 32, borderRadius: '50%', overflow: 'hidden',
                border: '2px solid #133458', background: '#fff', boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <img
                  src={defaultHallImg}
                  alt=""
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  onError={(e) => { e.target.style.display = 'none'; e.target.parentNode.innerHTML = '<span style="font-size:10px;font-weight:700;color:#133458">🏛</span>'; }}
                />
              </div>
              {/* Pin pointer */}
              <div style={{
                width: 0, height: 0,
                borderLeft: '6px solid transparent', borderRight: '6px solid transparent',
                borderTop: '8px solid #133458', marginTop: -1,
              }} />
              {/* Label */}
              <span style={{
                fontSize: 7, fontWeight: 500, color: isSatellite ? '#fff' : '#133458',
                marginTop: 2, whiteSpace: 'nowrap', textAlign: 'center',
              }}>
                {hall.name.replace(' Brgy. Hall', '') + ' Hall'}
              </span>
            </div>
          </OverlayView>
        );
      })}

      {/* Info window */}
      {selectedMarker && (
        <InfoWindow
          position={{
            lat: selectedMarker.lat != null ? selectedMarker.lat : (selectedMarker.latitude != null ? parseFloat(selectedMarker.latitude) : 0),
            lng: selectedMarker.lng != null ? selectedMarker.lng : (selectedMarker.longitude != null ? parseFloat(selectedMarker.longitude) : 0),
          }}
          onCloseClick={() => setSelectedMarker(null)}
        >
          <div style={{ fontFamily: 'Inter, sans-serif', minWidth: 180, padding: '4px 2px' }}>
            {selectedMarker._isCenter ? (
              <>
                <p style={{ fontWeight: 700, fontSize: 14, color: '#1e293b' }}>{selectedMarker.name}</p>
                <p style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>{selectedMarker.op_status} · {selectedMarker.occupancy}/{selectedMarker.max_capacity}</p>
              </>
            ) : selectedMarker._isHall ? (
              <>
                <p style={{ fontWeight: 700, fontSize: 14, color: '#133458', marginBottom: 4 }}>🏛 {selectedMarker.name}</p>
                <p style={{ fontSize: 12, color: '#64748b' }}>Barangay Hall</p>
                <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>Bago City, Negros Occidental</p>
                <p style={{ fontSize: 11, color: '#0d9488', marginTop: 3 }}>
                  📍 {selectedMarker.lat.toFixed(5)}, {selectedMarker.lng.toFixed(5)}
                </p>
              </>
            ) : selectedMarker._isRescuer ? (
              <>
                <p style={{ fontWeight: 700, fontSize: 14, color: '#1e293b', marginBottom: 4 }}>🚒 {selectedMarker.name}</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: selectedMarker.status === 'Responding' ? '#dc2626' : '#10b981', display: 'inline-block' }}></span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: selectedMarker.status === 'Responding' ? '#dc2626' : '#10b981' }}>
                    {selectedMarker.status === 'Responding' ? 'Responding to rescue' : 'Available'}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: '#64748b', display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <span>Barangay: {selectedMarker.barangay_name || '—'}</span>
                  {selectedMarker.evacuee_name && (
                    <span style={{ color: '#2563eb', fontWeight: 500 }}>Evacuee: {selectedMarker.evacuee_name}</span>
                  )}
                </div>
                {selectedMarker.last_location_at && (
                  <p style={{ fontSize: 10, color: '#94a3b8', marginTop: 8, borderTop: '1px solid #f1f5f9', paddingTop: 6 }}>
                    Last update: {new Date(selectedMarker.last_location_at).toLocaleString()}
                  </p>
                )}
              </>
            ) : (
              <>
                <p style={{ fontWeight: 700, fontSize: 14, color: '#1e293b', marginBottom: 6 }}>{selectedMarker.full_name}</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: getMarkerColor(selectedMarker), display: 'inline-block' }}></span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: getMarkerColor(selectedMarker) }}>{getStatusLabel(selectedMarker)}</span>
                </div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 6, display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <span>Registered: Brgy. {selectedMarker.barangay_name || '—'}</span>
                  {selectedMarker.current_barangay && selectedMarker.current_barangay !== selectedMarker.barangay_name && (
                    <span style={{ color: '#2563eb', fontWeight: 500 }}>📍 Currently in: Brgy. {selectedMarker.current_barangay}</span>
                  )}
                  {selectedMarker.current_barangay && selectedMarker.current_barangay === selectedMarker.barangay_name && (
                    <span style={{ color: '#10b981' }}>📍 In home barangay</span>
                  )}
                  {selectedMarker.contact_no && <span style={{ color: '#0d9488', fontWeight: 500 }}>{selectedMarker.contact_no}</span>}
                </div>
                {selectedMarker.last_location_at && (
                  <p style={{ fontSize: 10, color: '#94a3b8', marginTop: 8, borderTop: '1px solid #f1f5f9', paddingTop: 6 }}>
                    Last update: {new Date(selectedMarker.last_location_at).toLocaleString()}
                  </p>
                )}
              </>
            )}
          </div>
        </InfoWindow>
      )}
    </GMap>

      {/* Satellite toggle */}
      <button
        onClick={() => setIsSatellite(!isSatellite)}
        className="absolute top-3 right-3 z-10 px-3 py-1.5 rounded-lg text-xs font-semibold shadow-md transition-all"
        style={{
          background: isSatellite ? '#fff' : '#133458',
          color: isSatellite ? '#133458' : '#fff',
          border: '1px solid ' + (isSatellite ? '#e2e8f0' : '#133458'),
        }}
      >
        {isSatellite ? '🗺 Map' : '🛰 Satellite'}
      </button>
    </div>
  );
}
