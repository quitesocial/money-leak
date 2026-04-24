import type { Transaction } from '@/types/transaction';

export type TransactionsSummary = {
  totalSpent: number;
  totalLeaks: number;
  leakPercentage: number;
};

function sanitizeNumber(value: number) {
  return Number.isFinite(value) ? value : 0;
}

export function calculateTransactionsSummary(
  transactions: Transaction[],
): TransactionsSummary {
  const summary = transactions.reduce<TransactionsSummary>(
    (currentSummary, transaction) => {
      const amount = sanitizeNumber(transaction.amount);

      currentSummary.totalSpent += amount;

      if (transaction.isLeak) {
        currentSummary.totalLeaks += amount;
      }

      currentSummary.totalSpent = sanitizeNumber(currentSummary.totalSpent);
      currentSummary.totalLeaks = sanitizeNumber(currentSummary.totalLeaks);

      return currentSummary;
    },
    {
      totalSpent: 0,
      totalLeaks: 0,
      leakPercentage: 0,
    },
  );

  const leakPercentage =
    summary.totalSpent > 0
      ? (summary.totalLeaks / summary.totalSpent) * 100
      : 0;

  return {
    totalSpent: sanitizeNumber(summary.totalSpent),
    totalLeaks: sanitizeNumber(summary.totalLeaks),
    leakPercentage: sanitizeNumber(leakPercentage),
  };
}
