import * as WebBrowser from 'expo-web-browser';

import type { AuthProviderAdapter } from '@/lib/auth/auth-service';
import { mapSupabaseSessionToAuthSession } from '@/lib/auth/supabase-auth-session';
import { getSupabaseClient } from '@/lib/supabase/supabase-client';
import {
  supabaseConfigStatus,
  type SupabaseClientConfig,
} from '@/lib/supabase/supabase-config';

export const GOOGLE_AUTH_CONFIG_ERROR_MESSAGE =
  'Google login is not configured for this build.';

export const GOOGLE_AUTH_ERROR_MESSAGE =
  "Couldn't continue with Google. Try again.";

type GoogleAuthErrorKind = 'config' | 'provider' | 'network' | 'session';

export class GoogleAuthError extends Error {
  kind: GoogleAuthErrorKind;

  constructor(kind: GoogleAuthErrorKind, message = GOOGLE_AUTH_ERROR_MESSAGE) {
    super(message);
    this.kind = kind;
    this.name = 'GoogleAuthError';
  }
}

type GoogleAuthSupabaseClient = NonNullable<
  ReturnType<typeof getSupabaseClient>
>;

type OpenAuthSessionAsync = typeof WebBrowser.openAuthSessionAsync;

type GoogleAuthAdapterOptions = {
  client?: GoogleAuthSupabaseClient | null;
  config?: SupabaseClientConfig | null;
  isEnabled?: boolean;
  now?: () => number;
  openAuthSessionAsync?: OpenAuthSessionAsync;
};

export function getGoogleAuthSafeErrorMessage(error: unknown) {
  if (error instanceof GoogleAuthError && error.kind === 'config') {
    return GOOGLE_AUTH_CONFIG_ERROR_MESSAGE;
  }

  return GOOGLE_AUTH_ERROR_MESSAGE;
}

function getAuthCodeFromRedirectUrl(url: string) {
  try {
    const redirectUrl = new URL(url);
    const providerError =
      redirectUrl.searchParams.get('error_description') ??
      redirectUrl.searchParams.get('error_code') ??
      redirectUrl.searchParams.get('error');

    if (providerError) {
      throw new GoogleAuthError('provider');
    }

    return redirectUrl.searchParams.get('code');
  } catch (error) {
    if (error instanceof GoogleAuthError) throw error;

    throw new GoogleAuthError('session');
  }
}

export function createGoogleAuthAdapter({
  client = getSupabaseClient(),
  config = supabaseConfigStatus.config,
  isEnabled = supabaseConfigStatus.isAvailable,
  now = Date.now,
  openAuthSessionAsync = WebBrowser.openAuthSessionAsync,
}: GoogleAuthAdapterOptions = {}): AuthProviderAdapter {
  return {
    provider: 'google',
    isEnabled,

    async signIn() {
      if (!isEnabled || !config || !client) {
        throw new GoogleAuthError('config', GOOGLE_AUTH_CONFIG_ERROR_MESSAGE);
      }

      const { data, error } = await client.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: config.authRedirectUrl,
          skipBrowserRedirect: true,
        },
      });

      if (error || !data.url) {
        throw new GoogleAuthError('provider');
      }

      let authSessionResult: Awaited<ReturnType<OpenAuthSessionAsync>>;

      try {
        authSessionResult = await openAuthSessionAsync(
          data.url,
          config.authRedirectUrl,
        );
      } catch {
        throw new GoogleAuthError('network');
      }

      if (
        authSessionResult.type === 'cancel' ||
        authSessionResult.type === 'dismiss'
      ) {
        return null;
      }

      if (authSessionResult.type !== 'success') {
        throw new GoogleAuthError('provider');
      }

      const code = getAuthCodeFromRedirectUrl(authSessionResult.url);

      if (!code) {
        throw new GoogleAuthError('session');
      }

      const { data: sessionData, error: exchangeError } =
        await client.auth.exchangeCodeForSession(code);

      if (exchangeError || !sessionData.session) {
        throw new GoogleAuthError('session');
      }

      return mapSupabaseSessionToAuthSession({
        now,
        session: sessionData.session,
      });
    },
  };
}

export const googleAuthAdapter = createGoogleAuthAdapter();
