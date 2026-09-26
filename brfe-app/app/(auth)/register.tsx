import { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, ScrollView, Modal, FlatList, Alert, StatusBar, Image,
} from 'react-native';
import { router, useNavigationContainerRef } from 'expo-router';
import { CommonActions } from '@react-navigation/native';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { apiFetch } from '@/constants/config';
import { setToken } from '@/hooks/use-auth';
import OtpModal from '@/components/OtpModal';

export default function RegisterScreen() {
  const navigationRef = useNavigationContainerRef();
  const [barangays, setBarangays] = useState<{id: number; name: string}[]>([]);
  const [fullName, setFullName]   = useState('');
  const [username, setUsername]   = useState('');
  const [email, setEmail]         = useState('');
  const [age, setAge]             = useState('');
  const [address, setAddress]     = useState('');
  const [barangayId, setBarangayId]     = useState<number | null>(null);
  const [barangayName, setBarangayName] = useState('');
  const [contactNo, setContactNo] = useState('');
  const [emergName, setEmergName] = useState('');
  const [emergNo, setEmergNo]     = useState('');
  const [password, setPassword]   = useState('');
  const [showPass, setShowPass]   = useState(false);
  const [lat, setLat]             = useState<number | null>(null);
  const [lng, setLng]             = useState<number | null>(null);
  const [fieldErrors, setFieldErrors]   = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState('');
  const [loading, setLoading]           = useState(false);
  const [gpsLoading, setGpsLoading]     = useState(false);
  const [showBarangayPicker, setShowBarangayPicker] = useState(false);
  const [showOtp, setShowOtp]           = useState(false);
  const [resendSeconds, setResendSeconds] = useState(60);

  // Fetch barangays from API
  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch('/api/barangays/list', {}, 15000);
        const json = await res.json();
        const list = json.data || [];
        setBarangays(list.map((b: any) => ({ id: b.id, name: b.name })));
      } catch {
        // Fallback if API fails
        setBarangays([]);
      }
    })();
  }, []);

  async function getLocation() {
    setGpsLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { Alert.alert('Permission denied', 'Location permission is required.'); return; }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setLat(loc.coords.latitude);
      setLng(loc.coords.longitude);
    } catch {
      Alert.alert('Error', 'Could not get your location. Please try again.');
    } finally {
      setGpsLoading(false);
    }
  }

  // Lightweight client-side validation so we only email a code once the form
  // looks complete. The backend re-validates everything authoritatively.
  function validateForm(): boolean {
    const errs: Record<string, string> = {};
    if (!fullName.trim()) errs.full_name = 'Full name is required.';
    if (!username.trim()) errs.username = 'Username is required.';
    else if (!/^[a-zA-Z0-9._]{3,30}$/.test(username.trim())) errs.username = 'Username must be 3–30 characters (letters, numbers, . or _).';
    if (!email.trim()) errs.email = 'Email address is required.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) errs.email = 'Enter a valid email address.';
    if (!age) errs.age = 'Age is required.';
    if (!address.trim()) errs.address = 'Address is required.';
    if (!barangayId) errs.barangay_id = 'Barangay is required.';
    if (!contactNo.trim()) errs.contact_no = 'Contact number is required.';
    if (!emergName.trim()) errs.emerg_name = 'Emergency contact name is required.';
    if (!emergNo.trim()) errs.emerg_no = 'Emergency contact number is required.';
    if (!password) errs.password = 'Password is required.';
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function buildPayload(code?: string) {
    return {
      full_name: fullName.trim(),
      username: username.trim(),
      email: email.trim(),
      age: age ? parseInt(age, 10) : null,
      address: address.trim(),
      barangay_id: barangayId,
      contact_no: contactNo.trim(),
      emerg_name: emergName.trim(),
      emerg_no: emergNo.trim(),
      password,
      lat,
      lng,
      ...(code ? { code } : {}),
    };
  }

  // Step 1: validate, then ask the backend to email a verification code.
  async function handleRegister() {
    setFieldErrors({});
    setGeneralError('');
    if (!validateForm()) return;
    setLoading(true);
    try {
      // Sending the email over SMTP can take several seconds — allow up to 45s.
      const res = await apiFetch('/api/auth/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), full_name: fullName.trim() }),
      }, 45000);
      const data = await res.json() as any;
      if (data.error) {
        if (data.fields) setFieldErrors(data.fields);
        else if (data.code === 'DUPLICATE') setFieldErrors({ email: data.message });
        else setGeneralError(data.message ?? 'Could not send verification code.');
        return;
      }
      setResendSeconds(60);
      setShowOtp(true);
    } catch (e: any) {
      setGeneralError(
        e?.name === 'AbortError'
          ? 'Sending the code is taking too long. Please try again.'
          : 'Network error. Check your connection.'
      );
    } finally {
      setLoading(false);
    }
  }

  // Step 2: submit the full registration with the verification code.
  // Returns an error string for the OTP modal, or null on success.
  async function submitWithCode(code: string): Promise<string | null> {
    let res: Response;
    try {
      // Registration itself is fast (no email), but keep a safe 25s ceiling.
      res = await apiFetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(buildPayload(code)),
      }, 25000);
    } catch (e: any) {
      // fetch itself failed — connection never completed.
      if (e?.name === 'AbortError') return 'The request timed out. Please try again.';
      // Surface the real reason to help diagnose device-side connectivity.
      const detail = e?.message ? ` (${e.message})` : '';
      return `Cannot reach the server${detail}. Check that your phone is on the same Wi-Fi as the server.`;
    }

    // Read as text first so stray output or non-JSON never throws here.
    const raw = await res.text();
    let data: any = {};
    try { data = raw ? JSON.parse(raw) : {}; } catch {
      // Show the start of the actual body so we can see what the server sent.
      const preview = (raw || '(empty)').replace(/\s+/g, ' ').slice(0, 120);
      return `Unexpected response (${res.status}): ${preview}`;
    }

    if (!res.ok || data.error) {
      // Code-specific error stays in the modal; other field errors close it.
      if (data.fields?.code) return data.fields.code;
      if (data.fields) { setFieldErrors(data.fields); setShowOtp(false); return null; }
      return data.message ?? `Registration failed (${res.status}).`;
    }

    await setToken(data.token);
    setShowOtp(false);
    navigationRef.dispatch(
      CommonActions.reset({ index: 0, routes: [{ name: '(app)', params: { screen: 'map' } }] })
    );
    return null;
  }

  // Resend a verification code. Returns an error string or null.
  async function resendCode(): Promise<string | null> {
    try {
      const res = await apiFetch('/api/auth/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), full_name: fullName.trim() }),
      }, 45000);
      const data = await res.json() as any;
      if (data.error) return data.message ?? 'Could not resend code.';
      return null;
    } catch (e: any) {
      return e?.name === 'AbortError'
        ? 'Sending the code is taking too long. Please try again.'
        : 'Network error. Check your connection.';
    }
  }

  function FErr({ field }: { field: string }) {
    return fieldErrors[field] ? <Text style={st.fieldError}>{fieldErrors[field]}</Text> : null;
  }

  function SectionHeader({ icon, label }: { icon: keyof typeof Ionicons.glyphMap; label: string }) {
    return (
      <View style={st.sectionHead}>
        <Ionicons name={icon} size={16} color="#1e40af" />
        <Text style={st.sectionTitle}>{label}</Text>
      </View>
    );
  }

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor="#1e40af" />
      <ScrollView style={st.scroll} contentContainerStyle={st.container} keyboardShouldPersistTaps="handled">
        <View style={st.header}>
          <View style={st.logoCircle}>
            <Image source={require('../../assets/images/logo.png')} style={st.headerLogoImg} />
          </View>
          <Text style={st.headerTitle}>Create Account</Text>
          <Text style={st.headerSub}>Register as a Bago City evacuee</Text>
        </View>

        <View style={st.card}>

          {/* ── Personal Info ── */}
          <SectionHeader icon="person-outline" label="Personal Information" />

          <Text style={st.label}>Full Name <Text style={st.req}>*</Text></Text>
          <View style={[st.inputWrap, !!fieldErrors.full_name && st.inputWrapErr]}>
            <Ionicons name="person-outline" size={16} color="#9ca3af" style={st.inputIcon} />
            <TextInput style={st.input} value={fullName} onChangeText={setFullName}
              placeholder="Juan Dela Cruz" placeholderTextColor="#9ca3af" />
          </View>
          <FErr field="full_name" />

          <Text style={st.label}>Username <Text style={st.req}>*</Text></Text>
          <View style={[st.inputWrap, !!fieldErrors.username && st.inputWrapErr]}>
            <Ionicons name="at-outline" size={16} color="#9ca3af" style={st.inputIcon} />
            <TextInput style={st.input} value={username} onChangeText={setUsername}
              placeholder="juan.delacruz" placeholderTextColor="#9ca3af" autoCapitalize="none" />
          </View>
          <FErr field="username" />

          <Text style={st.label}>Email Address <Text style={st.req}>*</Text></Text>
          <View style={[st.inputWrap, !!fieldErrors.email && st.inputWrapErr]}>
            <Ionicons name="mail-outline" size={16} color="#9ca3af" style={st.inputIcon} />
            <TextInput style={st.input} value={email} onChangeText={setEmail}
              placeholder="juan@example.com" placeholderTextColor="#9ca3af"
              keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
          </View>
          <FErr field="email" />

          <View style={st.row}>
            <View style={{ flex: 1 }}>
              <Text style={st.label}>Age <Text style={st.req}>*</Text></Text>
              <View style={[st.inputWrap, !!fieldErrors.age && st.inputWrapErr]}>
                <Ionicons name="calendar-outline" size={16} color="#9ca3af" style={st.inputIcon} />
                <TextInput style={st.input} value={age} onChangeText={setAge}
                  placeholder="25" placeholderTextColor="#9ca3af" keyboardType="numeric" />
              </View>
              <FErr field="age" />
            </View>
            <View style={{ flex: 2, marginLeft: 10 }}>
              <Text style={st.label}>Barangay <Text style={st.req}>*</Text></Text>
              <TouchableOpacity style={[st.inputWrap, !!fieldErrors.barangay_id && st.inputWrapErr]}
                onPress={() => setShowBarangayPicker(true)}>
                <Ionicons name="location-outline" size={16} color="#9ca3af" style={st.inputIcon} />
                <Text style={[st.input, { paddingVertical: 12 }, !barangayId && { color: '#9ca3af' }]}>
                  {barangayId ? barangayName : 'Select Barangay'}
                </Text>
                <Ionicons name="chevron-down-outline" size={14} color="#9ca3af" style={{ marginRight: 10 }} />
              </TouchableOpacity>
              <FErr field="barangay_id" />
            </View>
          </View>

          <Text style={st.label}>Home Address <Text style={st.req}>*</Text></Text>
          <View style={[st.inputWrap, !!fieldErrors.address && st.inputWrapErr]}>
            <Ionicons name="home-outline" size={16} color="#9ca3af" style={st.inputIcon} />
            <TextInput style={st.input} value={address} onChangeText={setAddress}
              placeholder="Purok / Street, Barangay" placeholderTextColor="#9ca3af" />
          </View>
          <FErr field="address" />

          {/* ── Contact ── */}
          <SectionHeader icon="call-outline" label="Contact Details" />

          <Text style={st.label}>Contact Number <Text style={st.req}>*</Text></Text>
          <View style={[st.inputWrap, !!fieldErrors.contact_no && st.inputWrapErr]}>
            <Ionicons name="phone-portrait-outline" size={16} color="#9ca3af" style={st.inputIcon} />
            <TextInput style={st.input} value={contactNo} onChangeText={setContactNo}
              placeholder="09XXXXXXXXX" placeholderTextColor="#9ca3af" keyboardType="phone-pad" />
          </View>
          <FErr field="contact_no" />

          <Text style={st.label}>Emergency Contact Name <Text style={st.req}>*</Text></Text>
          <View style={[st.inputWrap, !!fieldErrors.emerg_name && st.inputWrapErr]}>
            <Ionicons name="people-outline" size={16} color="#9ca3af" style={st.inputIcon} />
            <TextInput style={st.input} value={emergName} onChangeText={setEmergName}
              placeholder="Maria Dela Cruz" placeholderTextColor="#9ca3af" />
          </View>
          <FErr field="emerg_name" />

          <Text style={st.label}>Emergency Contact Number <Text style={st.req}>*</Text></Text>
          <View style={[st.inputWrap, !!fieldErrors.emerg_no && st.inputWrapErr]}>
            <Ionicons name="call-outline" size={16} color="#9ca3af" style={st.inputIcon} />
            <TextInput style={st.input} value={emergNo} onChangeText={setEmergNo}
              placeholder="09XXXXXXXXX" placeholderTextColor="#9ca3af" keyboardType="phone-pad" />
          </View>
          <FErr field="emerg_no" />

          {/* ── Security ── */}
          <SectionHeader icon="lock-closed-outline" label="Security" />

          <Text style={st.label}>Password <Text style={st.req}>*</Text></Text>
          <View style={[st.inputWrap, !!fieldErrors.password && st.inputWrapErr]}>
            <Ionicons name="lock-closed-outline" size={16} color="#9ca3af" style={st.inputIcon} />
            <TextInput style={[st.input, { flex: 1 }]} value={password} onChangeText={setPassword}
              secureTextEntry={!showPass} placeholder="Create a password" placeholderTextColor="#9ca3af" />
            <TouchableOpacity onPress={() => setShowPass(!showPass)} style={{ padding: 10 }}>
              <Ionicons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={18} color="#9ca3af" />
            </TouchableOpacity>
          </View>
          <FErr field="password" />

          {/* ── Location ── */}
          <SectionHeader icon="navigate-outline" label="Location (optional)" />

          <TouchableOpacity style={[st.gpsBtn, lat !== null && st.gpsBtnActive]} onPress={getLocation} disabled={gpsLoading}>
            {gpsLoading
              ? <ActivityIndicator color="#2563eb" size="small" />
              : <>
                  <Ionicons name={lat !== null ? 'checkmark-circle' : 'navigate-outline'}
                    size={18} color={lat !== null ? '#16a34a' : '#2563eb'} />
                  <Text style={[st.gpsBtnText, lat !== null && st.gpsBtnTextActive]}>
                    {lat !== null ? `${lat.toFixed(4)}, ${lng!.toFixed(4)}` : 'Get My Location'}
                  </Text>
                </>
            }
          </TouchableOpacity>

          {generalError ? (
            <View style={st.errorBox}>
              <Ionicons name="alert-circle-outline" size={16} color="#dc2626" />
              <Text style={st.generalError}>{generalError}</Text>
            </View>
          ) : null}

          <TouchableOpacity style={[st.button, loading && st.buttonDisabled]} onPress={handleRegister} disabled={loading}>
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={st.buttonText}>Continue</Text>
            }
          </TouchableOpacity>

          <TouchableOpacity style={st.loginLink} onPress={() => router.back()}>
            <Text style={st.loginLinkText}>Already have an account? <Text style={st.loginLinkBold}>Sign In</Text></Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Barangay Picker */}
      <Modal visible={showBarangayPicker} animationType="slide" transparent>
        <View style={st.modalOverlay}>
          <View style={st.modalContent}>
            <Text style={st.modalTitle}>Select Barangay</Text>
            <FlatList
              data={barangays}
              keyExtractor={(item) => String(item.id)}
              renderItem={({ item }) => (
                <TouchableOpacity style={st.modalItem} onPress={() => {
                  setBarangayId(item.id); setBarangayName(item.name); setShowBarangayPicker(false);
                }}>
                  <Text style={[st.modalItemText, barangayId === item.id && st.modalItemActive]}>
                    {item.name}
                  </Text>
                  {barangayId === item.id && <Ionicons name="checkmark" size={18} color="#2563eb" />}
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity style={st.modalClose} onPress={() => setShowBarangayPicker(false)}>
              <Text style={st.modalCloseText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Email verification step */}
      <OtpModal
        visible={showOtp}
        email={email.trim()}
        resendCooldown={resendSeconds}
        onSubmit={submitWithCode}
        onResend={resendCode}
        onClose={() => setShowOtp(false)}
      />
    </>
  );
}

const st = StyleSheet.create({
  scroll:     { flex: 1, backgroundColor: '#1e40af' },
  container:  { paddingBottom: 40 },
  header:     { alignItems: 'center', paddingVertical: 32, paddingHorizontal: 24 },
  logoCircle: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', marginBottom: 12, elevation: 4, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 8 },
  headerLogoImg: { width: 72, height: 72, resizeMode: 'contain' },
  headerTitle:{ fontSize: 26, fontWeight: '900', color: '#fff' },
  headerSub:  { fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 4 },
  card:       { backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 40 },
  sectionHead:{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 20, marginBottom: 14, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  sectionTitle:{ fontSize: 13, fontWeight: '800', color: '#1e40af', textTransform: 'uppercase', letterSpacing: 0.5 },
  label:      { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 5 },
  req:        { color: '#ef4444' },
  opt:        { color: '#9ca3af', fontWeight: '400' },
  inputWrap:  { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f9fafb', borderWidth: 1.5, borderColor: '#e5e7eb', borderRadius: 12, marginBottom: 4 },
  inputWrapErr:{ borderColor: '#ef4444' },
  inputIcon:  { marginLeft: 12 },
  input:      { flex: 1, paddingHorizontal: 10, paddingVertical: 11, fontSize: 14, color: '#111827' },
  fieldError: { fontSize: 12, color: '#ef4444', marginBottom: 8 },
  row:        { flexDirection: 'row', marginBottom: 4 },
  gpsBtn:     { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1.5, borderColor: '#2563eb', borderRadius: 12, borderStyle: 'dashed', paddingVertical: 12, paddingHorizontal: 14, marginBottom: 4 },
  gpsBtnActive:{ borderStyle: 'solid', backgroundColor: '#f0fdf4', borderColor: '#16a34a' },
  gpsBtnText: { fontSize: 14, color: '#2563eb', fontWeight: '600' },
  gpsBtnTextActive:{ color: '#16a34a' },
  errorBox:   { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#fef2f2', borderRadius: 10, padding: 12, marginVertical: 8 },
  generalError:{ flex: 1, color: '#dc2626', fontSize: 13, fontWeight: '500' },
  button:     { backgroundColor: '#2563eb', borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 20, marginBottom: 16, elevation: 3, shadowColor: '#2563eb', shadowOpacity: 0.4, shadowRadius: 8 },
  buttonDisabled:{ backgroundColor: '#93c5fd', elevation: 0 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  loginLink:  { alignItems: 'center' },
  loginLinkText:{ fontSize: 14, color: '#6b7280' },
  loginLinkBold:{ color: '#2563eb', fontWeight: '700' },
  modalOverlay:{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent:{ backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '70%', padding: 20 },
  modalTitle: { fontSize: 18, fontWeight: '800', marginBottom: 12, textAlign: 'center', color: '#111827' },
  modalItem:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  modalItemText:{ fontSize: 15, color: '#374151' },
  modalItemActive:{ color: '#2563eb', fontWeight: '700' },
  modalClose: { marginTop: 12, padding: 14, alignItems: 'center' },
  modalCloseText:{ color: '#dc2626', fontSize: 15, fontWeight: '600' },
});
