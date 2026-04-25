import { calculateTransactionsSummary } from '@/features/home/calculate-transactions-summary';
import { sanitizeNumber } from '@/lib/display-formatters';
import {
  TRANSACTION_CATEGORIES,
  type Transaction,
  type TransactionCategory,
} from '@/types/transaction';

export type DailyReviewTopLeakCategory = {
  category: TransactionCategory;
  totalLeaks: number;
  count: number;
};

export type DailyReviewSummary = {
  transactionCount: number;
  totalSpent: number;
  totalLeaks: number;
  leakPercentage: number;
  topLeakCategory: DailyReviewTopLeakCategory | null;
};

type CalculateDailyReviewSummaryParams = {
  transactions: Transaction[];
  now?: number;
};

function getValidDate(value: number) {
  if (!Number.isFinite(value)) return null;

  const date = new Date(value);

  if (!Number.isFinite(date.getTime())) return null;

  return date;
}

function getReferenceDate(now?: number) {
  return getValidDate(now ?? Date.now()) ?? new Date();
}

function getStartOfDay(referenceDate: Date) {
  const startOfDay = new Date(referenceDate);

  startOfDay.setHours(0, 0, 0, 0);

  return startOfDay;
}

function getCategoryOrder(category: TransactionCategory) {
  return TRANSACTION_CATEGORIES.indexOf(category);
}

function getTopLeakCategory(
  transactions: Transaction[],
): DailyReviewTopLeakCategory | null {
  const groups = new Map<TransactionCategory, DailyReviewTopLeakCategory>();

  for (const transaction of transactions) {
    if (!transaction.isLeak) continue;

    const currentGroup = groups.get(transaction.category) ?? {
      category: transaction.category,
      totalLeaks: 0,
      count: 0,
    };

    groups.set(transaction.category, {
      ...currentGroup,
      totalLeaks:
        sanitizeNumber(currentGroup.totalLeaks) +
        sanitizeNumber(transaction.amount),
      count: currentGroup.count + 1,
    });
  }

  return (
    [...groups.values()].sort((firstGroup, secondGroup) => {
      if (secondGroup.totalLeaks !== firstGroup.totalLeaks)
        return secondGroup.totalLeaks - firstGroup.totalLeaks;

      if (secondGroup.count !== firstGroup.count)
        return secondGroup.count - firstGroup.count;

      return (
        getCategoryOrder(firstGroup.category) -
        getCategoryOrder(secondGroup.category)
      );
    })[0] ?? null
  );
}

export function calculateDailyReviewSummary({
  transactions,
  now,
}: CalculateDailyReviewSummaryParams): DailyReviewSummary {
  const referenceDate = getReferenceDate(now);
  const startOfToday = getStartOfDay(referenceDate);
  const startOfTomorrow = new Date(startOfToday);

  startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);

  const startOfTodayTime = startOfToday.getTime();
  const startOfTomorrowTime = startOfTomorrow.getTime();

  const todaysTransactions = transactions.filter((transaction) => {
    const transactionDate = getValidDate(transaction.createdAt);

    if (!transactionDate) return false;

    const transactionTime = transactionDate.getTime();

    return (
      transactionTime >= startOfTodayTime &&
      transactionTime < startOfTomorrowTime
    );
  });

  const summary = calculateTransactionsSummary(todaysTransactions);

  return {
    transactionCount: todaysTransactions.length,
    totalSpent: summary.totalSpent,
    totalLeaks: summary.totalLeaks,
    leakPercentage: summary.leakPercentage,
    topLeakCategory: getTopLeakCategory(todaysTransactions),
  };
}
