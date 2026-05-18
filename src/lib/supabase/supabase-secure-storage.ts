import type { SupportedStorage } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';

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
