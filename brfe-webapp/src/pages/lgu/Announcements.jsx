import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Megaphone, Send, Radio } from 'lucide-react';
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

  const { data: feed, isLoading } = useQuery({
    queryKey: ['lgu-announcements'],
    queryFn: async () => {
      const { data } = await api.get('/chat/thread_lgu', { params: { feed: 1 } });
      return data.data || [];
    },
  });

  const sendMutation = useMutation({
    mutationFn: (payload) => api.post('/chat/broadcast', payload),
    onSuccess: (res) => {
      if (res.data.error) { toast.error(res.data.message); return; }
      toast.success(`Sent to ${res.data.sent_to || 0} evacuees`);
      setComposeOpen(false); setBody(''); setExpires('');
      queryClient.invalidateQueries({ queryKey: ['lgu-announcements'] });
    },
    onError: () => toast.error('Failed to send'),
  });

  const announcements = (feed || []).filter((m) => m.msg_type === 'announcement');
  const broadcasts = (feed || []).filter((m) => m.msg_type === 'broadcast');

  return (
    <div className="p-4 lg:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">Post announcements and weather advisories to all residents</p>
        <div className="flex gap-3">
          <button onClick={() => { setComposeType('broadcast'); setComposeOpen(true); }} className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl transition-colors">
            <Radio size={16} /> Broadcast
          </button>
          <button onClick={() => { setComposeType('announcement'); setComposeOpen(true); }} className="inline-flex items-center gap-2 px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-xl transition-colors">
            <Megaphone size={16} /> Announcement
          </button>
        </div>
      </div>

      {/* Announcements */}
      <div>
        <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2"><Megaphone size={16} className="text-orange-500" /> Announcements</h3>
        {isLoading ? <TableSkeleton rows={3} cols={3} /> : (
          <div className="space-y-3">
            {announcements.length === 0 ? <div className="card p-8 text-center text-slate-400 text-sm">No announcements yet</div> :
              announcements.map((m) => (
                <div key={m.id} className="card p-5 animate-slide-up">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-50 text-orange-600 ring-1 ring-orange-100">Announcement</span>
                        <span className="text-xs text-slate-400">{m.sender_name}</span>
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

      {/* Broadcasts */}
      <div>
        <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2"><Radio size={16} className="text-emerald-500" /> Broadcasts</h3>
        <div className="space-y-3">
          {broadcasts.length === 0 ? <div className="card p-8 text-center text-slate-400 text-sm">No broadcasts yet</div> :
            broadcasts.map((m) => (
              <div key={m.id} className="card p-5 animate-slide-up">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100">Broadcast</span>
                      <span className="text-xs text-slate-400">{m.sender_name}</span>
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

      {/* Compose Modal */}
      <Modal open={composeOpen} onClose={() => setComposeOpen(false)} title={composeType === 'announcement' ? '📣 New Announcement' : '📢 New Broadcast'} subtitle={composeType === 'announcement' ? 'Sent to ALL evacuees city-wide' : 'Sent to all evacuees and barangay officials'}>
        <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} placeholder="Type your message..." className="input resize-none mb-4" />
        <div className="mb-6">
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">Expires at <span className="font-normal text-slate-400">(optional)</span></label>
          <input type="datetime-local" value={expires} onChange={(e) => setExpires(e.target.value)} className="input" />
        </div>
        <div className="flex gap-3">
          <button onClick={() => setComposeOpen(false)} className="flex-1 btn-secondary">Cancel</button>
          <button
            onClick={() => sendMutation.mutate({ body: body.trim(), msg_type: composeType, expires_at: expires || null })}
            disabled={sendMutation.isPending || !body.trim()}
            className={cn('flex-1 text-white font-semibold py-2.5 rounded-xl transition-colors disabled:opacity-50', composeType === 'announcement' ? 'bg-orange-500 hover:bg-orange-600' : 'bg-emerald-600 hover:bg-emerald-700')}
          >
            {sendMutation.isPending ? 'Sending...' : 'Send'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
