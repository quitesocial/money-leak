const LANGUAGE_STORAGE_KEY = 'money-leak:settings-language';
const CURRENCY_STORAGE_KEY = 'money-leak:settings-currency';
const FOREGROUND_SYNC_ENABLED_STORAGE_KEY =
  'money-leak:foreground-auto-sync-enabled';

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

function isSettingsLanguage(value: string): value is SettingsLanguage {
  return SETTINGS_LANGUAGE_OPTIONS.some((option) => option === value);
}

function isSettingsCurrency(value: string): value is SettingsCurrency {
  return SETTINGS_CURRENCY_OPTIONS.some((option) => option === value);
}

export function getCurrencyOptionLabel(currency: SettingsCurrency) {
  return `${currency} (${SETTINGS_CURRENCY_CODES[currency]})`;
}

async function getAsyncStorage() {
  const module = await import('@react-native-async-storage/async-storage');

  return module.default;
}

export async function getSettingsLanguage(): Promise<SettingsLanguage> {
  const AsyncStorage = await getAsyncStorage();
  const value = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);

  return value && isSettingsLanguage(value) ? value : DEFAULT_SETTINGS_LANGUAGE;
}

export async function setSettingsLanguage(
  language: SettingsLanguage,
): Promise<void> {
  const AsyncStorage = await getAsyncStorage();

  await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, language);
}

export async function getSettingsCurrency(): Promise<SettingsCurrency> {
  const AsyncStorage = await getAsyncStorage();
  const value = await AsyncStorage.getItem(CURRENCY_STORAGE_KEY);

  return value && isSettingsCurrency(value) ? value : DEFAULT_SETTINGS_CURRENCY;
}

export async function setSettingsCurrency(
  currency: SettingsCurrency,
): Promise<void> {
  const AsyncStorage = await getAsyncStorage();

  await AsyncStorage.setItem(CURRENCY_STORAGE_KEY, currency);
}

export async function getForegroundSyncEnabled(): Promise<boolean> {
  const AsyncStorage = await getAsyncStorage();
  const value = await AsyncStorage.getItem(FOREGROUND_SYNC_ENABLED_STORAGE_KEY);

  return value !== 'false';
}

export async function setForegroundSyncEnabled(
  enabled: boolean,
): Promise<void> {
  const AsyncStorage = await getAsyncStorage();

  await AsyncStorage.setItem(
    FOREGROUND_SYNC_ENABLED_STORAGE_KEY,
    String(enabled),
  );
}
