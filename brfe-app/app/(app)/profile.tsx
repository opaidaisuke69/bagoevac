import { useEffect, useState, useCallback } from "react";
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, Image,
  StyleSheet, ActivityIndicator, Alert, StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useFocusEffect } from "expo-router";
import { API_BASE_URL } from "../../constants/config";
import { getToken, clearToken } from "../../hooks/use-auth";
import { router } from "expo-router";
import * as WsClient from "../../services/websocket-client";

interface UserProfile {
  id: number; full_name: string; username: string | null; email: string | null;
  age: number; address: string; contact_no: string;
  emerg_name: string; emerg_no: string; barangay_id: number;
  status: string; avatar_path: string | null;
}

const STATUS_CFG: Record<string, { bg: string; text: string; border: string; label: string; icon: keyof typeof Ionicons.glyphMap }> = {
  Safe:            { bg: "#dcfce7", text: "#16a34a", border: "#86efac", label: "Safe",            icon: "checkmark-circle" },
  Need_Assistance: { bg: "#fef9c3", text: "#d97706", border: "#fde047", label: "Need Assistance", icon: "warning" },
  In_Danger:       { bg: "#fee2e2", text: "#dc2626", border: "#fca5a5", label: "In Danger",       icon: "alert-circle" },
};

type Section = "view" | "edit" | "password";

export default function ProfileScreen() {
  const [profile, setProfile]   = useState<UserProfile | null>(null);
  const [loading, setLoading]   = useState(true);
  const [section, setSection]   = useState<Section>("view");
  const [avatarUploading, setAvatarUploading] = useState(false);

  // Edit fields
  const [fullName, setFullName]   = useState("");
  const [username, setUsername]   = useState("");
  const [email, setEmail]         = useState("");
  const [age, setAge]             = useState("");
  const [address, setAddress]     = useState("");
  const [emergName, setEmergName] = useState("");
  const [emergNo, setEmergNo]     = useState("");
  const [saving, setSaving]       = useState(false);
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});

  // Password fields
  const [curPass, setCurPass]     = useState("");
  const [newPass, setNewPass]     = useState("");
  const [confirmPass, setConfirm] = useState("");
  const [showCur, setShowCur]     = useState(false);
  const [showNew, setShowNew]     = useState(false);
  const [changingPw, setChangingPw] = useState(false);
  const [pwErrors, setPwErrors]   = useState<Record<string, string>>({});

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getToken();
      if (!token) { doLogout(); return; }
      const res  = await fetch(`${API_BASE_URL}/api/users/get`, { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json();
      if (json.error) { if (json.status === 401) doLogout(); return; }
      const data: UserProfile = json.data ?? json;
      setProfile(data);
      setFullName(data.full_name ?? "");
      setUsername(data.username ?? "");
      setEmail(data.email ?? "");
      setAge(String(data.age ?? ""));
      setAddress(data.address ?? "");
      setEmergName(data.emerg_name ?? "");
      setEmergNo(data.emerg_no ?? "");
    } catch { /* non-fatal */ } finally { setLoading(false); }
  }, []);

  // Re-fetch every time the profile tab is focused
  useFocusEffect(
    useCallback(() => {
      fetchProfile();
    }, [fetchProfile])
  );

  // Also update status badge instantly when StatusSelector changes it
  useEffect(() => {
    const handler = (data: unknown) => {
      const ev = data as { user_id?: number; userId?: number; status?: string };
      const evUserId = ev.user_id ?? ev.userId;
      if (ev.status && profile && evUserId === profile.id) {
        setProfile((prev) => prev ? { ...prev, status: ev.status! } : prev);
      }
    };
    WsClient.on("status_change", handler);
    return () => WsClient.off("status_change", handler);
  }, [profile]);

  async function doLogout() {
    await clearToken();
    router.replace("/(auth)/login");
  }

  async function pickAvatar() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") { Alert.alert("Permission required", "Camera roll access is needed."); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8, allowsEditing: true, aspect: [1, 1] });
    if (result.canceled || !result.assets.length) return;
    uploadAvatar(result.assets[0].uri);
  }

  async function takeAvatarPhoto() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") { Alert.alert("Permission required", "Camera access is needed."); return; }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.8, allowsEditing: true, aspect: [1, 1] });
    if (result.canceled || !result.assets.length) return;
    uploadAvatar(result.assets[0].uri);
  }

  function showAvatarOptions() {
    Alert.alert("Profile Photo", "Choose an option", [
      { text: "Take Photo", onPress: takeAvatarPhoto },
      { text: "Choose from Gallery", onPress: pickAvatar },
      { text: "Cancel", style: "cancel" },
    ]);
  }

  async function uploadAvatar(uri: string) {
    setAvatarUploading(true);
    try {
      const token    = await getToken();
      const filename = uri.split("/").pop() ?? "avatar.jpg";
      const match    = /\.(\w+)$/.exec(filename);
      const type     = match ? `image/${match[1]}` : "image/jpeg";
      const formData = new FormData();
      formData.append("avatar", { uri, name: filename, type } as unknown as Blob);
      const res  = await fetch(`${API_BASE_URL}/api/users/avatar`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: formData });
      const json = await res.json();
      if (!json.error && profile) {
        setProfile({ ...profile, avatar_path: json.avatar_path });
      } else {
        Alert.alert("Upload failed", json.message ?? "Could not upload photo.");
      }
    } catch { Alert.alert("Error", "Network error. Please try again."); }
    finally { setAvatarUploading(false); }
  }

  async function handleSave() {
    const errs: Record<string, string> = {};
    if (!fullName.trim()) errs.full_name = "Full name is required.";
    const ageNum = parseInt(age, 10);
    if (!age || isNaN(ageNum) || ageNum < 1 || ageNum > 120) errs.age = "Enter a valid age (1-120).";
    if (!address.trim()) errs.address = "Address is required.";
    if (!emergName.trim()) errs.emerg_name = "Emergency contact name is required.";
    if (!emergNo.trim()) errs.emerg_no = "Emergency contact number is required.";
    if (!username.trim()) errs.username = "Username is required.";
    else if (!/^[a-zA-Z0-9._]{3,30}$/.test(username.trim())) errs.username = "3-30 chars: letters, numbers, . or _";
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) errs.email = "Enter a valid email address.";
    if (Object.keys(errs).length) { setEditErrors(errs); return; }
    setEditErrors({});
    setSaving(true);
    try {
      const token = await getToken();
      const res   = await fetch(`${API_BASE_URL}/api/users/update?id=${profile!.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ full_name: fullName.trim(), username: username.trim(), email: email.trim() || null, age: ageNum, address: address.trim(), barangay_id: profile!.barangay_id, emerg_name: emergName.trim(), emerg_no: emergNo.trim() }),
      });
      const json = await res.json();
      if (json.error) { if (json.fields) setEditErrors(json.fields); else setEditErrors({ general: json.message ?? "Update failed." }); return; }
      setProfile({ ...(json.data ?? json), avatar_path: profile!.avatar_path });
      setSection("view");
      Alert.alert("Saved", "Your profile has been updated.");
    } catch { setEditErrors({ general: "Network error. Please try again." }); }
    finally { setSaving(false); }
  }

  async function handleChangePassword() {
    const errs: Record<string, string> = {};
    if (!curPass) errs.current_password = "Current password is required.";
    if (!newPass) errs.new_password = "New password is required.";
    else if (newPass.length < 6) errs.new_password = "Must be at least 6 characters.";
    if (!confirmPass) errs.confirm_password = "Please confirm your new password.";
    else if (newPass !== confirmPass) errs.confirm_password = "Passwords do not match.";
    if (Object.keys(errs).length) { setPwErrors(errs); return; }
    setPwErrors({});
    setChangingPw(true);
    try {
      const token = await getToken();
      const res   = await fetch(`${API_BASE_URL}/api/users/change_password`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ current_password: curPass, new_password: newPass, confirm_password: confirmPass }),
      });
      const json = await res.json();
      if (json.error) { if (json.fields) setPwErrors(json.fields); else setPwErrors({ general: json.message ?? "Failed." }); return; }
      setCurPass(""); setNewPass(""); setConfirm("");
      setSection("view");
      Alert.alert("Done", "Password changed successfully.");
    } catch { setPwErrors({ general: "Network error. Please try again." }); }
    finally { setChangingPw(false); }
  }

  const avatarUrl = profile?.avatar_path ? `${API_BASE_URL}/${profile.avatar_path}` : null;
  const initials  = profile?.full_name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase() ?? "?";

  if (loading) return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <StatusBar barStyle="light-content" backgroundColor="#1d4ed8" />
      <View style={s.header}><Text style={s.headerTitle}>My Profile</Text></View>
      <View style={s.center}><ActivityIndicator size="large" color="#1d4ed8" /><Text style={s.loadingTxt}>Loading profile...</Text></View>
    </SafeAreaView>
  );

  if (!profile) return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <StatusBar barStyle="light-content" backgroundColor="#1d4ed8" />
      <View style={s.header}><Text style={s.headerTitle}>My Profile</Text></View>
      <View style={s.center}>
        <Ionicons name="person-circle-outline" size={64} color="#cbd5e1" />
        <Text style={s.errMsg}>Failed to load profile.</Text>
        <TouchableOpacity style={s.retryBtn} onPress={fetchProfile}><Text style={s.retryTxt}>Retry</Text></TouchableOpacity>
      </View>
    </SafeAreaView>
  );

  const sc = STATUS_CFG[profile.status] ?? { bg: "#f1f5f9", text: "#64748b", border: "#e2e8f0", label: profile.status, icon: "help-circle" as keyof typeof Ionicons.glyphMap };

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <StatusBar barStyle="light-content" backgroundColor="#1d4ed8" />
      <ScrollView style={s.scroll} contentContainerStyle={s.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        {/* Hero */}
        <View style={s.hero}>
          <TouchableOpacity style={s.avatarWrap} onPress={showAvatarOptions} disabled={avatarUploading}>
            {avatarUploading
              ? <View style={s.avatarImg}><ActivityIndicator color="#fff" /></View>
              : avatarUrl
                ? <Image source={{ uri: avatarUrl }} style={s.avatarImg} />
                : <View style={s.avatarImg}><Text style={s.avatarTxt}>{initials}</Text></View>
            }
            <View style={s.avatarBadge}><Ionicons name="camera" size={12} color="#fff" /></View>
          </TouchableOpacity>
          <Text style={s.name}>{profile.full_name}</Text>
          {profile.username ? <Text style={s.usernameLabel}>@{profile.username}</Text> : null}
          <View style={[s.badge, { backgroundColor: sc.bg, borderColor: sc.border }]}>
            <Ionicons name={sc.icon} size={14} color={sc.text} />
            <Text style={[s.badgeTxt, { color: sc.text }]}>{sc.label}</Text>
          </View>
          <View style={s.contactRow}>
            <Ionicons name="call-outline" size={13} color="rgba(255,255,255,0.7)" />
            <Text style={s.contactLine}>{profile.contact_no}</Text>
          </View>
          {profile.email ? (
            <View style={s.contactRow}>
              <Ionicons name="mail-outline" size={13} color="rgba(255,255,255,0.7)" />
              <Text style={s.contactLine}>{profile.email}</Text>
            </View>
          ) : null}
        </View>

        {section !== "view" && (
          <TouchableOpacity style={s.backRow} onPress={() => { setSection("view"); setEditErrors({}); setPwErrors({}); }}>
            <Ionicons name="arrow-back-outline" size={16} color="#1d4ed8" />
            <Text style={s.backTxt}>Back to Profile</Text>
          </TouchableOpacity>
        )}

        {/* VIEW */}
        {section === "view" && (
          <>
            <View style={s.card}>
              <View style={s.cardHead}>
                <Text style={s.cardTitle}>Personal Information</Text>
                <TouchableOpacity style={s.editBtn} onPress={() => setSection("edit")}>
                  <Ionicons name="create-outline" size={14} color="#1d4ed8" />
                  <Text style={s.editBtnTxt}>Edit</Text>
                </TouchableOpacity>
              </View>
              <InfoRow icon="person-outline"  label="Full Name"         value={profile.full_name} />
              {profile.username ? <InfoRow icon="at-outline" label="Username" value={`@${profile.username}`} /> : null}
              {profile.email    ? <InfoRow icon="mail-outline" label="Email"  value={profile.email} /> : null}
              <InfoRow icon="calendar-outline" label="Age"              value={`${profile.age} years old`} />
              <InfoRow icon="home-outline"     label="Address"          value={profile.address} />
              <InfoRow icon="people-outline"   label="Emergency Contact" value={profile.emerg_name} />
              <InfoRow icon="call-outline"     label="Emergency Number"  value={profile.emerg_no} last />
            </View>

            <TouchableOpacity style={s.actionBtn} onPress={() => setSection("password")}>
              <Ionicons name="lock-closed-outline" size={20} color="#1d4ed8" />
              <Text style={s.actionTxt}>Change Password</Text>
              <Ionicons name="chevron-forward-outline" size={18} color="#94a3b8" />
            </TouchableOpacity>

            <TouchableOpacity style={s.logoutBtn} onPress={() => Alert.alert("Log Out", "Are you sure?", [{ text: "Cancel", style: "cancel" }, { text: "Log Out", style: "destructive", onPress: doLogout }])}>
              <Ionicons name="log-out-outline" size={20} color="#dc2626" />
              <Text style={s.logoutTxt}>Log Out</Text>
            </TouchableOpacity>

            <Text style={s.version}>BRFE App · Bago City</Text>
          </>
        )}

        {/* EDIT */}
        {section === "edit" && (
          <View style={s.card}>
            <Text style={s.cardTitle}>Edit Profile</Text>
            <View style={{ height: 14 }} />
            <FField label="Full Name" error={editErrors.full_name} icon="person-outline">
              <TextInput style={[s.input, editErrors.full_name && s.inputErr]} value={fullName} onChangeText={setFullName} placeholder="Full name" placeholderTextColor="#94a3b8" />
            </FField>
            <FField label="Username" error={editErrors.username} icon="at-outline">
              <TextInput style={[s.input, editErrors.username && s.inputErr]} value={username} onChangeText={setUsername} placeholder="username" placeholderTextColor="#94a3b8" autoCapitalize="none" />
            </FField>
            <FField label="Email Address" error={editErrors.email} icon="mail-outline">
              <TextInput style={[s.input, editErrors.email && s.inputErr]} value={email} onChangeText={setEmail} placeholder="email@example.com" placeholderTextColor="#94a3b8" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
            </FField>
            <FField label="Age" error={editErrors.age} icon="calendar-outline">
              <TextInput style={[s.input, editErrors.age && s.inputErr]} value={age} onChangeText={setAge} keyboardType="numeric" placeholder="Age" placeholderTextColor="#94a3b8" />
            </FField>
            <FField label="Address" error={editErrors.address} icon="home-outline">
              <TextInput style={[s.input, editErrors.address && s.inputErr]} value={address} onChangeText={setAddress} placeholder="Address" placeholderTextColor="#94a3b8" />
            </FField>
            <FField label="Emergency Contact Name" error={editErrors.emerg_name} icon="people-outline">
              <TextInput style={[s.input, editErrors.emerg_name && s.inputErr]} value={emergName} onChangeText={setEmergName} placeholder="Name" placeholderTextColor="#94a3b8" />
            </FField>
            <FField label="Emergency Contact Number" error={editErrors.emerg_no} icon="call-outline">
              <TextInput style={[s.input, editErrors.emerg_no && s.inputErr]} value={emergNo} onChangeText={setEmergNo} keyboardType="phone-pad" placeholder="09XXXXXXXXX" placeholderTextColor="#94a3b8" />
            </FField>
            {editErrors.general ? <Text style={s.genErr}>{editErrors.general}</Text> : null}
            <View style={s.rowBtns}>
              <TouchableOpacity style={s.cancelBtn} onPress={() => { setSection("view"); setEditErrors({}); }}><Text style={s.cancelTxt}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={[s.saveBtn, saving && s.saveBtnOff]} onPress={handleSave} disabled={saving}>
                {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.saveTxt}>Save Changes</Text>}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* CHANGE PASSWORD */}
        {section === "password" && (
          <View style={s.card}>
            <Text style={s.cardTitle}>Change Password</Text>
            <View style={{ height: 14 }} />
            <FField label="Current Password" error={pwErrors.current_password} icon="lock-closed-outline">
              <View style={s.pwRow}>
                <TextInput style={[s.input, s.pwInput, pwErrors.current_password && s.inputErr]} value={curPass} onChangeText={setCurPass} secureTextEntry={!showCur} placeholder="Current password" placeholderTextColor="#94a3b8" />
                <TouchableOpacity style={s.eyeBtn} onPress={() => setShowCur(!showCur)}><Ionicons name={showCur ? "eye-off-outline" : "eye-outline"} size={18} color="#94a3b8" /></TouchableOpacity>
              </View>
            </FField>
            <FField label="New Password" error={pwErrors.new_password} icon="lock-open-outline">
              <View style={s.pwRow}>
                <TextInput style={[s.input, s.pwInput, pwErrors.new_password && s.inputErr]} value={newPass} onChangeText={setNewPass} secureTextEntry={!showNew} placeholder="Min 6 characters" placeholderTextColor="#94a3b8" />
                <TouchableOpacity style={s.eyeBtn} onPress={() => setShowNew(!showNew)}><Ionicons name={showNew ? "eye-off-outline" : "eye-outline"} size={18} color="#94a3b8" /></TouchableOpacity>
              </View>
            </FField>
            <FField label="Confirm New Password" error={pwErrors.confirm_password} icon="checkmark-circle-outline">
              <TextInput style={[s.input, pwErrors.confirm_password && s.inputErr]} value={confirmPass} onChangeText={setConfirm} secureTextEntry placeholder="Repeat new password" placeholderTextColor="#94a3b8" />
            </FField>
            {pwErrors.general ? <Text style={s.genErr}>{pwErrors.general}</Text> : null}
            <View style={s.rowBtns}>
              <TouchableOpacity style={s.cancelBtn} onPress={() => { setSection("view"); setPwErrors({}); setCurPass(""); setNewPass(""); setConfirm(""); }}><Text style={s.cancelTxt}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={[s.saveBtn, changingPw && s.saveBtnOff]} onPress={handleChangePassword} disabled={changingPw}>
                {changingPw ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.saveTxt}>Update Password</Text>}
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function FField({ label, error, icon, children }: { label: string; error?: string; icon: keyof typeof Ionicons.glyphMap; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 5 }}>
        <Ionicons name={icon} size={13} color="#475569" />
        <Text style={s.fieldLbl}>{label}</Text>
      </View>
      {children}
      {error ? <Text style={s.fieldErr}>{error}</Text> : null}
    </View>
  );
}

function InfoRow({ icon, label, value, last }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string; last?: boolean }) {
  return (
    <View style={[s.infoRow, last && s.infoRowLast]}>
      <View style={s.infoIconWrap}><Ionicons name={icon} size={16} color="#1d4ed8" /></View>
      <View style={{ flex: 1 }}>
        <Text style={s.infoLbl}>{label}</Text>
        <Text style={s.infoVal}>{value || "—"}</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: "#1d4ed8" },
  scroll:      { flex: 1, backgroundColor: "#f8fafc" },
  content:     { paddingBottom: 48 },
  header:      { backgroundColor: "#1d4ed8", paddingHorizontal: 20, paddingVertical: 14 },
  headerTitle: { color: "#fff", fontWeight: "800", fontSize: 18 },
  center:      { flex: 1, justifyContent: "center", alignItems: "center", gap: 14, backgroundColor: "#f8fafc", paddingTop: 80 },
  loadingTxt:  { fontSize: 14, color: "#64748b" },
  errMsg:      { fontSize: 15, color: "#dc2626", fontWeight: "700" },
  retryBtn:    { backgroundColor: "#1d4ed8", borderRadius: 10, paddingHorizontal: 24, paddingVertical: 11 },
  retryTxt:    { color: "#fff", fontWeight: "700", fontSize: 14 },
  hero: { backgroundColor: "#1d4ed8", alignItems: "center", paddingTop: 8, paddingBottom: 28, paddingHorizontal: 20, borderBottomLeftRadius: 28, borderBottomRightRadius: 28, marginBottom: 16 },
  avatarWrap:  { position: "relative", marginBottom: 12 },
  avatarImg:   { width: 96, height: 96, borderRadius: 48, backgroundColor: "rgba(255,255,255,0.2)", borderWidth: 3, borderColor: "rgba(255,255,255,0.5)", justifyContent: "center", alignItems: "center" },
  avatarTxt:   { color: "#fff", fontSize: 32, fontWeight: "900" },
  avatarBadge: { position: "absolute", bottom: 2, right: 2, width: 26, height: 26, borderRadius: 13, backgroundColor: "#1d4ed8", borderWidth: 2, borderColor: "#fff", justifyContent: "center", alignItems: "center" },
  name:        { fontSize: 22, fontWeight: "800", color: "#fff", marginBottom: 4 },
  usernameLabel:{ fontSize: 13, color: "rgba(255,255,255,0.65)", marginBottom: 8 },
  badge:       { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1, marginBottom: 8 },
  badgeTxt:    { fontSize: 13, fontWeight: "700" },
  contactRow:  { flexDirection: "row", alignItems: "center", gap: 5 },
  contactLine: { fontSize: 13, color: "rgba(255,255,255,0.75)" },
  backRow:     { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 16, paddingBottom: 8 },
  backTxt:     { fontSize: 14, color: "#1d4ed8", fontWeight: "700" },
  card:        { backgroundColor: "#fff", borderRadius: 18, padding: 18, marginHorizontal: 16, marginBottom: 12, elevation: 2, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 10 },
  cardHead:    { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  cardTitle:   { fontSize: 16, fontWeight: "800", color: "#1e293b" },
  editBtn:     { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#eff6ff", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  editBtnTxt:  { fontSize: 13, color: "#1d4ed8", fontWeight: "700" },
  infoRow:     { flexDirection: "row", alignItems: "center", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#f1f5f9", gap: 12 },
  infoRowLast: { borderBottomWidth: 0 },
  infoIconWrap:{ width: 32, height: 32, borderRadius: 8, backgroundColor: "#eff6ff", justifyContent: "center", alignItems: "center" },
  infoLbl:     { fontSize: 11, color: "#94a3b8", fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 },
  infoVal:     { fontSize: 14, color: "#1e293b", fontWeight: "600" },
  actionBtn:   { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#fff", borderRadius: 14, paddingVertical: 16, paddingHorizontal: 18, marginHorizontal: 16, marginBottom: 10, elevation: 1, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 4, borderWidth: 1, borderColor: "#e2e8f0" },
  actionTxt:   { flex: 1, fontSize: 15, color: "#1e293b", fontWeight: "600" },
  logoutBtn:   { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: "#fff", borderRadius: 14, paddingVertical: 16, marginHorizontal: 16, marginBottom: 20, borderWidth: 1.5, borderColor: "#fecaca", elevation: 1 },
  logoutTxt:   { fontSize: 15, color: "#dc2626", fontWeight: "800" },
  version:     { textAlign: "center", fontSize: 12, color: "#cbd5e1", paddingBottom: 8 },
  fieldLbl:    { fontSize: 13, fontWeight: "700", color: "#475569" },
  input:       { backgroundColor: "#f8fafc", borderWidth: 1.5, borderColor: "#e2e8f0", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, fontSize: 14, color: "#1e293b" },
  inputErr:    { borderColor: "#ef4444" },
  fieldErr:    { fontSize: 12, color: "#ef4444", marginTop: 4 },
  genErr:      { color: "#dc2626", fontSize: 13, marginBottom: 10, textAlign: "center" },
  rowBtns:     { flexDirection: "row", gap: 10, marginTop: 6 },
  cancelBtn:   { flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 1.5, borderColor: "#e2e8f0", alignItems: "center" },
  cancelTxt:   { fontSize: 14, color: "#475569", fontWeight: "700" },
  saveBtn:     { flex: 2, paddingVertical: 12, borderRadius: 10, backgroundColor: "#1d4ed8", alignItems: "center" },
  saveBtnOff:  { backgroundColor: "#93c5fd" },
  saveTxt:     { fontSize: 14, color: "#fff", fontWeight: "800" },
  pwRow:       { flexDirection: "row", alignItems: "center", gap: 6 },
  pwInput:     { flex: 1 },
  eyeBtn:      { padding: 10 },
});
