import { useState, useEffect, useCallback, useRef } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, Alert,
  ActivityIndicator, ScrollView, Linking, RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { API_BASE_URL } from "../../constants/config";
import { getToken } from "../../hooks/use-auth";
import * as GpsTracker from "../../services/gps-tracker";
import { RC, RADIUS, SPACING, shadow, glow, statusColors } from "../../features/rescuer/theme";
import { RescuerScreen, ScreenHeader, Card } from "../../features/rescuer/components";

type ActiveRescue = {
  id: number;
  full_name: string;
  lat: number;
  lng: number;
  best_lat?: number;
  best_lng?: number;
  status_at_request: string;
  user_status?: string;
  req_status: string;
  requested_at: string;
  contact_no?: string;
  barangay_name?: string;
  responder_id?: number | null;
  is_online?: boolean;
};

const STATUS_STEPS = [
  { key: "Ongoing", label: "Accepted", icon: "checkmark-circle" as const, color: RC.primary },
  { key: "On_the_way", label: "On the Way", icon: "car" as const, color: RC.blue },
  { key: "Arrived", label: "Arrived", icon: "location" as const, color: RC.purple },
  { key: "Completed", label: "Completed", icon: "flag" as const, color: RC.green },
];

/** Decode the (unverified) JWT payload to read this rescuer's account id. */
function decodeJwt(token: string): any {
  try {
    const b = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(b.padEnd(b.length + ((4 - (b.length % 4)) % 4), "=")));
  } catch { return null; }
}

export default function ActiveRescueScreen() {
  const [rescue, setRescue] = useState<ActiveRescue | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [localStep, setLocalStep] = useState<string>("Ongoing");
  // Context for the empty state: how many requests exist that AREN'T mine.
  const [otherActive, setOtherActive] = useState(0);
  const [myId, setMyId] = useState<number | null>(null);
  const gpsInterval = useRef<any>(null);

  // Resolve this rescuer's account id (responder_id points to lgu_accounts.id,
  // which equals user_id in the rescuer JWT).
  useEffect(() => {
    (async () => {
      const token = await getToken();
      if (!token) return;
      const p = decodeJwt(token);
      if (p?.user_id != null) setMyId(Number(p.user_id));
    })();
  }, []);

  const fetchActive = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) { setLoading(false); return; }
      const meId = myId ?? (() => {
        const p = decodeJwt(token);
        return p?.user_id != null ? Number(p.user_id) : null;
      })();

      // Use /api/rescue/list — it allows the Rescuer role and returns
      // responder_id + best_lat/best_lng + is_online for each request.
      const res = await fetch(`${API_BASE_URL}/api/rescue/list?status=Ongoing`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      const list: ActiveRescue[] = data.rescue_requests || data.data || [];

      // My active rescue = an Ongoing request whose responder is me.
      const mine = meId != null
        ? list.find((r) => Number(r.responder_id) === meId && r.req_status === "Ongoing")
        : null;

      // Count Ongoing rescues assigned to someone else (for the empty-state hint).
      const others = list.filter(
        (r) => r.req_status === "Ongoing" && (meId == null || Number(r.responder_id) !== meId)
      ).length;
      setOtherActive(others);

      if (mine) {
        setRescue((prev) => {
          // Reset the local step only when switching to a different rescue.
          if (!prev || prev.id !== mine.id) setLocalStep("Ongoing");
          return mine;
        });
      } else {
        setRescue(null);
        setLocalStep("Ongoing");
      }
    } catch { /* silent */ }
    finally { setLoading(false); setRefreshing(false); }
  }, [myId]);

  useEffect(() => {
    fetchActive();
    const interval = setInterval(fetchActive, 5000);
    return () => clearInterval(interval);
  }, [fetchActive]);

  useEffect(() => {
    if (!rescue || (localStep !== "On_the_way" && localStep !== "Arrived")) {
      if (gpsInterval.current) { clearInterval(gpsInterval.current); gpsInterval.current = null; }
      return;
    }
    const postLocation = async () => {
      const coords = GpsTracker.getLastCoords();
      if (!coords) return;
      try {
        const token = await getToken();
        await fetch(`${API_BASE_URL}/api/rescue/location`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ lat: coords.latitude, lng: coords.longitude, rescue_id: rescue.id }),
        });
      } catch {}
    };
    postLocation();
    gpsInterval.current = setInterval(postLocation, 3000);
    return () => { if (gpsInterval.current) clearInterval(gpsInterval.current); };
  }, [localStep, rescue]);

  async function handleNextStep() {
    if (!rescue) return;
    if (localStep === "Ongoing") { setLocalStep("On_the_way"); return; }
    if (localStep === "On_the_way") { setLocalStep("Arrived"); return; }
    if (localStep === "Arrived") {
      setUpdating(true);
      try {
        const token = await getToken();
        await fetch(`${API_BASE_URL}/api/rescue/update_lgu`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ id: rescue.id, req_status: "Completed" }),
        });
        setRescue(null);
        setLocalStep("Ongoing");
        Alert.alert("Rescue Completed", "Great work! The evacuee has been rescued.");
        fetchActive();
      } catch {
        Alert.alert("Error", "Failed to complete rescue");
      } finally { setUpdating(false); }
    }
  }

  function getNext(): { label: string; icon: keyof typeof Ionicons.glyphMap; color: string } | null {
    if (localStep === "Ongoing") return { label: "I'm On the Way", icon: "car", color: RC.blue };
    if (localStep === "On_the_way") return { label: "I've Arrived", icon: "location", color: RC.purple };
    if (localStep === "Arrived") return { label: "Rescue Completed", icon: "flag", color: RC.green };
    return null;
  }

  if (loading) {
    return (
      <RescuerScreen>
        <ScreenHeader title="Active Rescue" icon="navigate" />
        <View style={styles.center}><ActivityIndicator size="large" color={RC.primary} /></View>
      </RescuerScreen>
    );
  }

  // ── No rescue assigned to me ────────────────────────────────────────────────
  if (!rescue) {
    return (
      <RescuerScreen>
        <ScreenHeader title="Active Rescue" subtitle="No assignment in progress" icon="navigate" />
        <ScrollView
          contentContainerStyle={styles.emptyScroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchActive(); }} tintColor={RC.primary} />}
        >
          {/* Status banner — the explicit "no active rescue" state the rescuer asked for */}
          <View style={styles.statusBanner}>
            <View style={styles.statusIconIdle}>
              <Ionicons name="shield-outline" size={26} color={RC.textMuted} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.statusBannerTitle}>No active rescue</Text>
              <Text style={styles.statusBannerSub}>
                You have no rescue in progress right now.
              </Text>
            </View>
            <View style={styles.idlePill}>
              <View style={styles.idleDot} />
              <Text style={styles.idlePillTxt}>Standby</Text>
            </View>
          </View>

          {/* Contextual hint: are there rescues out there, just not mine? */}
          <Card style={styles.hintCard}>
            {otherActive > 0 ? (
              <>
                <Ionicons name="people-outline" size={22} color={RC.blue} />
                <Text style={styles.hintTitle}>
                  {otherActive} rescue{otherActive > 1 ? "s" : ""} in progress by other rescuers
                </Text>
                <Text style={styles.hintSub}>
                  A request becomes your active rescue only once it is assigned to you.
                  Accept a pending request from Assignments to start.
                </Text>
              </>
            ) : (
              <>
                <Ionicons name="checkmark-done-circle-outline" size={22} color={RC.green} />
                <Text style={styles.hintTitle}>All clear in your area</Text>
                <Text style={styles.hintSub}>
                  When you accept a request, it will appear here with live progress and navigation.
                </Text>
              </>
            )}
            <TouchableOpacity style={styles.goAssignBtn} onPress={() => router.push("/(rescuer)/assignments")}>
              <Ionicons name="list" size={16} color={RC.primary} />
              <Text style={styles.goAssignTxt}>View Assignments</Text>
            </TouchableOpacity>
          </Card>
        </ScrollView>
      </RescuerScreen>
    );
  }

  const next = getNext();
  const currentStepIdx = STATUS_STEPS.findIndex((s) => s.key === localStep);
  const sc = statusColors(localStep);
  const danger = (rescue.status_at_request || rescue.user_status || "").toLowerCase().includes("danger");
  const destLat = rescue.best_lat ?? rescue.lat;
  const destLng = rescue.best_lng ?? rescue.lng;

  return (
    <RescuerScreen>
      <ScreenHeader title={`Active Rescue #${rescue.id}`} subtitle={STATUS_STEPS[currentStepIdx]?.label} icon="navigate" />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchActive(); }} tintColor={RC.primary} />}
      >
        {/* Assignment confirmation strip */}
        <View style={styles.assignedStrip}>
          <Ionicons name="person-circle" size={16} color={RC.primary} />
          <Text style={styles.assignedTxt}>Assigned to you</Text>
          <View style={[styles.livePill, { backgroundColor: rescue.is_online ? "#dcfce7" : RC.divider }]}>
            <View style={[styles.liveDot, { backgroundColor: rescue.is_online ? RC.green : RC.textFaint }]} />
            <Text style={[styles.livePillTxt, { color: rescue.is_online ? RC.green : RC.textMuted }]}>
              {rescue.is_online ? "Live location" : "Last known"}
            </Text>
          </View>
        </View>

        {/* Hero evacuee card */}
        <Card style={[styles.hero, danger && styles.heroDanger]}>
          <View style={styles.heroTop}>
            <View style={styles.heroAvatar}>
              <Text style={styles.heroAvatarTxt}>{(rescue.full_name || "U").trim().charAt(0).toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroName}>{rescue.full_name}</Text>
              {rescue.barangay_name ? <Text style={styles.heroBarangay}>{rescue.barangay_name}</Text> : null}
            </View>
            <View style={[styles.statusPill, { backgroundColor: sc.bg }]}>
              <Text style={[styles.statusPillTxt, { color: sc.fg }]}>{STATUS_STEPS[currentStepIdx]?.label}</Text>
            </View>
          </View>

          {danger && (
            <View style={styles.dangerBanner}>
              <Ionicons name="warning" size={16} color="#fff" />
              <Text style={styles.dangerBannerTxt}>Evacuee reported in danger — prioritize</Text>
            </View>
          )}

          <View style={styles.heroMeta}>
            <View style={styles.metaItem}>
              <Ionicons name="location-outline" size={15} color={RC.red} />
              <Text style={styles.metaText}>{destLat?.toFixed(5)}, {destLng?.toFixed(5)}</Text>
            </View>
            <View style={styles.metaItem}>
              <Ionicons name="alert-circle-outline" size={15} color={RC.amber} />
              <Text style={styles.metaText}>{rescue.status_at_request?.replace("_", " ")}</Text>
            </View>
          </View>

          <View style={styles.quickActions}>
            {rescue.contact_no ? (
              <TouchableOpacity style={styles.callBtn} onPress={() => Linking.openURL(`tel:${rescue.contact_no}`)}>
                <Ionicons name="call" size={16} color="#fff" />
                <Text style={styles.callTxt}>Call</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity style={styles.mapBtn} onPress={() => router.push("/(rescuer)/rescue-map")}>
              <Ionicons name="navigate" size={16} color={RC.primary} />
              <Text style={styles.mapTxt}>Navigate on Map</Text>
            </TouchableOpacity>
          </View>
        </Card>

        {/* Horizontal progress stepper */}
        <Card>
          <Text style={styles.sectionLabel}>Progress</Text>
          <View style={styles.stepper}>
            {STATUS_STEPS.map((step, i) => {
              const done = i <= currentStepIdx;
              const isLast = i === STATUS_STEPS.length - 1;
              return (
                <View key={step.key} style={styles.stepCol}>
                  <View style={styles.stepIconRow}>
                    <View style={[styles.stepDot, done && { backgroundColor: step.color }]}>
                      <Ionicons name={step.icon} size={15} color={done ? "#fff" : RC.textFaint} />
                    </View>
                    {!isLast && <View style={[styles.stepBar, i < currentStepIdx && { backgroundColor: step.color }]} />}
                  </View>
                  <Text style={[styles.stepLabel, done && styles.stepLabelActive]} numberOfLines={1}>{step.label}</Text>
                </View>
              );
            })}
          </View>
        </Card>

        {next && (
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: next.color }, glow(next.color), updating && styles.actionBtnDisabled]}
            onPress={handleNextStep}
            disabled={updating}
            activeOpacity={0.9}
          >
            {updating ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name={next.icon} size={20} color="#fff" />
                <Text style={styles.actionBtnText}>{next.label}</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </ScrollView>
    </RescuerScreen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: RC.bg, padding: SPACING.xl },

  emptyScroll: { flexGrow: 1, backgroundColor: RC.bg, padding: SPACING.lg, gap: SPACING.md },
  statusBanner: { flexDirection: "row", alignItems: "center", gap: SPACING.md, backgroundColor: RC.surface, borderRadius: RADIUS.lg, padding: SPACING.lg, ...shadow(2) },
  statusIconIdle: { width: 48, height: 48, borderRadius: RADIUS.md, backgroundColor: RC.divider, justifyContent: "center", alignItems: "center" },
  statusBannerTitle: { fontSize: 16, fontWeight: "800", color: RC.text },
  statusBannerSub: { fontSize: 12.5, color: RC.textMuted, marginTop: 2 },
  idlePill: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#fef3c7", paddingHorizontal: 10, paddingVertical: 5, borderRadius: RADIUS.pill },
  idleDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: RC.amber },
  idlePillTxt: { fontSize: 11, fontWeight: "800", color: "#b45309" },

  hintCard: { alignItems: "center", gap: SPACING.sm, paddingVertical: SPACING.xl },
  hintTitle: { fontSize: 15, fontWeight: "800", color: RC.text, textAlign: "center", marginTop: 4 },
  hintSub: { fontSize: 13, color: RC.textFaint, textAlign: "center", lineHeight: 19, paddingHorizontal: SPACING.md },
  goAssignBtn: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: SPACING.md, paddingHorizontal: 18, paddingVertical: 11, borderRadius: RADIUS.pill, backgroundColor: RC.primaryTint, borderWidth: 1.5, borderColor: RC.primarySoft },
  goAssignTxt: { color: RC.primary, fontWeight: "800", fontSize: 13.5 },

  scroll: { flex: 1, backgroundColor: RC.bg },
  content: { padding: SPACING.lg, paddingBottom: 40, gap: SPACING.md },

  assignedStrip: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: RC.primaryTint, borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderWidth: 1, borderColor: RC.primarySoft },
  assignedTxt: { fontSize: 12.5, fontWeight: "800", color: RC.primary, flex: 1 },
  livePill: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 9, paddingVertical: 4, borderRadius: RADIUS.pill },
  liveDot: { width: 7, height: 7, borderRadius: 4 },
  livePillTxt: { fontSize: 10.5, fontWeight: "800" },

  hero: { padding: SPACING.lg },
  heroDanger: { borderTopWidth: 4, borderTopColor: RC.red },
  heroTop: { flexDirection: "row", alignItems: "center", gap: SPACING.md },
  heroAvatar: { width: 50, height: 50, borderRadius: RADIUS.lg, backgroundColor: RC.primarySoft, justifyContent: "center", alignItems: "center" },
  heroAvatarTxt: { fontSize: 22, fontWeight: "800", color: RC.primary },
  heroName: { fontSize: 19, fontWeight: "800", color: RC.text },
  heroBarangay: { fontSize: 13, color: RC.textMuted, marginTop: 1 },
  statusPill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: RADIUS.pill },
  statusPillTxt: { fontSize: 11, fontWeight: "800" },

  dangerBanner: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: RC.red, borderRadius: RADIUS.md, paddingHorizontal: 12, paddingVertical: 9, marginTop: SPACING.md },
  dangerBannerTxt: { color: "#fff", fontSize: 12.5, fontWeight: "700", flex: 1 },

  heroMeta: { gap: 6, backgroundColor: RC.bgAlt, borderRadius: RADIUS.md, padding: SPACING.md, marginTop: SPACING.md },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 8 },
  metaText: { fontSize: 13, color: RC.textMuted, fontWeight: "600" },

  quickActions: { flexDirection: "row", gap: SPACING.md, marginTop: SPACING.md },
  callBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: RC.primary, paddingVertical: 11, borderRadius: RADIUS.md },
  callTxt: { color: "#fff", fontWeight: "800", fontSize: 13.5 },
  mapBtn: { flex: 1.4, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: RC.primaryTint, borderWidth: 1.5, borderColor: RC.primarySoft, paddingVertical: 11, borderRadius: RADIUS.md },
  mapTxt: { color: RC.primary, fontWeight: "800", fontSize: 13.5 },

  sectionLabel: { fontSize: 11, fontWeight: "800", color: RC.textFaint, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: SPACING.lg },
  stepper: { flexDirection: "row", justifyContent: "space-between" },
  stepCol: { flex: 1, alignItems: "center" },
  stepIconRow: { flexDirection: "row", alignItems: "center", width: "100%", justifyContent: "center" },
  stepDot: { width: 34, height: 34, borderRadius: 17, backgroundColor: RC.divider, justifyContent: "center", alignItems: "center", zIndex: 2 },
  stepBar: { position: "absolute", left: "50%", right: "-50%", height: 3, backgroundColor: RC.divider, top: 15.5 },
  stepLabel: { fontSize: 11, color: RC.textFaint, fontWeight: "700", marginTop: 8, textAlign: "center" },
  stepLabelActive: { color: RC.text },

  actionBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 17, borderRadius: RADIUS.lg, marginTop: SPACING.xs },
  actionBtnDisabled: { opacity: 0.6 },
  actionBtnText: { color: "#fff", fontSize: 16.5, fontWeight: "800" },
});
