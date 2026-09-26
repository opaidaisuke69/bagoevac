import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Users, Truck, Building2, LifeBuoy, BarChart3, Download,
  Power, ShieldAlert, ShieldCheck, Loader2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../lib/api';
import { CardSkeleton } from '../../components/Skeleton';
import Modal from '../../components/Modal';
import { cn } from '../../lib/utils';

function StatCard({ icon: Icon, label, value, color = 'blue', loading }) {
  if (loading) return <CardSkeleton />;
  const styles = {
    blue: 'bg-blue-50 text-blue-600 ring-blue-100',
    green: 'bg-emerald-50 text-emerald-600 ring-emerald-100',
    yellow: 'bg-amber-50 text-amber-600 ring-amber-100',
    red: 'bg-red-50 text-red-600 ring-red-100',
    orange: 'bg-orange-50 text-orange-600 ring-orange-100',
    slate: 'bg-slate-100 text-slate-600 ring-slate-200',
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

function toCsv(summary) {
  const rows = [];
  rows.push(['BRFE Report', `Generated ${new Date(summary.generated_at).toLocaleString()}`]);
  rows.push([]);
  rows.push(['SUMMARY']);
  rows.push(['Metric', 'Count']);
  rows.push(['Total Evacuees', summary.evacuees.total]);
  rows.push(['Evacuees Safe', summary.evacuees.safe]);
  rows.push(['Evacuees Need Help', summary.evacuees.need]);
  rows.push(['Evacuees In Danger', summary.evacuees.danger]);
  rows.push(['Rescuers', summary.rescuers.total]);
  rows.push(['Barangay Officials', summary.officials.total]);
  rows.push(['Rescue Requests (total)', summary.rescues.total]);
  rows.push(['Rescues Pending', summary.rescues.pending]);
  rows.push(['Rescues Ongoing', summary.rescues.ongoing]);
  rows.push(['Rescues Completed', summary.rescues.completed]);
  rows.push(['Flood Reports (total)', summary.reports.total]);
  rows.push([]);
  rows.push(['PER BARANGAY']);
  rows.push(['Barangay', 'Evacuees', 'Safe', 'Need Help', 'In Danger', 'Rescuers', 'Centers', 'Flood Reports']);
  for (const b of summary.per_barangay) {
    rows.push([b.name, b.evacuees, b.safe, b.need_help, b.in_danger, b.rescuers, b.centers, b.reports]);
  }
  return rows
    .map((r) => r.map((cell) => {
      const s = String(cell ?? '');
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(','))
    .join('\n');
}

export default function LguGenerateReports() {
  const queryClient = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const { data: summary, isLoading } = useQuery({
    queryKey: ['lgu-report-summary'],
    queryFn: async () => { const { data } = await api.get('/reports/summary'); return data; },
    refetchInterval: 10000,
  });

  const { data: settings } = useQuery({
    queryKey: ['lgu-settings'],
    queryFn: async () => { const { data } = await api.get('/lgu/settings'); return data; },
    refetchInterval: 10000,
  });

  const toggleMaintenance = useMutation({
    mutationFn: (on) => api.post('/lgu/settings', { maintenance_mode: on }),
    onSuccess: (res) => {
      const on = res.data?.maintenance_mode;
      toast.success(on ? 'System shut down — only Barangay & LGU can log in' : 'System is back online');
      queryClient.invalidateQueries({ queryKey: ['lgu-settings'] });
      setConfirmOpen(false);
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to update system status'),
  });

  const maintenance = !!settings?.maintenance_mode;

  function handleExport() {
    if (!summary) return;
    const csv = toCsv(summary);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `brfe-report-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast.success('Report exported');
  }

  function handleToggle() {
    setConfirmOpen(true);
  }

  return (
    <div className="p-4 lg:p-8 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <p className="text-sm text-slate-500">
          Generate reports on evacuees, rescuers and barangays
          {summary && <span className="text-slate-400"> · updated {new Date(summary.generated_at).toLocaleTimeString()}</span>}
        </p>
        <button onClick={handleExport} disabled={!summary} className="btn-primary inline-flex items-center gap-2 text-sm disabled:opacity-50">
          <Download size={16} /> Export CSV
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Users} label="Total Evacuees" value={summary?.evacuees.total} color="blue" loading={isLoading} />
        <StatCard icon={Users} label="Safe" value={summary?.evacuees.safe} color="green" loading={isLoading} />
        <StatCard icon={Users} label="Need Help" value={summary?.evacuees.need} color="yellow" loading={isLoading} />
        <StatCard icon={Users} label="In Danger" value={summary?.evacuees.danger} color="red" loading={isLoading} />
        <StatCard icon={Truck} label="Rescuers" value={summary?.rescuers.total} color="blue" loading={isLoading} />
        <StatCard icon={Building2} label="Barangay Officials" value={summary?.officials.total} color="slate" loading={isLoading} />
        <StatCard icon={LifeBuoy} label="Rescue Requests" value={summary?.rescues.total} color="orange" loading={isLoading} />
        <StatCard icon={BarChart3} label="Flood Reports" value={summary?.reports.total} color="red" loading={isLoading} />
      </div>

      {/* Per-barangay breakdown */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h3 className="font-bold text-slate-800 text-sm">Per-Barangay Breakdown</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-slate-100">
              <th className="text-left px-5 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wider">Barangay</th>
              <th className="text-right px-4 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wider">Evacuees</th>
              <th className="text-right px-4 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wider">Safe</th>
              <th className="text-right px-4 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wider">Need Help</th>
              <th className="text-right px-4 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wider">In Danger</th>
              <th className="text-right px-4 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wider">Rescuers</th>
              <th className="text-right px-4 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wider">Centers</th>
              <th className="text-right px-5 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wider">Reports</th>
            </tr></thead>
            <tbody className="divide-y divide-slate-50">
              {(summary?.per_barangay || []).map((b) => (
                <tr key={b.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-5 py-3 font-semibold text-slate-900">{b.name}</td>
                  <td className="px-4 py-3 text-right text-slate-700">{b.evacuees}</td>
                  <td className="px-4 py-3 text-right text-emerald-600">{b.safe}</td>
                  <td className="px-4 py-3 text-right text-amber-600">{b.need_help}</td>
                  <td className="px-4 py-3 text-right text-red-600">{b.in_danger}</td>
                  <td className="px-4 py-3 text-right text-slate-700">{b.rescuers}</td>
                  <td className="px-4 py-3 text-right text-slate-700">{b.centers}</td>
                  <td className="px-5 py-3 text-right text-slate-700">{b.reports}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* System control */}
      <div className={cn('card p-5 border', maintenance ? 'border-red-200 bg-red-50/40' : 'border-slate-200')}>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-3">
            <div className={cn('w-11 h-11 rounded-xl flex items-center justify-center ring-1', maintenance ? 'bg-red-50 text-red-600 ring-red-100' : 'bg-emerald-50 text-emerald-600 ring-emerald-100')}>
              {maintenance ? <ShieldAlert size={20} /> : <ShieldCheck size={20} />}
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                System Control
                <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full', maintenance ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700')}>
                  {maintenance ? 'SHUT DOWN' : 'ONLINE'}
                </span>
              </h3>
              <p className="text-xs text-slate-500 mt-1 max-w-md">
                {maintenance
                  ? 'The system is shut down. Only Barangay Officials and LGU Admin can log in — evacuees and rescuers are blocked.'
                  : 'The system is online. When shut down, only Barangay Officials and LGU Admin can log in.'}
              </p>
            </div>
          </div>
          <button
            onClick={handleToggle}
            disabled={toggleMaintenance.isPending}
            className={cn(
              'inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-colors disabled:opacity-50',
              maintenance ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'
            )}
          >
            {toggleMaintenance.isPending ? <Loader2 size={16} className="animate-spin" /> : <Power size={16} />}
            {maintenance ? 'Bring Online' : 'Shut Down System'}
          </button>
        </div>
      </div>

      {/* Confirm shutdown / bring-online modal */}
      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title={maintenance ? 'Bring the system back online?' : 'Shut down the system?'}
      >
        <div className="flex items-start gap-3">
          <div className={cn('w-11 h-11 rounded-xl flex items-center justify-center ring-1 shrink-0', maintenance ? 'bg-emerald-50 text-emerald-600 ring-emerald-100' : 'bg-red-50 text-red-600 ring-red-100')}>
            {maintenance ? <ShieldCheck size={20} /> : <ShieldAlert size={20} />}
          </div>
          <p className="text-sm text-slate-600 leading-relaxed">
            {maintenance
              ? 'Everyone will be able to log in again, including evacuees and rescuers.'
              : 'Evacuees and rescuers will be blocked from logging in. Only Barangay Officials and LGU Admin can log in while the system is shut down.'}
          </p>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={() => setConfirmOpen(false)} className="flex-1 btn-secondary">Cancel</button>
          <button
            onClick={() => toggleMaintenance.mutate(!maintenance)}
            disabled={toggleMaintenance.isPending}
            className={cn(
              'flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-colors disabled:opacity-50',
              maintenance ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'
            )}
          >
            {toggleMaintenance.isPending ? <Loader2 size={16} className="animate-spin" /> : <Power size={16} />}
            {maintenance ? 'Bring Online' : 'Shut Down'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
