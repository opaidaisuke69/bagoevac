import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { LifeBuoy, CheckCircle2, UserPlus, MapPin, Clock, Phone, AlertTriangle, Image as ImageIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../lib/api';
import { useAuthStore } from '../../stores/authStore';
import { formatDate } from '../../lib/utils';
import { isInsideBarangay } from '../../lib/geo';
import { BARANGAY_ID_MAP } from '../../data/barangayBoundaries';
import { TableSkeleton } from '../../components/Skeleton';
import Badge from '../../components/Badge';
import Modal from '../../components/Modal';
import SearchInput from '../../components/SearchInput';

export default function BrgyRescue() {
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [assignModal, setAssignModal] = useState(null); // { id, name }
  const [selectedRescuer, setSelectedRescuer] = useState('');
  const [lightbox, setLightbox] = useState(null);

  const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost/bagoevac/brfe-backend/api';
  const photoBase = API_BASE.replace('/api', '');

  // Rescue requests — fetched city-wide, then filtered by the request's live
  // GPS location (border jurisdiction), not the evacuee's registered barangay.
  const { data: rescues, isLoading } = useQuery({
    queryKey: ['brgy-rescues', statusFilter],
    queryFn: async () => {
      const params = { scope: 'jurisdiction' };
      if (statusFilter) params.status = statusFilter;
      const { data } = await api.get('/rescue/list_lgu', { params });
      return data.data || [];
    },
  });

  const barangayName = BARANGAY_ID_MAP[user?.barangay_id] || user?.barangay_name || null;

  // Rescuers in this barangay for assignment dropdown
  const { data: rescuers } = useQuery({
    queryKey: ['brgy-rescuers', user?.barangay_id],
    queryFn: async () => {
      const { data } = await api.get('/lgu/accounts', {
        params: { barangay_id: user?.barangay_id, role: 'Rescuer' },
      });
      return data.data || [];
    },
    retry: false,
    refetchInterval: false,
  });

  const assignMutation = useMutation({
    mutationFn: ({ id, rescuerId }) =>
      api.put('/rescue/update_lgu', { id, req_status: 'Ongoing', rescuer_id: rescuerId || undefined }),
    onSuccess: () => {
      toast.success('Rescue assigned — rescuer is on the way');
      queryClient.invalidateQueries({ queryKey: ['brgy-rescues'] });
      setAssignModal(null);
      setSelectedRescuer('');
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to assign'),
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
    onSuccess: () => toast.success('Rescue completed! Evacuee marked Safe.'),
    onError: (_, __, ctx) => {
      queryClient.setQueryData(['brgy-rescues', statusFilter], ctx.prev);
      toast.error('Failed to complete');
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['brgy-rescues'] }),
  });

  const filtered = (rescues || [])
    // Border jurisdiction: only requests whose GPS falls inside this barangay.
    .filter((r) => isInsideBarangay(r.latitude, r.longitude, barangayName))
    .filter((r) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return r.full_name?.toLowerCase().includes(q) || r.barangay_name?.toLowerCase().includes(q);
    });

  const pending = filtered.filter((r) => r.req_status === 'Pending').length;
  const ongoing = filtered.filter((r) => r.req_status === 'Ongoing').length;
  const completed = filtered.filter((r) => r.req_status === 'Completed').length;

  return (
    <div className="p-4 lg:p-8 space-y-6">
      <p className="text-sm text-slate-500">
        Rescue requests from evacuees in <span className="font-semibold text-slate-700">Brgy. {user?.barangay_name || '...'}</span> jurisdiction
      </p>

      {/* Urgent alert */}
      {pending > 0 && (
        <div className="card p-4 border-l-4 border-l-red-500 bg-red-50 flex items-center gap-3">
          <AlertTriangle size={20} className="text-red-600 shrink-0" />
          <div>
            <p className="font-bold text-red-700 text-sm">{pending} Pending Rescue Request{pending > 1 ? 's' : ''}</p>
            <p className="text-xs text-red-600 mt-0.5">Evacuees are waiting for a rescuer to be assigned.</p>
          </div>
        </div>
      )}

      {/* Stats */}
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
          <div><p className="text-2xl font-bold text-slate-900">{completed}</p><p className="text-xs text-slate-500">Completed</p></div>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-5 flex flex-wrap gap-3 items-center">
        <SearchInput placeholder="Search evacuee..." onSearch={setSearch} className="w-64" />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="select">
          <option value="">All Status</option>
          <option value="Pending">Pending</option>
          <option value="Ongoing">Ongoing</option>
          <option value="Completed">Completed</option>
        </select>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {isLoading ? <TableSkeleton rows={6} cols={8} /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left px-5 py-4 font-semibold text-slate-500 text-xs uppercase tracking-wider">ID</th>
                  <th className="text-left px-5 py-4 font-semibold text-slate-500 text-xs uppercase tracking-wider">Evacuee</th>
                  <th className="text-left px-5 py-4 font-semibold text-slate-500 text-xs uppercase tracking-wider">Evacuee Status</th>
                  <th className="text-left px-5 py-4 font-semibold text-slate-500 text-xs uppercase tracking-wider">Location</th>
                  <th className="text-left px-5 py-4 font-semibold text-slate-500 text-xs uppercase tracking-wider">Proof</th>
                  <th className="text-left px-5 py-4 font-semibold text-slate-500 text-xs uppercase tracking-wider">Rescue Status</th>
                  <th className="text-left px-5 py-4 font-semibold text-slate-500 text-xs uppercase tracking-wider">Requested</th>
                  <th className="text-left px-5 py-4 font-semibold text-slate-500 text-xs uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-16 text-slate-400">No rescue requests in your jurisdiction</td></tr>
                ) : (
                  filtered.map((r) => (
                    <tr key={r.id} className={`hover:bg-slate-50/80 transition-colors ${r.req_status === 'Pending' ? 'bg-amber-50/30' : ''}`}>
                      <td className="px-5 py-3.5 text-slate-400 font-mono text-xs">#{r.id}</td>
                      <td className="px-5 py-3.5">
                        <p className="font-semibold text-slate-900">{r.full_name || '—'}</p>
                        <p className="text-xs text-slate-400">{r.barangay_name}</p>
                        {r.contact_no && (
                          <p className="text-xs text-emerald-600 flex items-center gap-1 mt-0.5">
                            <Phone size={10} />{r.contact_no}
                          </p>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <Badge status={r.current_status || r.status_at_request} />
                      </td>
                      <td className="px-5 py-3.5">
                        {r.latitude && r.longitude ? (
                          <a
                            href={`https://maps.google.com/?q=${r.latitude},${r.longitude}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 font-mono text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded-md hover:bg-blue-100 transition-colors"
                          >
                            <MapPin size={10} />
                            {parseFloat(r.latitude).toFixed(4)}, {parseFloat(r.longitude).toFixed(4)}
                          </a>
                        ) : '—'}
                      </td>
                      <td className="px-5 py-3.5">
                        {r.photo_path ? (
                          <button onClick={() => setLightbox(`${photoBase}/public/${r.photo_path}`)} className="group relative">
                            <img src={`${photoBase}/public/${r.photo_path}`} alt="Proof" className="w-12 h-12 object-cover rounded-xl border border-slate-200 group-hover:opacity-80 transition" />
                          </button>
                        ) : <ImageIcon size={16} className="text-slate-300" />}
                      </td>
                      <td className="px-5 py-3.5"><Badge status={r.req_status} /></td>
                      <td className="px-5 py-3.5 text-xs text-slate-500">{formatDate(r.requested_at)}</td>
                      <td className="px-5 py-3.5">
                        {r.req_status === 'Pending' && (
                          <button
                            onClick={() => setAssignModal({ id: r.id, name: r.full_name })}
                            className="btn-primary text-xs py-1.5 px-3 inline-flex items-center gap-1.5"
                          >
                            <UserPlus size={12} /> Assign Rescuer
                          </button>
                        )}
                        {r.req_status === 'Ongoing' && (
                          <button
                            onClick={() => completeMutation.mutate(r.id)}
                            disabled={completeMutation.isPending}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold rounded-xl transition-colors"
                          >
                            <CheckCircle2 size={12} /> Complete
                          </button>
                        )}
                        {r.req_status === 'Completed' && (
                          <span className="text-xs text-slate-400 flex items-center gap-1">
                            <CheckCircle2 size={12} className="text-emerald-500" /> Done
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Assign Modal */}
      <Modal
        open={!!assignModal}
        onClose={() => { setAssignModal(null); setSelectedRescuer(''); }}
        title="Assign Rescuer"
        subtitle={`Assigning rescue for ${assignModal?.name}`}
      >
        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
              Select Rescuer <span className="font-normal text-slate-400">(optional)</span>
            </label>
            {(rescuers || []).length === 0 ? (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700">
                No rescuers in your barangay yet.{' '}
                <a href="/brgy/rescuers" className="font-semibold underline">Create one first</a>.
              </div>
            ) : (
              <select
                value={selectedRescuer}
                onChange={(e) => setSelectedRescuer(e.target.value)}
                className="select w-full"
              >
                <option value="">— Assign to barangay (no specific rescuer) —</option>
                {(rescuers || []).map((r) => (
                  <option key={r.id} value={r.id}>{r.username}</option>
                ))}
              </select>
            )}
          </div>
          <p className="text-xs text-slate-500">
            The evacuee will be notified that a rescuer is on the way.
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => { setAssignModal(null); setSelectedRescuer(''); }}
            className="flex-1 btn-secondary"
          >
            Cancel
          </button>
          <button
            onClick={() => assignMutation.mutate({
              id: assignModal.id,
              rescuerId: selectedRescuer ? parseInt(selectedRescuer) : null,
            })}
            disabled={assignMutation.isPending}
            className="flex-1 btn-primary"
          >
            {assignMutation.isPending ? 'Assigning...' : 'Confirm Assign'}
          </button>
        </div>
      </Modal>

      {lightbox && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-6 cursor-pointer animate-fade-in" onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="Rescue proof" className="max-w-full max-h-full rounded-2xl shadow-2xl animate-slide-up" />
        </div>
      )}
    </div>
  );
}
