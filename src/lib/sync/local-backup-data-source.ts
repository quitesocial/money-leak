import {
  getBalanceEntriesForBackup,
  getBalanceTypesForBackup,
} from '@/db/balance';
import { getCategories } from '@/db/categories';
import { getTransactionsForBackup } from '@/db/transactions';
import {
  getSettingsPreferenceSnapshot,
  type SettingsPreferenceSnapshot,
} from '@/lib/settings-preferences';
import type { BalanceEntry, BalanceType } from '@/types/balance';
import type { Category } from '@/types/category';
import type { Transaction } from '@/types/transaction';

export type LocalBackupData = {
  transactions: Transaction[];
  categories: Category[];
  balanceTypes: BalanceType[];
  balanceEntries: BalanceEntry[];
  settings?: SettingsPreferenceSnapshot;
};

export type LocalBackupDataSource = {
  getBackupData: () => Promise<LocalBackupData>;
};

export function createLocalBackupDataSource({
  readTransactions = getTransactionsForBackup,
  readCategories = getCategories,
  readBalanceTypes = getBalanceTypesForBackup,
  readBalanceEntries = getBalanceEntriesForBackup,
  readSettings = getSettingsPreferenceSnapshot,
}: {
  readTransactions?: () => Promise<Transaction[]>;
  readCategories?: () => Promise<Category[]>;
  readBalanceTypes?: () => Promise<BalanceType[]>;
  readBalanceEntries?: () => Promise<BalanceEntry[]>;
  readSettings?: () => Promise<SettingsPreferenceSnapshot>;
} = {}): LocalBackupDataSource {
  return {
    async getBackupData() {
      const [transactions, categories, balanceTypes, balanceEntries, settings] =
        await Promise.all([
          readTransactions(),
          readCategories(),
          readBalanceTypes(),
          readBalanceEntries(),
          readSettings(),
        ]);

      return {
        transactions,
        categories: categories.filter(
          (category) => category.deletedAt === null,
        ),
        balanceTypes,
        balanceEntries,
        settings,
      };
    },
  };
}
