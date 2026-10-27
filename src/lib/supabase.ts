import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

import { authStorage } from '@/lib/authStorage';
import { resolveSupabaseUrl } from '@/lib/supabaseUrl';
import type { Database } from '@/types/database.types';

const configuredUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!configuredUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY. Copy .env.example to .env after npm run db:status.',
  );
}

const supabaseUrl = resolveSupabaseUrl(configuredUrl);

const isClientRuntime = Platform.OS !== 'web' || typeof window !== 'undefined';

/**
 * Anon client only. Never ship the service-role key in the app.
 * On Expo Go, localhost env URLs are rewritten to the Metro LAN host automatically.
 */
export const supabase: SupabaseClient<Database> = createClient<Database>(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      storage: authStorage,
      autoRefreshToken: isClientRuntime,
      persistSession: isClientRuntime,
      detectSessionInUrl: Platform.OS === 'web' && typeof window !== 'undefined',
      flowType: 'pkce',
    },
  },
);

if (__DEV__) {
  // Helpful when debugging Expo Go ↔ local Supabase connectivity.
  // Does not log keys or tokens.
  console.log(`[kiburan] Supabase URL → ${supabaseUrl}`);
}
