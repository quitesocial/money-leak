import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import type { Session } from '@supabase/supabase-js';

import {
  APPLE_AUTH_CONFIG_ERROR_MESSAGE,
  APPLE_AUTH_ERROR_MESSAGE,
  createAppleAuthAdapter,
  getAppleAuthSafeErrorMessage,
} from '@/lib/auth/apple-auth-adapter';

const EXPECTED_RAW_NONCE =
  '000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f';

const mockGetRandomValues = jest.fn((array: Uint8Array) => {
  for (let index = 0; index < array.length; index += 1) {
    array[index] = index;
  }

  return array;
});

const mockDigestStringAsync = jest.fn(
  (_algorithm: Crypto.CryptoDigestAlgorithm, _data: string) => {
    return Promise.resolve('hashed-apple-nonce');
  },
);

const mockIsAvailableAsync = jest.fn<() => Promise<boolean>>();

const mockSignInAsync =
  jest.fn<
    (
      _options?: AppleAuthentication.AppleAuthenticationSignInOptions,
    ) => Promise<AppleAuthentication.AppleAuthenticationCredential>
  >();

const mockSignInWithIdToken =
  jest.fn<
    (_credentials: {
      provider: 'apple';
      token: string;
      nonce: string;
    }) => Promise<{ data: { session: Session | null }; error: Error | null }>
  >();

const TEST_SUPABASE_APPLE_SESSION = {
  access_token: 'sample-access-credential',
  refresh_token: 'sample-refresh-credential',
  provider_token: 'sample-provider-credential',
  provider_refresh_token: 'sample-provider-refresh-credential',
  expires_at: 1760003600,
  expires_in: 3600,
  token_type: 'bearer',
  user: {
    id: 'supabase-apple-user-id',
    email: 'relay@privaterelay.appleid.com',
    app_metadata: {
      provider: 'apple',
      providers: ['apple'],
    },
    aud: 'authenticated',
    created_at: '2026-01-01T00:00:00.000Z',
    user_metadata: {},
  },
} as unknown as Session;

const TEST_APPLE_CREDENTIAL: AppleAuthentication.AppleAuthenticationCredential =
  {
    authorizationCode: 'apple-authorization-code',
    email: 'relay@privaterelay.appleid.com',
    fullName: {
      familyName: 'Appleseed',
      givenName: 'Ada',
      middleName: null,
      namePrefix: null,
      nameSuffix: null,
      nickname: null,
    },
    identityToken: 'apple-identity-token',
    realUserStatus:
      AppleAuthentication.AppleAuthenticationUserDetectionStatus.LIKELY_REAL,
    state: null,
    user: 'apple-user-id',
  };

function createMockClient() {
  return {
    auth: {
      signInWithIdToken: mockSignInWithIdToken,
    },
  };
}

function createAdapter() {
  return createAppleAuthAdapter({
    client: createMockClient() as never,
    digestStringAsync: mockDigestStringAsync as never,
    getRandomValues: mockGetRandomValues as never,
    isAvailableAsync: mockIsAvailableAsync,
    isEnabled: true,
    now: () => 1760000000000,
    platformOS: 'ios',
    signInAsync: mockSignInAsync,
  });
}

beforeEach(() => {
  jest.clearAllMocks();

  mockIsAvailableAsync.mockResolvedValue(true);
  mockSignInAsync.mockResolvedValue(TEST_APPLE_CREDENTIAL);
  mockSignInWithIdToken.mockResolvedValue({
    data: {
      session: TEST_SUPABASE_APPLE_SESSION,
    },
    error: null,
  });
});

describe('Apple auth adapter', () => {
  it('maps a successful native Apple credential into a token-free auth session', async () => {
    const adapter = createAdapter();

    const session = await adapter.signIn();

    expect(mockDigestStringAsync).toHaveBeenCalledWith(
      Crypto.CryptoDigestAlgorithm.SHA256,
      EXPECTED_RAW_NONCE,
    );

    expect(mockSignInAsync).toHaveBeenCalledWith({
      nonce: 'hashed-apple-nonce',
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      ],
    });

    expect(mockSignInWithIdToken).toHaveBeenCalledWith({
      provider: 'apple',
      token: 'apple-identity-token',
      nonce: EXPECTED_RAW_NONCE,
    });

    expect(session).toEqual({
      provider: 'apple',
      createdAt: 1760000000000,
      expiresAt: 1760003600000,
      user: {
        id: 'supabase-apple-user-id',
        provider: 'apple',
        email: 'relay@privaterelay.appleid.com',
        displayName: 'Ada Appleseed',
        photoUrl: null,
      },
    });

    expect(JSON.stringify(session)).not.toContain('sample-access-credential');
    expect(JSON.stringify(session)).not.toContain('sample-refresh-credential');
    expect(JSON.stringify(session)).not.toContain('sample-provider-credential');
    expect(JSON.stringify(session)).not.toContain('apple-identity-token');
  });

  it('returns null for a cancelled Apple native auth sheet', async () => {
    mockSignInAsync.mockRejectedValueOnce({
      code: 'ERR_REQUEST_CANCELED',
      message: 'user cancelled',
    });

    await expect(createAdapter().signIn()).resolves.toBeNull();
    expect(mockSignInWithIdToken).not.toHaveBeenCalled();
  });

  it('throws a safe config error when native Apple auth is unavailable', async () => {
    mockIsAvailableAsync.mockResolvedValueOnce(false);

    const adapter = createAdapter();

    await expect(adapter.signIn()).rejects.toThrow(
      APPLE_AUTH_CONFIG_ERROR_MESSAGE,
    );

    await adapter.signIn().catch((error: unknown) => {
      expect(getAppleAuthSafeErrorMessage(error)).toBe(
        APPLE_AUTH_CONFIG_ERROR_MESSAGE,
      );
    });
  });

  it('throws a safe error when Apple does not return an identity token', async () => {
    mockSignInAsync.mockResolvedValueOnce({
      ...TEST_APPLE_CREDENTIAL,
      identityToken: null,
    });

    await createAdapter()
      .signIn()
      .catch((error: unknown) => {
        expect(getAppleAuthSafeErrorMessage(error)).toBe(
          APPLE_AUTH_ERROR_MESSAGE,
        );
        expect(String(error)).not.toContain('identityToken');
        expect(String(error)).not.toContain('apple-identity-token');
      });

    expect(mockSignInWithIdToken).not.toHaveBeenCalled();
  });

  it('uses a safe generic error for provider and Supabase failures', async () => {
    mockSignInAsync.mockRejectedValueOnce(
      new Error('raw provider failure apple-identity-token'),
    );

    await createAdapter()
      .signIn()
      .catch((error: unknown) => {
        expect(getAppleAuthSafeErrorMessage(error)).toBe(
          APPLE_AUTH_ERROR_MESSAGE,
        );
        expect(String(error)).not.toContain('apple-identity-token');
      });

    mockSignInWithIdToken.mockResolvedValueOnce({
      data: { session: null },
      error: new Error('raw Supabase failure access_token refresh_token'),
    });

    await createAdapter()
      .signIn()
      .catch((error: unknown) => {
        expect(getAppleAuthSafeErrorMessage(error)).toBe(
          APPLE_AUTH_ERROR_MESSAGE,
        );
        expect(String(error)).not.toContain('access_token');
        expect(String(error)).not.toContain('refresh_token');
      });
  });

  it('accepts null Apple name and email without unsafe fallback values', async () => {
    mockSignInAsync.mockResolvedValueOnce({
      ...TEST_APPLE_CREDENTIAL,
      email: null,
      fullName: null,
    });

    mockSignInWithIdToken.mockResolvedValueOnce({
      data: {
        session: {
          ...TEST_SUPABASE_APPLE_SESSION,
          user: {
            ...TEST_SUPABASE_APPLE_SESSION.user,
            email: undefined,
            user_metadata: {},
          },
        } as unknown as Session,
      },
      error: null,
    });

    await expect(createAdapter().signIn()).resolves.toMatchObject({
      provider: 'apple',
      user: {
        provider: 'apple',
        email: null,
        displayName: null,
      },
    });
  });
});
