import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

import { fetchWithTimeout } from '@/lib/fetch-with-timeout';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase config. Copy .env.example to .env and fill in ' +
      'EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY from your Supabase project.',
  );
}

// On native, AsyncStorage is always safe. On web, Expo Router statically
// pre-renders routes in Node during export/dev, where `window` doesn't
// exist yet — AsyncStorage's web implementation assumes it does and throws.
// Fall back to `window.localStorage` in the browser and a no-op store
// during that server-side render pass.
const noopStorage = {
  getItem: async () => null,
  setItem: async () => {},
  removeItem: async () => {},
};

const authStorage =
  Platform.OS === 'web' ? (typeof window !== 'undefined' ? window.localStorage : noopStorage) : AsyncStorage;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: authStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
  // Neither the storage nor database client applies a request timeout on
  // its own, so a stalled connection (slow network, dropped mid-transfer)
  // hangs indefinitely with no error — see fetch-with-timeout.ts.
  global: {
    fetch: fetchWithTimeout,
  },
});

// Supabase's token auto-refresh timer keeps running in the background even
// when the app isn't visible; tie it to app foreground/background state.
AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});
