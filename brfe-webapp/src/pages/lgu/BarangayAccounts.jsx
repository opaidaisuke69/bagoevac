import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { UserPlus, Shield, Users, Building2, Truck } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../lib/api';
import { cn, formatDate } from '../../lib/utils';
import { TableSkeleton } from '../../components/Skeleton';
import Modal from '../../components/Modal';
import Badge from '../../components/Badge';

const TABS = [
  { key: 'barangay', label: 'Barangay Officials', icon: Building2 },
  { key: 'evacuees', label: 'Evacuees', icon: Users },
  { key: 'rescuers', label: 'Rescuers', icon: Truck },
];

export default function LguBarangayAccounts() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState('barangay');

  // Create Barangay Official modal (LGU admin only creates officials;
  // rescuers and evacuees are created on the barangay side).
  const [acctModal, setAcctModal] = useState(false);
  const [acctForm, setAcctForm] = useState({ username: '', password: '', barangay_id: '' });
  const [errors, setErrors] = useState({});

  const { data: barangays } = useQuery({
    queryKey: ['barangays'],
    queryFn: async () => { const { data } = await api.get('/barangays/list'); return data.data || []; },
    staleTime: 60000, refetchInterval: false,
  });

  const { data: officials, isLoading: loadingOfficials } = useQuery({
    queryKey: ['lgu-accounts', 'Barangay_Official'],
    queryFn: async () => { const { data } = await api.get('/lgu/accounts', { params: { role: 'Barangay_Official' } }); return data.data || []; },
    refetchInterval: 30000,
  });

  const { data: rescuers, isLoading: loadingRescuers } = useQuery({
    queryKey: ['lgu-accounts', 'Rescuer'],
    queryFn: async () => { const { data } = await api.get('/lgu/accounts', { params: { role: 'Rescuer' } }); return data.data || []; },
    refetchInterval: 30000,
  });

  const { data: evacuees, isLoading: loadingEvacuees } = useQuery({
    queryKey: ['lgu-evacuees-accounts'],
    queryFn: async () => { const { data } = await api.get('/users/list-all'); return data.data || []; },
    refetchInterval: 15000,
  });

  const createAcct = useMutation({
    mutationFn: (payload) => api.post('/lgu/create-account', payload),
    onSuccess: (res) => {
      if (res.data?.error) { if (res.data.fields) setErrors(res.data.fields); else toast.error(res.data.message || 'Failed'); return; }
      toast.success('Barangay official created');
      queryClient.invalidateQueries({ queryKey: ['lgu-accounts'] });
      setAcctModal(false); setAcctForm({ username: '', password: '', barangay_id: '' }); setErrors({});
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to create account'),
  });

  return (
    <div className="p-4 lg:p-8 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <p className="text-sm text-slate-500">Monitor accounts across Bago City</p>
        {tab === 'barangay' && (
          <button onClick={() => { setAcctForm({ username: '', password: '', barangay_id: '' }); setErrors({}); setAcctModal(true); }} className="btn-primary inline-flex items-center gap-2 text-sm">
            <UserPlus size={16} /> Add Barangay Official
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200">
        {TABS.map((t) => {
          const count = t.key === 'barangay' ? officials?.length : t.key === 'rescuers' ? rescuers?.length : evacuees?.length;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                'inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors',
                tab === t.key ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-700'
              )}
            >
              <t.icon size={15} />
              {t.label}
              {count != null && (
                <span className={cn('text-[11px] px-1.5 py-0.5 rounded-md', tab === t.key ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500')}>{count}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Barangay Officials */}
      {tab === 'barangay' && (
        <div className="card overflow-hidden">
          {loadingOfficials ? <TableSkeleton rows={5} cols={4} /> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-slate-100">
                  <th className="text-left px-5 py-4 font-semibold text-slate-500 text-xs uppercase tracking-wider">Username</th>
                  <th className="text-left px-5 py-4 font-semibold text-slate-500 text-xs uppercase tracking-wider">Role</th>
                  <th className="text-left px-5 py-4 font-semibold text-slate-500 text-xs uppercase tracking-wider">Barangay</th>
                  <th className="text-left px-5 py-4 font-semibold text-slate-500 text-xs uppercase tracking-wider">Created</th>
                </tr></thead>
                <tbody className="divide-y divide-slate-50">
                  {(officials || []).length === 0 ? (
                    <tr><td colSpan={4} className="text-center py-16 text-slate-400"><Shield size={32} className="mx-auto mb-2 opacity-30" /><p>No barangay officials yet.</p></td></tr>
                  ) : (officials || []).map((a) => (
                    <tr key={a.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-5 py-3.5 font-semibold text-slate-900">{a.username}</td>
                      <td className="px-5 py-3.5"><span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100">Barangay Official</span></td>
                      <td className="px-5 py-3.5 text-slate-600">{a.barangay_name || '—'}</td>
                      <td className="px-5 py-3.5 text-xs text-slate-500">{formatDate(a.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Rescuers (view-only — created by Barangay Officials) */}
      {tab === 'rescuers' && (
        <div className="card overflow-hidden">
          {loadingRescuers ? <TableSkeleton rows={5} cols={4} /> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-slate-100">
                  <th className="text-left px-5 py-4 font-semibold text-slate-500 text-xs uppercase tracking-wider">Username</th>
                  <th className="text-left px-5 py-4 font-semibold text-slate-500 text-xs uppercase tracking-wider">Role</th>
                  <th className="text-left px-5 py-4 font-semibold text-slate-500 text-xs uppercase tracking-wider">Barangay</th>
                  <th className="text-left px-5 py-4 font-semibold text-slate-500 text-xs uppercase tracking-wider">Created</th>
                </tr></thead>
                <tbody className="divide-y divide-slate-50">
                  {(rescuers || []).length === 0 ? (
                    <tr><td colSpan={4} className="text-center py-16 text-slate-400"><Truck size={32} className="mx-auto mb-2 opacity-30" /><p>No rescuers yet.</p></td></tr>
                  ) : (rescuers || []).map((a) => (
                    <tr key={a.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-5 py-3.5 font-semibold text-slate-900">{a.username}</td>
                      <td className="px-5 py-3.5"><span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 ring-1 ring-blue-100">Rescuer</span></td>
                      <td className="px-5 py-3.5 text-slate-600">{a.barangay_name || '—'}</td>
                      <td className="px-5 py-3.5 text-xs text-slate-500">{formatDate(a.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Evacuees (view-only — registered via the mobile app / barangay) */}
      {tab === 'evacuees' && (
        <div className="card overflow-hidden">
          {loadingEvacuees ? <TableSkeleton rows={6} cols={5} /> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-slate-100">
                  <th className="text-left px-5 py-4 font-semibold text-slate-500 text-xs uppercase tracking-wider">Name</th>
                  <th className="text-left px-5 py-4 font-semibold text-slate-500 text-xs uppercase tracking-wider">Barangay</th>
                  <th className="text-left px-5 py-4 font-semibold text-slate-500 text-xs uppercase tracking-wider">Status</th>
                  <th className="text-left px-5 py-4 font-semibold text-slate-500 text-xs uppercase tracking-wider">Contact</th>
                  <th className="text-left px-5 py-4 font-semibold text-slate-500 text-xs uppercase tracking-wider">Age</th>
                </tr></thead>
                <tbody className="divide-y divide-slate-50">
                  {(evacuees || []).length === 0 ? (
                    <tr><td colSpan={5} className="text-center py-16 text-slate-400"><Users size={32} className="mx-auto mb-2 opacity-30" /><p>No evacuees registered.</p></td></tr>
                  ) : (evacuees || []).map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-5 py-3.5 font-semibold text-slate-900">{u.full_name}</td>
                      <td className="px-5 py-3.5 text-slate-600">{u.barangay_name || '—'}</td>
                      <td className="px-5 py-3.5"><Badge status={u.status} /></td>
                      <td className="px-5 py-3.5 text-slate-600">{u.contact_no || '—'}</td>
                      <td className="px-5 py-3.5 text-slate-600">{u.age || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Create Barangay Official modal */}
      <Modal
        open={acctModal}
        onClose={() => setAcctModal(false)}
        title="Create Barangay Official"
        subtitle="This account is assigned to a single barangay"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Username *</label>
            <input value={acctForm.username} onChange={(e) => setAcctForm({ ...acctForm, username: e.target.value })} className="input" placeholder="e.g. brgy_poblacion" />
            {errors.username && <p className="text-xs text-red-500 mt-1">{errors.username}</p>}
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Password *</label>
            <input type="password" value={acctForm.password} onChange={(e) => setAcctForm({ ...acctForm, password: e.target.value })} className="input" placeholder="Min 6 characters" />
            {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password}</p>}
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Assign Barangay *</label>
            <select value={acctForm.barangay_id} onChange={(e) => setAcctForm({ ...acctForm, barangay_id: e.target.value })} className="select w-full">
              <option value="">— Select barangay —</option>
              {(barangays || []).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            {errors.barangay_id && <p className="text-xs text-red-500 mt-1">{errors.barangay_id}</p>}
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={() => setAcctModal(false)} className="flex-1 btn-secondary">Cancel</button>
          <button
            onClick={() => createAcct.mutate({ username: acctForm.username.trim(), password: acctForm.password, role: 'Barangay_Official', barangay_id: acctForm.barangay_id })}
            disabled={createAcct.isPending || !acctForm.username.trim() || !acctForm.password || !acctForm.barangay_id}
            className="flex-1 btn-primary"
          >
            {createAcct.isPending ? 'Creating...' : 'Create Account'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
