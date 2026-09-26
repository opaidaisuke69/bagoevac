import { useCallback, useRef, useState } from 'react';
import { GoogleMap, useJsApiLoader, Marker } from '@react-google-maps/api';

const GOOGLE_MAPS_API_KEY = 'AIzaSyAYMxiPynLx-KZ7udjt382QPsgadmzh7HM';
// Bago City center as the default view.
const BAGO_CENTER = { lat: 10.5378, lng: 122.8356 };

/**
 * LocationPicker — click or drag on the map to choose a coordinate.
 * Calls onChange({ lat, lng }) with 6-decimal precision.
 *
 * Props:
 *   lat, lng  current values (strings or numbers, optional)
 *   onChange  ({lat, lng}) => void
 *   height    map height (CSS value, e.g. "260px" or "100%"). Default "260px".
 */
export default function LocationPicker({ lat, lng, onChange, height = '260px' }) {
  const { isLoaded } = useJsApiLoader({ id: 'google-map', googleMapsApiKey: GOOGLE_MAPS_API_KEY });
  const mapRef = useRef(null);
  const [zoom] = useState(13);
  const containerStyle = { width: '100%', height: '100%' };
  const fill = height === '100%';

  const hasPoint = lat !== '' && lat != null && lng !== '' && lng != null && !isNaN(parseFloat(lat)) && !isNaN(parseFloat(lng));
  const point = hasPoint ? { lat: parseFloat(lat), lng: parseFloat(lng) } : null;
  const center = point || BAGO_CENTER;

  const emit = useCallback((latLng) => {
    onChange({
      lat: parseFloat(latLng.lat().toFixed(6)),
      lng: parseFloat(latLng.lng().toFixed(6)),
    });
  }, [onChange]);

  if (!isLoaded) {
    return (
      <div
        className="w-full flex items-center justify-center bg-slate-100 rounded-xl text-sm text-slate-400"
        style={{ height: fill ? '100%' : height, minHeight: fill ? 260 : undefined }}
      >
        Loading map...
      </div>
    );
  }

  return (
    <div
      className="rounded-xl overflow-hidden border border-slate-200 flex flex-col"
      style={{ height: fill ? '100%' : 'auto' }}
    >
      <div className="flex-1" style={{ minHeight: fill ? 260 : height }}>
        <GoogleMap
          mapContainerStyle={containerStyle}
          center={center}
          zoom={zoom}
          onLoad={(map) => { mapRef.current = map; }}
          onClick={(e) => emit(e.latLng)}
          options={{
            disableDefaultUI: true,
            zoomControl: true,
            streetViewControl: false,
            mapTypeControl: false,
            fullscreenControl: false,
            clickableIcons: false,
          }}
        >
          {point && (
            <Marker
              position={point}
              draggable
              onDragEnd={(e) => emit(e.latLng)}
            />
          )}
        </GoogleMap>
      </div>
      <div className="bg-slate-50 px-3 py-2 text-[11px] text-slate-500 border-t border-slate-100 shrink-0">
        {point
          ? <>Pinned at <span className="font-mono text-slate-700">{point.lat.toFixed(6)}, {point.lng.toFixed(6)}</span> — tap the map or drag the pin to adjust.</>
          : 'Tap on the map to drop a pin and set the coordinates.'}
      </div>
    </div>
  );
}
