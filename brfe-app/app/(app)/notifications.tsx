import { useEffect, useState, useCallback } from "react";
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, StatusBar, ActivityIndicator, RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { API_BASE_URL } from "../../constants/config";
import { getToken } from "../../hooks/use-auth";
import * as WsClient from "../../services/websocket-client";

interface Notification {
  id: number;
  type: string;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  is_read: boolean;
  created_at: string;
}

const TYPE_ICON: Record<string, { icon: keyof typeof Ionicons.glyphMap; color: string; bg: string }> = {
  rescue_ongoing:   { icon: "navigate",        color: "#1d4ed8", bg: "#eff6ff" },
  rescue_completed: { icon: "checkmark-circle", color: "#16a34a", bg: "#f0fdf4" },
  status_safe:      { icon: "shield-checkmark", color: "#16a34a", bg: "#f0fdf4" },
};

function fmtDate(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleString();
  } catch { return iso; }
}

export default function NotificationsScreen() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount,   setUnreadCount]   = useState(0);
  const [loading,       setLoading]       = useState(true);
  const [refreshing,    setRefreshing]    = useState(false);

  const fetchNotifications = useCallback(async () => {
    try {
      const token = await getToken();
      const res = await fetch(`${API_BASE_URL}/api/notifications/list`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!json.error) {
        setNotifications(json.notifications ?? []);
        setUnreadCount(json.unread_count ?? 0);
      }
    } catch { /* non-fatal */ } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    const onNotif = () => fetchNotifications();
    WsClient.on("notification", onNotif);
    WsClient.on("rescue_status", onNotif);
    return () => {
      WsClient.off("notification", onNotif);
      WsClient.off("rescue_status", onNotif);
    };
  }, [fetchNotifications]);

  async function markRead(id: number) {
    try {
      const token = await getToken();
      await fetch(`${API_BASE_URL}/api/notifications/read`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id }),
      });
      setNotifications((prev) =>
        prev.map((n) => n.id === id ? { ...n, is_read: true } : n)
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch { /* non-fatal */ }
  }

  async function markAllRead() {
    try {
      const token = await getToken();
      await fetch(`${API_BASE_URL}/api/notifications/read`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({}),
      });
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch { /* non-fatal */ }
  }

  function onRefresh() {
    setRefreshing(true);
    fetchNotifications();
  }

  const cfg = (type: string) => TYPE_ICON[type] ?? { icon: "notifications" as const, color: "#64748b", bg: "#f8fafc" };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <StatusBar barStyle="light-content" backgroundColor="#1d4ed8" />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Notifications</Text>
        {unreadCount > 0 && (
          <TouchableOpacity onPress={markAllRead} style={styles.markAllBtn}>
            <Text style={styles.markAllText}>Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#1d4ed8" />
        </View>
      ) : notifications.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="notifications-off-outline" size={52} color="#cbd5e1" />
          <Text style={styles.emptyText}>No notifications yet</Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => String(item.id)}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={{ paddingVertical: 8 }}
          renderItem={({ item }) => {
            const c = cfg(item.type);
            return (
              <TouchableOpacity
                style={[styles.card, !item.is_read && styles.cardUnread]}
                onPress={() => !item.is_read && markRead(item.id)}
                activeOpacity={0.8}
              >
                <View style={[styles.iconWrap, { backgroundColor: c.bg }]}>
                  <Ionicons name={c.icon} size={22} color={c.color} />
                </View>
                <View style={styles.cardBody}>
                  <View style={styles.cardTop}>
                    <Text style={styles.cardTitle}>{item.title}</Text>
                    {!item.is_read && <View style={styles.unreadDot} />}
                  </View>
                  <Text style={styles.cardMsg}>{item.body}</Text>
                  <Text style={styles.cardTime}>{fmtDate(item.created_at)}</Text>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea:   { flex: 1, backgroundColor: "#1d4ed8" },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: "#1d4ed8", paddingHorizontal: 20, paddingVertical: 14,
  },
  headerTitle:  { color: "#fff", fontWeight: "800", fontSize: 18 },
  markAllBtn:   { backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  markAllText:  { color: "#fff", fontSize: 12, fontWeight: "700" },
  center:       { flex: 1, justifyContent: "center", alignItems: "center", gap: 12, backgroundColor: "#f8fafc" },
  emptyText:    { fontSize: 15, color: "#94a3b8", fontWeight: "600" },
  card: {
    flexDirection: "row", alignItems: "flex-start", gap: 12,
    backgroundColor: "#fff", marginHorizontal: 16, marginVertical: 4,
    borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: "#e2e8f0",
  },
  cardUnread:  { borderColor: "#bfdbfe", backgroundColor: "#f0f7ff" },
  iconWrap:    { width: 44, height: 44, borderRadius: 22, justifyContent: "center", alignItems: "center" },
  cardBody:    { flex: 1 },
  cardTop:     { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 3 },
  cardTitle:   { fontSize: 14, fontWeight: "800", color: "#1e293b", flex: 1 },
  unreadDot:   { width: 8, height: 8, borderRadius: 4, backgroundColor: "#1d4ed8", marginLeft: 6 },
  cardMsg:     { fontSize: 13, color: "#475569", lineHeight: 18, marginBottom: 4 },
  cardTime:    { fontSize: 11, color: "#94a3b8" },
});
