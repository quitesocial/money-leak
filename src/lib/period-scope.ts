import type { Transaction } from '@/types/transaction';
import { getReferenceDate, getValidDate } from '@/lib/date-utils';

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

const customDateFormatter = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
});

function getStartOfDay(referenceDate: Date) {
  const startOfDay = new Date(referenceDate);

  startOfDay.setHours(0, 0, 0, 0);

  return startOfDay;
}

function addDays(referenceDate: Date, days: number) {
  const nextDate = new Date(referenceDate);

  nextDate.setDate(nextDate.getDate() + days);
  nextDate.setHours(0, 0, 0, 0);

  return nextDate;
}

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
) {
  switch (period) {
    case 'yesterday':
      return 'Yesterday';
    case 'today':
      return 'Today';
    case 'this_week':
      return 'This week';
    case 'custom_date': {
      const customDateStartTime = getLocalDayStartTimestamp(
        selectedCustomDateStart,
      );

      if (customDateStartTime === null) return 'Choose date';

      return `Choose date: ${customDateFormatter.format(
        new Date(customDateStartTime),
      )}`;
    }
  }
}

export function filterTransactionsByPeriod({
  transactions,
  period,
  selectedCustomDateStart,
  now,
}: FilterTransactionsByPeriodParams) {
  const periodRange = getPeriodRange({
    period,
    selectedCustomDateStart,
    now,
  });

  if (!periodRange) return [];

  const periodStartTime = periodRange.start.getTime();
  const periodEndTime = periodRange.end.getTime();

  return transactions.filter((transaction) => {
    const transactionDate = getValidDate(transaction.createdAt);

    if (!transactionDate) return false;

    const transactionTime = transactionDate.getTime();

    return (
      transactionTime >= periodStartTime && transactionTime < periodEndTime
    );
  });
}
