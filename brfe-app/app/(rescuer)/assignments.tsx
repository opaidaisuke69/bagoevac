import { useState, useEffect, useCallback } from "react";
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl, StatusBar, Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { API_BASE_URL } from "../../constants/config";
import { getToken } from "../../hooks/use-auth";

type RescueRequest = {
  id: number;
  full_name: string;
  lat: number;
  lng: number;
  status_at_request: string;
  req_status: string;
  requested_at: string;
  barangay_name?: string;
};

export default function AssignmentsScreen() {
  const [rescues, setRescues] = useState<RescueRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAssignments = useCallback(async () => {
    try {
      const token = await getToken();
      const res = await fetch(`${API_BASE_URL}/api/rescue/list_lgu?status=Ongoing`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setRescues(data.data || []);
    } catch { /* silent */ }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => {
    fetchAssignments();
    const interval = setInterval(fetchAssignments, 5000); // poll every 5s
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

  function renderItem({ item }: { item: RescueRequest }) {
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.idBadge}>
            <Text style={styles.idText}>#{item.id}</Text>
          </View>
          <View style={[styles.statusBadge, item.req_status === 'Ongoing' ? styles.statusOngoing : styles.statusPending]}>
            <Text style={styles.statusText}>{item.req_status}</Text>
          </View>
        </View>

        <Text style={styles.name}>{item.full_name || "Unknown"}</Text>
        {item.barangay_name && <Text style={styles.barangay}>{item.barangay_name}</Text>}

        <View style={styles.infoRow}>
          <Ionicons name="location" size={14} color="#6b7280" />
          <Text style={styles.infoText}>
            {item.lat?.toFixed(5)}, {item.lng?.toFixed(5)}
          </Text>
        </View>

        <View style={styles.infoRow}>
          <Ionicons name="alert-circle" size={14} color="#dc2626" />
          <Text style={styles.infoText}>
            Status: {item.status_at_request?.replace("_", " ")}
          </Text>
        </View>

        <View style={styles.infoRow}>
          <Ionicons name="time" size={14} color="#6b7280" />
          <Text style={styles.infoText}>
            {new Date(item.requested_at).toLocaleString()}
          </Text>
        </View>

        {/* Action buttons */}
        <View style={styles.actions}>
          {item.req_status === "Pending" && (
            <TouchableOpacity style={styles.acceptBtn} onPress={() => handleAccept(item.id)}>
              <Ionicons name="checkmark-circle" size={16} color="#fff" />
              <Text style={styles.btnText}>Accept</Text>
            </TouchableOpacity>
          )}
          {item.req_status === "Ongoing" && (
            <TouchableOpacity style={styles.completeBtn} onPress={() => handleComplete(item.id)}>
              <Ionicons name="flag" size={16} color="#fff" />
              <Text style={styles.btnText}>Complete</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <StatusBar barStyle="light-content" backgroundColor="#0d4f4f" />
      <View style={styles.header}>
        <Ionicons name="shield-checkmark" size={22} color="#fff" />
        <Text style={styles.headerTitle}>My Assignments</Text>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#0d9488" /></View>
      ) : (
        <FlatList
          data={rescues}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchAssignments(); }} tintColor="#0d9488" />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="checkmark-done-circle" size={56} color="#d1d5db" />
              <Text style={styles.emptyText}>No active assignments</Text>
              <Text style={styles.emptySub}>When a rescue is assigned to you, it will appear here.</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea:     { flex: 1, backgroundColor: "#0d4f4f" },
  header:       { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 20, paddingVertical: 14, backgroundColor: "#0d4f4f" },
  headerTitle:  { color: "#fff", fontSize: 18, fontWeight: "800" },
  center:       { flex: 1, justifyContent: "center", alignItems: "center" },
  list:         { padding: 16, paddingBottom: 40, backgroundColor: "#f1f5f9" },
  card:         { backgroundColor: "#fff", borderRadius: 16, padding: 16, marginBottom: 12, elevation: 2, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 8 },
  cardHeader:   { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  idBadge:      { backgroundColor: "#f1f5f9", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  idText:       { fontSize: 11, fontWeight: "700", color: "#64748b" },
  statusBadge:  { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusPending:{ backgroundColor: "#fef3c7" },
  statusOngoing:{ backgroundColor: "#dbeafe" },
  statusText:   { fontSize: 11, fontWeight: "700", color: "#1e293b" },
  name:         { fontSize: 16, fontWeight: "700", color: "#1e293b", marginBottom: 2 },
  barangay:     { fontSize: 12, color: "#6b7280", marginBottom: 8 },
  infoRow:      { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
  infoText:     { fontSize: 12, color: "#6b7280" },
  actions:      { flexDirection: "row", gap: 10, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: "#f1f5f9" },
  acceptBtn:    { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: "#0d9488", paddingVertical: 10, borderRadius: 10 },
  completeBtn:  { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: "#2563eb", paddingVertical: 10, borderRadius: 10 },
  btnText:      { color: "#fff", fontSize: 13, fontWeight: "700" },
  empty:        { alignItems: "center", paddingTop: 80 },
  emptyText:    { fontSize: 16, fontWeight: "700", color: "#9ca3af", marginTop: 12 },
  emptySub:     { fontSize: 13, color: "#d1d5db", marginTop: 4, textAlign: "center", paddingHorizontal: 40 },
});
