import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Shield, UserPlus } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../lib/api';
import { useAuthStore } from '../../stores/authStore';
import { TableSkeleton } from '../../components/Skeleton';
import Modal from '../../components/Modal';

export default function BrgyRescuers() {
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ username: '', password: '' });
  const [errors, setErrors] = useState({});

  const { data: rescuers, isLoading } = useQuery({
    queryKey: ['brgy-rescuers', user?.barangay_id],
    queryFn: async () => {
      const { data } = await api.get('/lgu/accounts', {
        params: { barangay_id: user?.barangay_id, role: 'Rescuer' },
      });
      return data.data || [];
    },
    retry: false,
    refetchInterval: 30000, // rescuer list rarely changes
  });

  const createMutation = useMutation({
    mutationFn: (payload) => api.post('/lgu/create-account', payload),
    onSuccess: (res) => {
      if (res.data.error) {
        if (res.data.fields) setErrors(res.data.fields);
        else toast.error(res.data.message || 'Failed');
        return;
      }
      toast.success('Rescuer account created');
      queryClient.invalidateQueries({ queryKey: ['brgy-rescuers'] });
      setModalOpen(false); setForm({ username: '', password: '' }); setErrors({});
    },
    onError: () => toast.error('Failed to create'),
  });

  return (
    <div className="p-4 lg:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">Manage rescuers assigned to your barangay</p>
        <button onClick={() => { setModalOpen(true); setErrors({}); }} className="btn-primary inline-flex items-center gap-2 text-sm">
          <UserPlus size={16} /> Add Rescuer
        </button>
      </div>

      <div className="card overflow-hidden">
        {isLoading ? <TableSkeleton rows={4} cols={3} /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-slate-100">
                <th className="text-left px-5 py-4 font-semibold text-slate-500 text-xs uppercase tracking-wider">Username</th>
                <th className="text-left px-5 py-4 font-semibold text-slate-500 text-xs uppercase tracking-wider">Role</th>
                <th className="text-left px-5 py-4 font-semibold text-slate-500 text-xs uppercase tracking-wider">Status</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-50">
                {(rescuers || []).length === 0 ? (
                  <tr><td colSpan={3} className="text-center py-16 text-slate-400">
                    <Shield size={32} className="mx-auto mb-2 opacity-30" />
                    <p>No rescuers yet. Add one above.</p>
                  </td></tr>
                ) : (
                  (rescuers || []).map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-5 py-3.5 font-semibold text-slate-900">{r.username}</td>
                      <td className="px-5 py-3.5"><span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 ring-1 ring-blue-100">Rescuer</span></td>
                      <td className="px-5 py-3.5 text-xs text-slate-500">Active</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Create Rescuer Account" subtitle="This rescuer will be assigned to your barangay only">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Username *</label>
            <input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} className="input" placeholder="e.g. rescuer_juan" />
            {errors.username && <p className="text-xs text-red-500 mt-1">{errors.username}</p>}
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Password *</label>
            <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="input" placeholder="Min 6 characters" />
            {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password}</p>}
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={() => setModalOpen(false)} className="flex-1 btn-secondary">Cancel</button>
          <button
            onClick={() => createMutation.mutate({ username: form.username.trim(), password: form.password, role: 'Rescuer', barangay_id: user?.barangay_id })}
            disabled={createMutation.isPending || !form.username.trim() || !form.password}
            className="flex-1 btn-primary"
          >
            {createMutation.isPending ? 'Creating...' : 'Create Rescuer'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
