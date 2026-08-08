import { useState, useEffect } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, StatusBar, Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { clearToken, getToken } from "../../hooks/use-auth";
import { API_BASE_URL } from "../../constants/config";
import * as WsClient from "../../services/websocket-client";
import * as GpsTracker from "../../services/gps-tracker";

export default function RescuerProfileScreen() {
  const [username, setUsername] = useState("Rescuer");
  const [barangay, setBarangay] = useState("");

  useEffect(() => {
    // Decode JWT to get username (simple base64 decode of payload)
    (async () => {
      const token = await getToken();
      if (!token) return;
      try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        setUsername(payload.username || "Rescuer");
        // Fetch barangay name
        if (payload.barangay_id) {
          const res = await fetch(`${API_BASE_URL}/api/barangays/list`);
          const data = await res.json();
          const found = (data.data || []).find((b: any) => b.id === payload.barangay_id);
          if (found) setBarangay(found.name);
        }
      } catch { /* silent */ }
    })();
  }, []);

  function handleLogout() {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          WsClient.disconnect();
          GpsTracker.stop();
          await clearToken();
          router.replace("/(auth)/login");
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <StatusBar barStyle="light-content" backgroundColor="#0d4f4f" />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile</Text>
      </View>

      <View style={styles.content}>
        {/* Avatar */}
        <View style={styles.avatarWrap}>
          <View style={styles.avatar}>
            <Ionicons name="shield-checkmark" size={40} color="#0d9488" />
          </View>
          <Text style={styles.username}>{username}</Text>
          <View style={styles.roleBadge}>
            <Text style={styles.roleText}>Rescuer</Text>
          </View>
          {barangay ? <Text style={styles.barangayText}>Brgy. {barangay}</Text> : null}
        </View>

        {/* Info cards */}
        <View style={styles.card}>
          <View style={styles.cardRow}>
            <Ionicons name="person" size={18} color="#64748b" />
            <View style={styles.cardRowInfo}>
              <Text style={styles.cardLabel}>Username</Text>
              <Text style={styles.cardValue}>{username}</Text>
            </View>
          </View>
          <View style={styles.divider} />
          <View style={styles.cardRow}>
            <Ionicons name="location" size={18} color="#64748b" />
            <View style={styles.cardRowInfo}>
              <Text style={styles.cardLabel}>Assigned Barangay</Text>
              <Text style={styles.cardValue}>{barangay || "—"}</Text>
            </View>
          </View>
          <View style={styles.divider} />
          <View style={styles.cardRow}>
            <Ionicons name="radio" size={18} color="#64748b" />
            <View style={styles.cardRowInfo}>
              <Text style={styles.cardLabel}>GPS Tracking</Text>
              <Text style={[styles.cardValue, { color: "#16a34a" }]}>Active</Text>
            </View>
          </View>
        </View>

        {/* Logout */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={18} color="#dc2626" />
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea:     { flex: 1, backgroundColor: "#0d4f4f" },
  header:       { paddingHorizontal: 20, paddingVertical: 14 },
  headerTitle:  { color: "#fff", fontSize: 18, fontWeight: "800" },
  content:      { flex: 1, backgroundColor: "#f1f5f9", padding: 20 },
  avatarWrap:   { alignItems: "center", marginBottom: 24 },
  avatar:       { width: 80, height: 80, borderRadius: 40, backgroundColor: "#ccfbf1", justifyContent: "center", alignItems: "center", marginBottom: 12 },
  username:     { fontSize: 20, fontWeight: "800", color: "#1e293b" },
  roleBadge:    { backgroundColor: "#0d9488", paddingHorizontal: 12, paddingVertical: 4, borderRadius: 8, marginTop: 6 },
  roleText:     { color: "#fff", fontSize: 11, fontWeight: "700" },
  barangayText: { color: "#64748b", fontSize: 13, marginTop: 6 },
  card:         { backgroundColor: "#fff", borderRadius: 16, padding: 16, elevation: 2, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 8, marginBottom: 20 },
  cardRow:      { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 },
  cardRowInfo:  { flex: 1 },
  cardLabel:    { fontSize: 11, color: "#94a3b8", fontWeight: "600" },
  cardValue:    { fontSize: 14, color: "#1e293b", fontWeight: "600", marginTop: 1 },
  divider:      { height: 1, backgroundColor: "#f1f5f9" },
  logoutBtn:    { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#fff", paddingVertical: 14, borderRadius: 14, borderWidth: 1.5, borderColor: "#fecaca" },
  logoutText:   { color: "#dc2626", fontSize: 14, fontWeight: "700" },
});
