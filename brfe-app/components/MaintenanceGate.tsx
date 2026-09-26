/**
 * MaintenanceGate — wraps the authenticated app areas. When the LGU admin shuts
 * the system down, it renders a blocking full-screen notice and signs the user
 * out so evacuees and rescuers cannot keep using the app.
 */

import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigationContainerRef } from 'expo-router';
import { CommonActions } from '@react-navigation/native';
import { subscribe, type SystemStatus } from '../services/system-status';
import { clearToken } from '../hooks/use-auth';

export default function MaintenanceGate({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<SystemStatus>({ maintenance: false, message: '' });
  const navigationRef = useNavigationContainerRef();

  useEffect(() => {
    const unsub = subscribe(setStatus);
    return unsub;
  }, []);

  async function handleSignOut() {
    await clearToken();
    if (navigationRef.isReady()) {
      navigationRef.dispatch(
        CommonActions.reset({ index: 0, routes: [{ name: '(auth)', params: { screen: 'login' } }] })
      );
    }
  }

  if (!status.maintenance) {
    return <>{children}</>;
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#7f1d1d" />
      <View style={styles.iconCircle}>
        <Ionicons name="warning" size={56} color="#fff" />
      </View>
      <Text style={styles.title}>System Unavailable</Text>
      <Text style={styles.message}>
        {status.message ||
          'The system has been shut down by the LGU administrator. Please try again later.'}
      </Text>
      <TouchableOpacity style={styles.button} onPress={handleSignOut}>
        <Ionicons name="log-out-outline" size={18} color="#7f1d1d" />
        <Text style={styles.buttonText}>Sign Out</Text>
      </TouchableOpacity>
      <Text style={styles.hint}>You will be able to sign in again once the system is back online.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#991b1b', justifyContent: 'center', alignItems: 'center', padding: 32 },
  iconCircle: { width: 110, height: 110, borderRadius: 55, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center', marginBottom: 28 },
  title: { fontSize: 26, fontWeight: '900', color: '#fff', marginBottom: 12, textAlign: 'center' },
  message: { fontSize: 15, color: 'rgba(255,255,255,0.9)', textAlign: 'center', lineHeight: 22, marginBottom: 32 },
  button: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff', paddingHorizontal: 24, paddingVertical: 13, borderRadius: 14 },
  buttonText: { color: '#7f1d1d', fontSize: 15, fontWeight: '800' },
  hint: { fontSize: 12, color: 'rgba(255,255,255,0.7)', textAlign: 'center', marginTop: 20 },
});
