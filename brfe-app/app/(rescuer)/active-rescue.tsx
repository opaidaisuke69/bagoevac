import { useState, useEffect, useCallback } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, Alert,
  ActivityIndicator, StatusBar, ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { API_BASE_URL } from "../../constants/config";
import { getToken } from "../../hooks/use-auth";

type ActiveRescue = {
  id: number;
  full_name: string;
  lat: number;
  lng: number;
  status_at_request: string;
  req_status: string;
  requested_at: string;
  contact_no?: string;
  barangay_name?: string;
};

const STATUS_STEPS = [
  { key: "Ongoing", label: "Accepted", icon: "checkmark-circle" as const, color: "#0d9488" },
  { key: "On_the_way", label: "On the Way", icon: "car" as const, color: "#2563eb" },
  { key: "Arrived", label: "Arrived", icon: "location" as const, color: "#7c3aed" },
  { key: "Completed", label: "Rescue Completed", icon: "flag" as const, color: "#16a34a" },
];

export default function ActiveRescueScreen() {
  const [rescue, setRescue] = useState<ActiveRescue | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  const fetchActive = useCallback(async () => {
    try {
      const token = await getToken();
      const res = await fetch(`${API_BASE_URL}/api/rescue/list_lgu?status=Ongoing`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      const list = data.data || [];
      setRescue(list.length > 0 ? list[0] : null);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchActive();
    const interval = setInterval(fetchActive, 3000);
    return () => clearInterval(interval);
  }, [fetchActive]);

  async function updateStatus(newStatus: string) {
    if (!rescue) return;
    setUpdating(true);
    try {
      const token = await getToken();
      await fetch(`${API_BASE_URL}/api/rescue/update_lgu`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id: rescue.id, req_status: newStatus }),
      });
      if (newStatus === "Completed") {
        setRescue(null);
        Alert.alert("✅ Rescue Completed", "Great work! The evacuee has been rescued.");
      } else {
        fetchActive();
      }
    } catch {
      Alert.alert("Error", "Failed to update status");
    } finally { setUpdating(false); }
  }

  function getNextStatus(): { key: string; label: string } | null {
    if (!rescue) return null;
    const current = rescue.req_status;
    if (current === "Ongoing") return { key: "On_the_way", label: "I'm On the Way" };
    if (current === "On_the_way") return { key: "Arrived", label: "I've Arrived" };
    if (current === "Arrived") return { key: "Completed", label: "Rescue Completed" };
    return null;
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <StatusBar barStyle="light-content" backgroundColor="#0d4f4f" />
        <View style={styles.header}><Text style={styles.headerTitle}>Active Rescue</Text></View>
        <View style={styles.center}><ActivityIndicator size="large" color="#0d9488" /></View>
      </SafeAreaView>
    );
  }

  if (!rescue) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <StatusBar barStyle="light-content" backgroundColor="#0d4f4f" />
        <View style={styles.header}><Text style={styles.headerTitle}>Active Rescue</Text></View>
        <View style={styles.center}>
          <Ionicons name="shield-checkmark" size={64} color="#d1d5db" />
          <Text style={styles.emptyText}>No active rescue</Text>
          <Text style={styles.emptySub}>Accept an assignment from the Assignments tab</Text>
        </View>
      </SafeAreaView>
    );
  }

  const nextStatus = getNextStatus();
  const currentStepIdx = STATUS_STEPS.findIndex((s) => s.key === rescue.req_status);

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <StatusBar barStyle="light-content" backgroundColor="#0d4f4f" />
      <View style={styles.header}>
        <Ionicons name="navigate" size={20} color="#fff" />
        <Text style={styles.headerTitle}>Active Rescue #{rescue.id}</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {/* Evacuee info card */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Evacuee</Text>
          <Text style={styles.name}>{rescue.full_name}</Text>
          {rescue.barangay_name && <Text style={styles.barangay}>{rescue.barangay_name}</Text>}
          {rescue.contact_no && (
            <View style={styles.infoRow}>
              <Ionicons name="call" size={14} color="#0d9488" />
              <Text style={styles.infoText}>{rescue.contact_no}</Text>
            </View>
          )}
          <View style={styles.infoRow}>
            <Ionicons name="location" size={14} color="#dc2626" />
            <Text style={styles.infoText}>{rescue.lat?.toFixed(5)}, {rescue.lng?.toFixed(5)}</Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="alert-circle" size={14} color="#f59e0b" />
            <Text style={styles.infoText}>Status: {rescue.status_at_request?.replace("_", " ")}</Text>
          </View>
        </View>

        {/* Progress stepper */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Progress</Text>
          {STATUS_STEPS.map((step, i) => {
            const done = i <= currentStepIdx;
            return (
              <View key={step.key} style={styles.stepRow}>
                <View style={[styles.stepDot, done && { backgroundColor: step.color }]}>
                  <Ionicons name={step.icon} size={14} color={done ? "#fff" : "#d1d5db"} />
                </View>
                {i < STATUS_STEPS.length - 1 && (
                  <View style={[styles.stepLine, done && { backgroundColor: step.color }]} />
                )}
                <Text style={[styles.stepLabel, done && styles.stepLabelActive]}>{step.label}</Text>
              </View>
            );
          })}
        </View>

        {/* Next action button */}
        {nextStatus && (
          <TouchableOpacity
            style={[styles.actionBtn, updating && styles.actionBtnDisabled]}
            onPress={() => updateStatus(nextStatus.key)}
            disabled={updating}
          >
            {updating ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="arrow-forward-circle" size={20} color="#fff" />
                <Text style={styles.actionBtnText}>{nextStatus.label}</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea:         { flex: 1, backgroundColor: "#0d4f4f" },
  header:           { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 20, paddingVertical: 14 },
  headerTitle:      { color: "#fff", fontSize: 18, fontWeight: "800" },
  center:           { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#f1f5f9" },
  emptyText:        { fontSize: 16, fontWeight: "700", color: "#9ca3af", marginTop: 12 },
  emptySub:         { fontSize: 13, color: "#d1d5db", marginTop: 4, textAlign: "center", paddingHorizontal: 40 },
  scroll:           { flex: 1, backgroundColor: "#f1f5f9" },
  content:          { padding: 16, paddingBottom: 40 },
  card:             { backgroundColor: "#fff", borderRadius: 16, padding: 16, marginBottom: 12, elevation: 2, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 8 },
  sectionLabel:     { fontSize: 11, fontWeight: "700", color: "#94a3b8", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 },
  name:             { fontSize: 18, fontWeight: "800", color: "#1e293b", marginBottom: 2 },
  barangay:         { fontSize: 13, color: "#6b7280", marginBottom: 8 },
  infoRow:          { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
  infoText:         { fontSize: 13, color: "#4b5563" },
  stepRow:          { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16, position: "relative" },
  stepDot:          { width: 28, height: 28, borderRadius: 14, backgroundColor: "#e2e8f0", justifyContent: "center", alignItems: "center" },
  stepLine:         { position: "absolute", left: 13, top: 28, width: 2, height: 16, backgroundColor: "#e2e8f0" },
  stepLabel:        { fontSize: 13, color: "#9ca3af", fontWeight: "600" },
  stepLabelActive:  { color: "#1e293b" },
  actionBtn:        { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#0d9488", paddingVertical: 16, borderRadius: 14, elevation: 3, shadowColor: "#0d9488", shadowOpacity: 0.3, shadowRadius: 8 },
  actionBtnDisabled:{ backgroundColor: "#99f6e4", elevation: 0 },
  actionBtnText:    { color: "#fff", fontSize: 16, fontWeight: "800" },
});
