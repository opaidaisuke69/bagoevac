import { useEffect, useRef, useState, useCallback } from "react";
import {
  View, Text, TextInput, TouchableOpacity, FlatList, Image,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator, StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { API_BASE_URL } from "../../constants/config";
import { getToken } from "../../hooks/use-auth";
import * as WsClient from "../../services/websocket-client";

interface ChatMessage {
  id: number;
  sender_id: number;
  sender_type: string;
  sender_name: string;
  sender_role?: string | null;
  sender_barangay?: string | null;
  avatar_path?: string | null;
  body: string;
  msg_type?: string;
  expires_at?: string | null;
  sent_at: string;
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
    return JSON.parse(atob(padded)) as Record<string, unknown>;
  } catch { return null; }
}

function formatTime(iso: string): string {
  try {
    const s = iso.includes("T") ? iso : iso.replace(" ", "T") + "+08:00";
    return new Date(s).toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit", hour12: true });
  } catch { return ""; }
}

function formatExpiry(iso: string | null | undefined): string | null {
  if (!iso) return null;
  try {
    return "Expires " + new Date(iso).toLocaleString("en-PH", {
      month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
    });
  } catch { return null; }
}

function buildAvatarUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  return `${API_BASE_URL}/${path.replace(/^\//, "")}`;
}


export default function ChatScreen() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input,    setInput]    = useState("");
  const [loading,  setLoading]  = useState(true);
  const [sending,  setSending]  = useState(false);
  const [myId,     setMyId]     = useState<number | null>(null);
  const [myAvatar, setMyAvatar] = useState<string | null>(null);
  const flatListRef = useRef<FlatList<ChatMessage>>(null);

  // Decode own user_id + fetch avatar
  useEffect(() => {
    (async () => {
      const token = await getToken();
      if (!token) return;
      const payload = decodeJwtPayload(token);
      if (!payload) return;
      const id = payload.user_id ?? payload.sub ?? payload.id;
      if (typeof id === "number") setMyId(id);
      try {
        const res = await fetch(`${API_BASE_URL}/api/users/get`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json();
        const user = json.data ?? json;
        if (user?.avatar_path) setMyAvatar(user.avatar_path);
      } catch { /* non-fatal */ }
    })();
  }, []);

  const fetchHistory = useCallback(async () => {
    try {
      const token = await getToken();
      const [chatRes, feedRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/chat/messages`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE_URL}/api/chat/feed`,     { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const chatJson = await chatRes.json();
      const feedJson = await feedRes.json();
      const chatMsgs: ChatMessage[] = Array.isArray(chatJson) ? chatJson : (chatJson.data ?? []);
      const feedMsgs: ChatMessage[] = feedJson.data ?? [];
      const all = [...chatMsgs, ...feedMsgs].sort(
        (a, b) => new Date(a.sent_at).getTime() - new Date(b.sent_at).getTime()
      );
      const seen = new Set<number>();
      setMessages(all.filter((m) => { if (seen.has(m.id)) return false; seen.add(m.id); return true; }));
    } catch { /* non-fatal */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  // Real-time incoming messages
  useEffect(() => {
    const handler = (data: unknown) => {
      const msg = data as ChatMessage & { type?: string };
      if (msg?.id && msg?.body) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev;
          return [...prev, msg].sort(
            (a, b) => new Date(a.sent_at).getTime() - new Date(b.sent_at).getTime()
          );
        });
      }
    };
    WsClient.on("chat_message", handler);
    return () => WsClient.off("chat_message", handler);
  }, []);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 80);
    }
  }, [messages]);

  async function handleSend() {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    setInput("");
    try {
      const token = await getToken();
      const res = await fetch(`${API_BASE_URL}/api/chat/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ body: text }),
      });
      const json = await res.json();
      if (!json.error) {
        const msg: ChatMessage = json.data ?? json;
        if (msg?.id) {
          setMessages((prev) => {
            if (prev.some((m) => m.id === msg.id)) return prev;
            return [...prev, { ...msg, avatar_path: msg.avatar_path ?? myAvatar ?? null }];
          });
        }
      }
    } catch { /* non-fatal */ } finally {
      setSending(false);
    }
  }


  function renderAvatar(item: ChatMessage, isMe: boolean) {
    const url = isMe ? buildAvatarUrl(myAvatar) : buildAvatarUrl(item.avatar_path);
    const initials = (item.sender_name ?? "?").charAt(0).toUpperCase();
    const isAdmin = item.sender_role === "LGU_Admin";
    const isBrgy  = item.sender_role === "Barangay_Official";
    const bg = isMe ? "#1d4ed8" : isAdmin ? "#dc2626" : isBrgy ? "#16a34a" : "#64748b";
    if (url) {
      return <Image source={{ uri: url }} style={[styles.avatar, { borderColor: bg }]} />;
    }
    return (
      <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: bg }]}>
        <Text style={styles.avatarText}>{initials}</Text>
      </View>
    );
  }

  function renderMessage({ item, index }: { item: ChatMessage; index: number }) {
    const isMe    = item.sender_id === myId && item.sender_type === "evacuee";
    const isLgu   = item.sender_type === "lgu";
    const isAdmin = item.sender_role === "LGU_Admin";
    const isBrgy  = item.sender_role === "Barangay_Official";
    const isBroadcast    = item.msg_type === "broadcast";
    const isAnnouncement = item.msg_type === "announcement";
    const prevItem   = index > 0 ? messages[index - 1] : null;
    const showAvatar = !prevItem || prevItem.sender_id !== item.sender_id;

    // ── Broadcast / Announcement banner ──────────────────────────────────────
    if (isBroadcast || isAnnouncement) {
      const color = isAdmin ? "#dc2626" : "#16a34a";
      const bg    = isAdmin ? "#fef2f2" : "#f0fdf4";
      const label = isAnnouncement ? "📣 Announcement" : "📢 Broadcast";
      const role  = isAdmin ? "LGU Admin" : "Barangay Official";
      const expiry = formatExpiry(item.expires_at);
      return (
        <View style={[styles.banner, { borderLeftColor: color, backgroundColor: bg }]}>
          <View style={styles.bannerTop}>
            <Text style={[styles.bannerLabel, { color }]}>{label}</Text>
            <Text style={[styles.bannerRole, { color }]}>{role}</Text>
          </View>
          <Text style={styles.bannerSender}>
            {item.sender_name}{item.sender_barangay ? ` · ${item.sender_barangay}` : ""}
          </Text>
          <Text style={styles.bannerBody}>{item.body}</Text>
          <View style={styles.bannerFoot}>
            <Text style={styles.bannerTime}>{formatTime(item.sent_at)}</Text>
            {expiry && <Text style={[styles.bannerExpiry, { color }]}>{expiry}</Text>}
          </View>
        </View>
      );
    }

    // ── Regular chat bubble ───────────────────────────────────────────────────
    const bubbleBg  = isMe ? "#1d4ed8" : isAdmin ? "#dc2626" : isBrgy ? "#16a34a" : "#fff";
    const textColor = (isMe || isLgu) ? "#fff" : "#1e293b";
    const nameColor = isAdmin ? "#dc2626" : isBrgy ? "#16a34a" : "#64748b";

    return (
      <View style={[styles.msgRow, isMe ? styles.msgRowMe : styles.msgRowOther]}>
        {!isMe && (
          <View style={styles.avatarSlot}>
            {showAvatar ? renderAvatar(item, false) : null}
          </View>
        )}
        <View style={[styles.bubbleWrap, isMe && styles.bubbleWrapMe]}>
          {!isMe && showAvatar && (
            <Text style={[styles.senderName, { color: nameColor }]}>
              {item.sender_name}
              {item.sender_barangay ? ` · ${item.sender_barangay}` : ""}
              {isLgu ? ` (${isAdmin ? "LGU Admin" : "Barangay Official"})` : ""}
            </Text>
          )}
          <View style={[styles.bubble, { backgroundColor: bubbleBg, borderColor: isLgu ? "transparent" : "#e2e8f0" }]}>
            <Text style={[styles.msgText, { color: textColor }]}>{item.body}</Text>
          </View>
          <Text style={[styles.msgTime, isMe && styles.msgTimeMe]}>{formatTime(item.sent_at)}</Text>
        </View>
        {isMe && (
          <View style={styles.avatarSlot}>
            {showAvatar ? renderAvatar(item, true) : null}
          </View>
        )}
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <StatusBar barStyle="light-content" backgroundColor="#1d4ed8" />
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.onlineDot} />
            <View>
              <Text style={styles.headerTitle}>Community Chat</Text>
              <Text style={styles.headerSub}>Live · Visible to LGU responders</Text>
            </View>
          </View>
        </View>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color="#1d4ed8" />
            <Text style={styles.loadingText}>Loading messages...</Text>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderMessage}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyWrap}>
                <Ionicons name="chatbubbles-outline" size={56} color="#cbd5e1" />
                <Text style={styles.emptyTitle}>No messages yet</Text>
                <Text style={styles.emptyText}>Be the first to send a message.</Text>
              </View>
            }
          />
        )}

        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            placeholder="Type a message..."
            placeholderTextColor="#94a3b8"
            value={input}
            onChangeText={setInput}
            multiline
            maxLength={500}
            returnKeyType="send"
            onSubmitEditing={handleSend}
            blurOnSubmit={false}
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!input.trim() || sending) && styles.sendBtnOff]}
            onPress={handleSend}
            disabled={!input.trim() || sending}
          >
            {sending
              ? <ActivityIndicator size="small" color="#fff" />
              : <Ionicons name="send" size={18} color="#fff" />
            }
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}


const styles = StyleSheet.create({
  safeArea:    { flex: 1, backgroundColor: "#1d4ed8" },
  container:   { flex: 1, backgroundColor: "#f1f5f9" },
  header:      { backgroundColor: "#1d4ed8", paddingHorizontal: 20, paddingVertical: 14, paddingBottom: 16 },
  headerLeft:  { flexDirection: "row", alignItems: "center", gap: 10 },
  headerTitle: { color: "#fff", fontWeight: "800", fontSize: 18 },
  headerSub:   { color: "rgba(255,255,255,0.65)", fontSize: 12, marginTop: 1 },
  onlineDot:   { width: 10, height: 10, borderRadius: 5, backgroundColor: "#4ade80" },
  loadingWrap: { flex: 1, justifyContent: "center", alignItems: "center", gap: 14 },
  loadingText: { fontSize: 14, color: "#64748b" },
  listContent: { paddingHorizontal: 12, paddingVertical: 12, paddingBottom: 4 },
  emptyWrap:   { alignItems: "center", paddingTop: 80, gap: 8 },
  emptyTitle:  { fontSize: 17, fontWeight: "700", color: "#1e293b" },
  emptyText:   { fontSize: 13, color: "#94a3b8", textAlign: "center", paddingHorizontal: 32 },

  // Broadcast / Announcement
  banner: {
    borderLeftWidth: 4, borderRadius: 12, padding: 12, marginBottom: 8,
    elevation: 1, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 4,
  },
  bannerTop:    { flexDirection: "row", justifyContent: "space-between", marginBottom: 2 },
  bannerLabel:  { fontSize: 12, fontWeight: "800" },
  bannerRole:   { fontSize: 11, fontWeight: "700", opacity: 0.8 },
  bannerSender: { fontSize: 11, color: "#64748b", marginBottom: 4 },
  bannerBody:   { fontSize: 14, color: "#1e293b", lineHeight: 20, marginBottom: 6 },
  bannerFoot:   { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  bannerTime:   { fontSize: 10, color: "#94a3b8" },
  bannerExpiry: { fontSize: 10, fontWeight: "700" },

  // Chat bubbles
  msgRow:      { flexDirection: "row", marginBottom: 4, alignItems: "flex-end" },
  msgRowMe:    { justifyContent: "flex-end" },
  msgRowOther: { justifyContent: "flex-start" },
  avatarSlot:  { width: 34, marginHorizontal: 4, alignItems: "center", justifyContent: "flex-end" },
  avatar:      { width: 30, height: 30, borderRadius: 15, borderWidth: 2 },
  avatarFallback: { justifyContent: "center", alignItems: "center" },
  avatarText:  { color: "#fff", fontSize: 12, fontWeight: "800" },
  bubbleWrap:  { maxWidth: "72%", alignItems: "flex-start" },
  bubbleWrapMe:{ alignItems: "flex-end" },
  senderName:  { fontSize: 11, fontWeight: "700", marginBottom: 3, marginLeft: 4 },
  bubble:      { borderRadius: 18, paddingHorizontal: 14, paddingVertical: 9, borderWidth: 1 },
  msgText:     { fontSize: 14, lineHeight: 20 },
  msgTime:     { fontSize: 10, color: "#94a3b8", marginTop: 3, marginLeft: 4 },
  msgTimeMe:   { alignSelf: "flex-end", marginRight: 4 },

  inputBar: {
    flexDirection: "row", alignItems: "flex-end",
    paddingHorizontal: 12, paddingVertical: 10,
    backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: "#e2e8f0", gap: 8,
  },
  input: {
    flex: 1, backgroundColor: "#f1f5f9", borderRadius: 24,
    paddingHorizontal: 16, paddingVertical: 10, fontSize: 14,
    color: "#1e293b", maxHeight: 100, borderWidth: 1, borderColor: "#e2e8f0",
  },
  sendBtn:    { width: 44, height: 44, borderRadius: 22, backgroundColor: "#1d4ed8", justifyContent: "center", alignItems: "center" },
  sendBtnOff: { backgroundColor: "#bfdbfe" },
});
