import { getCategories, restoreCategories } from '@/db/categories';
import {
  getTransactions,
  restoreTransactionTombstones,
  restoreTransactions,
} from '@/db/transactions';
import type {
  LocalRestoreDataTarget,
  LocalRestoreWriteResult,
  RemoteCategory,
  RemoteTransaction,
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

function mapRemoteCategoryToLocalInput(
  category: RemoteCategory,
): CategoryInput {
  return {
    id: category.id,
    name: category.name,
    createdAt: parseRemoteTimestamp(category.createdAt),
    updatedAt: parseRemoteTimestamp(category.updatedAt),
    isDefault: category.isDefault,
    isArchived: category.isArchived,
    sortOrder: category.sortOrder,
  };
}

function mapRemoteTransactionToLocalInput(
  transaction: RemoteTransaction,
): TransactionRestoreInput {
  return {
    id: transaction.id,
    amount: transaction.amount,
    category: transaction.categoryId,
    isLeak: transaction.isLeak,
    leakReason: transaction.leakReason,
    note: transaction.note,
    createdAt: parseRemoteTimestamp(transaction.createdAt),
    updatedAt: parseRemoteTimestamp(transaction.updatedAt),
  };
}

function mapRemoteTransactionTombstoneToLocalInput(
  transaction: RemoteTransaction,
): TransactionTombstoneRestoreInput {
  if (transaction.deletedAt === null) {
    throw new Error('Remote restore transaction tombstone is missing.');
  }

  return {
    id: transaction.id,
    updatedAt: parseRemoteTimestamp(transaction.updatedAt),
    deletedAt: parseRemoteTimestamp(transaction.deletedAt),
  };
}

function parseRemoteTimestamp(timestamp: string) {
  const parsedTimestamp = Date.parse(timestamp);

  if (!Number.isFinite(parsedTimestamp)) {
    throw new Error('Remote restore timestamp is invalid.');
  }

  return parsedTimestamp;
}
