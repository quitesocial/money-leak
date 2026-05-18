import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { createGuestAuthService } from '@/lib/auth/guest-auth-service';
import type { AuthSessionStorage } from '@/lib/auth/session-storage';
import type { AuthSession } from '@/types/auth';

const TEST_SESSION: AuthSession = {
  provider: 'apple',
  createdAt: 1760000000000,
  expiresAt: null,
  user: {
    id: 'auth-user-test',
    provider: 'apple',
    email: null,
    displayName: 'Test User',
    photoUrl: null,
  },
};

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

beforeEach(() => {
  jest.clearAllMocks();
});

describe('guest auth service', () => {
  it('restores null from session storage', async () => {
    const { sessionStorage, getSession } = createMockSessionStorage();

    getSession.mockResolvedValue(null);

    const authService = createGuestAuthService({ sessionStorage });

    await expect(authService.restoreSession()).resolves.toBeNull();
    expect(getSession).toHaveBeenCalledTimes(1);
  });

  it('restores a stored token-free session', async () => {
    const { sessionStorage, getSession } = createMockSessionStorage();

    getSession.mockResolvedValue(TEST_SESSION);

    const authService = createGuestAuthService({ sessionStorage });

    await expect(authService.restoreSession()).resolves.toBe(TEST_SESSION);
  });

  it('persists a token-free session through session storage', async () => {
    const { sessionStorage, setSession } = createMockSessionStorage();

    setSession.mockResolvedValue(undefined);

    const authService = createGuestAuthService({ sessionStorage });

    await authService.setSession(TEST_SESSION);

    expect(setSession).toHaveBeenCalledWith(TEST_SESSION);
  });

  it('clears session storage on sign out', async () => {
    const { sessionStorage, clearSession } = createMockSessionStorage();

    clearSession.mockResolvedValue(undefined);

    const authService = createGuestAuthService({ sessionStorage });

    await authService.signOut();

    expect(clearSession).toHaveBeenCalledTimes(1);
  });
});
