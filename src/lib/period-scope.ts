import type { Transaction } from '@/types/transaction';

export type PeriodScope = 'this_week' | 'this_month' | 'all_time';

export const PERIOD_SCOPE_OPTIONS: PeriodScope[] = [
  'this_week',
  'this_month',
  'all_time',
];

type FilterTransactionsByPeriodParams = {
  transactions: Transaction[];
  period: PeriodScope;
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

function getStartOfMondayWeek(referenceDate: Date) {
  const startOfWeek = new Date(referenceDate);

  startOfWeek.setHours(0, 0, 0, 0);

  const weekday = startOfWeek.getDay();
  const daysSinceMonday = weekday === 0 ? 6 : weekday - 1;

  startOfWeek.setDate(startOfWeek.getDate() - daysSinceMonday);

  return startOfWeek;
}

function getStartOfMonth(referenceDate: Date) {
  return new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1);
}

export function getPeriodLabel(period: PeriodScope) {
  switch (period) {
    case 'this_week':
      return 'This week';
    case 'this_month':
      return 'This month';
    case 'all_time':
      return 'All time';
  }
}

export function filterTransactionsByPeriod({
  transactions,
  period,
  now,
}: FilterTransactionsByPeriodParams) {
  if (period === 'all_time') return transactions;

  const referenceDate = getReferenceDate(now);

  const periodStart =
    period === 'this_week'
      ? getStartOfMondayWeek(referenceDate)
      : getStartOfMonth(referenceDate);

  const periodEnd = new Date(periodStart);

  if (period === 'this_week') {
    periodEnd.setDate(periodEnd.getDate() + 7);
  } else {
    periodEnd.setMonth(periodEnd.getMonth() + 1);
  }

  const periodStartTime = periodStart.getTime();
  const periodEndTime = periodEnd.getTime();

  return transactions.filter((transaction) => {
    const transactionDate = getValidDate(transaction.createdAt);

    if (!transactionDate) return false;

    const transactionTime = transactionDate.getTime();

    return (
      transactionTime >= periodStartTime && transactionTime < periodEndTime
    );
  });
}
