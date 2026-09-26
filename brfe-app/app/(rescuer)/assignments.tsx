import { useState, useEffect, useCallback, useMemo } from "react";
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl, Alert, Linking,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { API_BASE_URL } from "../../constants/config";
import { getToken, getTokenPayload } from "../../hooks/use-auth";
import { isInsideBarangay } from "../../services/geo";
import { RC, RADIUS, SPACING, shadow, glow, statusColors } from "../../features/rescuer/theme";
import { RescuerScreen, ScreenHeader, Badge, Card } from "../../features/rescuer/components";

type RescueRequest = {
  id: number;
  full_name: string;
  lat: number;
  lng: number;
  status_at_request: string;
  req_status: string;
  requested_at: string;
  barangay_name?: string;
  contact_no?: string;
};

type Filter = "All" | "Pending" | "Ongoing";

/** Human-friendly "x min ago" for the request timestamp. */
function timeAgo(iso?: string): string {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (isNaN(t)) return "";
  const diff = Math.floor((Date.now() - t) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hr ago`;
  return new Date(iso).toLocaleDateString();
}

export default function AssignmentsScreen() {
  const [rescues, setRescues] = useState<RescueRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [myBarangay, setMyBarangay] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("All");

  useEffect(() => {
    (async () => {
      const p = await getTokenPayload();
      if (p?.barangay_name) setMyBarangay(p.barangay_name);
    })();
  }, []);

  const fetchAssignments = useCallback(async () => {
    try {
      const token = await getToken();
      const res = await fetch(`${API_BASE_URL}/api/rescue/list?status=Ongoing`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      const list: any[] = data.rescue_requests || data.data || [];
      setRescues(list);
    } catch { /* silent */ }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => {
    fetchAssignments();
    const interval = setInterval(fetchAssignments, 5000);
    return () => clearInterval(interval);
  }, [fetchAssignments]);

  async function updateStatus(id: number, newStatus: string) {
    try {
      const token = await getToken();
      await fetch(`${API_BASE_URL}/api/rescue/update_lgu`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id, req_status: newStatus }),
      });
      fetchAssignments();
    } catch {
      Alert.alert("Error", "Failed to update status");
    }
  }

  function handleAccept(id: number) {
    Alert.alert("Accept Assignment", "Accept this rescue request?", [
      { text: "Cancel", style: "cancel" },
      { text: "Accept", onPress: () => updateStatus(id, "Ongoing") },
    ]);
  }

  function handleComplete(id: number) {
    Alert.alert("Complete Rescue", "Mark this rescue as completed?", [
      { text: "Cancel", style: "cancel" },
      { text: "Complete", style: "destructive", onPress: () => updateStatus(id, "Completed") },
    ]);
  }

  // Border jurisdiction scope, then filter tab.
  const scoped = useMemo(
    () => (myBarangay ? rescues.filter((r) => isInsideBarangay(r.lat, r.lng, myBarangay)) : rescues),
    [rescues, myBarangay]
  );
  const counts = useMemo(() => ({
    all: scoped.length,
    pending: scoped.filter((r) => r.req_status === "Pending").length,
    ongoing: scoped.filter((r) => r.req_status === "Ongoing").length,
  }), [scoped]);

  const visible = useMemo(
    () => (filter === "All" ? scoped : scoped.filter((r) => r.req_status === filter)),
    [scoped, filter]
  );

  function renderItem({ item }: { item: RescueRequest }) {
    const sc = statusColors(item.req_status);
    const danger = item.status_at_request?.toLowerCase().includes("danger");
    return (
      <Card style={[styles.card, danger && styles.cardDanger]}>
        <View style={styles.cardHeader}>
          <View style={styles.idRow}>
            <View style={styles.idBadge}><Text style={styles.idText}>#{item.id}</Text></View>
            <Text style={styles.timeAgo}>{timeAgo(item.requested_at)}</Text>
          </View>
          <Badge label={item.req_status} fg={sc.fg} bg={sc.bg} />
        </View>

        <View style={styles.nameRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarTxt}>
              {(item.full_name || "U").trim().charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{item.full_name || "Unknown"}</Text>
            {item.barangay_name ? <Text style={styles.barangay}>{item.barangay_name}</Text> : null}
          </View>
          {danger && (
            <View style={styles.dangerTag}>
              <Ionicons name="warning" size={12} color="#fff" />
              <Text style={styles.dangerTagTxt}>Danger</Text>
            </View>
          )}
        </View>

        <View style={styles.metaGrid}>
          <View style={styles.metaItem}>
            <Ionicons name="location-outline" size={14} color={RC.textMuted} />
            <Text style={styles.metaText}>{item.lat?.toFixed(4)}, {item.lng?.toFixed(4)}</Text>
          </View>
          <View style={styles.metaItem}>
            <Ionicons name="alert-circle-outline" size={14} color={RC.amber} />
            <Text style={styles.metaText}>{item.status_at_request?.replace("_", " ") || "—"}</Text>
          </View>
        </View>

        <View style={styles.actions}>
          {item.contact_no ? (
            <TouchableOpacity
              style={styles.callBtn}
              onPress={() => Linking.openURL(`tel:${item.contact_no}`)}
            >
              <Ionicons name="call" size={16} color={RC.primary} />
            </TouchableOpacity>
          ) : null}
          {item.req_status === "Pending" && (
            <TouchableOpacity style={[styles.primaryBtn, glow(RC.primary)]} onPress={() => handleAccept(item.id)}>
              <Ionicons name="checkmark-circle" size={16} color="#fff" />
              <Text style={styles.btnText}>Accept</Text>
            </TouchableOpacity>
          )}
          {item.req_status === "Ongoing" && (
            <TouchableOpacity style={[styles.completeBtn, glow(RC.blue)]} onPress={() => handleComplete(item.id)}>
              <Ionicons name="flag" size={16} color="#fff" />
              <Text style={styles.btnText}>Complete</Text>
            </TouchableOpacity>
          )}
        </View>
      </Card>
    );
  }

  const FilterTab = ({ label, value, count }: { label: string; value: Filter; count: number }) => {
    const active = filter === value;
    return (
      <TouchableOpacity
        style={[styles.tab, active && styles.tabActive]}
        onPress={() => setFilter(value)}
        activeOpacity={0.8}
      >
        <Text style={[styles.tabTxt, active && styles.tabTxtActive]}>{label}</Text>
        <View style={[styles.tabCount, active && styles.tabCountActive]}>
          <Text style={[styles.tabCountTxt, active && styles.tabCountTxtActive]}>{count}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <RescuerScreen>
      <ScreenHeader
        title="My Assignments"
        subtitle={myBarangay ? `Brgy. ${myBarangay}` : "Active rescue requests"}
        icon="shield-checkmark"
        right={
          <View style={styles.headerCount}>
            <Text style={styles.headerCountNum}>{counts.all}</Text>
            <Text style={styles.headerCountLbl}>active</Text>
          </View>
        }
      />

      <View style={styles.body}>
        <View style={styles.tabs}>
          <FilterTab label="All" value="All" count={counts.all} />
          <FilterTab label="Pending" value="Pending" count={counts.pending} />
          <FilterTab label="Ongoing" value="Ongoing" count={counts.ongoing} />
        </View>

        {loading ? (
          <View style={styles.center}><ActivityIndicator size="large" color={RC.primary} /></View>
        ) : (
          <FlatList
            data={visible}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderItem}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => { setRefreshing(true); fetchAssignments(); }}
                tintColor={RC.primary}
              />
            }
            ListEmptyComponent={
              <View style={styles.empty}>
                <View style={styles.emptyIcon}>
                  <Ionicons name="checkmark-done-circle-outline" size={48} color={RC.primary} />
                </View>
                <Text style={styles.emptyText}>
                  {filter === "All" ? "No active assignments" : `No ${filter.toLowerCase()} requests`}
                </Text>
                <Text style={styles.emptySub}>
                  When a rescue is assigned to your barangay, it will appear here.
                </Text>
              </View>
            }
          />
        )}
      </View>
    </RescuerScreen>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, backgroundColor: RC.bg },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },

  headerCount: { alignItems: "center" },
  headerCountNum: { color: "#fff", fontSize: 20, fontWeight: "900", lineHeight: 22 },
  headerCountLbl: { color: "rgba(255,255,255,0.7)", fontSize: 10, fontWeight: "700", textTransform: "uppercase" },

  tabs: { flexDirection: "row", gap: SPACING.sm, paddingHorizontal: SPACING.lg, paddingTop: SPACING.lg, paddingBottom: SPACING.sm },
  tab: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.pill,
    backgroundColor: RC.surface, borderWidth: 1, borderColor: RC.border,
  },
  tabActive: { backgroundColor: RC.primary, borderColor: RC.primary },
  tabTxt: { fontSize: 13, fontWeight: "700", color: RC.textMuted },
  tabTxtActive: { color: "#fff" },
  tabCount: { minWidth: 20, paddingHorizontal: 5, paddingVertical: 1, borderRadius: RADIUS.pill, backgroundColor: RC.divider, alignItems: "center" },
  tabCountActive: { backgroundColor: "rgba(255,255,255,0.25)" },
  tabCountTxt: { fontSize: 11, fontWeight: "800", color: RC.textMuted },
  tabCountTxtActive: { color: "#fff" },

  list: { padding: SPACING.lg, paddingTop: SPACING.sm, paddingBottom: 40, gap: SPACING.md },
  card: { padding: SPACING.lg },
  cardDanger: { borderLeftWidth: 4, borderLeftColor: RC.red },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: SPACING.md },
  idRow: { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
  idBadge: { backgroundColor: RC.divider, paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.sm },
  idText: { fontSize: 11, fontWeight: "800", color: RC.textMuted },
  timeAgo: { fontSize: 11.5, color: RC.textFaint, fontWeight: "600" },

  nameRow: { flexDirection: "row", alignItems: "center", gap: SPACING.md, marginBottom: SPACING.md },
  avatar: { width: 42, height: 42, borderRadius: RADIUS.md, backgroundColor: RC.primarySoft, justifyContent: "center", alignItems: "center" },
  avatarTxt: { fontSize: 18, fontWeight: "800", color: RC.primary },
  name: { fontSize: 16, fontWeight: "800", color: RC.text },
  barangay: { fontSize: 12.5, color: RC.textMuted, marginTop: 1 },
  dangerTag: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: RC.red, paddingHorizontal: 8, paddingVertical: 4, borderRadius: RADIUS.sm },
  dangerTagTxt: { color: "#fff", fontSize: 10, fontWeight: "800" },

  metaGrid: { gap: 6, backgroundColor: RC.bgAlt, borderRadius: RADIUS.md, padding: SPACING.md },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 8 },
  metaText: { fontSize: 12.5, color: RC.textMuted, fontWeight: "600" },

  actions: { flexDirection: "row", gap: SPACING.md, marginTop: SPACING.md },
  callBtn: { width: 44, borderRadius: RADIUS.md, borderWidth: 1.5, borderColor: RC.primarySoft, backgroundColor: RC.primaryTint, justifyContent: "center", alignItems: "center" },
  primaryBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: RC.primary, paddingVertical: 12, borderRadius: RADIUS.md },
  completeBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: RC.blue, paddingVertical: 12, borderRadius: RADIUS.md },
  btnText: { color: "#fff", fontSize: 14, fontWeight: "800" },

  empty: { alignItems: "center", paddingTop: 70 },
  emptyIcon: { width: 84, height: 84, borderRadius: 42, backgroundColor: RC.primaryTint, justifyContent: "center", alignItems: "center", marginBottom: SPACING.lg, ...shadow(1) },
  emptyText: { fontSize: 16, fontWeight: "800", color: RC.text },
  emptySub: { fontSize: 13, color: RC.textFaint, marginTop: 6, textAlign: "center", paddingHorizontal: 50, lineHeight: 19 },
});
