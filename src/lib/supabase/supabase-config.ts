import * as Linking from 'expo-linking';

export const SUPABASE_ENV_KEYS = [
  'EXPO_PUBLIC_SUPABASE_URL',
  'EXPO_PUBLIC_SUPABASE_ANON_KEY',
  'EXPO_PUBLIC_AUTH_REDIRECT_SCHEME',
  'EXPO_PUBLIC_AUTH_REDIRECT_PATH',
  'EXPO_PUBLIC_IOS_BUNDLE_IDENTIFIER',
  'EXPO_PUBLIC_ANDROID_PACKAGE',
] as const;

export type SupabaseEnvKey = (typeof SUPABASE_ENV_KEYS)[number];

type PublicEnv = Partial<Record<SupabaseEnvKey, string | undefined>>;

type NormalizedPublicEnv = {
  supabaseUrl: string;
  supabaseAnonKey: string;
  authRedirectScheme: string;
  authRedirectPath: string;
  iosBundleIdentifier: string;
  androidPackage: string;
};

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

  return {
    EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
    EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    EXPO_PUBLIC_AUTH_REDIRECT_SCHEME:
      process.env.EXPO_PUBLIC_AUTH_REDIRECT_SCHEME,
    EXPO_PUBLIC_AUTH_REDIRECT_PATH: process.env.EXPO_PUBLIC_AUTH_REDIRECT_PATH,
    EXPO_PUBLIC_IOS_BUNDLE_IDENTIFIER:
      process.env.EXPO_PUBLIC_IOS_BUNDLE_IDENTIFIER,
    EXPO_PUBLIC_ANDROID_PACKAGE: process.env.EXPO_PUBLIC_ANDROID_PACKAGE,
  };
}

function normalizeEnvValue(value: string | undefined) {
  return value?.trim() ?? '';
}

function normalizePublicEnv(env: PublicEnv): NormalizedPublicEnv {
  return {
    supabaseUrl: normalizeEnvValue(env.EXPO_PUBLIC_SUPABASE_URL),
    supabaseAnonKey: normalizeEnvValue(env.EXPO_PUBLIC_SUPABASE_ANON_KEY),
    authRedirectScheme: normalizeEnvValue(env.EXPO_PUBLIC_AUTH_REDIRECT_SCHEME),
    authRedirectPath: normalizeEnvValue(env.EXPO_PUBLIC_AUTH_REDIRECT_PATH),
    iosBundleIdentifier: normalizeEnvValue(
      env.EXPO_PUBLIC_IOS_BUNDLE_IDENTIFIER,
    ),
    androidPackage: normalizeEnvValue(env.EXPO_PUBLIC_ANDROID_PACKAGE),
  };
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

function hasUsableEnvValue(key: SupabaseEnvKey, value: string) {
  return value.length > 0 && !isPlaceholderValue(key, value);
}

function getSupabaseConfigDiagnosticsFromValues(
  values: NormalizedPublicEnv,
): SupabaseConfigDiagnostics {
  const hasSupabaseUrl = hasUsableEnvValue(
    'EXPO_PUBLIC_SUPABASE_URL',
    values.supabaseUrl,
  );
  const hasSupabaseAnonKey = hasUsableEnvValue(
    'EXPO_PUBLIC_SUPABASE_ANON_KEY',
    values.supabaseAnonKey,
  );
  const hasRedirectScheme = hasUsableEnvValue(
    'EXPO_PUBLIC_AUTH_REDIRECT_SCHEME',
    values.authRedirectScheme,
  );
  const hasRedirectPath = hasUsableEnvValue(
    'EXPO_PUBLIC_AUTH_REDIRECT_PATH',
    values.authRedirectPath,
  );
  const hasIosBundleIdentifier = hasUsableEnvValue(
    'EXPO_PUBLIC_IOS_BUNDLE_IDENTIFIER',
    values.iosBundleIdentifier,
  );
  const hasAndroidPackage = hasUsableEnvValue(
    'EXPO_PUBLIC_ANDROID_PACKAGE',
    values.androidPackage,
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

export function getSupabaseConfigDiagnostics(
  env: PublicEnv = getRuntimeEnv(),
): SupabaseConfigDiagnostics {
  return getSupabaseConfigDiagnosticsFromValues(normalizePublicEnv(env));
}

function getMissingKeys(values: NormalizedPublicEnv) {
  const missingKeys: SupabaseEnvKey[] = [];

  if (values.supabaseUrl.length === 0) {
    missingKeys.push('EXPO_PUBLIC_SUPABASE_URL');
  }

  if (values.supabaseAnonKey.length === 0) {
    missingKeys.push('EXPO_PUBLIC_SUPABASE_ANON_KEY');
  }

  if (values.authRedirectScheme.length === 0) {
    missingKeys.push('EXPO_PUBLIC_AUTH_REDIRECT_SCHEME');
  }

  if (values.authRedirectPath.length === 0) {
    missingKeys.push('EXPO_PUBLIC_AUTH_REDIRECT_PATH');
  }

  if (values.iosBundleIdentifier.length === 0) {
    missingKeys.push('EXPO_PUBLIC_IOS_BUNDLE_IDENTIFIER');
  }

  if (values.androidPackage.length === 0) {
    missingKeys.push('EXPO_PUBLIC_ANDROID_PACKAGE');
  }

  return missingKeys;
}

function getPlaceholderKeys(values: NormalizedPublicEnv) {
  const placeholderKeys: SupabaseEnvKey[] = [];

  if (
    values.supabaseUrl.length > 0 &&
    isPlaceholderValue('EXPO_PUBLIC_SUPABASE_URL', values.supabaseUrl)
  ) {
    placeholderKeys.push('EXPO_PUBLIC_SUPABASE_URL');
  }

  if (
    values.supabaseAnonKey.length > 0 &&
    isPlaceholderValue('EXPO_PUBLIC_SUPABASE_ANON_KEY', values.supabaseAnonKey)
  ) {
    placeholderKeys.push('EXPO_PUBLIC_SUPABASE_ANON_KEY');
  }

  if (
    values.authRedirectScheme.length > 0 &&
    isPlaceholderValue(
      'EXPO_PUBLIC_AUTH_REDIRECT_SCHEME',
      values.authRedirectScheme,
    )
  ) {
    placeholderKeys.push('EXPO_PUBLIC_AUTH_REDIRECT_SCHEME');
  }

  if (
    values.authRedirectPath.length > 0 &&
    isPlaceholderValue(
      'EXPO_PUBLIC_AUTH_REDIRECT_PATH',
      values.authRedirectPath,
    )
  ) {
    placeholderKeys.push('EXPO_PUBLIC_AUTH_REDIRECT_PATH');
  }

  if (
    values.iosBundleIdentifier.length > 0 &&
    isPlaceholderValue(
      'EXPO_PUBLIC_IOS_BUNDLE_IDENTIFIER',
      values.iosBundleIdentifier,
    )
  ) {
    placeholderKeys.push('EXPO_PUBLIC_IOS_BUNDLE_IDENTIFIER');
  }

  if (
    values.androidPackage.length > 0 &&
    isPlaceholderValue('EXPO_PUBLIC_ANDROID_PACKAGE', values.androidPackage)
  ) {
    placeholderKeys.push('EXPO_PUBLIC_ANDROID_PACKAGE');
  }

  return placeholderKeys;
}

export function getSupabaseConfigStatus(
  env: PublicEnv = getRuntimeEnv(),
): SupabaseConfigStatus {
  const values = normalizePublicEnv(env);
  const diagnostics = getSupabaseConfigDiagnosticsFromValues(values);
  const missingKeys = getMissingKeys(values);
  const placeholderKeys = getPlaceholderKeys(values);

  if (missingKeys.length > 0 || placeholderKeys.length > 0) {
    return {
      config: null,
      diagnostics,
      isAvailable: false,
      missingKeys,
      placeholderKeys,
    };
  }

  return {
    config: {
      supabaseUrl: values.supabaseUrl,
      supabaseAnonKey: values.supabaseAnonKey,
      authRedirectScheme: values.authRedirectScheme,
      authRedirectPath: values.authRedirectPath,
      authRedirectUrl: Linking.createURL(values.authRedirectPath, {
        scheme: values.authRedirectScheme,
      }),
      iosBundleIdentifier: values.iosBundleIdentifier,
      androidPackage: values.androidPackage,
    },
    diagnostics,
    isAvailable: true,
    missingKeys,
    placeholderKeys,
  };
}

export const supabaseConfigStatus = getSupabaseConfigStatus();
