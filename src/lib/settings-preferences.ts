const LANGUAGE_STORAGE_KEY = 'money-leak:settings-language';
const CURRENCY_STORAGE_KEY = 'money-leak:settings-currency';
const FOREGROUND_SYNC_ENABLED_STORAGE_KEY =
  'money-leak:foreground-auto-sync-enabled';

const SETTINGS_PREFERENCE_SCHEMA_VERSION = 1;

export const SETTINGS_LANGUAGE_OPTIONS = [
  'English',
  'German',
  'French',
  'Spanish',
  'Portuguese',
  'Italian',
  'Chinese',
  'Russian',
  'Indian',
] as const;

export type SettingsLanguage = (typeof SETTINGS_LANGUAGE_OPTIONS)[number];

export const SETTINGS_CURRENCY_OPTIONS = [
  'Euro',
  'United States dollar',
  'Canadian dollar',
  'Australian dollar',
  'Russian ruble',
  'Indian rupee',
  'Chinese yuan',
  'Pound sterling',
  'Japanese yen',
] as const;

export type SettingsCurrency = (typeof SETTINGS_CURRENCY_OPTIONS)[number];

export const SETTINGS_CURRENCY_CODES = {
  Euro: 'EUR',
  'United States dollar': 'USD',
  'Canadian dollar': 'CAD',
  'Australian dollar': 'AUD',
  'Russian ruble': 'RUB',
  'Indian rupee': 'INR',
  'Chinese yuan': 'CNY',
  'Pound sterling': 'GBP',
  'Japanese yen': 'JPY',
} satisfies Record<SettingsCurrency, string>;

export const SETTINGS_CURRENCY_SYMBOLS = {
  Euro: '€',
  'United States dollar': '$',
  'Canadian dollar': 'C$',
  'Australian dollar': 'A$',
  'Russian ruble': '₽',
  'Indian rupee': '₹',
  'Chinese yuan': 'CN¥',
  'Pound sterling': '£',
  'Japanese yen': '¥',
} satisfies Record<SettingsCurrency, string>;

export const DEFAULT_SETTINGS_LANGUAGE: SettingsLanguage = 'English';
export const DEFAULT_SETTINGS_CURRENCY: SettingsCurrency = 'Euro';

export type SettingsPreferenceKey = 'currency' | 'language';

export type SettingsPreferenceValueByKey = {
  currency: SettingsCurrency;
  language: SettingsLanguage;
};

export type SettingsPreference =
  | {
      key: 'currency';
      value: SettingsCurrency;
      updatedAt: number;
      schemaVersion: typeof SETTINGS_PREFERENCE_SCHEMA_VERSION;
      sourceDeviceId: string | null;
    }
  | {
      key: 'language';
      value: SettingsLanguage;
      updatedAt: number;
      schemaVersion: typeof SETTINGS_PREFERENCE_SCHEMA_VERSION;
      sourceDeviceId: string | null;
    };

export type SettingsPreferenceSnapshot = {
  currency: Extract<SettingsPreference, { key: 'currency' }>;
  language: Extract<SettingsPreference, { key: 'language' }>;
};

export type SettingsPreferenceRemoteInput = {
  key: SettingsPreferenceKey;
  value: string;
  updatedAt: number;
  schemaVersion?: number;
  sourceDeviceId?: string | null;
};

export type ApplySettingsPreferencesResult = {
  ignoredSettingsCount: number;
  restoredSettingsCount: number;
};

type StoredSettingsPreferenceEnvelope = {
  schemaVersion?: unknown;
  sourceDeviceId?: unknown;
  updatedAt?: unknown;
  value?: unknown;
};

function isSettingsLanguage(value: unknown): value is SettingsLanguage {
  return (
    typeof value === 'string' &&
    SETTINGS_LANGUAGE_OPTIONS.some((option) => option === value)
  );
}

function isSettingsCurrency(value: unknown): value is SettingsCurrency {
  return (
    typeof value === 'string' &&
    SETTINGS_CURRENCY_OPTIONS.some((option) => option === value)
  );
}

export function isSettingsPreferenceKey(
  value: unknown,
): value is SettingsPreferenceKey {
  return value === 'currency' || value === 'language';
}

export function isSettingsPreferenceValue(
  key: 'currency',
  value: unknown,
): value is SettingsCurrency;
export function isSettingsPreferenceValue(
  key: 'language',
  value: unknown,
): value is SettingsLanguage;
export function isSettingsPreferenceValue(
  key: SettingsPreferenceKey,
  value: unknown,
): value is SettingsCurrency | SettingsLanguage;
export function isSettingsPreferenceValue(
  key: SettingsPreferenceKey,
  value: unknown,
) {
  return key === 'currency'
    ? isSettingsCurrency(value)
    : isSettingsLanguage(value);
}

export function getCurrencyOptionLabel(currency: SettingsCurrency) {
  return `${currency} (${SETTINGS_CURRENCY_CODES[currency]})`;
}

function getAsyncStorage() {
  /* eslint-disable @typescript-eslint/no-require-imports */
  const module =
    require('@react-native-async-storage/async-storage') as typeof import('@react-native-async-storage/async-storage');
  /* eslint-enable @typescript-eslint/no-require-imports */

  return module.default;
}

export async function getSettingsLanguage(): Promise<SettingsLanguage> {
  const preference = await readSettingsPreference({
    defaultValue: DEFAULT_SETTINGS_LANGUAGE,
    key: 'language',
    storageKey: LANGUAGE_STORAGE_KEY,
  });

  return preference.value;
}

export async function setSettingsLanguage(
  language: SettingsLanguage,
): Promise<void> {
  await writeSettingsPreference({
    key: 'language',
    storageKey: LANGUAGE_STORAGE_KEY,
    value: language,
    updatedAt: Date.now(),
  });
}

export async function getSettingsCurrency(): Promise<SettingsCurrency> {
  const preference = await readSettingsPreference({
    defaultValue: DEFAULT_SETTINGS_CURRENCY,
    key: 'currency',
    storageKey: CURRENCY_STORAGE_KEY,
  });

  return preference.value;
}

export async function setSettingsCurrency(
  currency: SettingsCurrency,
): Promise<void> {
  await writeSettingsPreference({
    key: 'currency',
    storageKey: CURRENCY_STORAGE_KEY,
    value: currency,
    updatedAt: Date.now(),
  });
}

export async function getSettingsPreferenceSnapshot(): Promise<SettingsPreferenceSnapshot> {
  const [currency, language] = await Promise.all([
    readSettingsPreference({
      defaultValue: DEFAULT_SETTINGS_CURRENCY,
      key: 'currency',
      storageKey: CURRENCY_STORAGE_KEY,
    }),
    readSettingsPreference({
      defaultValue: DEFAULT_SETTINGS_LANGUAGE,
      key: 'language',
      storageKey: LANGUAGE_STORAGE_KEY,
    }),
  ]);

  return {
    currency,
    language,
  };
}

export async function applyRemoteSettingsPreferences(
  preferences: SettingsPreferenceRemoteInput[],
): Promise<ApplySettingsPreferencesResult> {
  let ignoredSettingsCount = 0;
  let restoredSettingsCount = 0;

  for (const preference of preferences) {
    const { key, updatedAt, value } = preference;

    if (!isSettingsPreferenceKey(key) || !Number.isFinite(updatedAt)) {
      ignoredSettingsCount += 1;

      continue;
    }

    if (key === 'currency') {
      if (!isSettingsPreferenceValue('currency', value)) {
        ignoredSettingsCount += 1;

        continue;
      }

      const didApply = await applyRemoteSettingsPreference({
        key,
        sourceDeviceId: preference.sourceDeviceId ?? null,
        updatedAt,
        value,
      });

      if (didApply) restoredSettingsCount += 1;

      continue;
    }

    if (!isSettingsPreferenceValue('language', value)) {
      ignoredSettingsCount += 1;

      continue;
    }

    const didApply = await applyRemoteSettingsPreference({
      key,
      sourceDeviceId: preference.sourceDeviceId ?? null,
      updatedAt,
      value,
    });

    if (didApply) restoredSettingsCount += 1;
  }

  return {
    ignoredSettingsCount,
    restoredSettingsCount,
  };
}

export async function getForegroundSyncEnabled(): Promise<boolean> {
  const AsyncStorage = getAsyncStorage();
  const value = await AsyncStorage.getItem(FOREGROUND_SYNC_ENABLED_STORAGE_KEY);

  return value !== 'false';
}

export async function setForegroundSyncEnabled(
  enabled: boolean,
): Promise<void> {
  const AsyncStorage = getAsyncStorage();

  await AsyncStorage.setItem(
    FOREGROUND_SYNC_ENABLED_STORAGE_KEY,
    String(enabled),
  );
}

function getSettingsPreferenceStorageKey(key: SettingsPreferenceKey) {
  return key === 'currency' ? CURRENCY_STORAGE_KEY : LANGUAGE_STORAGE_KEY;
}

async function readSettingsPreference<Key extends SettingsPreferenceKey>({
  defaultValue,
  key,
  storageKey,
}: {
  defaultValue: SettingsPreferenceValueByKey[Key];
  key: Key;
  storageKey: string;
}): Promise<Extract<SettingsPreference, { key: Key }>> {
  const AsyncStorage = getAsyncStorage();
  const storedValue = await AsyncStorage.getItem(storageKey);
  const fallback = createSettingsPreference({
    key,
    updatedAt: 0,
    value: defaultValue,
  });

  if (!storedValue) return fallback;

  if (isSettingsPreferenceValue(key, storedValue)) {
    return createSettingsPreference({
      key,
      updatedAt: 0,
      value: storedValue as SettingsPreferenceValueByKey[Key],
    });
  }

  const parsedValue = parseStoredPreferenceEnvelope(storedValue);

  if (!parsedValue || !isSettingsPreferenceValue(key, parsedValue.value)) {
    return fallback;
  }

  return createSettingsPreference({
    key,
    sourceDeviceId: parseSourceDeviceId(parsedValue.sourceDeviceId),
    updatedAt: parseUpdatedAt(parsedValue.updatedAt),
    value: parsedValue.value as SettingsPreferenceValueByKey[Key],
  });
}

async function writeSettingsPreference<Key extends SettingsPreferenceKey>({
  key,
  sourceDeviceId = null,
  storageKey,
  updatedAt,
  value,
}: {
  key: Key;
  sourceDeviceId?: string | null;
  storageKey: string;
  updatedAt: number;
  value: SettingsPreferenceValueByKey[Key];
}) {
  const AsyncStorage = getAsyncStorage();

  await AsyncStorage.setItem(
    storageKey,
    JSON.stringify(
      createSettingsPreference({
        key,
        sourceDeviceId,
        updatedAt,
        value,
      }),
    ),
  );
}

async function applyRemoteSettingsPreference<
  Key extends SettingsPreferenceKey,
>({
  key,
  sourceDeviceId,
  updatedAt,
  value,
}: {
  key: Key;
  sourceDeviceId: string | null;
  updatedAt: number;
  value: SettingsPreferenceValueByKey[Key];
}) {
  const defaultValue = (
    key === 'currency' ? DEFAULT_SETTINGS_CURRENCY : DEFAULT_SETTINGS_LANGUAGE
  ) as SettingsPreferenceValueByKey[Key];

  const currentPreference = await readSettingsPreference({
    defaultValue,
    key,
    storageKey: getSettingsPreferenceStorageKey(key),
  });

  if (
    currentPreference.value === value &&
    currentPreference.updatedAt === updatedAt
  ) {
    return false;
  }

  await writeSettingsPreference({
    key,
    storageKey: getSettingsPreferenceStorageKey(key),
    value,
    updatedAt,
    sourceDeviceId,
  });

  return true;
}

function createSettingsPreference<Key extends SettingsPreferenceKey>({
  key,
  sourceDeviceId = null,
  updatedAt,
  value,
}: {
  key: Key;
  sourceDeviceId?: string | null;
  updatedAt: number;
  value: SettingsPreferenceValueByKey[Key];
}): Extract<SettingsPreference, { key: Key }> {
  return {
    key,
    value,
    updatedAt,
    schemaVersion: SETTINGS_PREFERENCE_SCHEMA_VERSION,
    sourceDeviceId,
  } as Extract<SettingsPreference, { key: Key }>;
}

function parseStoredPreferenceEnvelope(
  value: string,
): StoredSettingsPreferenceEnvelope | null {
  try {
    const parsedValue = JSON.parse(value) as unknown;

    return parsedValue && typeof parsedValue === 'object' ? parsedValue : null;
  } catch {
    return null;
  }
}

function parseUpdatedAt(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function parseSourceDeviceId(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}
