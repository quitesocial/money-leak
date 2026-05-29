import { sanitizeNumber } from '@/lib/display-formatters';
import type { BalanceEntry } from '@/types/balance';
import type { Transaction } from '@/types/transaction';

type CalculateCurrentBalanceParams = {
  balanceEntries: BalanceEntry[];
  transactions: Transaction[];
};

function getFiniteAmount(value: number) {
  return Number.isFinite(value) ? value : 0;
}

export function calculateCurrentBalance({
  balanceEntries,
  transactions,
}: CalculateCurrentBalanceParams) {
  const totalAdded = balanceEntries.reduce((total, entry) => {
    if (entry.deletedAt !== null) return total;

    return sanitizeNumber(total + getFiniteAmount(entry.amount));
  }, 0);

  const totalSpent = transactions.reduce((total, transaction) => {
    if (transaction.deletedAt !== null) return total;

    return sanitizeNumber(total + getFiniteAmount(transaction.amount));
  }, 0);

  return sanitizeNumber(totalAdded - totalSpent);
}
