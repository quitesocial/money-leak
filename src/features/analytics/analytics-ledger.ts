import { getReferenceDate, getValidDate } from '@/lib/date-utils';
import type { BalanceEntry } from '@/types/balance';
import type { LeakReason, Transaction } from '@/types/transaction';

export type AnalyticsPeriod = 'today' | 'week' | 'month' | 'custom';

export type AnalyticsCustomPeriodType =
  | 'day'
  | 'month'
  | 'year'
  | 'custom_dates';

export type AnalyticsFilterOperation = 'all' | 'added' | 'spent';

export type AnalyticsSpentKind = 'normal' | 'leak';

export type AnalyticsFilterState = {
  balanceTypeId: string | null;
  categoryId: string | null;
  leakReason: LeakReason | null;
  operation: AnalyticsFilterOperation;
  transactionKind: AnalyticsSpentKind | null;
};

export type AnalyticsLedgerItem =
  | {
      createdAt: number;
      entry: BalanceEntry;
      id: string;
      kind: 'balance';
    }
  | {
      createdAt: number;
      id: string;
      kind: 'transaction';
      transaction: Transaction;
    };

export type AnalyticsLedgerGroup = {
  dateKey: string;
  items: AnalyticsLedgerItem[];
  label: string;
};

type AnalyticsPeriodRangeParams = {
  customDate: number;
  customPeriodType: AnalyticsCustomPeriodType | null;
  customRangeEnd: number;
  customRangeStart: number;
  now?: number | Date;
  period: AnalyticsPeriod;
};

type BuildAnalyticsLedgerItemsParams = AnalyticsPeriodRangeParams & {
  balanceEntries: BalanceEntry[];
  filter: AnalyticsFilterState;
  transactions: Transaction[];
};

const fullDateFormatter = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

const shortDateFormatter = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

const monthFormatter = new Intl.DateTimeFormat('en-GB', {
  month: 'short',
  year: 'numeric',
});

const timeFormatter = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit',
  hour12: false,
  minute: '2-digit',
});

export const ANALYTICS_PERIOD_OPTIONS: AnalyticsPeriod[] = [
  'today',
  'week',
  'month',
  'custom',
];

export const ANALYTICS_CUSTOM_PERIOD_TYPE_OPTIONS: AnalyticsCustomPeriodType[] =
  ['day', 'month', 'year', 'custom_dates'];

export function createDefaultAnalyticsFilter(): AnalyticsFilterState {
  return {
    balanceTypeId: null,
    categoryId: null,
    leakReason: null,
    operation: 'all',
    transactionKind: null,
  };
}

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

function getStartOfMondayWeek(referenceDate: Date) {
  const startOfWeek = getStartOfDay(referenceDate);
  const weekday = startOfWeek.getDay();
  const daysSinceMonday = weekday === 0 ? 6 : weekday - 1;

  startOfWeek.setDate(startOfWeek.getDate() - daysSinceMonday);

  return startOfWeek;
}

function getStartOfMonth(referenceDate: Date) {
  return new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1);
}

function getStartOfYear(referenceDate: Date) {
  return new Date(referenceDate.getFullYear(), 0, 1);
}

function addMonths(referenceDate: Date, months: number) {
  return new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth() + months,
    1,
  );
}

function addYears(referenceDate: Date, years: number) {
  return new Date(referenceDate.getFullYear() + years, 0, 1);
}

function getValidOrReferenceDate(value: number, referenceDate: Date) {
  return getValidDate(value) ?? referenceDate;
}

export function getAnalyticsLocalDayTimestamp(
  value: Date | number | null | undefined,
) {
  const date = getValidDate(value);

  if (!date) return null;

  return getStartOfDay(date).getTime();
}

export function getAnalyticsPeriodRange({
  customDate,
  customPeriodType,
  customRangeEnd,
  customRangeStart,
  now,
  period,
}: AnalyticsPeriodRangeParams) {
  const referenceDate = getReferenceDate(now);

  if (period === 'today') {
    const start = getStartOfDay(referenceDate);

    return {
      end: addDays(start, 1),
      start,
    };
  }

  if (period === 'week') {
    const start = getStartOfMondayWeek(referenceDate);

    return {
      end: addDays(start, 7),
      start,
    };
  }

  if (period === 'month') {
    const start = getStartOfMonth(referenceDate);

    return {
      end: addMonths(start, 1),
      start,
    };
  }

  if (customPeriodType === null) return null;

  if (customPeriodType === 'day') {
    const start = getStartOfDay(
      getValidOrReferenceDate(customDate, referenceDate),
    );

    return {
      end: addDays(start, 1),
      start,
    };
  }

  if (customPeriodType === 'month') {
    const start = getStartOfMonth(
      getValidOrReferenceDate(customDate, referenceDate),
    );

    return {
      end: addMonths(start, 1),
      start,
    };
  }

  if (customPeriodType === 'year') {
    const start = getStartOfYear(
      getValidOrReferenceDate(customDate, referenceDate),
    );

    return {
      end: addYears(start, 1),
      start,
    };
  }

  const firstRangeDate = getStartOfDay(
    getValidOrReferenceDate(customRangeStart, referenceDate),
  );
  const secondRangeDate = getStartOfDay(
    getValidOrReferenceDate(customRangeEnd, referenceDate),
  );
  const start =
    firstRangeDate.getTime() <= secondRangeDate.getTime()
      ? firstRangeDate
      : secondRangeDate;
  const endDate =
    firstRangeDate.getTime() <= secondRangeDate.getTime()
      ? secondRangeDate
      : firstRangeDate;

  return {
    end: addDays(endDate, 1),
    start,
  };
}

export function isAnalyticsFilterActive(filter: AnalyticsFilterState) {
  return filter.operation !== 'all';
}

export function normalizeAnalyticsFilter(
  filter: AnalyticsFilterState,
): AnalyticsFilterState {
  if (filter.operation === 'all') return createDefaultAnalyticsFilter();

  if (filter.operation === 'added') {
    return {
      ...createDefaultAnalyticsFilter(),
      balanceTypeId: filter.balanceTypeId,
      operation: 'added',
    };
  }

  return {
    ...createDefaultAnalyticsFilter(),
    categoryId: filter.categoryId,
    leakReason: filter.leakReason,
    operation: 'spent',
    transactionKind: filter.leakReason ? 'leak' : filter.transactionKind,
  };
}

function isItemInRange(createdAt: number, startTime: number, endTime: number) {
  const date = getValidDate(createdAt);

  if (!date) return false;

  const itemTime = date.getTime();

  return itemTime >= startTime && itemTime < endTime;
}

function doesTransactionMatchSpentFilter({
  filter,
  transaction,
}: {
  filter: AnalyticsFilterState;
  transaction: Transaction;
}) {
  if (filter.transactionKind === 'normal' && transaction.isLeak) return false;
  if (filter.transactionKind === 'leak' && !transaction.isLeak) return false;

  if (filter.categoryId && transaction.category !== filter.categoryId) {
    return false;
  }

  if (filter.leakReason && transaction.leakReason !== filter.leakReason) {
    return false;
  }

  return true;
}

export function buildAnalyticsLedgerItems({
  balanceEntries,
  customDate,
  customPeriodType,
  customRangeEnd,
  customRangeStart,
  filter,
  now,
  period,
  transactions,
}: BuildAnalyticsLedgerItemsParams): AnalyticsLedgerItem[] {
  const normalizedFilter = normalizeAnalyticsFilter(filter);
  const periodRange = getAnalyticsPeriodRange({
    customDate,
    customPeriodType,
    customRangeEnd,
    customRangeStart,
    now,
    period,
  });

  if (!periodRange) return [];

  const periodStartTime = periodRange.start.getTime();
  const periodEndTime = periodRange.end.getTime();
  const items: AnalyticsLedgerItem[] = [];

  if (normalizedFilter.operation !== 'spent') {
    for (const entry of balanceEntries) {
      if (entry.deletedAt !== null) continue;

      if (
        normalizedFilter.operation === 'added' &&
        normalizedFilter.balanceTypeId &&
        entry.typeId !== normalizedFilter.balanceTypeId
      ) {
        continue;
      }

      if (!isItemInRange(entry.createdAt, periodStartTime, periodEndTime)) {
        continue;
      }

      items.push({
        createdAt: entry.createdAt,
        entry,
        id: `balance:${entry.id}`,
        kind: 'balance',
      });
    }
  }

  if (normalizedFilter.operation !== 'added') {
    for (const transaction of transactions) {
      if (transaction.deletedAt !== null) continue;

      if (
        normalizedFilter.operation === 'spent' &&
        !doesTransactionMatchSpentFilter({
          filter: normalizedFilter,
          transaction,
        })
      ) {
        continue;
      }

      if (
        !isItemInRange(transaction.createdAt, periodStartTime, periodEndTime)
      ) {
        continue;
      }

      items.push({
        createdAt: transaction.createdAt,
        id: `transaction:${transaction.id}`,
        kind: 'transaction',
        transaction,
      });
    }
  }

  return items.sort((firstItem, secondItem) => {
    const createdAtDiff = secondItem.createdAt - firstItem.createdAt;

    if (createdAtDiff !== 0) return createdAtDiff;

    return secondItem.id.localeCompare(firstItem.id);
  });
}

function getLocalDateKey(date: Date) {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');

  return `${year}-${month}-${day}`;
}

export function formatAnalyticsDateLabel(createdAt: number) {
  const date = getValidDate(createdAt);

  if (!date) return 'Unknown date';

  return fullDateFormatter.format(date);
}

export function groupAnalyticsLedgerItems(
  items: AnalyticsLedgerItem[],
): AnalyticsLedgerGroup[] {
  const groups = new Map<string, AnalyticsLedgerGroup>();

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
      label: formatAnalyticsDateLabel(item.createdAt),
    });
  }

  return [...groups.values()];
}

function sanitizeAnalyticsAmount(value: number) {
  return Number.isFinite(value) ? Math.abs(value) : 0;
}

export function formatAnalyticsAmount({
  amount,
  sign,
}: {
  amount: number;
  sign: '+' | '-';
}) {
  const [integerPart, decimalPart] = sanitizeAnalyticsAmount(amount)
    .toFixed(2)
    .split('.');
  const spacedIntegerPart = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

  return `${sign}${spacedIntegerPart}.${decimalPart} €`;
}

export function formatAnalyticsTime(createdAt: number) {
  const date = getValidDate(createdAt);

  if (!date) return 'Unknown time';

  return timeFormatter.format(date);
}

export function formatAnalyticsCustomDateLabel({
  customDate,
  customPeriodType,
  customRangeEnd,
  customRangeStart,
}: Omit<AnalyticsPeriodRangeParams, 'now' | 'period'>) {
  const referenceDate = new Date();

  if (customPeriodType === 'day') {
    return shortDateFormatter.format(
      getValidOrReferenceDate(customDate, referenceDate),
    );
  }

  if (customPeriodType === 'month') {
    return monthFormatter.format(
      getValidOrReferenceDate(customDate, referenceDate),
    );
  }

  if (customPeriodType === 'year') {
    return getValidOrReferenceDate(customDate, referenceDate)
      .getFullYear()
      .toString();
  }

  const firstRangeDate = getStartOfDay(
    getValidOrReferenceDate(customRangeStart, referenceDate),
  );
  const secondRangeDate = getStartOfDay(
    getValidOrReferenceDate(customRangeEnd, referenceDate),
  );
  const start =
    firstRangeDate.getTime() <= secondRangeDate.getTime()
      ? firstRangeDate
      : secondRangeDate;
  const end =
    firstRangeDate.getTime() <= secondRangeDate.getTime()
      ? secondRangeDate
      : firstRangeDate;

  return `${shortDateFormatter.format(start)} - ${shortDateFormatter.format(
    end,
  )}`;
}
