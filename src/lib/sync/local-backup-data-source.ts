import { getCategories } from '@/db/categories';
import { getTransactionsForBackup } from '@/db/transactions';
import type { Category } from '@/types/category';
import type { Transaction } from '@/types/transaction';

export type LocalBackupData = {
  transactions: Transaction[];
  categories: Category[];
};

export type LocalBackupDataSource = {
  getBackupData: () => Promise<LocalBackupData>;
};

export function createLocalBackupDataSource({
  readTransactions = getTransactionsForBackup,
  readCategories = getCategories,
}: {
  readTransactions?: () => Promise<Transaction[]>;
  readCategories?: () => Promise<Category[]>;
} = {}): LocalBackupDataSource {
  return {
    async getBackupData() {
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
