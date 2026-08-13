import { useEffect, useRef, useState, useCallback } from "react";
import {
  View, Text, FlatList, StyleSheet, ActivityIndicator, StatusBar, RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { API_BASE_URL } from "../../constants/config";
import { getToken } from "../../hooks/use-auth";

interface FeedMessage {
  id: number;
  sender_id: number;
  sender_name: string;
  sender_role?: string | null;
  sender_barangay?: string | null;
  body: string;
  msg_type: string;
  expires_at?: string | null;
  sent_at: string;
}

function formatTime(iso: string): string {
  try {
    const s = iso.includes("T") ? iso : iso.replace(" ", "T") + "+08:00";
    return new Date(s).toLocaleString("en-PH", {
      month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: true,
    });
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

export default function AnnouncementsScreen() {
  const [messages, setMessages] = useState<FeedMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchFeed = useCallback(async () => {
    try {
      const token = await getToken();
      const res = await fetch(`${API_BASE_URL}/api/chat/feed`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      const msgs: FeedMessage[] = json.data ?? [];
      setMessages(msgs.sort((a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime()));
    } catch { /* non-fatal */ } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchFeed(); }, [fetchFeed]);

  // Auto-refresh every 5 seconds
  useEffect(() => {
    const interval = setInterval(fetchFeed, 5000);
    return () => clearInterval(interval);
  }, [fetchFeed]);

  function onRefresh() {
    setRefreshing(true);
    fetchFeed();
  }

  function renderMessage({ item }: { item: FeedMessage }) {
    const isAnnouncement = item.msg_type === "announcement";
    const color = isAnnouncement ? "#dc2626" : "#16a34a";
    const bg = isAnnouncement ? "#fef2f2" : "#f0fdf4";
    const label = isAnnouncement ? "📣 Announcement" : "📢 Broadcast";
    const source = item.sender_role === "LGU_Admin" ? "LGU Admin" : "Barangay Official";
    const expiry = formatExpiry(item.expires_at);

    return (
      <View style={[styles.card, { borderLeftColor: color, backgroundColor: bg }]}>
        <View style={styles.cardTop}>
          <Text style={[styles.cardLabel, { color }]}>{label}</Text>
          <Text style={[styles.cardSource, { color }]}>{source}</Text>
        </View>
        <Text style={styles.cardSender}>
          {item.sender_name}{item.sender_barangay ? ` · ${item.sender_barangay}` : ""}
        </Text>
        <Text style={styles.cardBody}>{item.body}</Text>
        <View style={styles.cardFoot}>
          <Text style={styles.cardTime}>{formatTime(item.sent_at)}</Text>
          {expiry && <Text style={[styles.cardExpiry, { color }]}>{expiry}</Text>}
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <StatusBar barStyle="light-content" backgroundColor="#1d4ed8" />
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Ionicons name="megaphone" size={20} color="#fff" />
            <View>
              <Text style={styles.headerTitle}>Announcements</Text>
              <Text style={styles.headerSub}>From LGU & Barangay Officials</Text>
            </View>
          </View>
        </View>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color="#1d4ed8" />
            <Text style={styles.loadingText}>Loading announcements...</Text>
          </View>
        ) : (
          <FlatList
            data={messages}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderMessage}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#1d4ed8"]} />}
            ListEmptyComponent={
              <View style={styles.emptyWrap}>
                <Ionicons name="megaphone-outline" size={56} color="#cbd5e1" />
                <Text style={styles.emptyTitle}>No announcements yet</Text>
                <Text style={styles.emptyText}>Announcements and broadcasts from LGU and your barangay will appear here.</Text>
              </View>
            }
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#1d4ed8" },
  container: { flex: 1, backgroundColor: "#f1f5f9" },
  header: { backgroundColor: "#1d4ed8", paddingHorizontal: 20, paddingVertical: 14, paddingBottom: 16 },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  headerTitle: { color: "#fff", fontWeight: "800", fontSize: 18 },
  headerSub: { color: "rgba(255,255,255,0.65)", fontSize: 12, marginTop: 1 },
  loadingWrap: { flex: 1, justifyContent: "center", alignItems: "center", gap: 14 },
  loadingText: { fontSize: 14, color: "#64748b" },
  listContent: { padding: 16, paddingBottom: 32 },
  emptyWrap: { alignItems: "center", paddingTop: 80, gap: 8 },
  emptyTitle: { fontSize: 17, fontWeight: "700", color: "#1e293b" },
  emptyText: { fontSize: 13, color: "#94a3b8", textAlign: "center", paddingHorizontal: 32 },

  card: {
    borderLeftWidth: 4, borderRadius: 12, padding: 14, marginBottom: 12,
    elevation: 2, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
  },
  cardTop: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  cardLabel: { fontSize: 12, fontWeight: "800" },
  cardSource: { fontSize: 11, fontWeight: "700", opacity: 0.8 },
  cardSender: { fontSize: 11, color: "#64748b", marginBottom: 6 },
  cardBody: { fontSize: 14, color: "#1e293b", lineHeight: 20, marginBottom: 8 },
  cardFoot: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardTime: { fontSize: 10, color: "#94a3b8" },
  cardExpiry: { fontSize: 10, fontWeight: "700" },
});
