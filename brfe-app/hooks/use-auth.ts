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
