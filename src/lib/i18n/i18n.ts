import {
  getLanguageLocale,
  type SupportedLanguage,
} from '@/lib/i18n/languages';
import {
  englishTranslations,
  translations,
  type TranslationKey,
} from '@/lib/i18n/translations';
import { DEFAULT_BALANCE_TYPES } from '@/types/balance';
import { DEFAULT_CATEGORIES } from '@/types/category';
import type { LeakReason } from '@/types/transaction';

type TranslationParams = Record<string, string | number>;

export function t(
  language: SupportedLanguage,
  key: TranslationKey,
  params?: TranslationParams,
) {
  const template =
    translations[language]?.[key] ?? englishTranslations[key] ?? key;

  if (!params) return template;

  return template.replace(/\{(\w+)}/g, (match, paramKey) => {
    const value = params[paramKey];

    return value === undefined ? match : String(value);
  });
}

export function formatLanguageDate(
  language: SupportedLanguage,
  date: Date,
  options: Intl.DateTimeFormatOptions,
) {
  return new Intl.DateTimeFormat(getLanguageLocale(language), options).format(
    date,
  );
}

export function getShortWeekdayLabels(language: SupportedLanguage) {
  const formatter = new Intl.DateTimeFormat(getLanguageLocale(language), {
    weekday: 'short',
  });
  const sunday = new Date(Date.UTC(2024, 0, 7));

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(sunday);
    date.setUTCDate(sunday.getUTCDate() + index);

    return formatter
      .format(date)
      .toLocaleUpperCase(getLanguageLocale(language));
  });
}

export function getMonthLabels(language: SupportedLanguage) {
  const formatter = new Intl.DateTimeFormat(getLanguageLocale(language), {
    month: 'long',
  });

  return Array.from({ length: 12 }, (_, index) =>
    formatter.format(new Date(2024, index, 1)),
  );
}

export function getLeakReasonLabel(
  language: SupportedLanguage,
  reason: LeakReason,
) {
  return t(language, `leakReason.${reason}` as TranslationKey);
}

export function getDefaultCategoryName(
  language: SupportedLanguage,
  categoryId: string,
) {
  const isDefault = DEFAULT_CATEGORIES.some(
    (category) => category.id === categoryId,
  );

  return isDefault
    ? t(language, `category.${categoryId}` as TranslationKey)
    : null;
}

export function getDefaultBalanceTypeName(
  language: SupportedLanguage,
  typeId: string,
) {
  const isDefault = DEFAULT_BALANCE_TYPES.some(
    (balanceType) => balanceType.id === typeId,
  );

  return isDefault
    ? t(language, `balanceType.${typeId}` as TranslationKey)
    : null;
}
