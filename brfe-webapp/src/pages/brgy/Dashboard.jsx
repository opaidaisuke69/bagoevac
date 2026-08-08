import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Users, AlertTriangle, LifeBuoy, Clock } from 'lucide-react';
import api from '../../lib/api';
import { useAuthStore } from '../../stores/authStore';
import { CardSkeleton, MapSkeleton } from '../../components/Skeleton';
import { cn } from '../../lib/utils';

function StatCard({ icon: Icon, label, value, color, loading }) {
  if (loading) return <CardSkeleton />;
  const styles = {
    blue: 'bg-blue-50 text-blue-600 ring-blue-100',
    green: 'bg-emerald-50 text-emerald-600 ring-emerald-100',
    yellow: 'bg-amber-50 text-amber-600 ring-amber-100',
    red: 'bg-red-50 text-red-600 ring-red-100',
    orange: 'bg-orange-50 text-orange-600 ring-orange-100',
  };
  return (
    <div className="card p-5 animate-slide-up">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</p>
          <p className="text-3xl font-bold text-slate-900 mt-2">{value ?? '—'}</p>
        </div>
        <div className={cn('w-11 h-11 rounded-xl flex items-center justify-center ring-1', styles[color])}>
          <Icon size={20} />
        </div>
      </div>
    </div>
  );
}

export default function BrgyDashboard() {
  const user = useAuthStore((s) => s.user);
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const markersRef = useRef(null);

  // Evacuees in this barangay only
  const { data: evacuees, isLoading } = useQuery({
    queryKey: ['brgy-evacuees'],
    queryFn: async () => {
      const params = { barangay_id: user?.barangay_id };
      const { data } = await api.get('/users/list-all', { params });
      return data.data || [];
    },
  });

  const { data: rescues } = useQuery({
    queryKey: ['brgy-rescue-stats'],
    queryFn: async () => {
      const { data } = await api.get('/rescue/list_lgu');
      return data.data || [];
    },
  });

  const stats = {
    total: (evacuees || []).length,
    safe: (evacuees || []).filter((u) => u.status === 'Safe').length,
    need: (evacuees || []).filter((u) => u.status === 'Need_Assistance').length,
    danger: (evacuees || []).filter((u) => u.status === 'In_Danger').length,
    pendingRescue: (rescues || []).filter((r) => r.req_status === 'Pending').length,
  };

  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;
    import('leaflet').then((L) => {
      const map = L.map(mapRef.current, { zoomControl: false }).setView([10.535, 122.84], 13);
      L.control.zoom({ position: 'bottomright' }).addTo(map);
      L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', { maxZoom: 19 }).addTo(map);
      mapInstance.current = map;
      markersRef.current = L.layerGroup().addTo(map);
    });
    return () => { if (mapInstance.current) { mapInstance.current.remove(); mapInstance.current = null; } };
  }, []);

  useEffect(() => {
    if (!mapInstance.current || !markersRef.current) return;
    import('leaflet').then((L) => {
      markersRef.current.clearLayers();
      const colors = { Safe: '#10b981', Need_Assistance: '#f59e0b', In_Danger: '#ef4444' };
      const bounds = [];
      (evacuees || []).forEach((u) => {
        if (!u.latitude || !u.longitude) return;
        bounds.push([u.latitude, u.longitude]);
        const c = colors[u.status] || '#94a3b8';
        const icon = L.divIcon({
          html: `<div style="width:14px;height:14px;border-radius:50%;background:${c};border:3px solid white;box-shadow:0 2px 8px ${c}50"></div>`,
          className: '', iconSize: [14, 14], iconAnchor: [7, 7],
        });
        L.marker([u.latitude, u.longitude], { icon })
          .bindPopup(`<b>${u.full_name}</b><br/>${u.status?.replace('_', ' ')}<br/>${u.contact_no || ''}`)
          .addTo(markersRef.current);
      });
      if (bounds.length > 0) mapInstance.current.fitBounds(bounds, { padding: [30, 30] });
    });
  }, [evacuees]);

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 lg:p-8 pb-0">
        <p className="text-sm text-slate-500 mb-4">Monitoring evacuees in your barangay</p>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <StatCard icon={Users} label="My Evacuees" value={stats.total} color="blue" loading={isLoading} />
          <StatCard icon={Users} label="Safe" value={stats.safe} color="green" loading={isLoading} />
          <StatCard icon={AlertTriangle} label="Need Help" value={stats.need} color="yellow" loading={isLoading} />
          <StatCard icon={AlertTriangle} label="In Danger" value={stats.danger} color="red" loading={isLoading} />
          <StatCard icon={Clock} label="Pending Rescue" value={stats.pendingRescue} color="orange" loading={isLoading} />
        </div>
      </div>
      <div className="flex-1 p-4 lg:p-8 pt-4">
        <div className="relative h-full min-h-[400px] rounded-2xl overflow-hidden border border-slate-200 shadow-sm bg-white">
          {!mapInstance.current && <MapSkeleton />}
          <div ref={mapRef} className="h-full w-full" />
          <div className="absolute top-4 left-4 bg-white/95 backdrop-blur-sm rounded-xl shadow-lg px-4 py-2.5 z-[1000] border border-slate-100">
            <p className="text-xs font-bold text-slate-700">Your Barangay Evacuees</p>
            <p className="text-[11px] text-slate-400">{stats.total} tracked</p>
          </div>
        </div>
      </div>
    </div>
  );
}
