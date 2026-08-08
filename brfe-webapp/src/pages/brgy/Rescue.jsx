import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { LifeBuoy, CheckCircle2, ArrowRight, MapPin, Clock } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../lib/api';
import { formatDate } from '../../lib/utils';
import { TableSkeleton } from '../../components/Skeleton';
import Badge from '../../components/Badge';
import Modal from '../../components/Modal';
import SearchInput from '../../components/SearchInput';

export default function BrgyRescue() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [assignModal, setAssignModal] = useState(null);

  const { data: rescues, isLoading } = useQuery({
    queryKey: ['brgy-rescues', statusFilter],
    queryFn: async () => {
      const params = {};
      if (statusFilter) params.status = statusFilter;
      const { data } = await api.get('/rescue/list_lgu', { params });
      return data.data || [];
    },
  });

  const assignMutation = useMutation({
    mutationFn: (id) => api.put('/rescue/update_lgu', { id, req_status: 'Ongoing' }),
    onSuccess: () => {
      toast.success('Rescue assigned — now Ongoing');
      queryClient.invalidateQueries({ queryKey: ['brgy-rescues'] });
      setAssignModal(null);
    },
    onError: () => toast.error('Failed to assign'),
  });

  const completeMutation = useMutation({
    mutationFn: (id) => api.put('/rescue/update_lgu', { id, req_status: 'Completed' }),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['brgy-rescues'] });
      const prev = queryClient.getQueryData(['brgy-rescues', statusFilter]);
      queryClient.setQueryData(['brgy-rescues', statusFilter], (old) =>
        (old || []).map((r) => r.id === id ? { ...r, req_status: 'Completed' } : r)
      );
      return { prev };
    },
    onSuccess: () => toast.success('Rescue completed!'),
    onError: (_, __, ctx) => { queryClient.setQueryData(['brgy-rescues', statusFilter], ctx.prev); toast.error('Failed'); },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['brgy-rescues'] }),
  });

  const filtered = (rescues || []).filter((r) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return r.full_name?.toLowerCase().includes(q) || r.barangay_name?.toLowerCase().includes(q);
  });

  const pending = filtered.filter((r) => r.req_status === 'Pending').length;
  const ongoing = filtered.filter((r) => r.req_status === 'Ongoing').length;

  return (
    <div className="p-4 lg:p-8 space-y-6">
      <p className="text-sm text-slate-500">Receive, verify, and manage rescue requests from your residents</p>

      <div className="grid grid-cols-3 gap-4">
        <div className="card p-4 flex items-center gap-3 border-l-4 border-l-amber-500">
          <Clock size={20} className="text-amber-600" />
          <div><p className="text-2xl font-bold text-slate-900">{pending}</p><p className="text-xs text-slate-500">Pending</p></div>
        </div>
        <div className="card p-4 flex items-center gap-3 border-l-4 border-l-blue-500">
          <LifeBuoy size={20} className="text-blue-600" />
          <div><p className="text-2xl font-bold text-slate-900">{ongoing}</p><p className="text-xs text-slate-500">Ongoing</p></div>
        </div>
        <div className="card p-4 flex items-center gap-3 border-l-4 border-l-emerald-500">
          <CheckCircle2 size={20} className="text-emerald-600" />
          <div><p className="text-2xl font-bold text-slate-900">{filtered.length - pending - ongoing}</p><p className="text-xs text-slate-500">Completed</p></div>
        </div>
      </div>

      <div className="card p-5 flex flex-wrap gap-3 items-center">
        <SearchInput placeholder="Search evacuee..." onSearch={setSearch} className="w-72" />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="select">
          <option value="">All</option><option value="Pending">Pending</option><option value="Ongoing">Ongoing</option><option value="Completed">Completed</option>
        </select>
      </div>

      <div className="card overflow-hidden">
        {isLoading ? <TableSkeleton rows={6} cols={6} /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-slate-100">
                <th className="text-left px-5 py-4 font-semibold text-slate-500 text-xs uppercase tracking-wider">ID</th>
                <th className="text-left px-5 py-4 font-semibold text-slate-500 text-xs uppercase tracking-wider">Evacuee</th>
                <th className="text-left px-5 py-4 font-semibold text-slate-500 text-xs uppercase tracking-wider">GPS</th>
                <th className="text-left px-5 py-4 font-semibold text-slate-500 text-xs uppercase tracking-wider">Status</th>
                <th className="text-left px-5 py-4 font-semibold text-slate-500 text-xs uppercase tracking-wider">Requested</th>
                <th className="text-left px-5 py-4 font-semibold text-slate-500 text-xs uppercase tracking-wider">Action</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.length === 0 ? <tr><td colSpan={6} className="text-center py-16 text-slate-400">No requests</td></tr> :
                  filtered.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-5 py-3.5 text-slate-400 font-mono text-xs">#{r.id}</td>
                      <td className="px-5 py-3.5"><p className="font-semibold text-slate-900">{r.full_name || '—'}</p></td>
                      <td className="px-5 py-3.5">
                        {r.latitude && r.longitude ? (
                          <span className="inline-flex items-center gap-1 font-mono text-xs text-slate-500 bg-slate-50 px-2 py-1 rounded-md">
                            <MapPin size={10} />{parseFloat(r.latitude).toFixed(4)}, {parseFloat(r.longitude).toFixed(4)}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-5 py-3.5"><Badge status={r.req_status} /></td>
                      <td className="px-5 py-3.5 text-xs text-slate-500">{formatDate(r.requested_at)}</td>
                      <td className="px-5 py-3.5">
                        {r.req_status === 'Pending' && (
                          <button onClick={() => setAssignModal(r.id)} className="btn-primary text-xs py-1.5 px-3 inline-flex items-center gap-1.5">
                            <ArrowRight size={12} /> Assign
                          </button>
                        )}
                        {r.req_status === 'Ongoing' && (
                          <button onClick={() => completeMutation.mutate(r.id)} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl transition-colors">
                            <CheckCircle2 size={12} /> Complete
                          </button>
                        )}
                        {r.req_status === 'Completed' && <span className="text-xs text-slate-400">Done</span>}
                      </td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={!!assignModal} onClose={() => setAssignModal(null)} title="Assign Rescue" subtitle={`Assign rescue #${assignModal} to a rescuer`}>
        <p className="text-sm text-slate-600 mb-6">This will mark the request as <Badge status="Ongoing" className="mx-1" /> and notify the evacuee that help is on the way.</p>
        <div className="flex gap-3">
          <button onClick={() => setAssignModal(null)} className="flex-1 btn-secondary">Cancel</button>
          <button onClick={() => assignMutation.mutate(assignModal)} disabled={assignMutation.isPending} className="flex-1 btn-primary">
            {assignMutation.isPending ? 'Assigning...' : 'Confirm Assign'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
