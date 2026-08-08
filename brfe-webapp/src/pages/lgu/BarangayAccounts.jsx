import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { UserPlus, Shield } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../lib/api';
import { TableSkeleton } from '../../components/Skeleton';
import Modal from '../../components/Modal';

export default function LguBarangayAccounts() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ username: '', password: '', barangay_id: '' });
  const [errors, setErrors] = useState({});

  const { data: accounts, isLoading } = useQuery({
    queryKey: ['lgu-accounts'],
    queryFn: async () => {
      const { data } = await api.get('/lgu/accounts');
      return data.data || [];
    },
    retry: false,
    refetchInterval: 30000, // accounts rarely change — 30s is fine
  });

  const { data: barangays } = useQuery({
    queryKey: ['barangays'],
    queryFn: async () => { const { data } = await api.get('/barangays/list'); return data.data || []; },
    staleTime: 60000, refetchInterval: false,
  });

  const createMutation = useMutation({
    mutationFn: (payload) => api.post('/lgu/create-account', payload),
    onSuccess: (res) => {
      if (res.data.error) {
        if (res.data.fields) setErrors(res.data.fields);
        else toast.error(res.data.message || 'Creation failed');
        return;
      }
      toast.success('Barangay account created');
      queryClient.invalidateQueries({ queryKey: ['lgu-accounts'] });
      setModalOpen(false); setForm({ username: '', password: '', barangay_id: '' }); setErrors({});
    },
    onError: () => toast.error('Failed to create account'),
  });

  return (
    <div className="p-4 lg:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">Manage barangay official accounts</p>
        <button onClick={() => { setModalOpen(true); setErrors({}); }} className="btn-primary inline-flex items-center gap-2 text-sm">
          <UserPlus size={16} /> Create Account
        </button>
      </div>

      <div className="card overflow-hidden">
        {isLoading ? <TableSkeleton rows={5} cols={4} /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-slate-100">
                <th className="text-left px-5 py-4 font-semibold text-slate-500 text-xs uppercase tracking-wider">Username</th>
                <th className="text-left px-5 py-4 font-semibold text-slate-500 text-xs uppercase tracking-wider">Role</th>
                <th className="text-left px-5 py-4 font-semibold text-slate-500 text-xs uppercase tracking-wider">Barangay</th>
                <th className="text-left px-5 py-4 font-semibold text-slate-500 text-xs uppercase tracking-wider">Created</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-50">
                {(accounts || []).length === 0 ? (
                  <tr><td colSpan={4} className="text-center py-16 text-slate-400">
                    <Shield size={32} className="mx-auto mb-2 opacity-30" />
                    <p>No barangay accounts yet. Create one above.</p>
                  </td></tr>
                ) : (
                  (accounts || []).map((a) => (
                    <tr key={a.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-5 py-3.5 font-semibold text-slate-900">{a.username}</td>
                      <td className="px-5 py-3.5">
                        <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100">Barangay Official</span>
                      </td>
                      <td className="px-5 py-3.5 text-slate-600">{a.barangay_name || '—'}</td>
                      <td className="px-5 py-3.5 text-xs text-slate-500">{a.created_at || '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Create Barangay Account" subtitle="This account will only manage their assigned barangay">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Username *</label>
            <input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} className="input" placeholder="e.g. brgy_poblacion" />
            {errors.username && <p className="text-xs text-red-500 mt-1">{errors.username}</p>}
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Password *</label>
            <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="input" placeholder="Min 6 characters" />
            {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password}</p>}
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Assign Barangay *</label>
            <select value={form.barangay_id} onChange={(e) => setForm({ ...form, barangay_id: e.target.value })} className="select w-full">
              <option value="">— Select barangay —</option>
              {(barangays || []).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            {errors.barangay_id && <p className="text-xs text-red-500 mt-1">{errors.barangay_id}</p>}
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={() => setModalOpen(false)} className="flex-1 btn-secondary">Cancel</button>
          <button
            onClick={() => createMutation.mutate({ username: form.username.trim(), password: form.password, role: 'Barangay_Official', barangay_id: form.barangay_id })}
            disabled={createMutation.isPending || !form.username.trim() || !form.password || !form.barangay_id}
            className="flex-1 btn-primary"
          >
            {createMutation.isPending ? 'Creating...' : 'Create Account'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
