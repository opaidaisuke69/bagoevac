import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, StatusBar, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { apiFetch } from '@/constants/config';

export default function ResetPasswordScreen() {
  const params = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail]       = useState(params.email ?? '');
  const [code, setCode]         = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm]   = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  async function handleReset() {
    setError('');
    const em = email.trim();
    if (!em || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) { setError('Enter a valid email address.'); return; }
    if (!/^\d{6}$/.test(code.trim())) { setError('Enter the 6-digit code from your email.'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    if (password !== confirm) { setError('Passwords do not match.'); return; }

    setLoading(true);
    try {
      const res = await apiFetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: em, code: code.trim(), password }),
      }, 25000);
      const data = await res.json() as any;
      if (data.error) {
        if (data.fields) setError(Object.values(data.fields)[0] as string);
        else setError(data.message ?? 'Could not reset password.');
        return;
      }
      Alert.alert('Password Reset', 'Your password has been reset. Please sign in with your new password.', [
        { text: 'Sign In', onPress: () => router.replace('/(auth)/login') },
      ]);
    } catch (e: any) {
      setError(
        e?.name === 'AbortError'
          ? 'The request timed out. Please try again.'
          : 'Network error. Check your connection.'
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar barStyle="light-content" backgroundColor="#1e40af" />

      <View style={s.hero}>
        <TouchableOpacity style={s.back} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={s.iconCircle}>
          <Ionicons name="shield-checkmark-outline" size={34} color="#1d4ed8" />
        </View>
        <Text style={s.heroTitle}>Reset Password</Text>
        <Text style={s.heroSub}>Enter the code and your new password</Text>
      </View>

      <View style={s.card}>
        <Text style={s.label}>Email Address</Text>
        <View style={s.inputWrap}>
          <Ionicons name="mail-outline" size={16} color="#9ca3af" style={s.inputIcon} />
          <TextInput
            style={s.input} placeholder="you@example.com" placeholderTextColor="#9ca3af"
            keyboardType="email-address" autoCapitalize="none" autoCorrect={false}
            value={email} onChangeText={setEmail}
          />
        </View>

        <Text style={s.label}>Verification Code</Text>
        <View style={s.inputWrap}>
          <Ionicons name="keypad-outline" size={16} color="#9ca3af" style={s.inputIcon} />
          <TextInput
            style={[s.input, { letterSpacing: 6, fontWeight: '700' }]}
            placeholder="000000" placeholderTextColor="#9ca3af"
            keyboardType="number-pad" maxLength={6}
            value={code} onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))}
          />
        </View>

        <Text style={s.label}>New Password</Text>
        <View style={s.inputWrap}>
          <Ionicons name="lock-closed-outline" size={16} color="#9ca3af" style={s.inputIcon} />
          <TextInput
            style={[s.input, { flex: 1 }]} placeholder="At least 6 characters" placeholderTextColor="#9ca3af"
            secureTextEntry={!showPass} value={password} onChangeText={setPassword}
          />
          <TouchableOpacity onPress={() => setShowPass(!showPass)} style={{ padding: 10 }}>
            <Ionicons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={18} color="#9ca3af" />
          </TouchableOpacity>
        </View>

        <Text style={s.label}>Confirm New Password</Text>
        <View style={s.inputWrap}>
          <Ionicons name="lock-closed-outline" size={16} color="#9ca3af" style={s.inputIcon} />
          <TextInput
            style={[s.input, { flex: 1 }]} placeholder="Re-enter password" placeholderTextColor="#9ca3af"
            secureTextEntry={!showPass} value={confirm} onChangeText={setConfirm}
          />
        </View>

        {error ? (
          <View style={s.errorBox}>
            <Ionicons name="alert-circle-outline" size={15} color="#dc2626" />
            <Text style={s.errorText}>{error}</Text>
          </View>
        ) : null}

        <TouchableOpacity style={[s.button, loading && s.buttonDisabled]} onPress={handleReset} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.buttonText}>Reset Password</Text>}
        </TouchableOpacity>

        <TouchableOpacity style={s.linkRow} onPress={() => router.replace('/(auth)/login')}>
          <Text style={s.linkText}>Back to <Text style={s.linkBold}>Sign In</Text></Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#1e40af' },
  hero:         { paddingTop: 90, paddingBottom: 24, alignItems: 'center', paddingHorizontal: 24 },
  back:         { position: 'absolute', top: 48, left: 20, padding: 6 },
  iconCircle:   { width: 80, height: 80, borderRadius: 40, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', marginBottom: 14, elevation: 5, shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 10 },
  heroTitle:    { fontSize: 24, fontWeight: '900', color: '#fff' },
  heroSub:      { fontSize: 13, color: 'rgba(255,255,255,0.78)', marginTop: 5 },
  card:         { flex: 1, backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 28 },
  label:        { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6, marginTop: 12 },
  inputWrap:    { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f9fafb', borderWidth: 1.5, borderColor: '#e5e7eb', borderRadius: 12 },
  inputIcon:    { marginLeft: 12 },
  input:        { flex: 1, paddingHorizontal: 10, paddingVertical: 12, fontSize: 15, color: '#111827' },
  errorBox:     { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#fef2f2', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, marginTop: 14 },
  errorText:    { flex: 1, color: '#dc2626', fontSize: 13, fontWeight: '500' },
  button:       { backgroundColor: '#2563eb', borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 22, marginBottom: 12, elevation: 3, shadowColor: '#2563eb', shadowOpacity: 0.4, shadowRadius: 8 },
  buttonDisabled: { backgroundColor: '#93c5fd', elevation: 0 },
  buttonText:   { color: '#fff', fontSize: 16, fontWeight: '800' },
  linkRow:      { alignItems: 'center', paddingVertical: 8 },
  linkText:     { fontSize: 14, color: '#6b7280' },
  linkBold:     { color: '#2563eb', fontWeight: '700' },
});
