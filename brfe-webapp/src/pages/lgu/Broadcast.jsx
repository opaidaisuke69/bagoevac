import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Radio, Send, Loader2, Megaphone } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../lib/api';
import { formatDate, cn } from '../../lib/utils';
import { TableSkeleton } from '../../components/Skeleton';

export default function LguBroadcast() {
  const queryClient = useQueryClient();
  const [body, setBody] = useState('');
  const [targetBarangay, setTargetBarangay] = useState('');
  const [expires, setExpires] = useState('');

  const { data: feed, isLoading } = useQuery({
    queryKey: ['lgu-broadcasts'],
    queryFn: async () => {
      const { data } = await api.get('/chat/thread_lgu', { params: { feed: 1 } });
      return data.data || [];
    },
    refetchInterval: 3000,
  });

  const { data: barangays } = useQuery({
    queryKey: ['barangays-list'],
    queryFn: async () => { const { data } = await api.get('/barangays/list'); return data.data || []; },
    staleTime: 60000,
  });

  const sendMutation = useMutation({
    mutationFn: (payload) => api.post('/chat/broadcast', payload),
    onSuccess: (res) => {
      if (res.data?.error) { toast.error(res.data.message || 'Failed to send'); return; }
      toast.success(`Broadcast sent to ${res.data.sent_to ?? 0} recipient(s)`);
      setBody(''); setExpires(''); setTargetBarangay('');
      queryClient.invalidateQueries({ queryKey: ['lgu-broadcasts'] });
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to send'),
  });

  function handleSend() {
    if (!body.trim()) return;
    sendMutation.mutate({
      body: body.trim(),
      msg_type: 'broadcast',
      barangay_id: targetBarangay ? parseInt(targetBarangay, 10) : null,
      expires_at: expires || null,
    });
  }

  const broadcasts = (feed || []).filter((m) => m.msg_type === 'broadcast' || m.msg_type === 'announcement');
  const targetLabel = targetBarangay
    ? (barangays || []).find((b) => String(b.id) === String(targetBarangay))?.name || 'Selected barangay'
    : 'All barangays, evacuees & rescuers';

  return (
    <div className="p-4 lg:p-8 space-y-6">
      <p className="text-sm text-slate-500">Send a broadcast to all barangays, evacuees, and rescuers across Bago City</p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Composer */}
        <div className="lg:col-span-1">
          <div className="card p-5 space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center ring-1 ring-emerald-100">
                <Radio size={18} className="text-emerald-600" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 text-sm">New Broadcast</h3>
                <p className="text-[11px] text-slate-400">Reaches every recipient instantly</p>
              </div>
            </div>

            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={5}
              maxLength={1000}
              placeholder="Type your broadcast message..."
              className="input resize-none"
            />
            <p className="text-[11px] text-slate-400 -mt-2 text-right">{body.length}/1000</p>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Target</label>
              <select value={targetBarangay} onChange={(e) => setTargetBarangay(e.target.value)} className="input">
                <option value="">All Barangays (City-wide)</option>
                {(barangays || []).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                Expires at <span className="font-normal text-slate-400">(optional)</span>
              </label>
              <input type="datetime-local" value={expires} onChange={(e) => setExpires(e.target.value)} className="input" />
            </div>

            <div className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-2 text-[11px] text-slate-500">
              Sending to: <span className="font-semibold text-slate-700">{targetLabel}</span>
            </div>

            <button
              onClick={handleSend}
              disabled={sendMutation.isPending || !body.trim()}
              className="w-full inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2.5 rounded-xl transition-colors disabled:opacity-50"
            >
              {sendMutation.isPending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
              {sendMutation.isPending ? 'Sending...' : 'Send Broadcast'}
            </button>
          </div>
        </div>

        {/* History */}
        <div className="lg:col-span-2">
          <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
            <Megaphone size={16} className="text-emerald-500" /> Recent Broadcasts
          </h3>
          {isLoading ? <TableSkeleton rows={4} cols={2} /> : (
            broadcasts.length === 0 ? (
              <div className="card p-10 text-center text-slate-400 text-sm">No broadcasts sent yet</div>
            ) : (
              <div className="space-y-3">
                {broadcasts.map((m) => (
                  <div key={m.id} className="card p-5 animate-slide-up">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100">Broadcast</span>
                          <span className="text-xs text-slate-400">{m.sender_name}</span>
                          {m.barangay_id
                            ? <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-500')}>Targeted</span>
                            : <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">City-wide</span>}
                        </div>
                        <p className="text-sm text-slate-800 leading-relaxed break-words">{m.body}</p>
                        {m.expires_at && <p className="text-[11px] text-orange-500 mt-2">Expires: {formatDate(m.expires_at)}</p>}
                      </div>
                      <span className="text-[11px] text-slate-400 whitespace-nowrap">{formatDate(m.sent_at)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
