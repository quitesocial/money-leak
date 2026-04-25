import { getReferenceDate, getValidDate } from '@/lib/date-utils';
import { sanitizeNumber } from '@/lib/display-formatters';
import {
  LEAK_REASONS,
  TRANSACTION_CATEGORIES,
  type LeakReason,
  type Transaction,
  type TransactionCategory,
} from '@/types/transaction';

export type LeakRiskLevel = 'unknown' | 'low' | 'medium' | 'high';

export type LeakRiskSummary = {
  riskLevel: LeakRiskLevel;
  hasEnoughData: boolean;
  matchingWeekdayLeakCount: number;
  totalLeakCount: number;
  topCategory: TransactionCategory | null;
  topReason: LeakReason | null;
  peakHour: number | null;
  suggestedWindow: string | null;
};

type LeakRiskTransaction = {
  amount: number;
  category: TransactionCategory;
  leakReason: LeakReason | null;
  weekday: number;
  hour: number;
};

function getCategoryOrder(category: TransactionCategory) {
  return TRANSACTION_CATEGORIES.indexOf(category);
}

function getReasonOrder(reason: LeakReason) {
  return LEAK_REASONS.indexOf(reason);
}

function formatHour(hour: number) {
  return `${hour.toString().padStart(2, '0')}:00`;
}

function formatSuggestedWindow(peakHour: number | null) {
  if (peakHour === null) return null;

  const endHour = (peakHour + 2) % 24;

  return `${formatHour(peakHour)}-${formatHour(endHour)}`;
}

function getValidLeakTransactions(
  transactions: Transaction[],
): LeakRiskTransaction[] {
  const validLeaks: LeakRiskTransaction[] = [];

  for (const transaction of transactions) {
    if (!transaction.isLeak) continue;

    const transactionDate = getValidDate(transaction.createdAt);

    if (!transactionDate) continue;

    validLeaks.push({
      amount: transaction.amount,
      category: transaction.category,
      leakReason: transaction.leakReason,
      weekday: transactionDate.getDay(),
      hour: transactionDate.getHours(),
    });
  }

  return validLeaks;
}

function getTopCategory(
  transactions: LeakRiskTransaction[],
): TransactionCategory | null {
  const groups = new Map<
    TransactionCategory,
    { category: TransactionCategory; totalAmount: number; count: number }
  >();

  for (const transaction of transactions) {
    const currentGroup = groups.get(transaction.category) ?? {
      category: transaction.category,
      totalAmount: 0,
      count: 0,
    };

    groups.set(transaction.category, {
      category: currentGroup.category,
      totalAmount:
        sanitizeNumber(currentGroup.totalAmount) +
        sanitizeNumber(transaction.amount),
      count: currentGroup.count + 1,
    });
  }

  return (
    [...groups.values()].sort((firstGroup, secondGroup) => {
      if (secondGroup.totalAmount !== firstGroup.totalAmount) {
        return secondGroup.totalAmount - firstGroup.totalAmount;
      }

      if (secondGroup.count !== firstGroup.count) {
        return secondGroup.count - firstGroup.count;
      }

      return (
        getCategoryOrder(firstGroup.category) -
        getCategoryOrder(secondGroup.category)
      );
    })[0]?.category ?? null
  );
}

function getTopReason(transactions: LeakRiskTransaction[]): LeakReason | null {
  const groups = new Map<LeakReason, { reason: LeakReason; count: number }>();

  for (const transaction of transactions) {
    if (!transaction.leakReason) continue;

    const currentGroup = groups.get(transaction.leakReason) ?? {
      reason: transaction.leakReason,
      count: 0,
    };

    groups.set(transaction.leakReason, {
      reason: currentGroup.reason,
      count: currentGroup.count + 1,
    });
  }

  return (
    [...groups.values()].sort((firstGroup, secondGroup) => {
      if (secondGroup.count !== firstGroup.count) {
        return secondGroup.count - firstGroup.count;
      }

      return (
        getReasonOrder(firstGroup.reason) - getReasonOrder(secondGroup.reason)
      );
    })[0]?.reason ?? null
  );
}

function getPeakHour(transactions: LeakRiskTransaction[]) {
  const groups = new Map<number, { hour: number; count: number }>();

  for (const transaction of transactions) {
    const currentGroup = groups.get(transaction.hour) ?? {
      hour: transaction.hour,
      count: 0,
    };

    groups.set(transaction.hour, {
      hour: currentGroup.hour,
      count: currentGroup.count + 1,
    });
  }

  return (
    [...groups.values()].sort((firstGroup, secondGroup) => {
      if (secondGroup.count !== firstGroup.count) {
        return secondGroup.count - firstGroup.count;
      }

      return firstGroup.hour - secondGroup.hour;
    })[0]?.hour ?? null
  );
}

function getRiskLevel(
  totalLeakCount: number,
  matchingWeekdayLeakCount: number,
): LeakRiskLevel {
  if (totalLeakCount < 3) return 'unknown';
  
  if (matchingWeekdayLeakCount >= 3) return 'high';
  
  if (matchingWeekdayLeakCount >= 1) return 'medium';

  return 'low';
}

export function calculateLeakRisk(
  transactions: Transaction[],
  now?: Date,
): LeakRiskSummary {
  const referenceDate = getReferenceDate(now);
  const referenceWeekday = referenceDate.getDay();
  const leakTransactions = getValidLeakTransactions(transactions);
  
  const matchingWeekdayTransactions = leakTransactions.filter(
    (transaction) => transaction.weekday === referenceWeekday,
  );
  
  const referenceTransactions =
    matchingWeekdayTransactions.length > 0
      ? matchingWeekdayTransactions
      : leakTransactions;
  
  const totalLeakCount = leakTransactions.length;
  const matchingWeekdayLeakCount = matchingWeekdayTransactions.length;
  const riskLevel = getRiskLevel(totalLeakCount, matchingWeekdayLeakCount);
  const hasEnoughData = riskLevel !== 'unknown';
  const peakHour = getPeakHour(referenceTransactions);

  return {
    riskLevel,
    hasEnoughData,
    matchingWeekdayLeakCount,
    totalLeakCount,
    topCategory: getTopCategory(referenceTransactions),
    topReason: getTopReason(referenceTransactions),
    peakHour,
    suggestedWindow: formatSuggestedWindow(peakHour),
  };
}
