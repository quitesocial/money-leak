import {
  getBalanceEntriesForBackup,
  getBalanceTypesForBackup,
} from '@/db/balance';
import { getCategories } from '@/db/categories';
import { getTransactionsForBackup } from '@/db/transactions';
import type { BalanceEntry, BalanceType } from '@/types/balance';
import type { Category } from '@/types/category';
import type { Transaction } from '@/types/transaction';

export type LocalSyncData = {
  transactions: Transaction[];
  categories: Category[];
  balanceTypes: BalanceType[];
  balanceEntries: BalanceEntry[];
};

export type LocalSyncDataSource = {
  getSyncData: () => Promise<LocalSyncData>;
};

export function createLocalSyncDataSource({
  readCategories = getCategories,
  readTransactions = getTransactionsForBackup,
  readBalanceTypes = getBalanceTypesForBackup,
  readBalanceEntries = getBalanceEntriesForBackup,
}: {
  readCategories?: () => Promise<Category[]>;
  readTransactions?: () => Promise<Transaction[]>;
  readBalanceTypes?: () => Promise<BalanceType[]>;
  readBalanceEntries?: () => Promise<BalanceEntry[]>;
} = {}): LocalSyncDataSource {
  return {
    async getSyncData() {
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
