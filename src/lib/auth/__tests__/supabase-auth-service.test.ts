import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
  AuthApiError,
  AuthRetryableFetchError,
  type Session,
  type User,
} from '@supabase/supabase-js';

import { createSupabaseAuthService } from '@/lib/auth/supabase-auth-service';
import type { AuthSessionStorage } from '@/lib/auth/session-storage';
import type { AuthSession } from '@/types/auth';

const mockGetTransactions = jest.fn();
const mockCreateTransaction = jest.fn();
const mockImportTransactions = jest.fn();
const mockUpdateTransaction = jest.fn();
const mockDeleteTransaction = jest.fn();
const mockGetCategories = jest.fn();
const mockCreateCategory = jest.fn();
const mockUpdateCategoryName = jest.fn();
const mockArchiveCategory = jest.fn();

jest.mock('@/db/transactions', () => ({
  createTransaction: (...args: unknown[]) => mockCreateTransaction(...args),
  deleteTransaction: (...args: unknown[]) => mockDeleteTransaction(...args),
  getTransactions: (...args: unknown[]) => mockGetTransactions(...args),
  importTransactions: (...args: unknown[]) => mockImportTransactions(...args),
  updateTransaction: (...args: unknown[]) => mockUpdateTransaction(...args),
}));

jest.mock('@/db/categories', () => ({
  archiveCategory: (...args: unknown[]) => mockArchiveCategory(...args),
  createCategory: (...args: unknown[]) => mockCreateCategory(...args),
  getCategories: (...args: unknown[]) => mockGetCategories(...args),
  updateCategoryName: (...args: unknown[]) => mockUpdateCategoryName(...args),
}));

const TEST_CACHED_USER = {
  id: 'supabase-user-id',
  email: 'cached@example.com',
  app_metadata: {},
  aud: 'authenticated',
  created_at: '2026-01-01T00:00:00.000Z',
  user_metadata: {
    avatar_url: 'https://example.com/cached-avatar.png',
    full_name: 'Cached User',
  },
} as unknown as User;

const TEST_VERIFIED_USER = {
  ...TEST_CACHED_USER,
  email: 'verified@example.com',
  user_metadata: {
    avatar_url: 'https://example.com/verified-avatar.png',
    full_name: 'Verified User',
  },
} as unknown as User;

const TEST_SUPABASE_SESSION = {
  access_token: 'sample-access-credential',
  refresh_token: 'sample-refresh-credential',
  provider_token: 'sample-provider-credential',
  provider_refresh_token: 'sample-provider-refresh-credential',
  expires_at: 1760003600,
  expires_in: 3600,
  token_type: 'bearer',
  user: TEST_CACHED_USER,
} as unknown as Session;

function createMockSessionStorage() {
  const getSession = jest.fn<() => Promise<AuthSession | null>>();
  const setSession = jest.fn<(session: AuthSession) => Promise<void>>();
  const clearSession = jest.fn<() => Promise<void>>();

  const sessionStorage: AuthSessionStorage = {
    getSession,
    setSession,
    clearSession,
  };

  return {
    sessionStorage,
    getSession,
    setSession,
    clearSession,
  };
}

function createMockSupabaseClient() {
  const getSession = jest.fn<
    () => Promise<{
      data: { session: Session | null };
      error: Error | null;
    }>
  >();

  const getUser = jest.fn<
    () => Promise<{
      data: { user: User | null };
      error: Error | null;
    }>
  >();

  const signOut = jest.fn<
    (_options?: { scope?: 'global' | 'local' | 'others' }) => Promise<{
      error: Error | null;
    }>
  >();

  return {
    client: {
      auth: {
        getSession,
        getUser,
        signOut,
      },
    },
    getSession,
    getUser,
    signOut,
  };
}

function expectLocalDataActionsNotCalled() {
  expect(mockGetTransactions).not.toHaveBeenCalled();
  expect(mockCreateTransaction).not.toHaveBeenCalled();
  expect(mockImportTransactions).not.toHaveBeenCalled();
  expect(mockUpdateTransaction).not.toHaveBeenCalled();
  expect(mockDeleteTransaction).not.toHaveBeenCalled();
  expect(mockGetCategories).not.toHaveBeenCalled();
  expect(mockCreateCategory).not.toHaveBeenCalled();
  expect(mockUpdateCategoryName).not.toHaveBeenCalled();
  expect(mockArchiveCategory).not.toHaveBeenCalled();
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('Supabase auth service', () => {
  it('restores a valid Supabase session into token-free Money Leak auth state', async () => {
    const { sessionStorage, setSession, clearSession } =
      createMockSessionStorage();

    const { client, getSession, getUser } = createMockSupabaseClient();
    const clearSupabaseSessionStorage = jest.fn<() => Promise<void>>();
    const getStoredSupabaseSessionValue =
      jest.fn<() => Promise<string | null>>();

    getSession.mockResolvedValue({
      data: { session: TEST_SUPABASE_SESSION },
      error: null,
    });
    getUser.mockResolvedValue({
      data: { user: TEST_VERIFIED_USER },
      error: null,
    });
    setSession.mockResolvedValue(undefined);
    clearSession.mockResolvedValue(undefined);
    clearSupabaseSessionStorage.mockResolvedValue(undefined);
    getStoredSupabaseSessionValue.mockResolvedValue('stored-supabase-session');

    const authService = createSupabaseAuthService({
      clearSupabaseSessionStorage,
      getClient: () => client as never,
      getStoredSupabaseSessionValue,
      now: () => 1760000000000,
      sessionStorage,
    });

    await expect(authService.restoreSession()).resolves.toEqual({
      provider: 'google',
      createdAt: 1760000000000,
      expiresAt: 1760003600000,
      user: {
        id: 'supabase-user-id',
        provider: 'google',
        email: 'verified@example.com',
        displayName: 'Verified User',
        photoUrl: 'https://example.com/verified-avatar.png',
      },
    });

    expect(getSession).toHaveBeenCalledTimes(1);
    expect(getUser).toHaveBeenCalledTimes(1);
    expect(setSession).toHaveBeenCalledTimes(1);
    expect(clearSession).not.toHaveBeenCalled();
    expect(clearSupabaseSessionStorage).not.toHaveBeenCalled();

    const storedMoneyLeakSession = JSON.stringify(setSession.mock.calls[0][0]);

    expect(storedMoneyLeakSession).not.toContain('sample-access-credential');
    expect(storedMoneyLeakSession).not.toContain('sample-refresh-credential');
    expect(storedMoneyLeakSession).not.toContain('sample-provider-credential');
    expect(storedMoneyLeakSession).not.toContain(
      'sample-provider-refresh-credential',
    );
    expect(storedMoneyLeakSession).not.toContain('EXPO_PUBLIC_');
    expectLocalDataActionsNotCalled();
  });

  it('returns guest and clears stale display auth when Supabase has no session', async () => {
    const { sessionStorage, setSession, clearSession } =
      createMockSessionStorage();

    const { client, getSession, getUser } = createMockSupabaseClient();
    const clearSupabaseSessionStorage = jest.fn<() => Promise<void>>();
    const getStoredSupabaseSessionValue =
      jest.fn<() => Promise<string | null>>();

    getSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });
    setSession.mockResolvedValue(undefined);
    clearSession.mockResolvedValue(undefined);
    clearSupabaseSessionStorage.mockResolvedValue(undefined);
    getStoredSupabaseSessionValue.mockResolvedValue(null);

    const authService = createSupabaseAuthService({
      clearSupabaseSessionStorage,
      getClient: () => client as never,
      getStoredSupabaseSessionValue,
      sessionStorage,
    });

    await expect(authService.restoreSession()).resolves.toBeNull();

    expect(getUser).not.toHaveBeenCalled();
    expect(setSession).not.toHaveBeenCalled();
    expect(clearSession).toHaveBeenCalledTimes(1);
    expect(clearSupabaseSessionStorage).toHaveBeenCalledTimes(1);
    expectLocalDataActionsNotCalled();
  });

  it('clears auth state and fails safely when stored Supabase session is corrupted', async () => {
    const { sessionStorage, clearSession } = createMockSessionStorage();
    const { client, getSession } = createMockSupabaseClient();
    const clearSupabaseSessionStorage = jest.fn<() => Promise<void>>();
    const getStoredSupabaseSessionValue =
      jest.fn<() => Promise<string | null>>();

    getSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });
    clearSession.mockResolvedValue(undefined);
    clearSupabaseSessionStorage.mockResolvedValue(undefined);
    getStoredSupabaseSessionValue.mockResolvedValue('corrupted-session');

    const authService = createSupabaseAuthService({
      clearSupabaseSessionStorage,
      getClient: () => client as never,
      getStoredSupabaseSessionValue,
      sessionStorage,
    });

    await expect(authService.restoreSession()).rejects.toThrow(
      'Supabase auth session could not be restored.',
    );

    expect(clearSession).toHaveBeenCalledTimes(1);
    expect(clearSupabaseSessionStorage).toHaveBeenCalledTimes(1);
    expectLocalDataActionsNotCalled();
  });

  it('clears auth state and fails safely when Supabase restore returns an error', async () => {
    const { sessionStorage, clearSession } = createMockSessionStorage();
    const { client, getSession } = createMockSupabaseClient();
    const clearSupabaseSessionStorage = jest.fn<() => Promise<void>>();
    const getStoredSupabaseSessionValue =
      jest.fn<() => Promise<string | null>>();

    getSession.mockResolvedValue({
      data: { session: null },
      error: new AuthApiError('invalid auth credential', 401, 'bad_jwt'),
    });
    clearSession.mockResolvedValue(undefined);
    clearSupabaseSessionStorage.mockResolvedValue(undefined);
    getStoredSupabaseSessionValue.mockResolvedValue('stored-supabase-session');

    const authService = createSupabaseAuthService({
      clearSupabaseSessionStorage,
      getClient: () => client as never,
      getStoredSupabaseSessionValue,
      sessionStorage,
    });

    await expect(authService.restoreSession()).rejects.toThrow(
      'Supabase auth session could not be restored.',
    );

    expect(clearSession).toHaveBeenCalledTimes(1);
    expect(clearSupabaseSessionStorage).toHaveBeenCalledTimes(1);
    expectLocalDataActionsNotCalled();
  });

  it('keeps an otherwise valid cached session when user validation has a retryable network error', async () => {
    const { sessionStorage, setSession, clearSession } =
      createMockSessionStorage();

    const { client, getSession, getUser } = createMockSupabaseClient();
    const clearSupabaseSessionStorage = jest.fn<() => Promise<void>>();
    const getStoredSupabaseSessionValue =
      jest.fn<() => Promise<string | null>>();

    getSession.mockResolvedValue({
      data: { session: TEST_SUPABASE_SESSION },
      error: null,
    });
    getUser.mockResolvedValue({
      data: { user: null },
      error: new AuthRetryableFetchError('Network unavailable', 0),
    });
    setSession.mockResolvedValue(undefined);
    clearSession.mockResolvedValue(undefined);
    clearSupabaseSessionStorage.mockResolvedValue(undefined);
    getStoredSupabaseSessionValue.mockResolvedValue('stored-supabase-session');

    const authService = createSupabaseAuthService({
      clearSupabaseSessionStorage,
      getClient: () => client as never,
      getStoredSupabaseSessionValue,
      now: () => 1760000000000,
      sessionStorage,
    });

    await expect(authService.restoreSession()).resolves.toMatchObject({
      provider: 'google',
      user: {
        id: 'supabase-user-id',
        email: 'cached@example.com',
        displayName: 'Cached User',
      },
    });

    expect(setSession).toHaveBeenCalledTimes(1);
    expect(clearSession).not.toHaveBeenCalled();
    expect(clearSupabaseSessionStorage).not.toHaveBeenCalled();
    expectLocalDataActionsNotCalled();
  });

  it('clears display and Supabase auth state when config is unavailable', async () => {
    const { sessionStorage, clearSession } = createMockSessionStorage();
    const clearSupabaseSessionStorage = jest.fn<() => Promise<void>>();
    const getStoredSupabaseSessionValue =
      jest.fn<() => Promise<string | null>>();

    clearSession.mockResolvedValue(undefined);
    clearSupabaseSessionStorage.mockResolvedValue(undefined);

    const authService = createSupabaseAuthService({
      clearSupabaseSessionStorage,
      getClient: () => null,
      getStoredSupabaseSessionValue,
      sessionStorage,
    });

    await expect(authService.restoreSession()).resolves.toBeNull();

    expect(getStoredSupabaseSessionValue).not.toHaveBeenCalled();
    expect(clearSession).toHaveBeenCalledTimes(1);
    expect(clearSupabaseSessionStorage).toHaveBeenCalledTimes(1);
    expectLocalDataActionsNotCalled();
  });

  it('persists only the token-free Money Leak session after sign-in', async () => {
    const { sessionStorage, setSession } = createMockSessionStorage();
    const authSession: AuthSession = {
      provider: 'google',
      createdAt: 1760000000000,
      expiresAt: 1760003600000,
      user: {
        id: 'supabase-user-id',
        provider: 'google',
        email: 'test@example.com',
        displayName: 'Test User',
        photoUrl: null,
      },
    };

    setSession.mockResolvedValue(undefined);

    const authService = createSupabaseAuthService({
      getClient: () => null,
      sessionStorage,
    });

    await authService.setSession(authSession);

    expect(setSession).toHaveBeenCalledWith(authSession);
    expect(JSON.stringify(setSession.mock.calls[0][0])).not.toContain('token');
  });

  it('signs out through Supabase and clears only auth storage boundaries', async () => {
    const { sessionStorage, clearSession } = createMockSessionStorage();
    const { client, signOut } = createMockSupabaseClient();
    const clearSupabaseSessionStorage = jest.fn<() => Promise<void>>();

    signOut.mockResolvedValue({ error: null });
    clearSession.mockResolvedValue(undefined);
    clearSupabaseSessionStorage.mockResolvedValue(undefined);

    const authService = createSupabaseAuthService({
      clearSupabaseSessionStorage,
      getClient: () => client as never,
      sessionStorage,
    });

    await authService.signOut();

    expect(signOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(clearSession).toHaveBeenCalledTimes(1);
    expect(clearSupabaseSessionStorage).toHaveBeenCalledTimes(1);
    expectLocalDataActionsNotCalled();
  });

  it('still clears local auth storage when Supabase sign out reports an error', async () => {
    const { sessionStorage, clearSession } = createMockSessionStorage();
    const { client, signOut } = createMockSupabaseClient();
    const clearSupabaseSessionStorage = jest.fn<() => Promise<void>>();

    signOut.mockResolvedValue({
      error: new AuthApiError('sign out failed', 500, 'server_error'),
    });
    clearSession.mockResolvedValue(undefined);
    clearSupabaseSessionStorage.mockResolvedValue(undefined);

    const authService = createSupabaseAuthService({
      clearSupabaseSessionStorage,
      getClient: () => client as never,
      sessionStorage,
    });

    await expect(authService.signOut()).rejects.toThrow(
      'Supabase auth session could not be cleared.',
    );

    expect(signOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(clearSession).toHaveBeenCalledTimes(1);
    expect(clearSupabaseSessionStorage).toHaveBeenCalledTimes(1);
    expectLocalDataActionsNotCalled();
  });
});
