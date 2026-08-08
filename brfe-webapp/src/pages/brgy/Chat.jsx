import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MessageCircle, Send, Loader2, MessageSquare, Radio } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../lib/api';
import { formatDate, cn } from '../../lib/utils';
import Modal from '../../components/Modal';

export default function BrgyChat() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('chat');
  const [activeUser, setActiveUser] = useState(null);
  const [msgInput, setMsgInput] = useState('');
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeBody, setComposeBody] = useState('');
  const msgListRef = useRef(null);

  const { data: threads } = useQuery({
    queryKey: ['brgy-threads'],
    queryFn: async () => { const { data } = await api.get('/chat/threads_lgu'); return data.data || []; },
  });

  const { data: messages } = useQuery({
    queryKey: ['brgy-messages', activeUser?.id],
    queryFn: async () => {
      if (!activeUser) return [];
      const { data } = await api.get('/chat/thread_lgu', { params: { with: activeUser.id } });
      return data.data || [];
    },
    enabled: !!activeUser,
  });

  const { data: feed } = useQuery({
    queryKey: ['brgy-feed'],
    queryFn: async () => { const { data } = await api.get('/chat/thread_lgu', { params: { feed: 1 } }); return (data.data || []).filter(m => m.msg_type === 'broadcast'); },
    enabled: activeTab === 'broadcast',
  });

  const sendMutation = useMutation({
    mutationFn: (body) => api.post('/chat/thread_lgu', { recipient_id: activeUser.id, message: body }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['brgy-messages', activeUser?.id] }); queryClient.invalidateQueries({ queryKey: ['brgy-threads'] }); },
  });

  const broadcastMutation = useMutation({
    mutationFn: (payload) => api.post('/chat/broadcast', payload),
    onSuccess: (res) => {
      if (res.data.error) { toast.error(res.data.message); return; }
      toast.success(`Broadcast sent to ${res.data.sent_to || 0} evacuees`);
      setComposeOpen(false); setComposeBody('');
      queryClient.invalidateQueries({ queryKey: ['brgy-feed'] });
    },
  });

  useEffect(() => { if (msgListRef.current) msgListRef.current.scrollTop = msgListRef.current.scrollHeight; }, [messages]);

  function handleSend(e) {
    e.preventDefault();
    if (!msgInput.trim() || !activeUser) return;
    sendMutation.mutate(msgInput.trim());
    setMsgInput('');
  }

  return (
    <div className="flex h-[calc(100vh-72px)] overflow-hidden bg-white">
      {/* Sidebar */}
      <div className="w-[300px] border-r border-slate-100 flex flex-col shrink-0 bg-slate-50/50">
        <div className="flex border-b border-slate-100 bg-white">
          <button onClick={() => setActiveTab('chat')} className={cn('flex-1 py-3.5 text-xs font-semibold text-center transition-all relative', activeTab === 'chat' ? 'text-emerald-700' : 'text-slate-500 hover:text-slate-700')}>
            <MessageCircle size={14} className="inline mr-1.5" />Messages
            {activeTab === 'chat' && <div className="absolute bottom-0 left-4 right-4 h-0.5 bg-emerald-600 rounded-full" />}
          </button>
          <button onClick={() => setActiveTab('broadcast')} className={cn('flex-1 py-3.5 text-xs font-semibold text-center transition-all relative', activeTab === 'broadcast' ? 'text-emerald-700' : 'text-slate-500 hover:text-slate-700')}>
            <Radio size={14} className="inline mr-1.5" />Broadcasts
            {activeTab === 'broadcast' && <div className="absolute bottom-0 left-4 right-4 h-0.5 bg-emerald-600 rounded-full" />}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {activeTab === 'chat' ? (
            (threads || []).length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-400"><MessageSquare size={32} className="mb-2 opacity-40" /><p className="text-sm">No conversations</p></div>
            ) : (threads || []).map((t) => (
              <button key={t.id} onClick={() => setActiveUser({ id: t.id, name: t.full_name })} className={cn('w-full text-left px-5 py-4 border-b border-slate-100/80 transition-all', activeUser?.id === t.id ? 'bg-emerald-50 border-l-[3px] border-l-emerald-600' : 'hover:bg-white')}>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center shrink-0"><span className="text-xs font-bold text-slate-600">{t.full_name?.[0]?.toUpperCase()}</span></div>
                  <div className="min-w-0 flex-1"><p className="font-semibold text-slate-900 text-sm truncate">{t.full_name}</p><p className="text-xs text-slate-400 truncate mt-0.5">{t.last_message || 'No messages'}</p></div>
                </div>
              </button>
            ))
          ) : (
            (feed || []).length === 0 ? <p className="text-center py-12 text-slate-400 text-sm">No broadcasts</p> :
            <div className="p-4 space-y-3">{(feed || []).map((m) => (
              <div key={m.id} className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
                <p className="text-sm text-slate-800">{m.body}</p>
                <p className="text-[11px] text-slate-400 mt-2">{formatDate(m.sent_at)}</p>
              </div>
            ))}</div>
          )}
        </div>

        <div className="p-4 border-t border-slate-100 bg-white">
          <button onClick={() => setComposeOpen(true)} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors">📢 Send Broadcast</button>
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {activeTab === 'chat' && activeUser ? (
          <>
            <div className="px-6 py-4 border-b border-slate-100 bg-white flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-100 to-teal-200 flex items-center justify-center"><span className="text-xs font-bold text-emerald-700">{activeUser.name?.[0]?.toUpperCase()}</span></div>
              <div><p className="font-semibold text-slate-900 text-sm">{activeUser.name}</p><p className="text-[11px] text-slate-400">Evacuee</p></div>
            </div>
            <div ref={msgListRef} className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50/50">
              {(messages || []).length === 0 ? <p className="text-center text-slate-400 text-sm pt-12">No messages yet</p> :
                (messages || []).map((m) => {
                  const isLgu = m.sender_type === 'lgu';
                  return (
                    <div key={m.id} className={cn('flex', isLgu ? 'justify-end' : 'justify-start')}>
                      <div className="max-w-[70%]">
                        <div className={cn('rounded-2xl px-4 py-3 shadow-sm', isLgu ? 'bg-emerald-600 text-white rounded-br-md' : 'bg-white text-slate-900 border border-slate-200 rounded-bl-md')}>
                          <p className="text-[13px] leading-relaxed">{m.body}</p>
                        </div>
                        <p className={cn('text-[10px] mt-1 px-1', isLgu ? 'text-right text-slate-400' : 'text-slate-400')}>{formatDate(m.sent_at)}</p>
                      </div>
                    </div>
                  );
                })
              }
            </div>
            <form onSubmit={handleSend} className="p-4 bg-white border-t border-slate-100 flex gap-3">
              <input value={msgInput} onChange={(e) => setMsgInput(e.target.value)} placeholder="Type a message..." maxLength={500} className="input flex-1" />
              <button type="submit" disabled={!msgInput.trim() || sendMutation.isPending} className="btn-primary px-4">
                {sendMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              </button>
            </form>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-slate-50/50">
            <div className="text-center"><div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4"><MessageCircle size={28} className="text-slate-300" /></div><p className="text-sm text-slate-400 font-medium">Select a conversation</p></div>
          </div>
        )}
      </div>

      <Modal open={composeOpen} onClose={() => setComposeOpen(false)} title="📢 Send Broadcast" subtitle="Sent to evacuees in your barangay">
        <textarea value={composeBody} onChange={(e) => setComposeBody(e.target.value)} rows={4} placeholder="Type your message..." className="input resize-none mb-4" />
        <div className="flex gap-3">
          <button onClick={() => setComposeOpen(false)} className="flex-1 btn-secondary">Cancel</button>
          <button onClick={() => broadcastMutation.mutate({ body: composeBody.trim(), msg_type: 'broadcast', expires_at: null })} disabled={broadcastMutation.isPending || !composeBody.trim()} className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl transition-colors">
            {broadcastMutation.isPending ? 'Sending...' : 'Send'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
