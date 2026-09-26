import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Users, AlertTriangle, LifeBuoy } from 'lucide-react';
import api from '../../lib/api';
import { CardSkeleton } from '../../components/Skeleton';
import { cn } from '../../lib/utils';
import GoogleMapView from '../../components/GoogleMap';

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
  const { data: locations, isLoading } = useQuery({
    queryKey: ['lgu-locations'],
    queryFn: async () => { const { data } = await api.get('/users/list-all'); return data.data || []; },
    refetchInterval: 1500,
  });

  const { data: rescueList } = useQuery({
    queryKey: ['lgu-rescue-list'],
    queryFn: async () => { const { data } = await api.get('/rescue/list_lgu'); return data.data || []; },
    refetchInterval: 1500,
  });

  const { data: centers } = useQuery({
    queryKey: ['lgu-centers'],
    queryFn: async () => { const { data } = await api.get('/centers/list_lgu'); return data.data || []; },
  });

  const users = useMemo(() => locations || [], [locations]);

  const stats = useMemo(() => ({
    total: users.length,
    safe: users.filter((u) => u.status === 'Safe').length,
    need: users.filter((u) => u.status === 'Need_Assistance').length,
    danger: users.filter((u) => u.status === 'In_Danger').length,
  }), [users]);

  const rescueStats = useMemo(() => {
    const list = rescueList || [];
    return {
      pending: list.filter((r) => r.req_status === 'Pending').length,
      ongoing: list.filter((r) => r.req_status === 'Ongoing').length,
    };
  }, [rescueList]);

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 lg:p-8 pb-0">
        <p className="text-sm text-slate-500 mb-4">Monitoring disaster situation across all 24 barangays of Bago City</p>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <StatCard icon={Users} label="Total Evacuees" value={stats.total} color="blue" loading={isLoading} />
          <StatCard icon={Users} label="Safe" value={stats.safe} color="green" loading={isLoading} />
          <StatCard icon={AlertTriangle} label="Need Help" value={stats.need} color="yellow" loading={isLoading} />
          <StatCard icon={AlertTriangle} label="In Danger" value={stats.danger} color="red" loading={isLoading} />
          <StatCard icon={LifeBuoy} label="Active Rescue" value={rescueStats.pending + rescueStats.ongoing} color="orange" loading={isLoading} />
        </div>
      </div>

      <div className="flex-1 p-4 lg:p-8 pt-4">
        <div className="relative h-full min-h-[600px] rounded-2xl overflow-hidden border border-slate-200 shadow-sm bg-white">
          {/* Only online evacuees are shown — offline users are hidden from the map */}
          <GoogleMapView evacuees={users} centers={centers || []} hideOfflineEvacuees zoom={12} />
          <div className="absolute bottom-4 left-4 bg-white/95 backdrop-blur-sm rounded-xl shadow-lg p-3 z-10 text-xs space-y-1.5 border border-slate-100">
            <p className="font-bold text-slate-700 text-[10px] uppercase tracking-wider mb-2">Legend</p>
            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-emerald-500" /><span>Online · Safe</span></div>
            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-amber-500" /><span>Need Help</span></div>
            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-red-500" /><span>In Danger</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}
