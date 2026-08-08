import { useEffect, useState } from 'react';
import { View, ActivityIndicator, Image } from 'react-native';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Slot, router, useRootNavigationState } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { isAuthenticated } from '@/hooks/use-auth';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const navState = useRootNavigationState();
  const [authChecked, setAuthChecked] = useState(false);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    isAuthenticated()
      .then(setAuthed)
      .catch(() => setAuthed(false))
      .finally(() => setAuthChecked(true));
  }, []);

  useEffect(() => {
    if (!authChecked) return;
    if (!navState?.key) return;
    if (authed) {
      // Route based on stored role
      const { getRole } = require('@/hooks/use-auth');
      getRole().then((role: string | null) => {
        if (role === 'rescuer') {
          router.replace('/(rescuer)/assignments');
        } else {
          router.replace('/(app)/map');
        }
      });
    } else {
      router.replace('/(auth)/login');
    }
  }, [authChecked, navState?.key, authed]);

  const ready = authChecked && !!navState?.key;

  return (
    <SafeAreaProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        {!ready ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1e40af', gap: 24 }}>
            <Image source={require('../assets/images/logo.png')} style={{ width: 120, height: 120, resizeMode: 'contain' }} />
            <ActivityIndicator size="large" color="#fff" />
          </View>
        ) : (
          <Slot />
        )}
        <StatusBar style="light" />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
