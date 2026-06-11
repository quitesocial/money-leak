import { describe, expect, it } from '@jest/globals';

import { t } from '@/lib/i18n/i18n';
import {
  DEFAULT_LANGUAGE,
  isSupportedLanguage,
  LANGUAGE_LOCALES,
} from '@/lib/i18n/languages';
import {
  englishTranslations,
  translations,
  type TranslationKey,
} from '@/lib/i18n/translations';
import { SETTINGS_LANGUAGE_OPTIONS } from '@/lib/settings-preferences';

describe('i18n', () => {
  it('defaults to English as the safe fallback language', () => {
    expect(DEFAULT_LANGUAGE).toBe('English');
    expect(t(DEFAULT_LANGUAGE, 'tabs.home')).toBe('Home');
  });

  it('keeps every selectable language backed by a locale and full dictionary', () => {
    const requiredKeys = Object.keys(englishTranslations) as TranslationKey[];

    expect(Object.keys(translations).sort()).toEqual(
      [...SETTINGS_LANGUAGE_OPTIONS].sort(),
    );
    expect(Object.keys(LANGUAGE_LOCALES).sort()).toEqual(
      [...SETTINGS_LANGUAGE_OPTIONS].sort(),
    );

    for (const language of SETTINGS_LANGUAGE_OPTIONS) {
      expect(Object.keys(translations[language]).sort()).toEqual(
        [...requiredKeys].sort(),
      );
    }
  });

  it('rejects missing or invalid language preference values safely', () => {
    expect(isSupportedLanguage('Russian')).toBe(true);
    expect(isSupportedLanguage('Klingon')).toBe(false);
    expect(isSupportedLanguage(null)).toBe(false);
  });

  it('preserves the Indian setting while mapping it to Hindi UI copy', () => {
    expect(LANGUAGE_LOCALES.Indian).toBe('hi');
    expect(t('Indian', 'common.add')).toBe('जोड़ें');
  });

  it('does not fall back to English for core non-English runtime surfaces', () => {
    const coreKeys: TranslationKey[] = [
      'tabs.analyticsTitle',
      'tabs.settings',
      'home.todaySummary',
      'home.history',
      'analytics.filterTitle',
      'settings.title',
      'settings.language',
      'transaction.addTitle',
      'balance.addTitle',
      'onboarding.firstRun',
      'category.food',
      'balanceType.salary',
    ];

    for (const language of SETTINGS_LANGUAGE_OPTIONS) {
      if (language === 'English') continue;

      for (const key of coreKeys) {
        expect(translations[language][key]).not.toBe(englishTranslations[key]);
      }
    }
  });
});
