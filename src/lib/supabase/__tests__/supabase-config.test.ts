import { afterEach, describe, expect, it, jest } from '@jest/globals';

import {
  getSupabaseConfigDiagnostics,
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

const ORIGINAL_PUBLIC_ENV: Record<SupabaseEnvKey, string | undefined> = {
  EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
  EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  EXPO_PUBLIC_AUTH_REDIRECT_SCHEME:
    process.env.EXPO_PUBLIC_AUTH_REDIRECT_SCHEME,
  EXPO_PUBLIC_AUTH_REDIRECT_PATH: process.env.EXPO_PUBLIC_AUTH_REDIRECT_PATH,
  EXPO_PUBLIC_IOS_BUNDLE_IDENTIFIER:
    process.env.EXPO_PUBLIC_IOS_BUNDLE_IDENTIFIER,
  EXPO_PUBLIC_ANDROID_PACKAGE: process.env.EXPO_PUBLIC_ANDROID_PACKAGE,
};

function setRuntimePublicEnv(env: Record<SupabaseEnvKey, string>) {
  process.env.EXPO_PUBLIC_SUPABASE_URL = env.EXPO_PUBLIC_SUPABASE_URL;
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  process.env.EXPO_PUBLIC_AUTH_REDIRECT_SCHEME =
    env.EXPO_PUBLIC_AUTH_REDIRECT_SCHEME;
  process.env.EXPO_PUBLIC_AUTH_REDIRECT_PATH =
    env.EXPO_PUBLIC_AUTH_REDIRECT_PATH;
  process.env.EXPO_PUBLIC_IOS_BUNDLE_IDENTIFIER =
    env.EXPO_PUBLIC_IOS_BUNDLE_IDENTIFIER;
  process.env.EXPO_PUBLIC_ANDROID_PACKAGE = env.EXPO_PUBLIC_ANDROID_PACKAGE;
}

function restoreRuntimePublicEnv() {
  if (ORIGINAL_PUBLIC_ENV.EXPO_PUBLIC_SUPABASE_URL === undefined) {
    delete process.env.EXPO_PUBLIC_SUPABASE_URL;
  } else {
    process.env.EXPO_PUBLIC_SUPABASE_URL =
      ORIGINAL_PUBLIC_ENV.EXPO_PUBLIC_SUPABASE_URL;
  }

  if (ORIGINAL_PUBLIC_ENV.EXPO_PUBLIC_SUPABASE_ANON_KEY === undefined) {
    delete process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  } else {
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY =
      ORIGINAL_PUBLIC_ENV.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  }

  if (ORIGINAL_PUBLIC_ENV.EXPO_PUBLIC_AUTH_REDIRECT_SCHEME === undefined) {
    delete process.env.EXPO_PUBLIC_AUTH_REDIRECT_SCHEME;
  } else {
    process.env.EXPO_PUBLIC_AUTH_REDIRECT_SCHEME =
      ORIGINAL_PUBLIC_ENV.EXPO_PUBLIC_AUTH_REDIRECT_SCHEME;
  }

  if (ORIGINAL_PUBLIC_ENV.EXPO_PUBLIC_AUTH_REDIRECT_PATH === undefined) {
    delete process.env.EXPO_PUBLIC_AUTH_REDIRECT_PATH;
  } else {
    process.env.EXPO_PUBLIC_AUTH_REDIRECT_PATH =
      ORIGINAL_PUBLIC_ENV.EXPO_PUBLIC_AUTH_REDIRECT_PATH;
  }

  if (ORIGINAL_PUBLIC_ENV.EXPO_PUBLIC_IOS_BUNDLE_IDENTIFIER === undefined) {
    delete process.env.EXPO_PUBLIC_IOS_BUNDLE_IDENTIFIER;
  } else {
    process.env.EXPO_PUBLIC_IOS_BUNDLE_IDENTIFIER =
      ORIGINAL_PUBLIC_ENV.EXPO_PUBLIC_IOS_BUNDLE_IDENTIFIER;
  }

  if (ORIGINAL_PUBLIC_ENV.EXPO_PUBLIC_ANDROID_PACKAGE === undefined) {
    delete process.env.EXPO_PUBLIC_ANDROID_PACKAGE;
  } else {
    process.env.EXPO_PUBLIC_ANDROID_PACKAGE =
      ORIGINAL_PUBLIC_ENV.EXPO_PUBLIC_ANDROID_PACKAGE;
  }
}

afterEach(() => {
  mockCreateURL.mockClear();
  restoreRuntimePublicEnv();
});

describe('Supabase config status', () => {
  it('returns available config when all public env values are real', () => {
    const status = getSupabaseConfigStatus(VALID_ENV);

    expect(status.isAvailable).toBe(true);
    expect(status.diagnostics).toEqual({
      hasSupabaseUrl: true,
      hasSupabaseAnonKey: true,
      hasRedirectScheme: true,
      hasRedirectPath: true,
      hasIosBundleIdentifier: true,
      hasAndroidPackage: true,
      isGoogleAuthConfigAvailable: true,
    });
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

  it('reads default runtime env values through static Expo public properties', () => {
    setRuntimePublicEnv(VALID_ENV);

    const status = getSupabaseConfigStatus();

    expect(status.isAvailable).toBe(true);
    expect(status.diagnostics.isGoogleAuthConfigAvailable).toBe(true);
    expect(status.config).toMatchObject({
      supabaseUrl: VALID_ENV.EXPO_PUBLIC_SUPABASE_URL,
      supabaseAnonKey: VALID_ENV.EXPO_PUBLIC_SUPABASE_ANON_KEY,
      authRedirectUrl: 'moneyleak://auth/callback',
    });
  });

  it('marks config unavailable when required values are missing', () => {
    const status = getSupabaseConfigStatus({
      ...VALID_ENV,
      EXPO_PUBLIC_SUPABASE_ANON_KEY: '',
      EXPO_PUBLIC_ANDROID_PACKAGE: '',
    });

    expect(status.isAvailable).toBe(false);
    expect(status.diagnostics).toMatchObject({
      hasSupabaseUrl: true,
      hasSupabaseAnonKey: false,
      hasRedirectScheme: true,
      hasRedirectPath: true,
      hasIosBundleIdentifier: true,
      hasAndroidPackage: false,
      isGoogleAuthConfigAvailable: false,
    });
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
    expect(status.diagnostics).toMatchObject({
      hasSupabaseUrl: false,
      hasSupabaseAnonKey: false,
      hasRedirectScheme: true,
      hasRedirectPath: true,
      hasIosBundleIdentifier: false,
      hasAndroidPackage: true,
      isGoogleAuthConfigAvailable: false,
    });
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
    expect(status.diagnostics.hasSupabaseUrl).toBe(false);
    expect(status.diagnostics.isGoogleAuthConfigAvailable).toBe(false);
    expect(status.config).toBeNull();
    expect(status.placeholderKeys).toEqual(['EXPO_PUBLIC_SUPABASE_URL']);
  });

  it('returns boolean-only diagnostics without requiring config creation', () => {
    const diagnostics = getSupabaseConfigDiagnostics({
      ...VALID_ENV,
      EXPO_PUBLIC_AUTH_REDIRECT_SCHEME: '',
    });

    expect(diagnostics).toEqual({
      hasSupabaseUrl: true,
      hasSupabaseAnonKey: true,
      hasRedirectScheme: false,
      hasRedirectPath: true,
      hasIosBundleIdentifier: true,
      hasAndroidPackage: true,
      isGoogleAuthConfigAvailable: false,
    });
    expect(
      Object.values(diagnostics).every((value) => {
        return typeof value === 'boolean';
      }),
    ).toBe(true);
  });
});
