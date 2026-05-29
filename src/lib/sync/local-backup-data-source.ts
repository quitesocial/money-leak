import {
  getBalanceEntriesForBackup,
  getBalanceTypesForBackup,
} from '@/db/balance';
import { getCategories } from '@/db/categories';
import { getTransactionsForBackup } from '@/db/transactions';
import type { BalanceEntry, BalanceType } from '@/types/balance';
import type { Category } from '@/types/category';
import type { Transaction } from '@/types/transaction';

export type LocalBackupData = {
  transactions: Transaction[];
  categories: Category[];
  balanceTypes: BalanceType[];
  balanceEntries: BalanceEntry[];
};

export type LocalBackupDataSource = {
  getBackupData: () => Promise<LocalBackupData>;
};

export function createLocalBackupDataSource({
  readTransactions = getTransactionsForBackup,
  readCategories = getCategories,
  readBalanceTypes = getBalanceTypesForBackup,
  readBalanceEntries = getBalanceEntriesForBackup,
}: {
  readTransactions?: () => Promise<Transaction[]>;
  readCategories?: () => Promise<Category[]>;
  readBalanceTypes?: () => Promise<BalanceType[]>;
  readBalanceEntries?: () => Promise<BalanceEntry[]>;
} = {}): LocalBackupDataSource {
  return {
    async getBackupData() {
      const [transactions, categories, balanceTypes, balanceEntries] =
        await Promise.all([
          readTransactions(),
          readCategories(),
          readBalanceTypes(),
          readBalanceEntries(),
        ]);

      return {
        transactions,
        categories: categories.filter(
          (category) => category.deletedAt === null,
        ),
        balanceTypes,
        balanceEntries,
      };
    },
  };
}
