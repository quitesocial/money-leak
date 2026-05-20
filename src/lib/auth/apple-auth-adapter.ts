import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';

import type { AuthProviderAdapter } from '@/lib/auth/auth-service';
import { mapSupabaseSessionToAuthSession } from '@/lib/auth/supabase-auth-session';
import { getSupabaseClient } from '@/lib/supabase/supabase-client';
import { supabaseConfigStatus } from '@/lib/supabase/supabase-config';

export const APPLE_AUTH_CONFIG_ERROR_MESSAGE =
  'Apple login is not available for this build.';

export const APPLE_AUTH_ERROR_MESSAGE =
  "Couldn't continue with Apple. Try again.";

type AppleAuthErrorKind = 'config' | 'provider' | 'session';

export class AppleAuthError extends Error {
  kind: AppleAuthErrorKind;

  constructor(kind: AppleAuthErrorKind, message = APPLE_AUTH_ERROR_MESSAGE) {
    super(message);
    this.kind = kind;
    this.name = 'AppleAuthError';
  }
}

type AppleAuthSupabaseClient = NonNullable<
  ReturnType<typeof getSupabaseClient>
>;

type AppleSignInAsync = typeof AppleAuthentication.signInAsync;
type AppleIsAvailableAsync = typeof AppleAuthentication.isAvailableAsync;
type DigestStringAsync = typeof Crypto.digestStringAsync;
type GetRandomValues = typeof Crypto.getRandomValues;

type AppleAuthAdapterOptions = {
  client?: AppleAuthSupabaseClient | null;
  digestStringAsync?: DigestStringAsync;
  getRandomValues?: GetRandomValues;
  isAvailableAsync?: AppleIsAvailableAsync;
  isEnabled?: boolean;
  now?: () => number;
  platformOS?: typeof Platform.OS;
  signInAsync?: AppleSignInAsync;
};

export type AppleAuthProviderAdapter = AuthProviderAdapter & {
  isAvailable: () => Promise<boolean>;
};

export function getAppleAuthSafeErrorMessage(error: unknown) {
  if (error instanceof AppleAuthError && error.kind === 'config') {
    return APPLE_AUTH_CONFIG_ERROR_MESSAGE;
  }

  return APPLE_AUTH_ERROR_MESSAGE;
}

export function createAppleAuthNonce(getRandomValues: GetRandomValues) {
  const bytes = new Uint8Array(32);

  getRandomValues(bytes);

  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join(
    '',
  );
}

function getAppleFullNameDisplayName(
  fullName: AppleAuthentication.AppleAuthenticationFullName | null,
) {
  if (!fullName) return null;

  const displayName = [
    fullName.givenName,
    fullName.middleName,
    fullName.familyName,
  ]
    .filter((part): part is string => {
      return typeof part === 'string' && part.trim().length > 0;
    })
    .map((part) => part.trim())
    .join(' ');

  return displayName.length > 0 ? displayName : null;
}

function isAppleAuthCancel(error: unknown) {
  if (!error || typeof error !== 'object') return false;

  return 'code' in error && error.code === 'ERR_REQUEST_CANCELED';
}

export function createAppleAuthAdapter({
  client = getSupabaseClient(),
  digestStringAsync = Crypto.digestStringAsync,
  getRandomValues = Crypto.getRandomValues,
  isAvailableAsync = AppleAuthentication.isAvailableAsync,
  isEnabled = supabaseConfigStatus.isAvailable && Platform.OS === 'ios',
  now = Date.now,
  platformOS = Platform.OS,
  signInAsync = AppleAuthentication.signInAsync,
}: AppleAuthAdapterOptions = {}): AppleAuthProviderAdapter {
  async function isAvailable() {
    if (!isEnabled || platformOS !== 'ios') return false;

    try {
      return await isAvailableAsync();
    } catch {
      return false;
    }
  }

  return {
    provider: 'apple',
    isEnabled,
    isAvailable,

    async signIn() {
      if (!client || !(await isAvailable())) {
        throw new AppleAuthError('config', APPLE_AUTH_CONFIG_ERROR_MESSAGE);
      }

      let rawNonce: string;
      let hashedNonce: string;

      try {
        rawNonce = createAppleAuthNonce(getRandomValues);
        hashedNonce = await digestStringAsync(
          Crypto.CryptoDigestAlgorithm.SHA256,
          rawNonce,
        );
      } catch {
        throw new AppleAuthError('config', APPLE_AUTH_CONFIG_ERROR_MESSAGE);
      }

      let credential: Awaited<ReturnType<AppleSignInAsync>>;

      try {
        credential = await signInAsync({
          nonce: hashedNonce,
          requestedScopes: [
            AppleAuthentication.AppleAuthenticationScope.EMAIL,
            AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          ],
        });
      } catch (error) {
        if (isAppleAuthCancel(error)) return null;

        throw new AppleAuthError('provider');
      }

      if (!credential.identityToken) {
        throw new AppleAuthError('session');
      }

      let authResult: Awaited<ReturnType<typeof client.auth.signInWithIdToken>>;

      try {
        authResult = await client.auth.signInWithIdToken({
          provider: 'apple',
          token: credential.identityToken,
          nonce: rawNonce,
        });
      } catch {
        throw new AppleAuthError('session');
      }

      const { data, error } = authResult;

      if (error || !data.session) {
        throw new AppleAuthError('session');
      }

      return mapSupabaseSessionToAuthSession({
        displayNameOverride: getAppleFullNameDisplayName(credential.fullName),
        now,
        providerOverride: 'apple',
        session: data.session,
      });
    },
  };
}

export const appleAuthAdapter = createAppleAuthAdapter();
