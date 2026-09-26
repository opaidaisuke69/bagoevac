import { useEffect, useState } from 'react';
import { View, ActivityIndicator, Image, LogBox } from 'react-native';
import { DarkTheme, DefaultTheme, ThemeProvider, CommonActions } from '@react-navigation/native';
import { Slot, useRootNavigationState, useNavigationContainerRef } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { isAuthenticated } from '@/hooks/use-auth';

// Suppress non-fatal warnings in dev
LogBox.ignoreLogs([
  'Unable to activate keep awake',
  "Passing an object as the argument to 'navigate' is deprecated",
]);

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const navState = useRootNavigationState();
  const navigationRef = useNavigationContainerRef();
  const [authChecked, setAuthChecked] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [initialRouteSet, setInitialRouteSet] = useState(false);

  useEffect(() => {
    isAuthenticated()
      .then(setAuthed)
      .catch(() => setAuthed(false))
      .finally(() => setAuthChecked(true));
  }, []);

  useEffect(() => {
    if (!authChecked) return;
    if (!navState?.key) return;
    if (initialRouteSet) return;
    if (!navigationRef.isReady()) return;
    setInitialRouteSet(true);

    if (authed) {
      const { getRole } = require('@/hooks/use-auth');
      getRole().then((role: string | null) => {
        if (role === 'rescuer') {
          navigationRef.dispatch(
            CommonActions.reset({ index: 0, routes: [{ name: '(rescuer)', params: { screen: 'assignments' } }] })
          );
        } else {
          navigationRef.dispatch(
            CommonActions.reset({ index: 0, routes: [{ name: '(app)', params: { screen: 'map' } }] })
          );
        }
      });
    } else {
      navigationRef.dispatch(
        CommonActions.reset({ index: 0, routes: [{ name: '(auth)', params: { screen: 'login' } }] })
      );
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
