import { describe, expect, it, jest } from '@jest/globals';

import {
  getSupabaseConfigStatus,
  type SupabaseEnvKey,
} from '@/lib/supabase/supabase-config';

const mockCreateURL = jest.fn(
  (path: string, { scheme }: { scheme?: string } = {}) => {
    return `${scheme}://${path}`;
  },
);

jest.mock('expo-linking', () => ({
  createURL: (path: string, options?: { scheme?: string }) => {
    return mockCreateURL(path, options);
  },
}));

const VALID_ENV: Record<SupabaseEnvKey, string> = {
  EXPO_PUBLIC_SUPABASE_URL: 'https://project-ref.supabase.co',
  EXPO_PUBLIC_SUPABASE_ANON_KEY: 'ey-public-anon-key',
  EXPO_PUBLIC_AUTH_REDIRECT_SCHEME: 'moneyleak',
  EXPO_PUBLIC_AUTH_REDIRECT_PATH: 'auth/callback',
  EXPO_PUBLIC_IOS_BUNDLE_IDENTIFIER: 'com.quitesocialorg.moneyleak',
  EXPO_PUBLIC_ANDROID_PACKAGE: 'com.quitesocialorg.moneyleak',
};

describe('Supabase config status', () => {
  it('returns available config when all public env values are real', () => {
    const status = getSupabaseConfigStatus(VALID_ENV);

    expect(status.isAvailable).toBe(true);
    expect(status.config).toMatchObject({
      supabaseUrl: VALID_ENV.EXPO_PUBLIC_SUPABASE_URL,
      supabaseAnonKey: VALID_ENV.EXPO_PUBLIC_SUPABASE_ANON_KEY,
      authRedirectScheme: 'moneyleak',
      authRedirectPath: 'auth/callback',
      authRedirectUrl: 'moneyleak://auth/callback',
      iosBundleIdentifier: 'com.quitesocialorg.moneyleak',
      androidPackage: 'com.quitesocialorg.moneyleak',
    });
    expect(status.missingKeys).toEqual([]);
    expect(status.placeholderKeys).toEqual([]);
  });

  it('marks config unavailable when required values are missing', () => {
    const status = getSupabaseConfigStatus({
      ...VALID_ENV,
      EXPO_PUBLIC_SUPABASE_ANON_KEY: '',
      EXPO_PUBLIC_ANDROID_PACKAGE: '',
    });

    expect(status.isAvailable).toBe(false);
    expect(status.config).toBeNull();
    expect(status.missingKeys).toEqual([
      'EXPO_PUBLIC_SUPABASE_ANON_KEY',
      'EXPO_PUBLIC_ANDROID_PACKAGE',
    ]);
  });

  it('marks config unavailable for placeholder values', () => {
    const status = getSupabaseConfigStatus({
      ...VALID_ENV,
      EXPO_PUBLIC_SUPABASE_URL: 'https://PROJECT_REF.supabase.co',
      EXPO_PUBLIC_SUPABASE_ANON_KEY: 'PUBLIC_ANON_KEY_PLACEHOLDER',
      EXPO_PUBLIC_IOS_BUNDLE_IDENTIFIER: 'com.example.moneyleak',
    });

    expect(status.isAvailable).toBe(false);
    expect(status.config).toBeNull();
    expect(status.placeholderKeys).toEqual([
      'EXPO_PUBLIC_SUPABASE_URL',
      'EXPO_PUBLIC_SUPABASE_ANON_KEY',
      'EXPO_PUBLIC_IOS_BUNDLE_IDENTIFIER',
    ]);
  });

  it('marks an invalid Supabase URL unavailable', () => {
    const status = getSupabaseConfigStatus({
      ...VALID_ENV,
      EXPO_PUBLIC_SUPABASE_URL: 'not-a-url',
    });

    expect(status.isAvailable).toBe(false);
    expect(status.config).toBeNull();
    expect(status.placeholderKeys).toEqual(['EXPO_PUBLIC_SUPABASE_URL']);
  });
});
