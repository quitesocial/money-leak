import { getCategories } from '@/db/categories';
import { getTransactionsForBackup } from '@/db/transactions';
import type { Category } from '@/types/category';
import type { Transaction } from '@/types/transaction';

export type LocalSyncData = {
  transactions: Transaction[];
  categories: Category[];
};

export type LocalSyncDataSource = {
  getSyncData: () => Promise<LocalSyncData>;
};

export function createLocalSyncDataSource({
  readCategories = getCategories,
  readTransactions = getTransactionsForBackup,
}: {
  readCategories?: () => Promise<Category[]>;
  readTransactions?: () => Promise<Transaction[]>;
} = {}): LocalSyncDataSource {
  return {
    async getSyncData() {
      const [transactions, categories] = await Promise.all([
        readTransactions(),
        readCategories(),
      ]);

      return {
        transactions,
        categories: categories.filter(
          (category) => category.deletedAt === null,
        ),
      };
    },
  };
}
