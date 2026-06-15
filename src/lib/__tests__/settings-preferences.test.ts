import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import {
  applyRemoteSettingsPreferences,
  getSettingsCurrency,
  getSettingsLanguage,
  getSettingsPreferenceSnapshot,
  setSettingsCurrency,
  setSettingsLanguage,
} from '@/lib/settings-preferences';

const mockStore = new Map<string, string>();

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async (key: string) => mockStore.get(key) ?? null),
    setItem: jest.fn(async (key: string, value: string) => {
      mockStore.set(key, value);
    }),
  },
}));

const CURRENCY_STORAGE_KEY = 'money-leak:settings-currency';
const LANGUAGE_STORAGE_KEY = 'money-leak:settings-language';

describe('settings preferences', () => {
  beforeEach(() => {
    jest.useRealTimers();
    mockStore.clear();
  });

  it('keeps backwards compatibility with plain stored values', async () => {
    mockStore.set(CURRENCY_STORAGE_KEY, 'Japanese yen');
    mockStore.set(LANGUAGE_STORAGE_KEY, 'Spanish');

    await expect(getSettingsCurrency()).resolves.toBe('Japanese yen');
    await expect(getSettingsLanguage()).resolves.toBe('Spanish');

    await expect(getSettingsPreferenceSnapshot()).resolves.toMatchObject({
      currency: {
        key: 'currency',
        value: 'Japanese yen',
        updatedAt: 0,
      },
      language: {
        key: 'language',
        value: 'Spanish',
        updatedAt: 0,
      },
    });
  });

  it('stores metadata envelopes with updatedAt when settings change', async () => {
    jest.useFakeTimers({ now: Date.parse('2026-06-15T10:00:00.000Z') });

    await setSettingsCurrency('United States dollar');
    await setSettingsLanguage('German');

    expect(JSON.parse(mockStore.get(CURRENCY_STORAGE_KEY) ?? '{}')).toEqual({
      key: 'currency',
      value: 'United States dollar',
      updatedAt: Date.parse('2026-06-15T10:00:00.000Z'),
      schemaVersion: 1,
      sourceDeviceId: null,
    });
    expect(JSON.parse(mockStore.get(LANGUAGE_STORAGE_KEY) ?? '{}')).toEqual({
      key: 'language',
      value: 'German',
      updatedAt: Date.parse('2026-06-15T10:00:00.000Z'),
      schemaVersion: 1,
      sourceDeviceId: null,
    });
  });

  it('applies valid remote settings and safely ignores invalid values', async () => {
    const result = await applyRemoteSettingsPreferences([
      {
        key: 'currency',
        value: 'Pound sterling',
        updatedAt: Date.parse('2026-06-14T09:00:00.000Z'),
      },
      {
        key: 'language',
        value: 'Not a language',
        updatedAt: Date.parse('2026-06-14T09:05:00.000Z'),
      },
    ]);

    expect(result).toEqual({
      restoredSettingsCount: 1,
      ignoredSettingsCount: 1,
    });
    await expect(getSettingsCurrency()).resolves.toBe('Pound sterling');
    await expect(getSettingsLanguage()).resolves.toBe('English');
  });
});
