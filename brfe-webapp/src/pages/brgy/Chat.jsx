
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Radio, Send, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../lib/api';
import { formatDate, cn } from '../../lib/utils';
import Modal from '../../components/Modal';

export default function BrgyChat() {
  const queryClient = useQueryClient();
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeBody, setComposeBody] = useState('');
  const [filter, setFilter] = useState('all');

  const { data: feed, isLoading } = useQuery({
    queryKey: ['brgy-broadcasts'],
    queryFn: async () => {
      const { data } = await api.get('/chat/thread_lgu', { params: { feed: 1 } });
      return (data.data || []).filter(m => m.msg_type === 'broadcast' || m.msg_type === 'announcement');
    },
    refetchInterval: 3000,
  });

  const broadcastMutation = useMutation({
    mutationFn: (payload) => api.post('/chat/broadcast', payload),
    onSuccess: (res) => {
      if (res.data.error) { toast.error(res.data.message); return; }
      toast.success(`Broadcast sent to ${res.data.sent_to || 0} evacuees`);
      setComposeOpen(false);
      setComposeBody('');
      queryClient.invalidateQueries({ queryKey: ['brgy-broadcasts'] });
    },
    onError: () => toast.error('Failed to send broadcast'),
  });

  return (
    <div className="p-4 lg:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500">Send announcements to evacuees in your barangay jurisdiction</p>
        </div>
        <button
          onClick={() => setComposeOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl transition-colors"
        >
          <Radio size={16} /> New Broadcast
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {['all', 'lgu', 'barangay'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-semibold transition-all',
              filter === f ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
            )}
          >
            {f === 'all' ? 'All' : f === 'lgu' ? 'LGU Announcements' : 'My Broadcasts'}
          </button>
        ))}
      </div>

      {/* Feed */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="card p-8 text-center text-slate-400 text-sm">Loading...</div>
        ) : (() => {
          const filtered = (feed || []).filter((m) => {
            if (filter === 'lgu') return m.sender_role === 'LGU_Admin';
            if (filter === 'barangay') return m.sender_role === 'Barangay_Official';
            return true;
          });
          return filtered.length === 0 ? (
          <div className="card p-12 text-center">
            <Radio size={32} className="text-slate-200 mx-auto mb-3" />
            <p className="text-slate-400 text-sm">No broadcasts yet</p>
            <p className="text-slate-300 text-xs mt-1">Send your first broadcast to evacuees in your barangay</p>
          </div>
        ) : (
          filtered.map((m) => {
            const isAnnouncement = m.msg_type === 'announcement';
            return (
              <div key={m.id} className="card p-5 animate-slide-up">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={cn(
                        'text-[10px] font-bold px-2 py-0.5 rounded-full ring-1',
                        isAnnouncement
                          ? 'bg-orange-50 text-orange-600 ring-orange-100'
                          : 'bg-emerald-50 text-emerald-600 ring-emerald-100'
                      )}>
                        {isAnnouncement ? '📣 Announcement' : '📢 Broadcast'}
                      </span>
                      <span className="text-xs text-slate-400">
                        {m.sender_name}{m.sender_barangay ? ` · ${m.sender_barangay}` : ''}
                      </span>
                      {m.sender_role === 'LGU_Admin' && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-50 text-red-500">LGU</span>
                      )}
                    </div>
                    <p className="text-sm text-slate-800 leading-relaxed">{m.body}</p>
                  </div>
                  <span className="text-[11px] text-slate-400 whitespace-nowrap ml-4">{formatDate(m.sent_at)}</span>
                </div>
                {m.expires_at && <p className="text-[11px] text-orange-500 mt-2">Expires: {formatDate(m.expires_at)}</p>}
              </div>
            );
          })
        );
        })()}
      </div>

      {/* Compose Modal */}
      <Modal open={composeOpen} onClose={() => setComposeOpen(false)} title="📢 Send Broadcast" subtitle="Sent to all evacuees in your barangay jurisdiction">
        <textarea
          value={composeBody}
          onChange={(e) => setComposeBody(e.target.value)}
          rows={4}
          placeholder="Type your announcement message..."
          className="input resize-none mb-4"
          maxLength={1000}
        />
        <div className="flex gap-3">
          <button onClick={() => setComposeOpen(false)} className="flex-1 btn-secondary">Cancel</button>
          <button
            onClick={() => broadcastMutation.mutate({ body: composeBody.trim(), msg_type: 'broadcast', expires_at: null })}
            disabled={broadcastMutation.isPending || !composeBody.trim()}
            className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            {broadcastMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            {broadcastMutation.isPending ? 'Sending...' : 'Send Broadcast'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
