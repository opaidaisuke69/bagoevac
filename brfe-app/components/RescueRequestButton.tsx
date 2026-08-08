import { useState } from 'react';
import { TouchableOpacity, Text, StyleSheet, Alert, ActivityIndicator, View } from 'react-native';
import { API_BASE_URL } from '../constants/config';
import { getToken } from '../hooks/use-auth';
import { getLastCoords } from '../services/gps-tracker';

export default function RescueRequestButton() {
  const [loading, setLoading] = useState(false);

  async function handlePress() {
    const coords = getLastCoords();
    if (!coords) {
      Alert.alert('No GPS Fix', 'Waiting for your location. Please try again in a moment.');
      return;
    }

    Alert.alert(
      '🆘 Request Rescue',
      'Send your location to emergency responders?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Send Now', style: 'destructive', onPress: () => sendRescue(coords) },
      ]
    );
  }

  async function sendRescue(coords: { latitude: number; longitude: number }) {
    setLoading(true);
    try {
      const token = await getToken();
      const res = await fetch(`${API_BASE_URL}/api/rescue/post`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ lat: coords.latitude, lng: coords.longitude }),
      });
      if (res.ok) {
        Alert.alert('✅ Rescue Requested', 'Responders have been notified of your location.');
      } else {
        const body = await res.json().catch(() => ({}));
        Alert.alert('Error', (body as { message?: string }).message ?? 'Failed to send rescue request.');
      }
    } catch {
      Alert.alert('Error', 'Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <TouchableOpacity
      style={[styles.button, loading && styles.buttonDisabled]}
      onPress={handlePress}
      disabled={loading}
    >
      {loading ? (
        <ActivityIndicator color="#fff" size="small" />
      ) : (
        <View style={styles.inner}>
          <Text style={styles.icon}>🆘</Text>
          <Text style={styles.label}>Rescue</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: '#DC2626',
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    minWidth: 90,
  },
  buttonDisabled: { backgroundColor: '#9CA3AF', shadowColor: '#000' },
  inner: { alignItems: 'center' },
  icon: { fontSize: 22 },
  label: { color: '#fff', fontWeight: '800', fontSize: 12, marginTop: 2 },
});

