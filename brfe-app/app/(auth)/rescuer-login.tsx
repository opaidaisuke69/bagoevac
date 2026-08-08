import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform, StatusBar,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { API_BASE_URL } from '@/constants/config';
import { setToken, setRole } from '@/hooks/use-auth';

export default function RescuerLoginScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [showPass, setShowPass] = useState(false);

  async function handleLogin() {
    setError('');
    if (!username.trim() || !password) {
      setError('Username and password are required.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/lgu/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const data = await res.json();
      if (data.error) { setError(data.message ?? 'Invalid credentials.'); return; }
      // Verify this is a Rescuer account
      if (data.user?.role !== 'Rescuer') {
        setError('This account is not a Rescuer account.');
        return;
      }
      await setToken(data.token);
      await setRole('rescuer');
      router.replace('/(rescuer)/assignments');
    } catch {
      setError('Network error. Check your connection.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar barStyle="light-content" backgroundColor="#0d4f4f" />

      <View style={styles.hero}>
        <View style={styles.iconCircle}>
          <Ionicons name="shield-checkmark" size={48} color="#fff" />
        </View>
        <Text style={styles.heroTitle}>Rescuer Login</Text>
        <Text style={styles.heroSub}>Bago City Flood Response Team</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Sign In</Text>
        <Text style={styles.cardSub}>Use credentials from your Barangay Admin</Text>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Username</Text>
          <View style={styles.inputWrap}>
            <Ionicons name="person-outline" size={16} color="#9ca3af" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Enter username"
              placeholderTextColor="#9ca3af"
              autoCapitalize="none"
              autoCorrect={false}
              value={username}
              onChangeText={setUsername}
            />
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Password</Text>
          <View style={styles.inputWrap}>
            <Ionicons name="lock-closed-outline" size={16} color="#9ca3af" style={styles.inputIcon} />
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="Enter password"
              placeholderTextColor="#9ca3af"
              secureTextEntry={!showPass}
              value={password}
              onChangeText={setPassword}
            />
            <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPass(!showPass)}>
              <Ionicons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={18} color="#9ca3af" />
            </TouchableOpacity>
          </View>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity style={[styles.button, loading && styles.buttonDisabled]} onPress={handleLogin} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Sign In as Rescuer</Text>}
        </TouchableOpacity>

        <TouchableOpacity style={styles.backLink} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={16} color="#6b7280" />
          <Text style={styles.backLinkText}>Back to Evacuee Login</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: '#0d4f4f' },
  hero:           { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 40 },
  iconCircle:     { width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  heroTitle:      { fontSize: 28, fontWeight: '900', color: '#fff', letterSpacing: 1, marginBottom: 6 },
  heroSub:        { fontSize: 13, color: 'rgba(255,255,255,0.7)' },
  card:           { backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 28, paddingBottom: 40, elevation: 20, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 20 },
  cardTitle:      { fontSize: 22, fontWeight: '800', color: '#111827', marginBottom: 4 },
  cardSub:        { fontSize: 13, color: '#6b7280', marginBottom: 24 },
  inputGroup:     { marginBottom: 16 },
  label:          { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 },
  inputWrap:      { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f9fafb', borderWidth: 1.5, borderColor: '#e5e7eb', borderRadius: 12 },
  inputIcon:      { marginLeft: 12 },
  input:          { flex: 1, paddingHorizontal: 10, paddingVertical: 12, fontSize: 15, color: '#111827' },
  eyeBtn:         { padding: 10 },
  error:          { color: '#dc2626', fontSize: 13, marginBottom: 12, textAlign: 'center', fontWeight: '500' },
  button:         { backgroundColor: '#0d9488', borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 4, marginBottom: 16, elevation: 3 },
  buttonDisabled: { backgroundColor: '#99f6e4', elevation: 0 },
  buttonText:     { color: '#fff', fontSize: 16, fontWeight: '800' },
  backLink:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  backLinkText:   { fontSize: 14, color: '#6b7280' },
});
