import type { Transaction } from '@/types/transaction';
import {
  addDays,
  getReferenceDate,
  getStartOfDay,
  getValidDate,
} from '@/lib/date-utils';
import { formatLanguageDate, t } from '@/lib/i18n/i18n';
import type { SupportedLanguage } from '@/lib/i18n/languages';

export type PeriodScope = 'yesterday' | 'today' | 'this_week' | 'custom_date';

export const PERIOD_SCOPE_OPTIONS: PeriodScope[] = [
  'yesterday',
  'today',
  'this_week',
  'custom_date',
];

type FilterTransactionsByPeriodParams = {
  transactions: Transaction[];
  period: PeriodScope;
  selectedCustomDateStart?: number | null;
  now?: number | Date;
};

type FilterItemsByPeriodParams<T extends { createdAt: number }> = {
  items: T[];
  period: PeriodScope;
  selectedCustomDateStart?: number | null;
  now?: number | Date;
};

export function getLocalDayStartTimestamp(
  value: number | Date | null | undefined,
) {
  const date = getValidDate(value);

  if (!date) return null;

  return getStartOfDay(date).getTime();
}

function getStartOfMondayWeek(referenceDate: Date) {
  const startOfWeek = getStartOfDay(referenceDate);

  const weekday = startOfWeek.getDay();
  const daysSinceMonday = weekday === 0 ? 6 : weekday - 1;

  startOfWeek.setDate(startOfWeek.getDate() - daysSinceMonday);

  return startOfWeek;
}

function getPeriodRange({
  period,
  selectedCustomDateStart,
  now,
}: Omit<FilterTransactionsByPeriodParams, 'transactions'>) {
  const referenceDate = getReferenceDate(now);

  if (period === 'yesterday') {
    const startOfToday = getStartOfDay(referenceDate);

    return {
      start: addDays(startOfToday, -1),
      end: startOfToday,
    };
  }

  if (period === 'today') {
    const startOfToday = getStartOfDay(referenceDate);

    return {
      start: startOfToday,
      end: addDays(startOfToday, 1),
    };
  }

  if (period === 'this_week') {
    const startOfWeek = getStartOfMondayWeek(referenceDate);

    return {
      start: startOfWeek,
      end: addDays(startOfWeek, 7),
    };
  }

  const customDateStartTime = getLocalDayStartTimestamp(
    selectedCustomDateStart,
  );

  if (customDateStartTime === null) return null;

  const customDateStart = new Date(customDateStartTime);

  return {
    start: customDateStart,
    end: addDays(customDateStart, 1),
  };
}

export function getPeriodLabel(
  period: PeriodScope,
  selectedCustomDateStart?: number | null,
  language?: SupportedLanguage,
) {
  switch (period) {
    case 'yesterday':
      return language ? t(language, 'period.yesterday') : 'Yesterday';
    case 'today':
      return language ? t(language, 'period.today') : 'Today';
    case 'this_week':
      return language ? t(language, 'period.thisWeek') : 'This week';
    case 'custom_date': {
      const customDateStartTime = getLocalDayStartTimestamp(
        selectedCustomDateStart,
      );

      if (customDateStartTime === null) {
        return language ? t(language, 'common.chooseDate') : 'Choose date';
      }

      const date = new Date(customDateStartTime);
      const formattedDate = language
        ? formatLanguageDate(language, date, { month: 'short', day: 'numeric' })
        : new Intl.DateTimeFormat(undefined, {
            month: 'short',
            day: 'numeric',
          }).format(date);

      return language
        ? t(language, 'period.customDate', { date: formattedDate })
        : `Choose date: ${formattedDate}`;
    }
  }
}

export function filterItemsByPeriod<T extends { createdAt: number }>({
  items,
  period,
  selectedCustomDateStart,
  now,
}: FilterItemsByPeriodParams<T>) {
  const periodRange = getPeriodRange({
    period,
    selectedCustomDateStart,
    now,
  });

  if (!periodRange) return [];

  const periodStartTime = periodRange.start.getTime();
  const periodEndTime = periodRange.end.getTime();

  return items.filter((item) => {
    const itemDate = getValidDate(item.createdAt);

    if (!itemDate) return false;

    const itemTime = itemDate.getTime();

    return itemTime >= periodStartTime && itemTime < periodEndTime;
  });
}

export function filterTransactionsByPeriod({
  transactions,
  period,
  selectedCustomDateStart,
  now,
}: FilterTransactionsByPeriodParams) {
  return filterItemsByPeriod({
    items: transactions,
    period,
    selectedCustomDateStart,
    now,
  });
}
