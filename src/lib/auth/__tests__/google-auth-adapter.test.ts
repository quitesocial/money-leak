import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Session } from '@supabase/supabase-js';

import {
  GOOGLE_AUTH_CONFIG_ERROR_MESSAGE,
  GOOGLE_AUTH_ERROR_MESSAGE,
  createGoogleAuthAdapter,
  getGoogleAuthSafeErrorMessage,
} from '@/lib/auth/google-auth-adapter';
import type { SupabaseClientConfig } from '@/lib/supabase/supabase-config';

const mockOpenAuthSessionAsync =
  jest.fn<
    (
      url: string,
      redirectUrl?: string | null,
    ) => Promise<{ type: 'success'; url: string } | { type: 'cancel' }>
  >();

const mockSignInWithOAuth =
  jest.fn<
    () => Promise<{ data: { url: string | null }; error: Error | null }>
  >();

const mockExchangeCodeForSession =
  jest.fn<
    () => Promise<{ data: { session: Session | null }; error: Error | null }>
  >();

const TEST_CONFIG: SupabaseClientConfig = {
  supabaseUrl: 'https://project-ref.supabase.co',
  supabaseAnonKey: 'ey-public-anon-key',
  authRedirectScheme: 'moneyleak',
  authRedirectPath: 'auth/callback',
  authRedirectUrl: 'moneyleak://auth/callback',
  iosBundleIdentifier: 'com.quitesocialorg.moneyleak',
  androidPackage: 'com.quitesocialorg.moneyleak',
};

const TEST_SUPABASE_SESSION = {
  access_token: 'raw-access-token',
  refresh_token: 'raw-refresh-token',
  expires_at: 1760003600,
  expires_in: 3600,
  token_type: 'bearer',
  user: {
    id: 'supabase-user-id',
    email: 'test@example.com',
    app_metadata: {},
    aud: 'authenticated',
    created_at: '2026-01-01T00:00:00.000Z',
    user_metadata: {
      avatar_url: 'https://example.com/avatar.png',
      full_name: 'Test User',
    },
  },
} as unknown as Session;

function createMockClient() {
  return {
    auth: {
      signInWithOAuth: mockSignInWithOAuth,
      exchangeCodeForSession: mockExchangeCodeForSession,
    },
  };
}

beforeEach(() => {
  jest.clearAllMocks();

  mockSignInWithOAuth.mockResolvedValue({
    data: {
      url: 'https://project-ref.supabase.co/auth/v1/authorize',
    },
    error: null,
  });

  mockOpenAuthSessionAsync.mockResolvedValue({
    type: 'success',
    url: 'moneyleak://auth/callback?code=auth-code',
  });

  mockExchangeCodeForSession.mockResolvedValue({
    data: {
      session: TEST_SUPABASE_SESSION,
    },
    error: null,
  });
});

describe('Google auth adapter', () => {
  it('maps a successful Supabase OAuth result into a token-free auth session', async () => {
    const adapter = createGoogleAuthAdapter({
      client: createMockClient() as never,
      config: TEST_CONFIG,
      isEnabled: true,
      now: () => 1760000000000,
      openAuthSessionAsync: mockOpenAuthSessionAsync as never,
    });

    const session = await adapter.signIn();

    expect(mockSignInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: {
        redirectTo: TEST_CONFIG.authRedirectUrl,
        skipBrowserRedirect: true,
      },
    });

    expect(mockOpenAuthSessionAsync).toHaveBeenCalledWith(
      'https://project-ref.supabase.co/auth/v1/authorize',
      TEST_CONFIG.authRedirectUrl,
    );

    expect(mockExchangeCodeForSession).toHaveBeenCalledWith('auth-code');

    expect(session).toEqual({
      provider: 'google',
      createdAt: 1760000000000,
      expiresAt: 1760003600000,
      user: {
        id: 'supabase-user-id',
        provider: 'google',
        email: 'test@example.com',
        displayName: 'Test User',
        photoUrl: 'https://example.com/avatar.png',
      },
    });

    expect(JSON.stringify(session)).not.toContain('raw-access-token');
    expect(JSON.stringify(session)).not.toContain('raw-refresh-token');
  });

  it('returns null for a cancelled Google auth browser session', async () => {
    mockOpenAuthSessionAsync.mockResolvedValueOnce({ type: 'cancel' });

    const adapter = createGoogleAuthAdapter({
      client: createMockClient() as never,
      config: TEST_CONFIG,
      isEnabled: true,
      openAuthSessionAsync: mockOpenAuthSessionAsync as never,
    });

    await expect(adapter.signIn()).resolves.toBeNull();
    expect(mockExchangeCodeForSession).not.toHaveBeenCalled();
  });

  it('throws a safe config error when Google auth is disabled', async () => {
    const adapter = createGoogleAuthAdapter({
      client: createMockClient() as never,
      config: TEST_CONFIG,
      isEnabled: false,
      openAuthSessionAsync: mockOpenAuthSessionAsync as never,
    });

    await expect(adapter.signIn()).rejects.toThrow(
      GOOGLE_AUTH_CONFIG_ERROR_MESSAGE,
    );

    await adapter.signIn().catch((error: unknown) => {
      expect(getGoogleAuthSafeErrorMessage(error)).toBe(
        GOOGLE_AUTH_CONFIG_ERROR_MESSAGE,
      );
    });
  });

  it('uses a safe generic error for provider and network failures', async () => {
    mockSignInWithOAuth.mockResolvedValueOnce({
      data: { url: null },
      error: new Error('raw provider token failure'),
    });

    const providerAdapter = createGoogleAuthAdapter({
      client: createMockClient() as never,
      config: TEST_CONFIG,
      isEnabled: true,
      openAuthSessionAsync: mockOpenAuthSessionAsync as never,
    });

    await providerAdapter.signIn().catch((error: unknown) => {
      expect(getGoogleAuthSafeErrorMessage(error)).toBe(
        GOOGLE_AUTH_ERROR_MESSAGE,
      );
      expect(String(error)).not.toContain('token');
    });

    mockOpenAuthSessionAsync.mockRejectedValueOnce(
      new Error('raw network secret'),
    );

    const networkAdapter = createGoogleAuthAdapter({
      client: createMockClient() as never,
      config: TEST_CONFIG,
      isEnabled: true,
      openAuthSessionAsync: mockOpenAuthSessionAsync as never,
    });

    await networkAdapter.signIn().catch((error: unknown) => {
      expect(getGoogleAuthSafeErrorMessage(error)).toBe(
        GOOGLE_AUTH_ERROR_MESSAGE,
      );
      expect(String(error)).not.toContain('secret');
    });
  });
});
