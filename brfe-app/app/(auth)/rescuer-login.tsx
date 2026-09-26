import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform, StatusBar, Image,
} from 'react-native';
import { router, useNavigationContainerRef } from 'expo-router';
import { CommonActions } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { API_BASE_URL } from '@/constants/config';
import { setToken, setRole } from '@/hooks/use-auth';

export default function RescuerLoginScreen() {
  const navigationRef = useNavigationContainerRef();
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
      if (res.status === 503 || data.code === 'MAINTENANCE') {
        setError('System Currently Down. Please try again later.');
        return;
      }
      if (data.error) { setError(data.message ?? 'Invalid credentials.'); return; }
      if (data.user?.role !== 'Rescuer') {
        setError('This account is not a Rescuer account.');
        return;
      }
      await setToken(data.token);
      await setRole('rescuer');
      navigationRef.dispatch(
        CommonActions.reset({ index: 0, routes: [{ name: '(rescuer)', params: { screen: 'assignments' } }] })
      );
    } catch {
      setError('Network error. Check your connection.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar barStyle="light-content" backgroundColor="#133458" />

      <View style={styles.hero}>
        <View style={styles.logoCircle}>
          <Image source={require('../../assets/images/logo.png')} style={styles.logo} />
        </View>
        <Text style={styles.heroTitle}>B R F E</Text>
        <Text style={styles.heroSub}>R E S C U E R</Text>
      </View>

      <View style={styles.card}>
<Text style={[styles.cardTitle, { textAlign: 'center' }]}>Rescuer Sign In</Text>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Username</Text>
          <View style={styles.inputWrap}>
            <Ionicons name="person-outline" size={16} color="#94a3b8" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Enter username"
              placeholderTextColor="#94a3b8"
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
            <Ionicons name="lock-closed-outline" size={16} color="#94a3b8" style={styles.inputIcon} />
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="Enter password"
              placeholderTextColor="#94a3b8"
              secureTextEntry={!showPass}
              value={password}
              onChangeText={setPassword}
            />
            <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPass(!showPass)}>
              <Ionicons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={18} color="#94a3b8" />
            </TouchableOpacity>
          </View>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity style={[styles.button, loading && styles.buttonDisabled]} onPress={handleLogin} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Sign In</Text>}
        </TouchableOpacity>

        <Text style={styles.description}>Bago Residents Flood Evacuees Rescuer</Text>

        <TouchableOpacity style={styles.backLink} onPress={() => router.back()}>
          <Ionicons name="person" size={16} color="#133458" />
          <Text style={styles.backLinkText}>Back to Evacuee Login</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: '#133458' },
  hero:           { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 40 },
  logoCircle:     { width: 200, height: 200, borderRadius: 100, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', marginBottom: 16, elevation: 6, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 12 },
  logo:           { width: 160, height: 160, resizeMode: 'contain' },
  heroTitle:      { fontSize: 30, fontWeight: '900', color: '#FFC349', letterSpacing: 2, marginBottom: 2 },
  heroSub:        { fontSize: 16, fontWeight: '700', color: '#fff', letterSpacing: 1 },
  card:           { backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 28, paddingBottom: 40, elevation: 20, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 20 },
  cardTitle:      { fontSize: 20, fontWeight: '800', color: '#133458', marginBottom: 4 },
  cardSub:        { fontSize: 12, color: '#6b7280', marginBottom: 24 },
  inputGroup:     { marginBottom: 16 },
  label:          { fontSize: 12, fontWeight: '600', color: '#133458', marginBottom: 6 },
  inputWrap:      { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', borderWidth: 1.5, borderColor: '#e2e8f0', borderRadius: 12 },
  inputIcon:      { marginLeft: 12 },
  input:          { flex: 1, paddingHorizontal: 10, paddingVertical: 12, fontSize: 14, color: '#1e293b' },
  eyeBtn:         { padding: 10 },
  error:          { color: '#C62828', fontSize: 12, marginBottom: 12, textAlign: 'center', fontWeight: '500' },
  button:         { backgroundColor: '#133458', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 4, marginBottom: 16, elevation: 3 },
  buttonDisabled: { backgroundColor: '#133458', opacity: 0.5, elevation: 0 },
  buttonText:     { color: '#fff', fontSize: 15, fontWeight: '800' },
  description:    { color: '#94a3b8', fontSize: 11, textAlign: 'center', marginTop: 14, marginBottom: 10 },
  backLink:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 4, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  backLinkText:   { fontSize: 13, color: '#133458', fontWeight: '600' },
});
