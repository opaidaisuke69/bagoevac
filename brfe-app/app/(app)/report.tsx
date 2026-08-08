import { useState, useEffect } from "react";
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Alert, ActivityIndicator, Image, StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { API_BASE_URL } from "../../constants/config";
import { getToken } from "../../hooks/use-auth";
import * as GpsTracker from "../../services/gps-tracker";

const FLOOD_LEVELS = ["Low", "Moderate", "High", "Critical"] as const;
type FloodLevel = (typeof FLOOD_LEVELS)[number];

type ReportStatus = "Need_Assistance" | "In_Danger";

const LEVEL_CONFIG: Record<FloodLevel, { color: string; bg: string; icon: keyof typeof Ionicons.glyphMap }> = {
  Low:      { color: "#16a34a", bg: "#dcfce7", icon: "water-outline" },
  Moderate: { color: "#d97706", bg: "#fef9c3", icon: "water" },
  High:     { color: "#ea580c", bg: "#ffedd5", icon: "warning-outline" },
  Critical: { color: "#dc2626", bg: "#fee2e2", icon: "warning" },
};

const STATUS_OPTIONS: { value: ReportStatus; label: string; color: string; bg: string; headerBg: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: "Need_Assistance", label: "Need Help",  color: "#d97706", bg: "#fef9c3", headerBg: "#d97706", icon: "alert-circle" },
  { value: "In_Danger",       label: "In Danger",  color: "#dc2626", bg: "#fee2e2", headerBg: "#dc2626", icon: "warning"      },
];

export default function ReportScreen() {
  const [floodLevel,   setFloodLevel]   = useState<FloodLevel | null>(null);
  const [reportStatus, setReportStatus] = useState<ReportStatus | null>(null);
  const [description,  setDescription]  = useState("");
  const [photoUri,     setPhotoUri]     = useState<string | null>(null);
  const [errors,       setErrors]       = useState<Record<string, string>>({});
  const [submitting,   setSubmitting]   = useState(false);
  const [submitted,    setSubmitted]    = useState(false);
  const [liveCoords,   setLiveCoords]   = useState<GpsTracker.Coords | null>(GpsTracker.getLastCoords());
  const [gpsWaiting,   setGpsWaiting]   = useState(!GpsTracker.getLastCoords());

  // Dynamic header color based on selected status
  const activeStatusCfg = reportStatus ? STATUS_OPTIONS.find(s => s.value === reportStatus) : null;
  const headerColor = activeStatusCfg?.headerBg ?? "#1d4ed8";

  // Subscribe to GPS updates — same tracker used by the map screen
  useEffect(() => {
    GpsTracker.start();
    const unsubscribe = GpsTracker.onLocationUpdate((update) => {
      if (update.coords) {
        setLiveCoords(update.coords);
        setGpsWaiting(false);
      } else if (update.unavailable) {
        setGpsWaiting(true);
      }
    });
    return () => { unsubscribe(); };
  }, []);

  async function pickPhoto() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") { Alert.alert("Permission required", "Camera roll access is needed."); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7, allowsEditing: true });
    if (!result.canceled && result.assets.length > 0) setPhotoUri(result.assets[0].uri);
  }

  async function takePhoto() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") { Alert.alert("Permission required", "Camera access is needed."); return; }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.7, allowsEditing: true });
    if (!result.canceled && result.assets.length > 0) setPhotoUri(result.assets[0].uri);
  }

  async function handleSubmit() {
    const newErrors: Record<string, string> = {};
    if (!reportStatus) newErrors.status = "Please select your current status.";
    if (!floodLevel) newErrors.flood_level = "Please select a flood level.";
    if (!description.trim()) newErrors.description = "Description is required.";
    if (!liveCoords) newErrors.coords = "GPS location unavailable. Please wait for a fix.";
    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return; }
    setErrors({});
    setSubmitting(true);
    try {
      const token = await getToken();
      const formData = new FormData();
      formData.append("status", reportStatus!);
      formData.append("flood_level", floodLevel!);
      formData.append("description", description.trim());
      formData.append("lat", String(liveCoords!.latitude));
      formData.append("lng", String(liveCoords!.longitude));
      if (photoUri) {
        const filename = photoUri.split("/").pop() ?? "photo.jpg";
        const match = /\.(\w+)$/.exec(filename);
        const type = match ? `image/${match[1]}` : "image/jpeg";
        formData.append("photo", { uri: photoUri, name: filename, type } as unknown as Blob);
      }
      const res = await fetch(`${API_BASE_URL}/api/reports/post`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const json = await res.json() as { error?: boolean; status?: number; fields?: Record<string, string>; message?: string };
      if (json.error) {
        if (json.fields) setErrors(json.fields);
        else setErrors({ general: json.message ?? "Submission failed." });
        return;
      }
      setSubmitted(true);
      setFloodLevel(null);
      setReportStatus(null);
      setDescription("");
      setPhotoUri(null);
    } catch {
      setErrors({ general: "Network error. Please check your connection." });
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <StatusBar barStyle="light-content" backgroundColor="#1d4ed8" />
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Flood Report</Text>
        </View>
        <View style={styles.successContainer}>
          <View style={styles.successIconWrap}>
            <Ionicons name="checkmark-circle" size={56} color="#16a34a" />
          </View>
          <Text style={styles.successTitle}>Report Submitted!</Text>
          <Text style={styles.successSub}>Your report has been sent to the LGU. Thank you for helping keep Bago City safe.</Text>
          <TouchableOpacity style={styles.newReportBtn} onPress={() => setSubmitted(false)}>
            <Text style={styles.newReportBtnText}>Submit Another Report</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <StatusBar barStyle="light-content" backgroundColor={headerColor} />
      <View style={[styles.header, { backgroundColor: headerColor }]}>
        <Text style={styles.headerTitle}>Flood Report</Text>
        <Text style={styles.headerSub}>Report flood conditions in your area</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

        {/* Status */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Your Status <Text style={styles.req}>*</Text></Text>
          <View style={styles.statusRow}>
            {STATUS_OPTIONS.map((opt) => {
              const active = reportStatus === opt.value;
              return (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.statusBtn, { borderColor: opt.color }, active && { backgroundColor: opt.color }]}
                  onPress={() => setReportStatus(opt.value)}
                >
                  <Ionicons name={opt.icon} size={18} color={active ? "#fff" : opt.color} />
                  <Text style={[styles.statusBtnText, { color: active ? "#fff" : opt.color }]}>{opt.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {errors.status && <Text style={styles.errText}>{errors.status}</Text>}
        </View>

        {/* Flood Level */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Flood Level <Text style={styles.req}>*</Text></Text>
          <View style={styles.levelGrid}>
            {FLOOD_LEVELS.map((level) => {
              const cfg = LEVEL_CONFIG[level];
              const active = floodLevel === level;
              return (
                <TouchableOpacity
                  key={level}
                  style={[styles.levelBtn, active && { backgroundColor: cfg.color, borderColor: cfg.color }]}
                  onPress={() => setFloodLevel(level)}
                >
                  <Ionicons name={cfg.icon} size={20} color={active ? "#fff" : cfg.color} style={{ marginBottom: 3 }} />
                  <Text style={[styles.levelBtnText, active && styles.levelBtnTextActive]}>{level}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {errors.flood_level && <Text style={styles.errText}>{errors.flood_level}</Text>}
        </View>

        {/* Description */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Description <Text style={styles.req}>*</Text></Text>
          <TextInput
            style={[styles.textArea, errors.description && styles.inputErr]}
            placeholder="Describe the flood situation — water level, affected streets, number of people…"
            placeholderTextColor="#94a3b8"
            multiline
            numberOfLines={4}
            value={description}
            onChangeText={setDescription}
            textAlignVertical="top"
          />
          {errors.description && <Text style={styles.errText}>{errors.description}</Text>}
        </View>

        {/* GPS — live updating */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>GPS Location</Text>
          <View style={[styles.gpsCard, liveCoords ? styles.gpsCardOk : styles.gpsCardWaiting]}>
            <Ionicons
              name={liveCoords ? "navigate" : "location-outline"}
              size={22}
              color={liveCoords ? "#16a34a" : "#d97706"}
            />
            <View style={{ flex: 1 }}>
              <Text style={[styles.gpsStatus, liveCoords ? styles.gpsStatusOk : styles.gpsStatusWaiting]}>
                {gpsWaiting ? "GPS unavailable" : liveCoords ? "Live location" : "Waiting for GPS fix..."}
              </Text>
              {liveCoords ? (
                <Text style={styles.gpsCoords}>
                  {liveCoords.latitude.toFixed(5)}, {liveCoords.longitude.toFixed(5)}
                </Text>
              ) : (
                <Text style={styles.gpsHint}>This will be attached to your report automatically.</Text>
              )}
            </View>
            {liveCoords && (
              <View style={styles.liveDot} />
            )}
          </View>
          {errors.coords && <Text style={styles.errText}>{errors.coords}</Text>}
        </View>

        {/* Photo */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Photo <Text style={styles.optional}>(optional)</Text></Text>
          {photoUri ? (
            <View style={styles.photoPreviewWrap}>
              <Image source={{ uri: photoUri }} style={styles.photoPreview} />
              <TouchableOpacity style={styles.removePhotoBtn} onPress={() => setPhotoUri(null)}>
                <Ionicons name="trash-outline" size={14} color="#ef4444" />
                <Text style={styles.removePhotoText}>Remove</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.photoRow}>
              <TouchableOpacity style={styles.photoBtn} onPress={takePhoto}>
                <Ionicons name="camera-outline" size={24} color="#475569" style={{ marginBottom: 4 }} />
                <Text style={styles.photoBtnText}>Camera</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.photoBtn} onPress={pickPhoto}>
                <Ionicons name="images-outline" size={24} color="#475569" style={{ marginBottom: 4 }} />
                <Text style={styles.photoBtnText}>Gallery</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {errors.general && (
          <View style={styles.generalError}>
            <Ionicons name="alert-circle-outline" size={16} color="#dc2626" />
            <Text style={styles.generalErrorText}>{errors.general}</Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.submitBtnText}>Submit Report</Text>
          }
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea:    { flex: 1, backgroundColor: "#1d4ed8" },
  header:      { paddingHorizontal: 20, paddingVertical: 14, paddingBottom: 16 },
  headerTitle: { color: "#fff", fontWeight: "800", fontSize: 18 },
  headerSub:   { color: "rgba(255,255,255,0.65)", fontSize: 12, marginTop: 2 },
  scroll:      { flex: 1, backgroundColor: "#f8fafc" },
  content:     { padding: 16, paddingBottom: 40 },
  section: {
    backgroundColor: "#fff", borderRadius: 16, padding: 16, marginBottom: 12,
    elevation: 1, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 6,
  },
  sectionLabel: { fontSize: 14, fontWeight: "700", color: "#1e293b", marginBottom: 10 },
  req:          { color: "#ef4444" },
  optional:     { color: "#94a3b8", fontWeight: "400" },
  levelGrid:    { flexDirection: "row", gap: 8 },
  statusRow:    { flexDirection: "row", gap: 10 },
  statusBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, paddingVertical: 12, borderRadius: 12, borderWidth: 2, backgroundColor: "#f8fafc",
  },
  statusBtnText: { fontSize: 13, fontWeight: "700" },  levelBtn: {
    flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: 12,
    borderWidth: 2, borderColor: "#e2e8f0", backgroundColor: "#f8fafc",
  },
  levelBtnText:       { fontSize: 11, fontWeight: "700", color: "#475569" },
  levelBtnTextActive: { color: "#fff" },
  textArea: {
    backgroundColor: "#f8fafc", borderWidth: 1.5, borderColor: "#e2e8f0",
    borderRadius: 12, padding: 12, fontSize: 14, color: "#1e293b", minHeight: 110,
  },
  inputErr: { borderColor: "#ef4444" },
  errText:  { fontSize: 12, color: "#ef4444", marginTop: 6 },
  gpsCard:        { flexDirection: "row", alignItems: "center", borderRadius: 12, padding: 12, gap: 10 },
  gpsCardOk:      { backgroundColor: "#f0fdf4", borderWidth: 1, borderColor: "#bbf7d0" },
  gpsCardWaiting: { backgroundColor: "#fffbeb", borderWidth: 1, borderColor: "#fde68a" },
  gpsStatus:        { fontSize: 13, fontWeight: "700" },
  gpsStatusOk:      { color: "#16a34a" },
  gpsStatusWaiting: { color: "#d97706" },
  gpsCoords: { fontSize: 11, color: "#64748b", marginTop: 2, fontVariant: ["tabular-nums"] },
  gpsHint:   { fontSize: 11, color: "#94a3b8", marginTop: 2 },
  // Pulsing green dot to indicate live signal
  liveDot: {
    width: 8, height: 8, borderRadius: 4, backgroundColor: "#16a34a",
  },
  photoRow: { flexDirection: "row", gap: 10 },
  photoBtn: {
    flex: 1, alignItems: "center", paddingVertical: 16, borderRadius: 12,
    borderWidth: 1.5, borderColor: "#e2e8f0", borderStyle: "dashed", backgroundColor: "#f8fafc",
  },
  photoBtnText:    { fontSize: 13, color: "#475569", fontWeight: "600" },
  photoPreviewWrap: { alignItems: "flex-start" },
  photoPreview:    { width: "100%", height: 160, borderRadius: 12, borderWidth: 1, borderColor: "#e2e8f0" },
  removePhotoBtn:  { marginTop: 8, flexDirection: "row", alignItems: "center", gap: 4 },
  removePhotoText: { fontSize: 13, color: "#ef4444", fontWeight: "600" },
  generalError: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "#fef2f2", borderRadius: 12, padding: 14, marginBottom: 12,
    borderWidth: 1, borderColor: "#fecaca",
  },
  generalErrorText: { fontSize: 13, color: "#dc2626", fontWeight: "500" },
  submitBtn: {
    backgroundColor: "#1d4ed8", borderRadius: 14, paddingVertical: 16, alignItems: "center",
    marginTop: 4, elevation: 4, shadowColor: "#1d4ed8", shadowOpacity: 0.4, shadowRadius: 10,
  },
  submitBtnDisabled: { backgroundColor: "#93c5fd", elevation: 0, shadowOpacity: 0 },
  submitBtnText:     { color: "#fff", fontSize: 16, fontWeight: "800" },
  successContainer: { flex: 1, justifyContent: "center", alignItems: "center", padding: 32, backgroundColor: "#f8fafc" },
  successIconWrap:  { width: 100, height: 100, borderRadius: 50, backgroundColor: "#dcfce7", justifyContent: "center", alignItems: "center", marginBottom: 20 },
  successTitle:     { fontSize: 24, fontWeight: "800", color: "#1e293b", marginBottom: 10 },
  successSub:       { fontSize: 14, color: "#64748b", textAlign: "center", lineHeight: 22, marginBottom: 32 },
  newReportBtn:     { backgroundColor: "#1d4ed8", borderRadius: 14, paddingHorizontal: 32, paddingVertical: 14 },
  newReportBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
});