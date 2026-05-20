import { getCategories, restoreCategories } from '@/db/categories';
import { getTransactions, restoreTransactions } from '@/db/transactions';
import type {
  LocalRestoreDataTarget,
  LocalRestoreWriteResult,
  RemoteCategory,
  RemoteTransaction,
  RestorePayload,
} from '@/lib/sync/sync-types';
import type { Category, CategoryInput } from '@/types/category';
import type { Transaction, TransactionRestoreInput } from '@/types/transaction';

type LocalRestoreDataTargetOptions = {
  readCategories?: () => Promise<Category[]>;
  readTransactions?: () => Promise<Transaction[]>;
  writeCategories?: (categories: CategoryInput[]) => Promise<number>;
  writeTransactions?: (
    transactions: TransactionRestoreInput[],
  ) => Promise<number>;
};

export function createLocalRestoreDataTarget({
  readCategories = getCategories,
  readTransactions = getTransactions,
  writeCategories = restoreCategories,
  writeTransactions = restoreTransactions,
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

      const restoredCategoriesCount = await writeCategories(categories);
      const restoredTransactionsCount = await writeTransactions(transactions);

      return {
        restoredTransactionsCount,
        restoredCategoriesCount,
      } satisfies LocalRestoreWriteResult;
    },
  };
}

function isActiveRemoteRow(row: { deletedAt: string | null }) {
  return row.deletedAt === null;
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

function parseRemoteTimestamp(timestamp: string) {
  const parsedTimestamp = Date.parse(timestamp);

  if (!Number.isFinite(parsedTimestamp)) {
    throw new Error('Remote restore timestamp is invalid.');
  }

  return parsedTimestamp;
}
