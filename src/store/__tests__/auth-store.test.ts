import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import type { AuthService } from '@/lib/auth/auth-service';
import { createAuthStore } from '@/store/auth-store';
import type { AuthSession } from '@/types/auth';

jest.mock('@/db/account-linking', () => ({
  linkLocalAccount: jest.fn(),
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

function createMockAuthService() {
  const restoreSession = jest.fn<() => Promise<AuthSession | null>>();
  const setSession = jest.fn<(session: AuthSession) => Promise<void>>();
  const signOut = jest.fn<() => Promise<void>>();
  const linkAccount = jest.fn<(_session: AuthSession) => Promise<unknown>>();

  const authService: AuthService = {
    restoreSession,
    setSession,
    signOut,
  };

  return {
    authService,
    restoreSession,
    setSession,
    signOut,
    linkAccount,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('auth store', () => {
  it('initializes guest mode when restore returns null', async () => {
    const { authService, linkAccount, restoreSession } =
      createMockAuthService();

    restoreSession.mockResolvedValue(null);
    linkAccount.mockResolvedValue(undefined);

    const store = createAuthStore({ authService, linkAccount });

    await store.getState().initializeAuth();

    expect(restoreSession).toHaveBeenCalledTimes(1);
    expect(linkAccount).not.toHaveBeenCalled();
    expect(store.getState()).toMatchObject({
      status: 'guest',
      session: null,
      user: null,
      error: null,
      isInitialized: true,
    });
  });

  it('initializes authenticated mode when restore returns a session', async () => {
    const { authService, linkAccount, restoreSession } =
      createMockAuthService();

    restoreSession.mockResolvedValue(TEST_SESSION);
    linkAccount.mockResolvedValue(undefined);

    const store = createAuthStore({ authService, linkAccount });

    await store.getState().initializeAuth();

    expect(linkAccount).toHaveBeenCalledWith(TEST_SESSION);
    expect(store.getState()).toMatchObject({
      status: 'authenticated',
      session: TEST_SESSION,
      user: TEST_SESSION.user,
      error: null,
      isInitialized: true,
    });
  });

  it('falls back to guest mode with a safe error when restore throws', async () => {
    const { authService, linkAccount, restoreSession } =
      createMockAuthService();

    restoreSession.mockRejectedValue(new Error('provider credential failure'));
    linkAccount.mockResolvedValue(undefined);

    const store = createAuthStore({ authService, linkAccount });

    await store.getState().initializeAuth();

    expect(linkAccount).not.toHaveBeenCalled();
    expect(store.getState()).toMatchObject({
      status: 'guest',
      session: null,
      user: null,
      error: {
        code: 'session_restore_failed',
        message: 'Auth could not be restored. Continuing as guest.',
        isRecoverable: true,
      },
      isInitialized: true,
    });

    expect(store.getState().error?.message).not.toContain('credential');
  });

  it('keeps authenticated mode with a safe error when account linking fails after restore', async () => {
    const { authService, linkAccount, restoreSession } =
      createMockAuthService();

    restoreSession.mockResolvedValue(TEST_SESSION);
    linkAccount.mockRejectedValue(new Error('raw owner relink failure'));

    const store = createAuthStore({ authService, linkAccount });

    await store.getState().initializeAuth();
    await Promise.resolve();

    expect(store.getState()).toMatchObject({
      status: 'authenticated',
      session: TEST_SESSION,
      user: TEST_SESSION.user,
      error: {
        code: 'account_link_failed',
        message:
          'Your local data is still on this device, but account linking could not finish.',
        isRecoverable: true,
      },
      isInitialized: true,
    });

    expect(store.getState().error?.message).not.toContain('owner');
  });

  it('signs out by clearing the service session and returning to guest mode', async () => {
    const { authService, linkAccount, restoreSession, signOut } =
      createMockAuthService();

    restoreSession.mockResolvedValue(TEST_SESSION);
    linkAccount.mockResolvedValue(undefined);
    signOut.mockResolvedValue(undefined);

    const store = createAuthStore({ authService, linkAccount });

    await store.getState().initializeAuth();
    linkAccount.mockClear();

    await store.getState().signOut();

    expect(signOut).toHaveBeenCalledTimes(1);
    expect(linkAccount).not.toHaveBeenCalled();
    expect(store.getState()).toMatchObject({
      status: 'guest',
      session: null,
      user: null,
      error: null,
      isInitialized: true,
    });
  });

  it('sets a session through the auth service', async () => {
    const { authService, linkAccount, setSession } = createMockAuthService();

    setSession.mockResolvedValue(undefined);
    linkAccount.mockResolvedValue(undefined);

    const store = createAuthStore({ authService, linkAccount });

    await store.getState().setSession(TEST_SESSION);

    expect(setSession).toHaveBeenCalledWith(TEST_SESSION);
    expect(linkAccount).toHaveBeenCalledWith(TEST_SESSION);
    expect(store.getState()).toMatchObject({
      status: 'authenticated',
      session: TEST_SESSION,
      user: TEST_SESSION.user,
      error: null,
      isInitialized: true,
    });
  });

  it('keeps authenticated mode with a safe error when account linking fails after login', async () => {
    const { authService, linkAccount, setSession } = createMockAuthService();

    setSession.mockResolvedValue(undefined);
    linkAccount.mockRejectedValue(new Error('raw local owner id failure'));

    const store = createAuthStore({ authService, linkAccount });

    await store.getState().setSession(TEST_SESSION);
    await Promise.resolve();

    expect(store.getState()).toMatchObject({
      status: 'authenticated',
      session: TEST_SESSION,
      user: TEST_SESSION.user,
      error: {
        code: 'account_link_failed',
        message:
          'Your local data is still on this device, but account linking could not finish.',
        isRecoverable: true,
      },
      isInitialized: true,
    });

    expect(store.getState().error?.message).not.toContain('local owner');
  });

  it('clears auth errors without changing the current auth mode', async () => {
    const { authService, linkAccount, restoreSession } =
      createMockAuthService();

    restoreSession.mockRejectedValue(new Error('restore failed'));
    linkAccount.mockResolvedValue(undefined);

    const store = createAuthStore({ authService, linkAccount });

    await store.getState().initializeAuth();

    expect(store.getState().error).not.toBeNull();

    store.getState().clearAuthError();

    expect(store.getState()).toMatchObject({
      status: 'guest',
      session: null,
      user: null,
      error: null,
      isInitialized: true,
    });
  });
});
