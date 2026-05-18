import * as Linking from 'expo-linking';

type PublicEnv = Record<string, string | undefined>;

export const SUPABASE_ENV_KEYS = [
  'EXPO_PUBLIC_SUPABASE_URL',
  'EXPO_PUBLIC_SUPABASE_ANON_KEY',
  'EXPO_PUBLIC_AUTH_REDIRECT_SCHEME',
  'EXPO_PUBLIC_AUTH_REDIRECT_PATH',
  'EXPO_PUBLIC_IOS_BUNDLE_IDENTIFIER',
  'EXPO_PUBLIC_ANDROID_PACKAGE',
] as const;

export type SupabaseEnvKey = (typeof SUPABASE_ENV_KEYS)[number];

export type SupabaseClientConfig = {
  supabaseUrl: string;
  supabaseAnonKey: string;
  authRedirectScheme: string;
  authRedirectPath: string;
  authRedirectUrl: string;
  iosBundleIdentifier: string;
  androidPackage: string;
};

export type SupabaseConfigDiagnostics = {
  hasSupabaseUrl: boolean;
  hasSupabaseAnonKey: boolean;
  hasRedirectScheme: boolean;
  hasRedirectPath: boolean;
  hasIosBundleIdentifier: boolean;
  hasAndroidPackage: boolean;
  isGoogleAuthConfigAvailable: boolean;
};

export type SupabaseConfigStatus = {
  config: SupabaseClientConfig | null;
  diagnostics: SupabaseConfigDiagnostics;
  isAvailable: boolean;
  missingKeys: SupabaseEnvKey[];
  placeholderKeys: SupabaseEnvKey[];
};

function getRuntimeEnv(): PublicEnv {
  if (typeof process === 'undefined') return {};

  return process.env;
}

function getEnvValue(env: PublicEnv, key: SupabaseEnvKey) {
  return env[key]?.trim() ?? '';
}

function isValidUrl(value: string) {
  try {
    const url = new URL(value);

    return url.protocol === 'https:' && url.hostname.length > 0;
  } catch {
    return false;
  }
}

function isPlaceholderValue(key: SupabaseEnvKey, value: string) {
  const normalizedValue = value.toLowerCase();

  if (
    normalizedValue.includes('placeholder') ||
    normalizedValue.includes('project_ref') ||
    normalizedValue.includes('your-project') ||
    normalizedValue.includes('example')
  ) {
    return true;
  }

  if (key === 'EXPO_PUBLIC_SUPABASE_URL') {
    return !isValidUrl(value);
  }

  return false;
}

function hasUsableEnvValue(env: PublicEnv, key: SupabaseEnvKey) {
  const value = getEnvValue(env, key);

  return value.length > 0 && !isPlaceholderValue(key, value);
}

export function getSupabaseConfigDiagnostics(
  env: PublicEnv = getRuntimeEnv(),
): SupabaseConfigDiagnostics {
  const hasSupabaseUrl = hasUsableEnvValue(env, 'EXPO_PUBLIC_SUPABASE_URL');
  const hasSupabaseAnonKey = hasUsableEnvValue(
    env,
    'EXPO_PUBLIC_SUPABASE_ANON_KEY',
  );
  const hasRedirectScheme = hasUsableEnvValue(
    env,
    'EXPO_PUBLIC_AUTH_REDIRECT_SCHEME',
  );
  const hasRedirectPath = hasUsableEnvValue(
    env,
    'EXPO_PUBLIC_AUTH_REDIRECT_PATH',
  );
  const hasIosBundleIdentifier = hasUsableEnvValue(
    env,
    'EXPO_PUBLIC_IOS_BUNDLE_IDENTIFIER',
  );
  const hasAndroidPackage = hasUsableEnvValue(
    env,
    'EXPO_PUBLIC_ANDROID_PACKAGE',
  );

  return {
    hasSupabaseUrl,
    hasSupabaseAnonKey,
    hasRedirectScheme,
    hasRedirectPath,
    hasIosBundleIdentifier,
    hasAndroidPackage,
    isGoogleAuthConfigAvailable:
      hasSupabaseUrl &&
      hasSupabaseAnonKey &&
      hasRedirectScheme &&
      hasRedirectPath &&
      hasIosBundleIdentifier &&
      hasAndroidPackage,
  };
}

export function getSupabaseConfigStatus(
  env: PublicEnv = getRuntimeEnv(),
): SupabaseConfigStatus {
  const diagnostics = getSupabaseConfigDiagnostics(env);

  const missingKeys = SUPABASE_ENV_KEYS.filter((key) => {
    return getEnvValue(env, key).length === 0;
  });

  const placeholderKeys = SUPABASE_ENV_KEYS.filter((key) => {
    const value = getEnvValue(env, key);

    return value.length > 0 && isPlaceholderValue(key, value);
  });

  if (missingKeys.length > 0 || placeholderKeys.length > 0) {
    return {
      config: null,
      diagnostics,
      isAvailable: false,
      missingKeys,
      placeholderKeys,
    };
  }

  const authRedirectScheme = getEnvValue(
    env,
    'EXPO_PUBLIC_AUTH_REDIRECT_SCHEME',
  );

  const authRedirectPath = getEnvValue(env, 'EXPO_PUBLIC_AUTH_REDIRECT_PATH');

  return {
    config: {
      supabaseUrl: getEnvValue(env, 'EXPO_PUBLIC_SUPABASE_URL'),
      supabaseAnonKey: getEnvValue(env, 'EXPO_PUBLIC_SUPABASE_ANON_KEY'),
      authRedirectScheme,
      authRedirectPath,
      authRedirectUrl: Linking.createURL(authRedirectPath, {
        scheme: authRedirectScheme,
      }),
      iosBundleIdentifier: getEnvValue(
        env,
        'EXPO_PUBLIC_IOS_BUNDLE_IDENTIFIER',
      ),
      androidPackage: getEnvValue(env, 'EXPO_PUBLIC_ANDROID_PACKAGE'),
    },
    diagnostics,
    isAvailable: true,
    missingKeys,
    placeholderKeys,
  };
}

export const supabaseConfigStatus = getSupabaseConfigStatus();
