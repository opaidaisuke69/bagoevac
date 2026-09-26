import { useState, useEffect } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigationContainerRef } from "expo-router";
import { CommonActions } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { clearToken, getToken } from "../../hooks/use-auth";
import { API_BASE_URL } from "../../constants/config";
import * as WsClient from "../../services/websocket-client";
import * as GpsTracker from "../../services/gps-tracker";
import { RC, RADIUS, SPACING, shadow } from "../../features/rescuer/theme";
import { RescuerScreen, ScreenHeader, Card } from "../../features/rescuer/components";

const RESCUER_PROFILE_CACHE_KEY = "brfe_rescuer_profile_cache";

export default function RescuerProfileScreen() {
  const navigationRef = useNavigationContainerRef();
  const [username, setUsername] = useState("Rescuer");
  const [barangay, setBarangay] = useState("");
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    (async () => {
      const token = await getToken();
      if (!token) return;
      try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        setUsername(payload.username || "Rescuer");
        if (payload.barangay_id) {
          try {
            const res = await fetch(`${API_BASE_URL}/api/barangays/list`);
            const data = await res.json();
            const found = (data.data || []).find((b: any) => b.id === payload.barangay_id);
            if (found) {
              setBarangay(found.name);
              setIsOffline(false);
              await AsyncStorage.setItem(RESCUER_PROFILE_CACHE_KEY, JSON.stringify({ username: payload.username || "Rescuer", barangay: found.name }));
            }
          } catch {
            try {
              const cached = await AsyncStorage.getItem(RESCUER_PROFILE_CACHE_KEY);
              if (cached) {
                const data = JSON.parse(cached);
                setUsername(data.username || "Rescuer");
                setBarangay(data.barangay || "");
                setIsOffline(true);
              }
            } catch { /* silent */ }
          }
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
          navigationRef.dispatch(
            CommonActions.reset({ index: 0, routes: [{ name: "(auth)", params: { screen: "login" } }] })
          );
        },
      },
    ]);
  }

  const initial = (username || "R").trim().charAt(0).toUpperCase();

  return (
    <RescuerScreen>
      <ScreenHeader title="Profile" icon="person-circle" />

      <ScrollView style={styles.body} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {isOffline && (
          <View style={styles.offlineBanner}>
            <Ionicons name="cloud-offline-outline" size={16} color="#92400e" />
            <Text style={styles.offlineTxt}>You're offline. Showing cached profile.</Text>
          </View>
        )}

        {/* Identity card */}
        <Card style={styles.identity}>
          <View style={styles.avatar}>
            <Text style={styles.avatarTxt}>{initial}</Text>
            <View style={styles.onlineRing} />
          </View>
          <Text style={styles.username}>{username}</Text>
          <View style={styles.roleBadge}>
            <Ionicons name="shield-checkmark" size={12} color="#fff" />
            <Text style={styles.roleText}>Rescuer</Text>
          </View>
          {barangay ? <Text style={styles.barangayText}>Brgy. {barangay}</Text> : null}
        </Card>

        {/* Status chips */}
        <View style={styles.statsRow}>
          <View style={styles.statChip}>
            <View style={[styles.statIcon, { backgroundColor: RC.primaryTint }]}>
              <Ionicons name="radio" size={18} color={RC.primary} />
            </View>
            <Text style={styles.statVal}>Active</Text>
            <Text style={styles.statLbl}>GPS Tracking</Text>
          </View>
          <View style={styles.statChip}>
            <View style={[styles.statIcon, { backgroundColor: isOffline ? "#fef3c7" : "#dcfce7" }]}>
              <Ionicons name={isOffline ? "cloud-offline" : "cloud-done"} size={18} color={isOffline ? "#b45309" : RC.green} />
            </View>
            <Text style={styles.statVal}>{isOffline ? "Offline" : "Online"}</Text>
            <Text style={styles.statLbl}>Connection</Text>
          </View>
        </View>

        {/* Details */}
        <Card style={{ padding: 0 }}>
          <Text style={styles.sectionLabel}>Account details</Text>
          <View style={styles.row}>
            <View style={styles.rowIcon}><Ionicons name="person-outline" size={18} color={RC.textMuted} /></View>
            <View style={styles.rowInfo}>
              <Text style={styles.rowLabel}>Username</Text>
              <Text style={styles.rowValue}>{username}</Text>
            </View>
          </View>
          <View style={styles.divider} />
          <View style={styles.row}>
            <View style={styles.rowIcon}><Ionicons name="location-outline" size={18} color={RC.textMuted} /></View>
            <View style={styles.rowInfo}>
              <Text style={styles.rowLabel}>Assigned Barangay</Text>
              <Text style={styles.rowValue}>{barangay || "—"}</Text>
            </View>
          </View>
          <View style={styles.divider} />
          <View style={styles.row}>
            <View style={styles.rowIcon}><Ionicons name="shield-checkmark-outline" size={18} color={RC.textMuted} /></View>
            <View style={styles.rowInfo}>
              <Text style={styles.rowLabel}>Role</Text>
              <Text style={styles.rowValue}>Field Rescuer</Text>
            </View>
          </View>
        </Card>

        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.85}>
          <Ionicons name="log-out-outline" size={18} color={RC.redDark} />
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>

        <Text style={styles.footer}>Bago Evac · Rescuer</Text>
      </ScrollView>
    </RescuerScreen>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, backgroundColor: RC.bg },
  content: { padding: SPACING.xl, paddingBottom: 40, gap: SPACING.lg },

  offlineBanner: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#fef3c7", borderWidth: 1, borderColor: "#fde68a", borderRadius: RADIUS.md, paddingHorizontal: 14, paddingVertical: 10 },
  offlineTxt: { fontSize: 13, color: "#92400e", fontWeight: "700", flex: 1 },

  identity: { alignItems: "center", paddingVertical: SPACING.xl },
  avatar: { width: 88, height: 88, borderRadius: 44, backgroundColor: RC.primarySoft, justifyContent: "center", alignItems: "center", marginBottom: SPACING.md },
  avatarTxt: { fontSize: 36, fontWeight: "800", color: RC.primary },
  onlineRing: { position: "absolute", bottom: 4, right: 4, width: 18, height: 18, borderRadius: 9, backgroundColor: RC.green, borderWidth: 3, borderColor: RC.surface },
  username: { fontSize: 22, fontWeight: "800", color: RC.text },
  roleBadge: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: RC.primary, paddingHorizontal: 12, paddingVertical: 5, borderRadius: RADIUS.pill, marginTop: SPACING.sm },
  roleText: { color: "#fff", fontSize: 11, fontWeight: "800", letterSpacing: 0.3 },
  barangayText: { color: RC.textMuted, fontSize: 13.5, marginTop: SPACING.sm, fontWeight: "600" },

  statsRow: { flexDirection: "row", gap: SPACING.md },
  statChip: { flex: 1, backgroundColor: RC.surface, borderRadius: RADIUS.lg, padding: SPACING.lg, alignItems: "center", ...shadow(2) },
  statIcon: { width: 40, height: 40, borderRadius: RADIUS.md, justifyContent: "center", alignItems: "center", marginBottom: SPACING.sm },
  statVal: { fontSize: 15, fontWeight: "800", color: RC.text },
  statLbl: { fontSize: 11, color: RC.textFaint, fontWeight: "600", marginTop: 1 },

  sectionLabel: { fontSize: 11, fontWeight: "800", color: RC.textFaint, textTransform: "uppercase", letterSpacing: 0.6, padding: SPACING.lg, paddingBottom: SPACING.sm },
  row: { flexDirection: "row", alignItems: "center", gap: SPACING.md, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md },
  rowIcon: { width: 36, height: 36, borderRadius: RADIUS.md, backgroundColor: RC.bgAlt, justifyContent: "center", alignItems: "center" },
  rowInfo: { flex: 1 },
  rowLabel: { fontSize: 11.5, color: RC.textFaint, fontWeight: "600" },
  rowValue: { fontSize: 14.5, color: RC.text, fontWeight: "700", marginTop: 1 },
  divider: { height: 1, backgroundColor: RC.divider, marginLeft: 64 },

  logoutBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: RC.surface, paddingVertical: 15, borderRadius: RADIUS.lg, borderWidth: 1.5, borderColor: "#fecaca" },
  logoutText: { color: RC.redDark, fontSize: 14.5, fontWeight: "800" },
  footer: { textAlign: "center", color: RC.textFaint, fontSize: 12, fontWeight: "600", marginTop: SPACING.sm },
});
