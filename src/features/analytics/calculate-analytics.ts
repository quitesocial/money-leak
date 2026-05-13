import { calculateTransactionsSummary } from '@/features/home/calculate-transactions-summary';
import { compareCategoryIds } from '@/lib/category-display';
import {
  LEAK_REASONS,
  type LeakReason,
  type Transaction,
  type TransactionCategory,
} from '@/types/transaction';

const WEEKDAYS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

type Weekday = (typeof WEEKDAYS)[number];

export type LeakCategoryGroup = {
  category: TransactionCategory;
  totalLeaks: number;
  count: number;
};

export type LeakReasonGroup = {
  leakReason: LeakReason;
  totalLeaks: number;
  count: number;
};

export type LeakWeekdayGroup = {
  weekday: Weekday;
  weekdayIndex: number;
  totalLeaks: number;
  count: number;
};

export type LeakHourGroup = {
  hour: number;
  totalLeaks: number;
  count: number;
};

export type AnalyticsResult = {
  totalSpent: number;
  totalLeaks: number;
  leakPercentage: number;
  topLeakCategory: LeakCategoryGroup | null;
  topLeakReason: LeakReasonGroup | null;
  peakLeakWeekday: LeakWeekdayGroup | null;
  peakLeakHour: LeakHourGroup | null;
};

const leakReasonSet = new Set<string>(LEAK_REASONS);

function sanitizeNumber(value: number) {
  return Number.isFinite(value) ? value : 0;
}

function addSafeAmount(currentValue: number, nextValue: number) {
  return sanitizeNumber(
    sanitizeNumber(currentValue) + sanitizeNumber(nextValue),
  );
}

function isLeakTransaction(transaction: Transaction) {
  return transaction.isLeak;
}

function getValidLeakDate(transaction: Transaction) {
  if (!Number.isFinite(transaction.createdAt)) return null;

  const date = new Date(transaction.createdAt);

  if (!Number.isFinite(date.getTime())) return null;

  return date;
}

function getReasonOrder(leakReason: LeakReason) {
  return LEAK_REASONS.indexOf(leakReason);
}

export function groupLeakTransactionsByCategory(
  transactions: Transaction[],
): LeakCategoryGroup[] {
  const groups = new Map<TransactionCategory, LeakCategoryGroup>();

  for (const transaction of transactions) {
    if (!isLeakTransaction(transaction)) continue;

    const currentGroup = groups.get(transaction.category) ?? {
      category: transaction.category,
      totalLeaks: 0,
      count: 0,
    };

    groups.set(transaction.category, {
      ...currentGroup,
      totalLeaks: addSafeAmount(currentGroup.totalLeaks, transaction.amount),
      count: currentGroup.count + 1,
    });
  }

  return [...groups.values()].sort((firstGroup, secondGroup) => {
    if (secondGroup.totalLeaks !== firstGroup.totalLeaks)
      return secondGroup.totalLeaks - firstGroup.totalLeaks;

    if (secondGroup.count !== firstGroup.count)
      return secondGroup.count - firstGroup.count;

    return compareCategoryIds(firstGroup.category, secondGroup.category);
  });
}

export function groupLeakTransactionsByLeakReason(
  transactions: Transaction[],
): LeakReasonGroup[] {
  const groups = new Map<LeakReason, LeakReasonGroup>();

  for (const transaction of transactions) {
    if (
      !isLeakTransaction(transaction) ||
      !transaction.leakReason ||
      !leakReasonSet.has(transaction.leakReason)
    ) {
      continue;
    }

    const currentGroup = groups.get(transaction.leakReason) ?? {
      leakReason: transaction.leakReason,
      totalLeaks: 0,
      count: 0,
    };

    groups.set(transaction.leakReason, {
      ...currentGroup,
      totalLeaks: addSafeAmount(currentGroup.totalLeaks, transaction.amount),
      count: currentGroup.count + 1,
    });
  }

  return [...groups.values()].sort((firstGroup, secondGroup) => {
    if (secondGroup.count !== firstGroup.count)
      return secondGroup.count - firstGroup.count;

    if (secondGroup.totalLeaks !== firstGroup.totalLeaks)
      return secondGroup.totalLeaks - firstGroup.totalLeaks;

    return (
      getReasonOrder(firstGroup.leakReason) -
      getReasonOrder(secondGroup.leakReason)
    );
  });
}

export function groupLeakTransactionsByWeekday(
  transactions: Transaction[],
): LeakWeekdayGroup[] {
  const groups = new Map<number, LeakWeekdayGroup>();

  for (const transaction of transactions) {
    if (!isLeakTransaction(transaction)) continue;

    const date = getValidLeakDate(transaction);

    if (!date) continue;

    const weekdayIndex = date.getDay();

    const currentGroup = groups.get(weekdayIndex) ?? {
      weekday: WEEKDAYS[weekdayIndex],
      weekdayIndex,
      totalLeaks: 0,
      count: 0,
    };

    groups.set(weekdayIndex, {
      ...currentGroup,
      totalLeaks: addSafeAmount(currentGroup.totalLeaks, transaction.amount),
      count: currentGroup.count + 1,
    });
  }

  return [...groups.values()].sort((firstGroup, secondGroup) => {
    if (secondGroup.count !== firstGroup.count)
      return secondGroup.count - firstGroup.count;

    if (secondGroup.totalLeaks !== firstGroup.totalLeaks)
      return secondGroup.totalLeaks - firstGroup.totalLeaks;

    return firstGroup.weekdayIndex - secondGroup.weekdayIndex;
  });
}

export function groupLeakTransactionsByHour(
  transactions: Transaction[],
): LeakHourGroup[] {
  const groups = new Map<number, LeakHourGroup>();

  for (const transaction of transactions) {
    if (!isLeakTransaction(transaction)) continue;

    const date = getValidLeakDate(transaction);

    if (!date) continue;

    const hour = date.getHours();

    const currentGroup = groups.get(hour) ?? {
      hour,
      totalLeaks: 0,
      count: 0,
    };

    groups.set(hour, {
      ...currentGroup,
      totalLeaks: addSafeAmount(currentGroup.totalLeaks, transaction.amount),
      count: currentGroup.count + 1,
    });
  }

  return [...groups.values()].sort((firstGroup, secondGroup) => {
    if (secondGroup.count !== firstGroup.count)
      return secondGroup.count - firstGroup.count;

    if (secondGroup.totalLeaks !== firstGroup.totalLeaks)
      return secondGroup.totalLeaks - firstGroup.totalLeaks;

    return firstGroup.hour - secondGroup.hour;
  });
}

export function calculateAnalytics(
  transactions: Transaction[],
): AnalyticsResult {
  const summary = calculateTransactionsSummary(transactions);

  const topLeakCategory =
    groupLeakTransactionsByCategory(transactions)[0] ?? null;

  const topLeakReason =
    groupLeakTransactionsByLeakReason(transactions)[0] ?? null;

  const peakLeakWeekday =
    groupLeakTransactionsByWeekday(transactions)[0] ?? null;

  const peakLeakHour = groupLeakTransactionsByHour(transactions)[0] ?? null;

  return {
    totalSpent: sanitizeNumber(summary.totalSpent),
    totalLeaks: sanitizeNumber(summary.totalLeaks),
    leakPercentage: sanitizeNumber(summary.leakPercentage),
    topLeakCategory,
    topLeakReason,
    peakLeakWeekday,
    peakLeakHour,
  };
}
