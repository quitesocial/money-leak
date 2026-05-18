import * as SecureStore from 'expo-secure-store';

import type { AuthSession, AuthUser } from '@/types/auth';

export const AUTH_SESSION_STORAGE_KEY = 'money-leak:auth-session:v1';
const STORED_AUTH_SESSION_SCHEMA_VERSION = 1;

type StoredAuthSession = {
  schemaVersion: typeof STORED_AUTH_SESSION_SCHEMA_VERSION;
  session: AuthSession;
};

export type AuthSessionStorage = {
  getSession: () => Promise<AuthSession | null>;
  setSession: (session: AuthSession) => Promise<void>;
  clearSession: () => Promise<void>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStringOrNull(value: unknown): value is string | null {
  return typeof value === 'string' || value === null;
}

function isAuthProvider(value: unknown): value is AuthSession['provider'] {
  return value === 'google' || value === 'apple';
}

function isAuthUser(value: unknown): value is AuthUser {
  if (!isRecord(value)) return false;

  return (
    typeof value.id === 'string' &&
    isAuthProvider(value.provider) &&
    isStringOrNull(value.email) &&
    isStringOrNull(value.displayName) &&
    isStringOrNull(value.photoUrl)
  );
}

function isAuthSession(value: unknown): value is AuthSession {
  if (!isRecord(value)) return false;

  return (
    isAuthUser(value.user) &&
    isAuthProvider(value.provider) &&
    value.provider === value.user.provider &&
    typeof value.createdAt === 'number' &&
    Number.isFinite(value.createdAt) &&
    (Number.isFinite(value.expiresAt) || value.expiresAt === null)
  );
}

export function parseStoredAuthSession(value: string): AuthSession | null {
  try {
    const parsedValue: unknown = JSON.parse(value);

    if (!isRecord(parsedValue)) return null;

    if (parsedValue.schemaVersion !== STORED_AUTH_SESSION_SCHEMA_VERSION) {
      return null;
    }

    return isAuthSession(parsedValue.session) ? parsedValue.session : null;
  } catch {
    return null;
  }
}

async function isSecureStoreAvailable() {
  try {
    return await SecureStore.isAvailableAsync();
  } catch {
    return false;
  }
}

export const secureAuthSessionStorage: AuthSessionStorage = {
  async getSession() {
    if (!(await isSecureStoreAvailable())) return null;

    const storedValue = await SecureStore.getItemAsync(
      AUTH_SESSION_STORAGE_KEY,
    );

    if (!storedValue) return null;

    return parseStoredAuthSession(storedValue);
  },

  async setSession(session) {
    if (!(await isSecureStoreAvailable())) {
      throw new Error('Secure auth session storage is unavailable.');
    }

    const storedSession: StoredAuthSession = {
      schemaVersion: STORED_AUTH_SESSION_SCHEMA_VERSION,
      session,
    };

    await SecureStore.setItemAsync(
      AUTH_SESSION_STORAGE_KEY,
      JSON.stringify(storedSession),
    );
  },

  async clearSession() {
    if (!(await isSecureStoreAvailable())) return;

    await SecureStore.deleteItemAsync(AUTH_SESSION_STORAGE_KEY);
  },
};
