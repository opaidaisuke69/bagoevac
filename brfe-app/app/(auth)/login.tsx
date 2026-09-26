import { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform, StatusBar,
  Image, Animated,
} from 'react-native';
import { router, useNavigationContainerRef } from 'expo-router';
import { CommonActions } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { API_BASE_URL } from '@/constants/config';
import { setToken, setRole } from '@/hooks/use-auth';

export default function LoginScreen() {
  const navigationRef = useNavigationContainerRef();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword]     = useState('');
  const [error, setError]           = useState('');
  const [loading, setLoading]       = useState(false);
  const [showPass, setShowPass]     = useState(false);

  // Animation values
  const logoScale   = useRef(new Animated.Value(0.4)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const titleY      = useRef(new Animated.Value(20)).current;
  const titleOpacity= useRef(new Animated.Value(0)).current;
  const cardY       = useRef(new Animated.Value(60)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      // Logo pops in
      Animated.parallel([
        Animated.spring(logoScale, { toValue: 1, useNativeDriver: true, tension: 60, friction: 7 }),
        Animated.timing(logoOpacity, { toValue: 1, duration: 350, useNativeDriver: true }),
      ]),
      // Title fades up
      Animated.parallel([
        Animated.timing(titleOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(titleY, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]),
      // Card slides up
      Animated.parallel([
        Animated.timing(cardOpacity, { toValue: 1, duration: 350, useNativeDriver: true }),
        Animated.spring(cardY, { toValue: 0, useNativeDriver: true, tension: 50, friction: 8 }),
      ]),
    ]).start();
  }, []);

  async function handleLogin() {
    setError('');
    if (!identifier.trim() || !password) {
      setError('Username/email and password are required.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: identifier.trim(), password }),
      });
      const text = await res.text();
      let data: any = {};
      try { data = JSON.parse(text); } catch {
        setError(`Server error (${res.status}). Please try again.`);
        return;
      }
      if (res.status === 503 || data.code === 'MAINTENANCE') {
        setError('System Currently Down. Please try again later.');
        return;
      }
      if (data.error) { setError(data.message ?? 'Invalid credentials.'); return; }
      await setToken(data.token);
      await setRole('evacuee');
      navigationRef.dispatch(
        CommonActions.reset({ index: 0, routes: [{ name: '(app)', params: { screen: 'map' } }] })
      );
    } catch {
      setError('Network error. Check your connection.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar barStyle="light-content" backgroundColor="#1e40af" />

      {/* Hero */}
      <View style={styles.hero}>
        <Animated.View style={[styles.logoCircle, { opacity: logoOpacity, transform: [{ scale: logoScale }] }]}>
          <Image source={require('../../assets/images/logo.png')} style={styles.heroLogo} />
        </Animated.View>

        <Animated.Text style={[styles.heroTitle, { opacity: titleOpacity, transform: [{ translateY: titleY }] }]}>
          B R F E
        </Animated.Text>
        <Animated.Text style={[styles.heroSub, { opacity: titleOpacity, transform: [{ translateY: titleY }] }]}>
          Bago Residents Flood Evacuees App
        </Animated.Text>
      </View>

      {/* Card */}
      <Animated.View style={[styles.card, { opacity: cardOpacity, transform: [{ translateY: cardY }] }]}>
        <Text style={styles.cardTitle}>Welcome Back</Text>
        <Text style={styles.cardSub}>Sign in to your account</Text>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Username or Email</Text>
          <View style={styles.inputWrap}>
            <Ionicons name="person-outline" size={16} color="#9ca3af" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Username or Email"
              placeholderTextColor="#9ca3af"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              value={identifier}
              onChangeText={setIdentifier}
            />
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Password</Text>
          <View style={styles.inputWrap}>
            <Ionicons name="lock-closed-outline" size={16} color="#9ca3af" style={styles.inputIcon} />
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="Password"
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

        <TouchableOpacity style={styles.forgotLink} onPress={() => router.push('/(auth)/forgot-password')}>
          <Text style={styles.forgotText}>Forgot password?</Text>
        </TouchableOpacity>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity style={[styles.button, loading && styles.buttonDisabled]} onPress={handleLogin} disabled={loading}>
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.buttonText}>Sign In</Text>
          }
        </TouchableOpacity>

        <TouchableOpacity style={styles.registerLink} onPress={() => router.push('/(auth)/register')}>
          <Text style={styles.registerLinkText}>Don't have an account? <Text style={styles.registerLinkBold}>Register</Text></Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.rescuerLink} onPress={() => router.push('/(auth)/rescuer-login')}>
          <Ionicons name="shield-checkmark" size={16} color="#FFC349" />
          <Text style={styles.rescuerLinkText}>Login as Rescuer</Text>
        </TouchableOpacity>
      </Animated.View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: '#1e40af' },
  hero:             { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 40 },
  logoCircle:       { width: 180, height: 180, borderRadius: 90, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', marginBottom: 20, elevation: 6, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 12 },
  heroLogo:         { width: 148, height: 148, resizeMode: 'contain' },
  heroTitle:        { fontSize: 38, fontWeight: '900', color: '#fff', letterSpacing: 6, marginBottom: 6 },
  heroSub:          { fontSize: 14, color: 'rgba(255,255,255,0.8)', marginTop: 2, letterSpacing: 0.3 },
  card:             { backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 28, paddingBottom: 40, elevation: 20, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 20 },
  cardTitle:        { fontSize: 22, fontWeight: '800', color: '#111827', marginBottom: 4 },
  cardSub:          { fontSize: 14, color: '#6b7280', marginBottom: 24 },
  inputGroup:       { marginBottom: 16 },
  label:            { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 },
  inputWrap:        { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f9fafb', borderWidth: 1.5, borderColor: '#e5e7eb', borderRadius: 12 },
  inputIcon:        { marginLeft: 12 },
  input:            { flex: 1, paddingHorizontal: 10, paddingVertical: 12, fontSize: 15, color: '#111827' },
  eyeBtn:           { padding: 10 },
  forgotLink:       { alignSelf: 'flex-end', marginTop: -4, marginBottom: 14 },
  forgotText:       { fontSize: 13, color: '#2563eb', fontWeight: '700' },
  error:            { color: '#dc2626', fontSize: 13, marginBottom: 12, textAlign: 'center', fontWeight: '500' },
  button:           { backgroundColor: '#2563eb', borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 4, marginBottom: 16, elevation: 3, shadowColor: '#2563eb', shadowOpacity: 0.4, shadowRadius: 8 },
  buttonDisabled:   { backgroundColor: '#93c5fd', elevation: 0 },
  buttonText:       { color: '#fff', fontSize: 16, fontWeight: '800' },
  registerLink:     { alignItems: 'center' },
  registerLinkText: { fontSize: 14, color: '#6b7280' },
  registerLinkBold: { color: '#2563eb', fontWeight: '700' },
  rescuerLink:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#f3f4f6' },
  rescuerLinkText:  { fontSize: 14, color: '#133458', fontWeight: '700' },
});
