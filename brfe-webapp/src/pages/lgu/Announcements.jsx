import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Megaphone, Send, Radio, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../lib/api';
import { formatDate, cn } from '../../lib/utils';
import { TableSkeleton } from '../../components/Skeleton';
import Modal from '../../components/Modal';

export default function LguAnnouncements() {
  const queryClient = useQueryClient();
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeType, setComposeType] = useState('announcement');
  const [body, setBody] = useState('');
  const [expires, setExpires] = useState('');
  const [targetBarangay, setTargetBarangay] = useState('');
  const [filterTab, setFilterTab] = useState('all');

  const { data: feed, isLoading } = useQuery({
    queryKey: ['lgu-announcements'],
    queryFn: async () => {
      const { data } = await api.get('/chat/thread_lgu', { params: { feed: 1 } });
      return data.data || [];
    },
    refetchInterval: 3000,
  });

  const { data: barangays } = useQuery({
    queryKey: ['barangays-list'],
    queryFn: async () => {
      const { data } = await api.get('/barangays/list');
      return data.data || [];
    },
  });

  const sendMutation = useMutation({
    mutationFn: (payload) => api.post('/chat/broadcast', payload),
    onSuccess: (res) => {
      if (res.data.error) { toast.error(res.data.message); return; }
      toast.success(`Sent to ${res.data.sent_to || 0} recipients`);
      setComposeOpen(false); setBody(''); setExpires(''); setTargetBarangay('');
      queryClient.invalidateQueries({ queryKey: ['lgu-announcements'] });
    },
    onError: () => toast.error('Failed to send'),
  });

  const announcements = (feed || []).filter((m) => m.msg_type === 'announcement');
  const broadcasts = (feed || []).filter((m) => m.msg_type === 'broadcast');

  // Apply filter
  const filteredAnnouncements = filterTab === 'broadcast' ? [] : announcements;
  const filteredBroadcasts = filterTab === 'announcement' ? [] : broadcasts;

  function handleSend() {
    const payload = {
      body: body.trim(),
      msg_type: composeType,
      expires_at: expires || null,
      barangay_id: targetBarangay ? parseInt(targetBarangay) : null,
    };
    sendMutation.mutate(payload);
  }

  return (
    <div className="p-4 lg:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">Send announcements and broadcasts to all residents or specific barangays</p>
        <div className="flex gap-3">
          <button onClick={() => { setComposeType('broadcast'); setComposeOpen(true); }} className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl transition-colors">
            <Radio size={16} /> Broadcast
          </button>
          <button onClick={() => { setComposeType('announcement'); setComposeOpen(true); }} className="inline-flex items-center gap-2 px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-xl transition-colors">
            <Megaphone size={16} /> Announcement
          </button>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {[
          { key: 'all', label: 'All' },
          { key: 'announcement', label: 'Announcements' },
          { key: 'broadcast', label: 'Broadcasts' },
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => setFilterTab(f.key)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-semibold transition-all',
              filterTab === f.key ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Announcements */}
      {filteredAnnouncements.length > 0 && (
      <div>
        <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2"><Megaphone size={16} className="text-orange-500" /> Announcements</h3>
        {isLoading ? <TableSkeleton rows={3} cols={3} /> : (
          <div className="space-y-3">
            {filteredAnnouncements.length === 0 ? <div className="card p-8 text-center text-slate-400 text-sm">No announcements yet</div> :
              filteredAnnouncements.map((m) => (
                <div key={m.id} className="card p-5 animate-slide-up">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-50 text-orange-600 ring-1 ring-orange-100">Announcement</span>
                        <span className="text-xs text-slate-400">{m.sender_name}</span>
                        {m.sender_barangay && <span className="text-[10px] text-slate-400">· {m.sender_barangay}</span>}
                        {m.barangay_id && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-500">Targeted</span>}
                      </div>
                      <p className="text-sm text-slate-800 leading-relaxed">{m.body}</p>
                    </div>
                    <span className="text-[11px] text-slate-400 whitespace-nowrap ml-4">{formatDate(m.sent_at)}</span>
                  </div>
                  {m.expires_at && <p className="text-[11px] text-orange-500 mt-2">Expires: {formatDate(m.expires_at)}</p>}
                </div>
              ))
            }
          </div>
        )}
      </div>
      )}

      {/* Broadcasts */}
      {filteredBroadcasts.length > 0 && (
      <div>
        <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2"><Radio size={16} className="text-emerald-500" /> Broadcasts</h3>
        <div className="space-y-3">
          {filteredBroadcasts.length === 0 ? <div className="card p-8 text-center text-slate-400 text-sm">No broadcasts yet</div> :
            filteredBroadcasts.map((m) => (
              <div key={m.id} className="card p-5 animate-slide-up">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100">Broadcast</span>
                      <span className="text-xs text-slate-400">{m.sender_name}</span>
                      {m.sender_barangay && <span className="text-[10px] text-slate-400">· {m.sender_barangay}</span>}
                      {m.barangay_id && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-500">Targeted</span>}
                    </div>
                    <p className="text-sm text-slate-800 leading-relaxed">{m.body}</p>
                  </div>
                  <span className="text-[11px] text-slate-400 whitespace-nowrap ml-4">{formatDate(m.sent_at)}</span>
                </div>
              </div>
            ))
          }
        </div>
      </div>
      )}

      {/* Compose Modal */}
      <Modal open={composeOpen} onClose={() => setComposeOpen(false)} title={composeType === 'announcement' ? '📣 New Announcement' : '📢 New Broadcast'} subtitle="Choose target audience below">
        <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} placeholder="Type your message..." className="input resize-none mb-4" maxLength={1000} />

        {/* Target selector */}
        <div className="mb-4">
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">Target</label>
          <select
            value={targetBarangay}
            onChange={(e) => setTargetBarangay(e.target.value)}
            className="input"
          >
            <option value="">All Barangays (City-wide)</option>
            {(barangays || []).map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">Expires at <span className="font-normal text-slate-400">(optional)</span></label>
          <input type="datetime-local" value={expires} onChange={(e) => setExpires(e.target.value)} className="input" />
        </div>

        <div className="flex gap-3">
          <button onClick={() => setComposeOpen(false)} className="flex-1 btn-secondary">Cancel</button>
          <button
            onClick={handleSend}
            disabled={sendMutation.isPending || !body.trim()}
            className={cn('flex-1 text-white font-semibold py-2.5 rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2', composeType === 'announcement' ? 'bg-orange-500 hover:bg-orange-600' : 'bg-emerald-600 hover:bg-emerald-700')}
          >
            {sendMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            {sendMutation.isPending ? 'Sending...' : 'Send'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
