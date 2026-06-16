import { sanitizeNumber } from '@/lib/display-formatters';
import type { BalanceEntry } from '@/types/balance';
import type { Transaction } from '@/types/transaction';

import {
  getAnalyticsPeriodRange,
  type AnalyticsCustomPeriodType,
  type AnalyticsPeriod,
} from './analytics-ledger';

type AnalyticsOverviewParams = {
  balanceEntries: BalanceEntry[];
  customDate: number;
  customPeriodType: AnalyticsCustomPeriodType | null;
  customRangeEnd: number;
  customRangeStart: number;
  now?: number | Date;
  period: AnalyticsPeriod;
  transactions: Transaction[];
};

export type AnalyticsOverview = {
  chartParts: {
    income: number;
    normalExpenses: number;
    leaks: number;
  };
  expensesAmount: number;
  incomeAmount: number;
  leaksAmount: number;
};

const EMPTY_OVERVIEW: AnalyticsOverview = {
  chartParts: {
    income: 0,
    normalExpenses: 0,
    leaks: 0,
  },
  expensesAmount: 0,
  incomeAmount: 0,
  leaksAmount: 0,
};

function isTimestampInRange(
  createdAt: number,
  startTime: number,
  endTime: number,
) {
  if (!Number.isFinite(createdAt)) return false;

  return createdAt >= startTime && createdAt < endTime;
}

function getSafePositiveAmount(amount: number) {
  return Math.abs(sanitizeNumber(amount));
}

function getChartParts({
  expensesAmount,
  incomeAmount,
  leaksAmount,
}: Pick<
  AnalyticsOverview,
  'expensesAmount' | 'incomeAmount' | 'leaksAmount'
>): AnalyticsOverview['chartParts'] {
  const normalExpenses = Math.max(expensesAmount - leaksAmount, 0);
  const total = incomeAmount + normalExpenses + leaksAmount;

  if (total <= 0) return EMPTY_OVERVIEW.chartParts;

  return {
    income: incomeAmount / total,
    normalExpenses: normalExpenses / total,
    leaks: leaksAmount / total,
  };
}

export function calculateAnalyticsOverview({
  balanceEntries,
  customDate,
  customPeriodType,
  customRangeEnd,
  customRangeStart,
  now,
  period,
  transactions,
}: AnalyticsOverviewParams): AnalyticsOverview {
  const periodRange = getAnalyticsPeriodRange({
    customDate,
    customPeriodType,
    customRangeEnd,
    customRangeStart,
    now,
    period,
  });

  if (!periodRange) return EMPTY_OVERVIEW;

  const periodStartTime = periodRange.start.getTime();
  const periodEndTime = periodRange.end.getTime();
  let incomeAmount = 0;
  let expensesAmount = 0;
  let leaksAmount = 0;

  for (const entry of balanceEntries) {
    if (entry.deletedAt !== null) continue;
    if (!isTimestampInRange(entry.createdAt, periodStartTime, periodEndTime)) {
      continue;
    }

    incomeAmount += getSafePositiveAmount(entry.amount);
  }

  for (const transaction of transactions) {
    if (transaction.deletedAt !== null) continue;
    if (
      !isTimestampInRange(transaction.createdAt, periodStartTime, periodEndTime)
    ) {
      continue;
    }

    const amount = getSafePositiveAmount(transaction.amount);

    expensesAmount += amount;

    if (transaction.isLeak) {
      leaksAmount += amount;
    }
  }

  return {
    chartParts: getChartParts({
      expensesAmount,
      incomeAmount,
      leaksAmount,
    }),
    expensesAmount,
    incomeAmount,
    leaksAmount,
  };
}
