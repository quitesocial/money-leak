import { getStartOfDay, getValidDate } from '@/lib/date-utils';
import { formatLanguageDate, t } from '@/lib/i18n/i18n';
import type { SupportedLanguage } from '@/lib/i18n/languages';

export type HomeHistoryItemBase = {
  createdAt: number;
  id: string;
};

export type HomeHistorySection<T extends HomeHistoryItemBase> = {
  dateKey: string;
  items: T[];
  label: string;
};

function getLocalDateKey(date: Date) {
  const startOfDay = getStartOfDay(date);
  const year = startOfDay.getFullYear();
  const month = (startOfDay.getMonth() + 1).toString().padStart(2, '0');
  const day = startOfDay.getDate().toString().padStart(2, '0');

  return `${year}-${month}-${day}`;
}

export function formatHomeHistoryDateLabel(
  createdAt: number,
  language: SupportedLanguage,
) {
  const date = getValidDate(createdAt);

  if (!date) return t(language, 'home.unknownDate');

  return formatLanguageDate(language, date, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function groupHomeHistoryItems<T extends HomeHistoryItemBase>(
  items: T[],
  language: SupportedLanguage,
): HomeHistorySection<T>[] {
  const groups = new Map<string, HomeHistorySection<T>>();

  for (const item of items) {
    const date = getValidDate(item.createdAt);

    if (!date) continue;

    const dateKey = getLocalDateKey(date);
    const existingGroup = groups.get(dateKey);

    if (existingGroup) {
      existingGroup.items.push(item);

      continue;
    }

    groups.set(dateKey, {
      dateKey,
      items: [item],
      label: formatHomeHistoryDateLabel(item.createdAt, language),
    });
  }

  return [...groups.values()];
}
