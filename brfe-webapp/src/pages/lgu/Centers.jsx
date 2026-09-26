import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../lib/api';
import { TableSkeleton } from '../../components/Skeleton';
import Badge from '../../components/Badge';
import ProgressBar from '../../components/ProgressBar';
import Modal from '../../components/Modal';
import LocationPicker from '../../components/LocationPicker';

const initialForm = { name: '', address: '', latitude: '', longitude: '', max_capacity: '', occupancy: '0', op_status: 'Open', barangay_id: '' };

export default function LguCenters() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState(null);
  const [errors, setErrors] = useState({});

  const { data: centers, isLoading } = useQuery({
    queryKey: ['lgu-centers'],
    queryFn: async () => { const { data } = await api.get('/centers/list_lgu'); return data.data || []; },
  });

  const { data: barangays } = useQuery({
    queryKey: ['barangays'],
    queryFn: async () => { const { data } = await api.get('/barangays/list'); return data.data || []; },
    staleTime: 60000, refetchInterval: false,
  });

  const saveMutation = useMutation({
    mutationFn: (payload) => api.post('/centers/upsert_lgu', payload),
    onSuccess: (res) => {
      if (res.data.error) { if (res.data.fields) setErrors(res.data.fields); else toast.error(res.data.message || 'Save failed'); return; }
      toast.success(editingId ? 'Center updated' : 'Center added');
      queryClient.invalidateQueries({ queryKey: ['lgu-centers'] });
      closeModal();
    },
    onError: () => toast.error('Failed to save'),
  });

  function openModal(center = null) {
    setErrors({});
    if (center) {
      setEditingId(center.id);
      setForm({ name: center.name || '', address: center.address || '', latitude: center.latitude || '', longitude: center.longitude || '', max_capacity: center.max_capacity || '', occupancy: center.occupancy || '0', op_status: center.op_status || 'Open', barangay_id: center.barangay_id || '' });
    } else { setEditingId(null); setForm(initialForm); }
    setModalOpen(true);
  }

  function closeModal() { setModalOpen(false); setEditingId(null); setForm(initialForm); setErrors({}); }

  function handleSave() {
    const payload = { ...form, latitude: parseFloat(form.latitude), longitude: parseFloat(form.longitude), max_capacity: parseInt(form.max_capacity, 10), occupancy: parseInt(form.occupancy, 10), barangay_id: form.barangay_id || null };
    if (editingId) payload.id = editingId;
    saveMutation.mutate(payload);
  }

  const totalCap = (centers || []).reduce((s, c) => s + (c.max_capacity || 0), 0);
  const totalOcc = (centers || []).reduce((s, c) => s + (c.occupancy || 0), 0);

  return (
    <div className="p-4 lg:p-8 space-y-6">
      <p className="text-sm text-slate-500">Manage all evacuation centers across Bago City</p>

      <div className="grid grid-cols-3 gap-4">
        <div className="card p-5"><p className="text-xs font-semibold text-slate-500">Total Centers</p><p className="text-3xl font-bold text-slate-900 mt-1">{(centers || []).length}</p></div>
        <div className="card p-5"><p className="text-xs font-semibold text-slate-500">Open</p><p className="text-3xl font-bold text-emerald-600 mt-1">{(centers || []).filter(c => c.op_status === 'Open').length}</p></div>
        <div className="card p-5"><p className="text-xs font-semibold text-slate-500">Total Occupancy</p><p className="text-3xl font-bold text-slate-900 mt-1">{totalOcc}<span className="text-lg text-slate-400">/{totalCap}</span></p><ProgressBar value={totalOcc} max={totalCap} className="mt-2" /></div>
      </div>

      <div className="flex justify-end">
        <button onClick={() => openModal()} className="btn-primary inline-flex items-center gap-2 text-sm"><Plus size={16} /> Add Center</button>
      </div>

      <div className="card overflow-hidden">
        {isLoading ? <TableSkeleton rows={5} cols={5} /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-slate-100">
                <th className="text-left px-5 py-4 font-semibold text-slate-500 text-xs uppercase tracking-wider">Name</th>
                <th className="text-left px-5 py-4 font-semibold text-slate-500 text-xs uppercase tracking-wider">Barangay</th>
                <th className="text-left px-5 py-4 font-semibold text-slate-500 text-xs uppercase tracking-wider">Status</th>
                <th className="text-left px-5 py-4 font-semibold text-slate-500 text-xs uppercase tracking-wider">Capacity</th>
                <th className="text-left px-5 py-4 font-semibold text-slate-500 text-xs uppercase tracking-wider">Actions</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-50">
                {(centers || []).length === 0 ? <tr><td colSpan={5} className="text-center py-16 text-slate-400">No centers</td></tr> :
                  (centers || []).map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-5 py-3.5"><p className="font-semibold text-slate-900">{c.name}</p><p className="text-xs text-slate-400 mt-0.5 truncate max-w-[200px]">{c.address}</p></td>
                      <td className="px-5 py-3.5 text-slate-600 text-xs">{c.barangay_name || '—'}</td>
                      <td className="px-5 py-3.5"><Badge status={c.op_status} /></td>
                      <td className="px-5 py-3.5"><div className="w-28"><div className="flex justify-between text-xs text-slate-500 mb-1"><span>{c.occupancy}/{c.max_capacity}</span></div><ProgressBar value={c.occupancy} max={c.max_capacity} /></div></td>
                      <td className="px-5 py-3.5"><button onClick={() => openModal(c)} className="btn-secondary text-xs py-1.5 px-3 inline-flex items-center gap-1.5"><Pencil size={12} /> Edit</button></td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={modalOpen} onClose={closeModal} title={editingId ? 'Edit Center' : 'Add Center'} size="3xl">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: form fields */}
          <div className="space-y-4">
            <div><label className="block text-sm font-semibold text-slate-700 mb-1.5">Name *</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input" />{errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}</div>
            <div><label className="block text-sm font-semibold text-slate-700 mb-1.5">Address *</label><input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="input" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-sm font-semibold text-slate-700 mb-1.5">Latitude *</label><input type="number" step="any" value={form.latitude} onChange={(e) => setForm({ ...form, latitude: e.target.value })} className="input" placeholder="10.5360" />{errors.latitude && <p className="text-xs text-red-500 mt-1">{errors.latitude}</p>}</div>
              <div><label className="block text-sm font-semibold text-slate-700 mb-1.5">Longitude *</label><input type="number" step="any" value={form.longitude} onChange={(e) => setForm({ ...form, longitude: e.target.value })} className="input" placeholder="122.8950" />{errors.longitude && <p className="text-xs text-red-500 mt-1">{errors.longitude}</p>}</div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-sm font-semibold text-slate-700 mb-1.5">Max Capacity *</label><input type="number" min="1" value={form.max_capacity} onChange={(e) => setForm({ ...form, max_capacity: e.target.value })} className="input" /></div>
              <div><label className="block text-sm font-semibold text-slate-700 mb-1.5">Occupancy</label><input type="number" min="0" value={form.occupancy} onChange={(e) => setForm({ ...form, occupancy: e.target.value })} className="input" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-sm font-semibold text-slate-700 mb-1.5">Status</label><select value={form.op_status} onChange={(e) => setForm({ ...form, op_status: e.target.value })} className="select w-full"><option value="Open">Open</option><option value="Full">Full</option><option value="Closed">Closed</option></select></div>
              <div><label className="block text-sm font-semibold text-slate-700 mb-1.5">Barangay</label><select value={form.barangay_id} onChange={(e) => setForm({ ...form, barangay_id: e.target.value })} className="select w-full"><option value="">— Select —</option>{(barangays || []).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></div>
            </div>
          </div>

          {/* Right: map pin picker */}
          <div className="flex flex-col">
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Pin Location on Map *</label>
            <div className="flex-1 min-h-[380px]">
              <LocationPicker
                height="100%"
                lat={form.latitude}
                lng={form.longitude}
                onChange={({ lat, lng }) => setForm((f) => ({ ...f, latitude: String(lat), longitude: String(lng) }))}
              />
            </div>
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={closeModal} className="flex-1 btn-secondary">Cancel</button>
          <button onClick={handleSave} disabled={saveMutation.isPending} className="flex-1 btn-primary">{saveMutation.isPending ? 'Saving...' : 'Save'}</button>
        </div>
      </Modal>
    </div>
  );
}
