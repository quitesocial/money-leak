import 'react-native-url-polyfill/auto';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import {
  supabaseConfigStatus,
  type SupabaseClientConfig,
} from '@/lib/supabase/supabase-config';
import {
  SUPABASE_AUTH_STORAGE_KEY,
  supabaseSecureAuthStorage,
} from '@/lib/supabase/supabase-secure-storage';

let supabaseClient: SupabaseClient | null = null;

export function createSupabaseClient(config: SupabaseClientConfig) {
  return createClient(config.supabaseUrl, config.supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      flowType: 'pkce',
      persistSession: true,
      skipAutoInitialize: true,
      storage: supabaseSecureAuthStorage,
      storageKey: SUPABASE_AUTH_STORAGE_KEY,
    },
  });
}

export function getSupabaseClient() {
  if (!supabaseConfigStatus.config) return null;

  supabaseClient ??= createSupabaseClient(supabaseConfigStatus.config);

  return supabaseClient;
}
