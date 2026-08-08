import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Users, AlertTriangle, LifeBuoy, Building2, TrendingUp, MapPin } from 'lucide-react';
import api from '../../lib/api';
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

export default function LguDashboard() {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const markersRef = useRef(null);

  const { data: stats, isLoading } = useQuery({
    queryKey: ['lgu-stats'],
    queryFn: async () => {
      const { data } = await api.get('/users/list-all');
      const users = data.data || [];
      return {
        total: users.length,
        safe: users.filter((u) => u.status === 'Safe').length,
        need: users.filter((u) => u.status === 'Need_Assistance').length,
        danger: users.filter((u) => u.status === 'In_Danger').length,
      };
    },
  });

  const { data: rescueStats } = useQuery({
    queryKey: ['lgu-rescue-stats'],
    queryFn: async () => {
      const { data } = await api.get('/rescue/list_lgu');
      const list = data.data || [];
      return {
        pending: list.filter((r) => r.req_status === 'Pending').length,
        ongoing: list.filter((r) => r.req_status === 'Ongoing').length,
      };
    },
  });

  const { data: locations } = useQuery({
    queryKey: ['lgu-locations'],
    queryFn: async () => { const { data } = await api.get('/users/list-all'); return data.data || []; },
  });

  const { data: centers } = useQuery({
    queryKey: ['lgu-centers'],
    queryFn: async () => { const { data } = await api.get('/centers/list_lgu'); return data.data || []; },
  });

  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;
    import('leaflet').then((L) => {
      const map = L.map(mapRef.current, { zoomControl: false }).setView([10.535, 122.84], 12);
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
      (locations || []).forEach((u) => {
        if (!u.latitude || !u.longitude) return;
        const c = colors[u.status] || '#94a3b8';
        const icon = L.divIcon({
          html: `<div style="width:12px;height:12px;border-radius:50%;background:${c};border:2.5px solid white;box-shadow:0 2px 6px ${c}40"></div>`,
          className: '', iconSize: [12, 12], iconAnchor: [6, 6],
        });
        L.marker([u.latitude, u.longitude], { icon })
          .bindPopup(`<b>${u.full_name}</b><br/>${u.status?.replace('_', ' ')}<br/><small>${u.barangay_name || ''}</small>`)
          .addTo(markersRef.current);
      });
      (centers || []).forEach((c) => {
        if (!c.latitude || !c.longitude) return;
        const emoji = c.op_status === 'Open' ? '🏠' : c.op_status === 'Full' ? '🟠' : '⚫';
        const icon = L.divIcon({ html: `<div style="font-size:18px">${emoji}</div>`, className: '', iconSize: [20, 20], iconAnchor: [10, 10] });
        L.marker([c.latitude, c.longitude], { icon })
          .bindPopup(`<b>${c.name}</b><br/>${c.op_status} · ${c.occupancy}/${c.max_capacity}`)
          .addTo(markersRef.current);
      });
    });
  }, [locations, centers]);

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 lg:p-8 pb-0">
        <p className="text-sm text-slate-500 mb-4">Monitoring disaster situation across all 24 barangays of Bago City</p>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <StatCard icon={Users} label="Total Evacuees" value={stats?.total} color="blue" loading={isLoading} />
          <StatCard icon={Users} label="Safe" value={stats?.safe} color="green" loading={isLoading} />
          <StatCard icon={AlertTriangle} label="Need Help" value={stats?.need} color="yellow" loading={isLoading} />
          <StatCard icon={AlertTriangle} label="In Danger" value={stats?.danger} color="red" loading={isLoading} />
          <StatCard icon={LifeBuoy} label="Active Rescue" value={(rescueStats?.pending || 0) + (rescueStats?.ongoing || 0)} color="orange" loading={isLoading} />
        </div>
      </div>
      <div className="flex-1 p-4 lg:p-8 pt-4">
        <div className="relative h-full min-h-[450px] rounded-2xl overflow-hidden border border-slate-200 shadow-sm bg-white">
          {!mapInstance.current && <MapSkeleton />}
          <div ref={mapRef} className="h-full w-full" />
          <div className="absolute bottom-4 right-4 bg-white/95 backdrop-blur-sm rounded-xl shadow-lg p-4 z-[1000] text-xs space-y-2 border border-slate-100">
            <p className="font-bold text-slate-700 text-[11px] uppercase tracking-wider">Legend</p>
            <div className="flex items-center gap-2.5"><div className="w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-emerald-500/20" /><span>Safe</span></div>
            <div className="flex items-center gap-2.5"><div className="w-3 h-3 rounded-full bg-amber-500 ring-2 ring-amber-500/20" /><span>Need Help</span></div>
            <div className="flex items-center gap-2.5"><div className="w-3 h-3 rounded-full bg-red-500 ring-2 ring-red-500/20" /><span>In Danger</span></div>
            <div className="flex items-center gap-2.5"><span>🏠</span><span>Center</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}
