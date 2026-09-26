import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MapPin } from 'lucide-react';
import api from '../../lib/api';
import { useAuthStore } from '../../stores/authStore';
import { formatDate, formatCoord } from '../../lib/utils';
import { isInsideBarangay } from '../../lib/geo';
import { BARANGAY_ID_MAP } from '../../data/barangayBoundaries';
import { TableSkeleton } from '../../components/Skeleton';
import Badge from '../../components/Badge';
import SearchInput from '../../components/SearchInput';

export default function BrgyEvacuees() {
  const user = useAuthStore((s) => s.user);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');

  // Fetch all located evacuees city-wide so anyone currently inside this
  // barangay's border shows up, even if registered in another barangay.
  const { data: evacuees, isLoading } = useQuery({
    queryKey: ['brgy-evacuees-list', statusFilter],
    queryFn: async () => {
      const params = { scope: 'jurisdiction' };
      if (statusFilter) params.status = statusFilter;
      const { data } = await api.get('/users/list-all', { params });
      return data.data || [];
    },
  });

  const barangayName = BARANGAY_ID_MAP[user?.barangay_id] || user?.barangay_name || null;

  const filtered = (evacuees || [])
    // Jurisdiction by CURRENT location: only evacuees whose live GPS is inside
    // this barangay's boundary.
    .filter((u) => isInsideBarangay(u.latitude, u.longitude, barangayName))
    .filter((u) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return u.full_name?.toLowerCase().includes(q) || u.contact_no?.includes(q);
    });

  return (
    <div className="p-4 lg:p-8 space-y-6">
      <p className="text-sm text-slate-500">Residents in your barangay jurisdiction</p>

      <div className="card p-5 flex flex-wrap gap-3 items-center">
        <SearchInput placeholder="Search name, contact..." onSearch={setSearch} className="w-72" />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="select">
          <option value="">All Statuses</option>
          <option value="Safe">Safe</option><option value="Need_Assistance">Need Assistance</option><option value="In_Danger">In Danger</option>
        </select>
        <span className="ml-auto text-sm text-slate-500 font-medium">{filtered.length} evacuees</span>
      </div>

      <div className="card overflow-hidden">
        {isLoading ? <TableSkeleton rows={8} cols={5} /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-slate-100">
                <th className="text-left px-5 py-4 font-semibold text-slate-500 text-xs uppercase tracking-wider">Name</th>
                <th className="text-left px-5 py-4 font-semibold text-slate-500 text-xs uppercase tracking-wider">Status</th>
                <th className="text-left px-5 py-4 font-semibold text-slate-500 text-xs uppercase tracking-wider">Contact</th>
                <th className="text-left px-5 py-4 font-semibold text-slate-500 text-xs uppercase tracking-wider">Location</th>
                <th className="text-left px-5 py-4 font-semibold text-slate-500 text-xs uppercase tracking-wider">Last GPS</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.length === 0 ? <tr><td colSpan={5} className="text-center py-16 text-slate-400">No evacuees found</td></tr> :
                  filtered.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-5 py-3.5 font-semibold text-slate-900">{u.full_name}</td>
                      <td className="px-5 py-3.5"><Badge status={u.status} /></td>
                      <td className="px-5 py-3.5 text-slate-600">{u.contact_no || '—'}</td>
                      <td className="px-5 py-3.5">
                        {u.latitude && u.longitude ? (
                          <span className="inline-flex items-center gap-1 font-mono text-xs text-slate-500 bg-slate-50 px-2 py-1 rounded-md">
                            <MapPin size={10} />{formatCoord(u.latitude)}, {formatCoord(u.longitude)}
                          </span>
                        ) : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-5 py-3.5 text-xs text-slate-500">{formatDate(u.last_location_at)}</td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
