import { useQuery } from '@tanstack/react-query';
import { Users, AlertTriangle, Clock, MapPin } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../../lib/api';
import { useAuthStore } from '../../stores/authStore';
import { isInsideBarangay } from '../../lib/geo';
import { BARANGAY_ID_MAP } from '../../data/barangayBoundaries';
import { CardSkeleton } from '../../components/Skeleton';
import { cn } from '../../lib/utils';
import GoogleMapView from '../../components/GoogleMap';

function StatCard({ icon: Icon, label, value, color, loading }) {
  if (loading) return <CardSkeleton />;
  const styles = {
    blue:   'bg-blue-50 text-blue-600 ring-blue-100',
    green:  'bg-emerald-50 text-emerald-600 ring-emerald-100',
    yellow: 'bg-amber-50 text-amber-600 ring-amber-100',
    red:    'bg-red-50 text-red-600 ring-red-100',
    orange: 'bg-orange-50 text-orange-600 ring-orange-100',
  };
  return (
    <div className="card p-5">
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
  const navigate = useNavigate();

  const { data: evacuees, isLoading } = useQuery({
    queryKey: ['brgy-dash-evacuees', user?.barangay_id],
    queryFn: async () => {
      const { data } = await api.get('/users/list-all');
      return data.data || [];
    },
    refetchInterval: 1500,
  });

  const { data: rescues } = useQuery({
    queryKey: ['brgy-dash-rescues', user?.barangay_id],
    queryFn: async () => {
      const { data } = await api.get('/rescue/list_lgu');
      return data.data || [];
    },
    refetchInterval: 1500,
  });

  const safe    = (evacuees || []).filter((u) => u.status === 'Safe').length;
  const need    = (evacuees || []).filter((u) => u.status === 'Need_Assistance').length;
  const danger  = (evacuees || []).filter((u) => u.status === 'In_Danger').length;
  const pending = (rescues  || []).filter((r) => r.req_status === 'Pending').length;

  const barangayName = BARANGAY_ID_MAP[user?.barangay_id]
    || user?.barangay_name
    || (evacuees || []).find((u) => u.barangay_id == user?.barangay_id)?.barangay_name
    || null;
  const displayName = barangayName || `Barangay #${user?.barangay_id || ''}`;

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 lg:p-8 pb-0">
        <div className="flex items-center gap-2 mb-4">
          <MapPin size={14} className="text-emerald-600" />
          <p className="text-sm text-slate-600">
            <span className="font-bold text-emerald-700">{displayName}</span>
            <span className="text-slate-400 text-xs ml-1">— showing evacuees within barangay jurisdiction</span>
          </p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <StatCard icon={Users}         label="Total"          value={(evacuees || []).length} color="blue"   loading={isLoading} />
          <StatCard icon={Users}         label="Safe"           value={safe}                    color="green"  loading={isLoading} />
          <StatCard icon={AlertTriangle} label="Need Help"      value={need}                    color="yellow" loading={isLoading} />
          <StatCard icon={AlertTriangle} label="In Danger"      value={danger}                  color="red"    loading={isLoading} />
          <StatCard icon={Clock}         label="Pending Rescue" value={pending}                 color="orange" loading={isLoading} />
        </div>
      </div>

      {/* Map */}
      <div className="flex-1 p-4 lg:p-8 pt-4">
        <div className="relative h-full min-h-[600px] rounded-2xl overflow-hidden border border-slate-200 shadow-sm bg-white">
          <GoogleMapView evacuees={evacuees || []} zoom={14} filterBarangay={barangayName} />

          {/* Legend — left side */}
          <div className="absolute bottom-4 left-4 bg-white/95 backdrop-blur-sm rounded-xl shadow-lg p-3 z-10 border border-slate-100 text-xs space-y-1.5">
            <p className="font-bold text-slate-700 text-[10px] uppercase tracking-wider mb-2">Legend</p>
            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-emerald-500" /><span className="text-slate-600">Online · Safe</span></div>
            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-gray-400" /><span className="text-slate-600">Offline</span></div>
            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-amber-500" /><span className="text-slate-600">Need Help</span></div>
            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-red-500" /><span className="text-slate-600">In Danger</span></div>
          </div>

          {/* Overlay info — top left */}
          <div className="absolute top-4 left-4 bg-white/95 backdrop-blur-sm rounded-xl shadow-lg px-4 py-3 z-10 border border-slate-100">
            <p className="text-xs font-bold text-slate-700">{displayName}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">{(evacuees || []).length} evacuees in jurisdiction</p>
            {danger > 0 && <p className="text-[11px] text-red-600 font-semibold mt-1">⚠ {danger} in danger</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
