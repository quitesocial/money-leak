import {
  DEFAULT_SETTINGS_LANGUAGE,
  SETTINGS_LANGUAGE_OPTIONS,
  type SettingsLanguage,
} from '@/lib/settings-preferences';

export type SupportedLanguage = SettingsLanguage;

export const DEFAULT_LANGUAGE: SupportedLanguage = DEFAULT_SETTINGS_LANGUAGE;

export const LANGUAGE_LOCALES = {
  English: 'en-GB',
  German: 'de',
  French: 'fr',
  Spanish: 'es',
  Portuguese: 'pt',
  Italian: 'it',
  Chinese: 'zh',
  Russian: 'ru',
  Indian: 'hi',
} satisfies Record<SupportedLanguage, string>;

export function isSupportedLanguage(
  value: unknown,
): value is SupportedLanguage {
  return (
    typeof value === 'string' &&
    SETTINGS_LANGUAGE_OPTIONS.some((language) => language === value)
  );
}

export function getLanguageLocale(language: SupportedLanguage) {
  return LANGUAGE_LOCALES[language] ?? LANGUAGE_LOCALES[DEFAULT_LANGUAGE];
}
