import AsyncStorage from '@react-native-async-storage/async-storage';

const TOKEN_KEY = 'brfe_jwt';
const ROLE_KEY = 'brfe_role'; // 'evacuee' | 'rescuer'

export async function getToken(): Promise<string | null> {
  return AsyncStorage.getItem(TOKEN_KEY);
}

export async function setToken(token: string): Promise<void> {
  await AsyncStorage.setItem(TOKEN_KEY, token);
}

export async function clearToken(): Promise<void> {
  await AsyncStorage.removeItem(TOKEN_KEY);
  await AsyncStorage.removeItem(ROLE_KEY);
}

export async function isAuthenticated(): Promise<boolean> {
  const token = await getToken();
  return token !== null && token.length > 0;
}

export async function getRole(): Promise<string | null> {
  return AsyncStorage.getItem(ROLE_KEY);
}

export async function setRole(role: string): Promise<void> {
  await AsyncStorage.setItem(ROLE_KEY, role);
}

/** Decode the (unverified) JWT payload stored for this session. */
export async function getTokenPayload(): Promise<Record<string, any> | null> {
  const token = await getToken();
  if (!token) return null;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    let base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    base64 = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    // atob is available in React Native's Hermes runtime.
    return JSON.parse(atob(base64));
  } catch {
    return null;
  }
}
