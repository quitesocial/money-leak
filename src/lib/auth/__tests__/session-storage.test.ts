import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import {
  AUTH_SESSION_STORAGE_KEY,
  parseStoredAuthSession,
  secureAuthSessionStorage,
} from '@/lib/auth/session-storage';
import type { AuthSession } from '@/types/auth';

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

const TEST_SESSION: AuthSession = {
  provider: 'google',
  createdAt: 1760000000000,
  expiresAt: null,
  user: {
    id: 'auth-user-test',
    provider: 'google',
    email: 'test@example.com',
    displayName: 'Test User',
    photoUrl: null,
  },
};

function createStoredSessionJson(session: AuthSession) {
  return JSON.stringify({
    schemaVersion: 1,
    session,
  });
}

beforeEach(() => {
  jest.clearAllMocks();

  mockIsAvailableAsync.mockResolvedValue(true);
  mockGetItemAsync.mockResolvedValue(null);
  mockSetItemAsync.mockResolvedValue(undefined);
  mockDeleteItemAsync.mockResolvedValue(undefined);
});

describe('secure auth session storage', () => {
  it('uses a SecureStore-compatible key', () => {
    expect(AUTH_SESSION_STORAGE_KEY).toMatch(/^[\w.-]+$/);
  });

  it('returns null when SecureStore is unavailable', async () => {
    mockIsAvailableAsync.mockResolvedValue(false);

    await expect(secureAuthSessionStorage.getSession()).resolves.toBeNull();

    expect(mockGetItemAsync).not.toHaveBeenCalled();
  });

  it('restores a token-free session from SecureStore', async () => {
    mockGetItemAsync.mockResolvedValue(createStoredSessionJson(TEST_SESSION));

    await expect(secureAuthSessionStorage.getSession()).resolves.toEqual(
      TEST_SESSION,
    );

    expect(mockGetItemAsync).toHaveBeenCalledWith(AUTH_SESSION_STORAGE_KEY);
  });

  it('returns null for invalid stored session data', () => {
    expect(parseStoredAuthSession('not-json')).toBeNull();
    expect(parseStoredAuthSession(JSON.stringify({ schemaVersion: 1 }))).toBe(
      null,
    );
  });

  it('writes a token-free session to SecureStore', async () => {
    await secureAuthSessionStorage.setSession(TEST_SESSION);

    expect(mockSetItemAsync).toHaveBeenCalledTimes(1);

    const [key, storedValue] = mockSetItemAsync.mock.calls[0];

    expect(key).toBe(AUTH_SESSION_STORAGE_KEY);
    expect(JSON.parse(storedValue)).toEqual({
      schemaVersion: 1,
      session: TEST_SESSION,
    });
    expect(storedValue).not.toContain('accessToken');
    expect(storedValue).not.toContain('refreshToken');
  });

  it('fails safely when saving without SecureStore availability', async () => {
    mockIsAvailableAsync.mockResolvedValue(false);

    await expect(
      secureAuthSessionStorage.setSession(TEST_SESSION),
    ).rejects.toThrow('Secure auth session storage is unavailable.');

    expect(mockSetItemAsync).not.toHaveBeenCalled();
  });

  it('clears SecureStore when available', async () => {
    await secureAuthSessionStorage.clearSession();

    expect(mockDeleteItemAsync).toHaveBeenCalledWith(AUTH_SESSION_STORAGE_KEY);
  });

  it('treats clear as a no-op when SecureStore is unavailable', async () => {
    mockIsAvailableAsync.mockResolvedValue(false);

    await secureAuthSessionStorage.clearSession();

    expect(mockDeleteItemAsync).not.toHaveBeenCalled();
  });
});
