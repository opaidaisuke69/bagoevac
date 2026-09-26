import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, StatusBar, KeyboardAvoidingView, Platform,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { apiFetch } from '@/constants/config';

export default function ForgotPasswordScreen() {
  const [email, setEmail]     = useState('');
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSend() {
    setError('');
    const trimmed = email.trim();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError('Enter a valid email address.');
      return;
    }
    setLoading(true);
    try {
      // Sending the reset email over SMTP can take several seconds.
      const res = await apiFetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmed }),
      }, 45000);
      const data = await res.json() as any;
      if (data.error && data.code !== 'COOLDOWN') {
        setError(data.message ?? 'Could not send reset code.');
        return;
      }
      // Move to the reset step regardless (uniform response hides account existence).
      router.push({ pathname: '/(auth)/reset-password', params: { email: trimmed } });
    } catch (e: any) {
      setError(
        e?.name === 'AbortError'
          ? 'Sending the code is taking too long. Please try again.'
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
          <Ionicons name="lock-closed-outline" size={34} color="#1d4ed8" />
        </View>
        <Text style={s.heroTitle}>Forgot Password</Text>
        <Text style={s.heroSub}>We'll email you a code to reset it</Text>
      </View>

      <View style={s.card}>
        <Text style={s.label}>Email Address</Text>
        <View style={s.inputWrap}>
          <Ionicons name="mail-outline" size={16} color="#9ca3af" style={s.inputIcon} />
          <TextInput
            style={s.input}
            placeholder="you@example.com"
            placeholderTextColor="#9ca3af"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            value={email}
            onChangeText={setEmail}
          />
        </View>

        {error ? (
          <View style={s.errorBox}>
            <Ionicons name="alert-circle-outline" size={15} color="#dc2626" />
            <Text style={s.errorText}>{error}</Text>
          </View>
        ) : null}

        <TouchableOpacity style={[s.button, loading && s.buttonDisabled]} onPress={handleSend} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.buttonText}>Send Reset Code</Text>}
        </TouchableOpacity>

        <TouchableOpacity style={s.linkRow} onPress={() => router.back()}>
          <Text style={s.linkText}>Back to <Text style={s.linkBold}>Sign In</Text></Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#1e40af' },
  hero:         { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  back:         { position: 'absolute', top: 48, left: 20, padding: 6 },
  iconCircle:   { width: 88, height: 88, borderRadius: 44, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', marginBottom: 18, elevation: 5, shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 10 },
  heroTitle:    { fontSize: 26, fontWeight: '900', color: '#fff' },
  heroSub:      { fontSize: 13.5, color: 'rgba(255,255,255,0.78)', marginTop: 6 },
  card:         { backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 28, paddingBottom: 40 },
  label:        { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 },
  inputWrap:    { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f9fafb', borderWidth: 1.5, borderColor: '#e5e7eb', borderRadius: 12 },
  inputIcon:    { marginLeft: 12 },
  input:        { flex: 1, paddingHorizontal: 10, paddingVertical: 12, fontSize: 15, color: '#111827' },
  errorBox:     { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#fef2f2', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, marginTop: 12 },
  errorText:    { flex: 1, color: '#dc2626', fontSize: 13, fontWeight: '500' },
  button:       { backgroundColor: '#2563eb', borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 20, marginBottom: 12, elevation: 3, shadowColor: '#2563eb', shadowOpacity: 0.4, shadowRadius: 8 },
  buttonDisabled: { backgroundColor: '#93c5fd', elevation: 0 },
  buttonText:   { color: '#fff', fontSize: 16, fontWeight: '800' },
  linkRow:      { alignItems: 'center', paddingVertical: 8 },
  linkText:     { fontSize: 14, color: '#6b7280' },
  linkBold:     { color: '#2563eb', fontWeight: '700' },
});
