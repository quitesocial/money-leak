import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import type { AuthService } from '@/lib/auth/auth-service';
import { createAuthStore } from '@/store/auth-store';
import type { AuthSession } from '@/types/auth';

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
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('auth store', () => {
  it('initializes guest mode when restore returns null', async () => {
    const { authService, restoreSession } = createMockAuthService();

    restoreSession.mockResolvedValue(null);

    const store = createAuthStore({ authService });

    await store.getState().initializeAuth();

    expect(restoreSession).toHaveBeenCalledTimes(1);
    expect(store.getState()).toMatchObject({
      status: 'guest',
      session: null,
      user: null,
      error: null,
      isInitialized: true,
    });
  });

  it('initializes authenticated mode when restore returns a session', async () => {
    const { authService, restoreSession } = createMockAuthService();

    restoreSession.mockResolvedValue(TEST_SESSION);

    const store = createAuthStore({ authService });

    await store.getState().initializeAuth();

    expect(store.getState()).toMatchObject({
      status: 'authenticated',
      session: TEST_SESSION,
      user: TEST_SESSION.user,
      error: null,
      isInitialized: true,
    });
  });

  it('falls back to guest mode with a safe error when restore throws', async () => {
    const { authService, restoreSession } = createMockAuthService();

    restoreSession.mockRejectedValue(new Error('raw provider token failure'));

    const store = createAuthStore({ authService });

    await store.getState().initializeAuth();

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

    expect(store.getState().error?.message).not.toContain('token');
  });

  it('signs out by clearing the service session and returning to guest mode', async () => {
    const { authService, restoreSession, signOut } = createMockAuthService();

    restoreSession.mockResolvedValue(TEST_SESSION);
    signOut.mockResolvedValue(undefined);

    const store = createAuthStore({ authService });

    await store.getState().initializeAuth();
    await store.getState().signOut();

    expect(signOut).toHaveBeenCalledTimes(1);
    expect(store.getState()).toMatchObject({
      status: 'guest',
      session: null,
      user: null,
      error: null,
      isInitialized: true,
    });
  });

  it('sets a session through the auth service', async () => {
    const { authService, setSession } = createMockAuthService();

    setSession.mockResolvedValue(undefined);

    const store = createAuthStore({ authService });

    await store.getState().setSession(TEST_SESSION);

    expect(setSession).toHaveBeenCalledWith(TEST_SESSION);
    expect(store.getState()).toMatchObject({
      status: 'authenticated',
      session: TEST_SESSION,
      user: TEST_SESSION.user,
      error: null,
      isInitialized: true,
    });
  });

  it('clears auth errors without changing the current auth mode', async () => {
    const { authService, restoreSession } = createMockAuthService();

    restoreSession.mockRejectedValue(new Error('restore failed'));

    const store = createAuthStore({ authService });

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
