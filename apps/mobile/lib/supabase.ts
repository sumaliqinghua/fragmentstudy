import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupportedStorage } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import { resolveSupabaseConfig } from './config';

const supabaseConfig = resolveSupabaseConfig(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
);

export const isSupabaseConfigured = supabaseConfig.isConfigured;
export const supabaseConfigError = supabaseConfig.error;
export const supabaseApiUrl = supabaseConfig.url;

/** Avoid AsyncStorage web impl touching `window` during Expo Router Node/SSR. */
const memoryStore = new Map<string, string>();

const ssrSafeStorage: SupportedStorage = {
  getItem: (key) => {
    if (Platform.OS === 'web' && typeof window === 'undefined') {
      return memoryStore.get(key) ?? null;
    }
    return AsyncStorage.getItem(key);
  },
  setItem: (key, value) => {
    if (Platform.OS === 'web' && typeof window === 'undefined') {
      memoryStore.set(key, value);
      return;
    }
    return AsyncStorage.setItem(key, value);
  },
  removeItem: (key) => {
    if (Platform.OS === 'web' && typeof window === 'undefined') {
      memoryStore.delete(key);
      return;
    }
    return AsyncStorage.removeItem(key);
  },
};

export const supabase = createClient(supabaseConfig.url, supabaseConfig.anonKey, {
  auth: {
    storage: ssrSafeStorage,
    persistSession: isSupabaseConfigured,
    autoRefreshToken: isSupabaseConfigured,
    detectSessionInUrl: false,
  },
});

export async function getSessionUserId(): Promise<string | null> {
  if (!isSupabaseConfigured) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}
