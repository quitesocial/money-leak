import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import {
  SUPABASE_AUTH_STORAGE_KEY,
  clearSupabaseAuthStorage,
  getStoredSupabaseAuthSessionValue,
  supabaseSecureAuthStorage,
} from '@/lib/supabase/supabase-secure-storage';

const mockIsAvailableAsync = jest.fn<() => Promise<boolean>>();
const mockGetItemAsync = jest.fn<(key: string) => Promise<string | null>>();

const mockSetItemAsync =
  jest.fn<(key: string, value: string) => Promise<void>>();

const mockDeleteItemAsync = jest.fn<(key: string) => Promise<void>>();

jest.mock('expo-secure-store', () => ({
  isAvailableAsync: () => mockIsAvailableAsync(),
  getItemAsync: (key: string) => mockGetItemAsync(key),
  setItemAsync: (key: string, value: string) => mockSetItemAsync(key, value),
  deleteItemAsync: (key: string) => mockDeleteItemAsync(key),
}));

beforeEach(() => {
  jest.clearAllMocks();

  mockIsAvailableAsync.mockResolvedValue(true);
  mockGetItemAsync.mockResolvedValue(null);
  mockSetItemAsync.mockResolvedValue(undefined);
  mockDeleteItemAsync.mockResolvedValue(undefined);
});

describe('Supabase secure auth storage', () => {
  it('uses an explicit Money Leak storage key', () => {
    expect(SUPABASE_AUTH_STORAGE_KEY).toBe(
      'money-leak-supabase-auth-session-v1',
    );
    expect(SUPABASE_AUTH_STORAGE_KEY).toMatch(/^[\w.-]+$/);
  });

  it('stores and reads values through SecureStore', async () => {
    mockGetItemAsync.mockResolvedValue('stored-session');

    await expect(
      supabaseSecureAuthStorage.getItem(SUPABASE_AUTH_STORAGE_KEY),
    ).resolves.toBe('stored-session');

    await supabaseSecureAuthStorage.setItem(
      SUPABASE_AUTH_STORAGE_KEY,
      'next-session',
    );

    expect(mockGetItemAsync).toHaveBeenCalledWith(SUPABASE_AUTH_STORAGE_KEY);
    expect(mockSetItemAsync).toHaveBeenCalledWith(
      SUPABASE_AUTH_STORAGE_KEY,
      'next-session',
    );
  });

  it('returns the stored Supabase auth session boundary value', async () => {
    mockGetItemAsync.mockResolvedValue('stored-session');

    await expect(getStoredSupabaseAuthSessionValue()).resolves.toBe(
      'stored-session',
    );

    expect(mockGetItemAsync).toHaveBeenCalledWith(SUPABASE_AUTH_STORAGE_KEY);
  });

  it('clears the Supabase auth storage boundary without touching other keys', async () => {
    await clearSupabaseAuthStorage();

    expect(mockDeleteItemAsync).toHaveBeenCalledTimes(3);
    expect(mockDeleteItemAsync).toHaveBeenCalledWith(SUPABASE_AUTH_STORAGE_KEY);
    expect(mockDeleteItemAsync).toHaveBeenCalledWith(
      `${SUPABASE_AUTH_STORAGE_KEY}-code-verifier`,
    );
    expect(mockDeleteItemAsync).toHaveBeenCalledWith(
      `${SUPABASE_AUTH_STORAGE_KEY}-user`,
    );
  });

  it('treats unavailable SecureStore as a no-op for reads and clears', async () => {
    mockIsAvailableAsync.mockResolvedValue(false);

    await expect(getStoredSupabaseAuthSessionValue()).resolves.toBeNull();
    await clearSupabaseAuthStorage();

    expect(mockGetItemAsync).not.toHaveBeenCalled();
    expect(mockDeleteItemAsync).not.toHaveBeenCalled();
  });
});
