import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Building2, Pencil } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../lib/api';
import { TableSkeleton } from '../../components/Skeleton';
import Badge from '../../components/Badge';
import ProgressBar from '../../components/ProgressBar';
import Modal from '../../components/Modal';

export default function BrgyCenters() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ id: null, occupancy: '', op_status: 'Open' });

  const { data: centers, isLoading } = useQuery({
    queryKey: ['brgy-centers'],
    queryFn: async () => { const { data } = await api.get('/centers/list_lgu'); return data.data || []; },
  });

  const updateMutation = useMutation({
    mutationFn: (payload) => api.post('/centers/upsert_lgu', payload),
    onSuccess: (res) => {
      if (res.data.error) { toast.error(res.data.message || 'Update failed'); return; }
      toast.success('Center updated');
      queryClient.invalidateQueries({ queryKey: ['brgy-centers'] });
      setModalOpen(false);
    },
    onError: () => toast.error('Failed to update'),
  });

  function openEdit(center) {
    setForm({ id: center.id, name: center.name, address: center.address, latitude: center.latitude, longitude: center.longitude, max_capacity: center.max_capacity, occupancy: center.occupancy, op_status: center.op_status, barangay_id: center.barangay_id });
    setModalOpen(true);
  }

  return (
    <div className="p-4 lg:p-8 space-y-6">
      <p className="text-sm text-slate-500">Update evacuation center information in your jurisdiction</p>

      <div className="card overflow-hidden">
        {isLoading ? <TableSkeleton rows={4} cols={5} /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-slate-100">
                <th className="text-left px-5 py-4 font-semibold text-slate-500 text-xs uppercase tracking-wider">Center</th>
                <th className="text-left px-5 py-4 font-semibold text-slate-500 text-xs uppercase tracking-wider">Status</th>
                <th className="text-left px-5 py-4 font-semibold text-slate-500 text-xs uppercase tracking-wider">Capacity</th>
                <th className="text-left px-5 py-4 font-semibold text-slate-500 text-xs uppercase tracking-wider">Action</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-50">
                {(centers || []).length === 0 ? <tr><td colSpan={4} className="text-center py-16 text-slate-400">No centers in your barangay</td></tr> :
                  (centers || []).map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-5 py-3.5"><p className="font-semibold text-slate-900">{c.name}</p><p className="text-xs text-slate-400 truncate max-w-[200px]">{c.address}</p></td>
                      <td className="px-5 py-3.5"><Badge status={c.op_status} /></td>
                      <td className="px-5 py-3.5"><div className="w-28"><div className="flex justify-between text-xs text-slate-500 mb-1"><span>{c.occupancy}/{c.max_capacity}</span></div><ProgressBar value={c.occupancy} max={c.max_capacity} /></div></td>
                      <td className="px-5 py-3.5"><button onClick={() => openEdit(c)} className="btn-secondary text-xs py-1.5 px-3 inline-flex items-center gap-1.5"><Pencil size={12} /> Update</button></td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Update Center" subtitle="Update occupancy and status">
        <div className="space-y-4">
          <div><label className="block text-sm font-semibold text-slate-700 mb-1.5">Occupancy</label><input type="number" min="0" value={form.occupancy} onChange={(e) => setForm({ ...form, occupancy: e.target.value })} className="input" /></div>
          <div><label className="block text-sm font-semibold text-slate-700 mb-1.5">Status</label><select value={form.op_status} onChange={(e) => setForm({ ...form, op_status: e.target.value })} className="select w-full"><option value="Open">Open</option><option value="Full">Full</option><option value="Closed">Closed</option></select></div>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={() => setModalOpen(false)} className="flex-1 btn-secondary">Cancel</button>
          <button onClick={() => updateMutation.mutate({ ...form, occupancy: parseInt(form.occupancy, 10) })} disabled={updateMutation.isPending} className="flex-1 btn-primary">{updateMutation.isPending ? 'Saving...' : 'Update'}</button>
        </div>
      </Modal>
    </div>
  );
}
