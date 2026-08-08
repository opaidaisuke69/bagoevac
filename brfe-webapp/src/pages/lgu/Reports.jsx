import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, Image as ImageIcon, ZoomIn } from 'lucide-react';
import api from '../../lib/api';
import { formatDate } from '../../lib/utils';
import { TableSkeleton, CardSkeleton } from '../../components/Skeleton';
import Badge from '../../components/Badge';
import SearchInput from '../../components/SearchInput';

export default function LguReports() {
  const [levelFilter, setLevelFilter] = useState('');
  const [barangayFilter, setBarangayFilter] = useState('');
  const [search, setSearch] = useState('');
  const [lightbox, setLightbox] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ['lgu-reports', levelFilter, barangayFilter],
    queryFn: async () => {
      const params = {};
      if (levelFilter) params.flood_level = levelFilter;
      if (barangayFilter) params.barangay_id = barangayFilter;
      const { data } = await api.get('/reports/list_lgu', { params });
      return data;
    },
  });

  const { data: barangays } = useQuery({
    queryKey: ['barangays'],
    queryFn: async () => { const { data } = await api.get('/barangays/list'); return data.data || []; },
    staleTime: 60000, refetchInterval: false,
  });

  const reports = data?.data || [];
  const counts = data?.counts || {};
  const filtered = reports.filter((r) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return r.full_name?.toLowerCase().includes(q) || r.description?.toLowerCase().includes(q) || r.barangay_name?.toLowerCase().includes(q);
  });

  const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost/bagoevac/brfe-backend/api';
  const photoBase = API_BASE.replace('/api', '');

  return (
    <div className="p-4 lg:p-8 space-y-6">
      <p className="text-sm text-slate-500">View and monitor disaster reports from all barangays</p>

      {/* Count cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading ? Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />) : (
          <>
            <div className="card p-5 border-l-4 border-l-emerald-500"><p className="text-xs font-semibold text-slate-500">Low</p><p className="text-3xl font-bold text-emerald-600 mt-1">{counts.Low || 0}</p></div>
            <div className="card p-5 border-l-4 border-l-amber-500"><p className="text-xs font-semibold text-slate-500">Moderate</p><p className="text-3xl font-bold text-amber-600 mt-1">{counts.Moderate || 0}</p></div>
            <div className="card p-5 border-l-4 border-l-orange-500"><p className="text-xs font-semibold text-slate-500">High</p><p className="text-3xl font-bold text-orange-600 mt-1">{counts.High || 0}</p></div>
            <div className="card p-5 border-l-4 border-l-red-500"><p className="text-xs font-semibold text-slate-500">Critical</p><p className="text-3xl font-bold text-red-600 mt-1">{counts.Critical || 0}</p></div>
          </>
        )}
      </div>

      {/* Filters */}
      <div className="card p-5 flex flex-wrap gap-3 items-center">
        <SearchInput placeholder="Search reporter, description..." onSearch={setSearch} className="w-72" />
        <select value={levelFilter} onChange={(e) => setLevelFilter(e.target.value)} className="select">
          <option value="">All Levels</option>
          <option value="Low">Low</option><option value="Moderate">Moderate</option><option value="High">High</option><option value="Critical">Critical</option>
        </select>
        <select value={barangayFilter} onChange={(e) => setBarangayFilter(e.target.value)} className="select">
          <option value="">All Barangays</option>
          {(barangays || []).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <span className="ml-auto text-sm text-slate-500 font-medium">{filtered.length} report(s)</span>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {isLoading ? <TableSkeleton rows={6} cols={6} /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-slate-100">
                <th className="text-left px-5 py-4 font-semibold text-slate-500 text-xs uppercase tracking-wider">Level</th>
                <th className="text-left px-5 py-4 font-semibold text-slate-500 text-xs uppercase tracking-wider">Reporter</th>
                <th className="text-left px-5 py-4 font-semibold text-slate-500 text-xs uppercase tracking-wider">Barangay</th>
                <th className="text-left px-5 py-4 font-semibold text-slate-500 text-xs uppercase tracking-wider">Description</th>
                <th className="text-left px-5 py-4 font-semibold text-slate-500 text-xs uppercase tracking-wider">Photo</th>
                <th className="text-left px-5 py-4 font-semibold text-slate-500 text-xs uppercase tracking-wider">Submitted</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.length === 0 ? <tr><td colSpan={6} className="text-center py-16 text-slate-400">No reports found</td></tr> :
                  filtered.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-5 py-3.5"><Badge status={r.flood_level} /></td>
                      <td className="px-5 py-3.5 font-semibold text-slate-900">{r.full_name || '—'}</td>
                      <td className="px-5 py-3.5 text-slate-600">{r.barangay_name || '—'}</td>
                      <td className="px-5 py-3.5 text-slate-600 max-w-[200px]"><p className="truncate text-xs">{r.description}</p></td>
                      <td className="px-5 py-3.5">
                        {r.photo_path ? (
                          <button onClick={() => setLightbox(`${photoBase}/public/${r.photo_path}`)} className="group relative">
                            <img src={`${photoBase}/public/${r.photo_path}`} alt="" className="w-12 h-12 object-cover rounded-xl border border-slate-200 group-hover:opacity-80 transition" />
                          </button>
                        ) : <ImageIcon size={16} className="text-slate-300" />}
                      </td>
                      <td className="px-5 py-3.5 text-xs text-slate-500">{formatDate(r.submitted_at)}</td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
          </div>
        )}
      </div>

      {lightbox && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-6 cursor-pointer animate-fade-in" onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="" className="max-w-full max-h-full rounded-2xl shadow-2xl animate-slide-up" />
        </div>
      )}
    </div>
  );
}
