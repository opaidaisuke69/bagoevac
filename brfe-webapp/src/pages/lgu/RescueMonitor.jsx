import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Eye, Clock, LifeBuoy, CheckCircle2 } from 'lucide-react';
import api from '../../lib/api';
import { formatDate } from '../../lib/utils';
import { TableSkeleton } from '../../components/Skeleton';
import Badge from '../../components/Badge';
import SearchInput from '../../components/SearchInput';

export default function LguRescueMonitor() {
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');

  const { data: rescues, isLoading } = useQuery({
    queryKey: ['lgu-rescue-monitor', statusFilter],
    queryFn: async () => {
      const params = {};
      if (statusFilter) params.status = statusFilter;
      const { data } = await api.get('/rescue/list_lgu', { params });
      return data.data || [];
    },
  });

  const filtered = (rescues || []).filter((r) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return r.full_name?.toLowerCase().includes(q) || r.barangay_name?.toLowerCase().includes(q);
  });

  const pending = filtered.filter((r) => r.req_status === 'Pending').length;
  const ongoing = filtered.filter((r) => r.req_status === 'Ongoing').length;
  const completed = filtered.filter((r) => r.req_status === 'Completed').length;

  return (
    <div className="p-4 lg:p-8 space-y-6">
      <p className="text-sm text-slate-500">Monitor rescue operations across all barangays (read-only)</p>

      <div className="grid grid-cols-3 gap-4">
        <div className="card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center ring-1 ring-amber-100"><Clock size={18} className="text-amber-600" /></div>
          <div><p className="text-2xl font-bold text-slate-900">{pending}</p><p className="text-xs text-slate-500">Pending</p></div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center ring-1 ring-blue-100"><LifeBuoy size={18} className="text-blue-600" /></div>
          <div><p className="text-2xl font-bold text-slate-900">{ongoing}</p><p className="text-xs text-slate-500">Ongoing</p></div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center ring-1 ring-emerald-100"><CheckCircle2 size={18} className="text-emerald-600" /></div>
          <div><p className="text-2xl font-bold text-slate-900">{completed}</p><p className="text-xs text-slate-500">Completed</p></div>
        </div>
      </div>

      <div className="card p-5 flex flex-wrap gap-3 items-center">
        <SearchInput placeholder="Search evacuee, barangay..." onSearch={setSearch} className="w-72" />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="select">
          <option value="">All Status</option>
          <option value="Pending">Pending</option><option value="Ongoing">Ongoing</option><option value="Completed">Completed</option>
        </select>
        <span className="ml-auto text-sm text-slate-500">{filtered.length} requests</span>
      </div>

      <div className="card overflow-hidden">
        {isLoading ? <TableSkeleton rows={6} cols={5} /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-slate-100">
                <th className="text-left px-5 py-4 font-semibold text-slate-500 text-xs uppercase tracking-wider">#</th>
                <th className="text-left px-5 py-4 font-semibold text-slate-500 text-xs uppercase tracking-wider">Evacuee</th>
                <th className="text-left px-5 py-4 font-semibold text-slate-500 text-xs uppercase tracking-wider">Barangay</th>
                <th className="text-left px-5 py-4 font-semibold text-slate-500 text-xs uppercase tracking-wider">Status</th>
                <th className="text-left px-5 py-4 font-semibold text-slate-500 text-xs uppercase tracking-wider">Requested</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.length === 0 ? <tr><td colSpan={5} className="text-center py-16 text-slate-400">No rescue requests</td></tr> :
                  filtered.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-5 py-3.5 text-slate-400 font-mono text-xs">#{r.id}</td>
                      <td className="px-5 py-3.5 font-semibold text-slate-900">{r.full_name || '—'}</td>
                      <td className="px-5 py-3.5 text-slate-600">{r.barangay_name || '—'}</td>
                      <td className="px-5 py-3.5"><Badge status={r.req_status} /></td>
                      <td className="px-5 py-3.5 text-xs text-slate-500">{formatDate(r.requested_at)}</td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card p-4 bg-amber-50 border-amber-200">
        <p className="text-xs text-amber-700 font-medium flex items-center gap-2">
          <Eye size={14} /> LGU Admin has monitoring access only. Rescue assignment is handled by Barangay Officials.
        </p>
      </div>
    </div>
  );
}
