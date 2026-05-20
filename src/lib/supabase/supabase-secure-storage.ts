import type { SupportedStorage } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';

export const SUPABASE_AUTH_STORAGE_KEY = 'money-leak-supabase-auth-session-v1';

const SUPABASE_AUTH_STORAGE_BOUNDARY_KEYS = [
  SUPABASE_AUTH_STORAGE_KEY,
  `${SUPABASE_AUTH_STORAGE_KEY}-code-verifier`,
  `${SUPABASE_AUTH_STORAGE_KEY}-user`,
] as const;

async function isSecureStoreAvailable() {
  try {
    return await SecureStore.isAvailableAsync();
  } catch {
    return false;
  }
}

export const supabaseSecureAuthStorage: SupportedStorage = {
  async getItem(key) {
    if (!(await isSecureStoreAvailable())) return null;

    return SecureStore.getItemAsync(key);
  },

  async setItem(key, value) {
    if (!(await isSecureStoreAvailable())) {
      throw new Error('Secure Supabase auth storage is unavailable.');
    }

    await SecureStore.setItemAsync(key, value);
  },

  async removeItem(key) {
    if (!(await isSecureStoreAvailable())) return;

    await SecureStore.deleteItemAsync(key);
  },
};

export async function getStoredSupabaseAuthSessionValue() {
  return supabaseSecureAuthStorage.getItem(SUPABASE_AUTH_STORAGE_KEY);
}

export async function clearSupabaseAuthStorage() {
  await Promise.all(
    SUPABASE_AUTH_STORAGE_BOUNDARY_KEYS.map((key) => {
      return supabaseSecureAuthStorage.removeItem(key);
    }),
  );
}
