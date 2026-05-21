import { getCategories, restoreCategories } from '@/db/categories';
import {
  getTransactions,
  restoreTransactionTombstones,
  restoreTransactions,
} from '@/db/transactions';
import {
  mapRemoteCategoryToLocalInput,
  mapRemoteTransactionToLocalInput,
  mapRemoteTransactionTombstoneToLocalInput,
} from '@/lib/sync/sync-mappers';
import type {
  LocalRestoreDataTarget,
  LocalRestoreWriteResult,
  RestorePayload,
} from '@/lib/sync/sync-types';
import type { Category, CategoryInput } from '@/types/category';
import type {
  Transaction,
  TransactionRestoreInput,
  TransactionTombstoneRestoreInput,
} from '@/types/transaction';

type LocalRestoreDataTargetOptions = {
  readCategories?: () => Promise<Category[]>;
  readTransactions?: () => Promise<Transaction[]>;
  writeCategories?: (categories: CategoryInput[]) => Promise<number>;
  writeTransactions?: (
    transactions: TransactionRestoreInput[],
  ) => Promise<number>;
  writeTransactionTombstones?: (
    tombstones: TransactionTombstoneRestoreInput[],
  ) => Promise<number>;
};

export function createLocalRestoreDataTarget({
  readCategories = getCategories,
  readTransactions = getTransactions,
  writeCategories = restoreCategories,
  writeTransactions = restoreTransactions,
  writeTransactionTombstones = restoreTransactionTombstones,
}: LocalRestoreDataTargetOptions = {}): LocalRestoreDataTarget {
  return {
    async hasLocalData() {
      const [categories, transactions] = await Promise.all([
        readCategories(),
        readTransactions(),
      ]);

      return categories.length > 0 || transactions.length > 0;
    },

    async restoreBackup(payload: RestorePayload) {
      const categories = payload.categories
        .filter(isActiveRemoteRow)
        .map(mapRemoteCategoryToLocalInput);

      const transactions = payload.transactions
        .filter(isActiveRemoteRow)
        .map(mapRemoteTransactionToLocalInput);

      const transactionTombstones = payload.transactions
        .filter(isDeletedRemoteRow)
        .map(mapRemoteTransactionTombstoneToLocalInput);

      const restoredCategoriesCount = await writeCategories(categories);
      const restoredActiveTransactionsCount =
        await writeTransactions(transactions);
      const restoredTransactionTombstonesCount =
        await writeTransactionTombstones(transactionTombstones);

      return {
        restoredTransactionsCount:
          restoredActiveTransactionsCount + restoredTransactionTombstonesCount,
        restoredCategoriesCount,
      } satisfies LocalRestoreWriteResult;
    },
  };
}

function isActiveRemoteRow(row: { deletedAt: string | null }) {
  return row.deletedAt === null;
}

function isDeletedRemoteRow(row: { deletedAt: string | null }) {
  return row.deletedAt !== null;
}
