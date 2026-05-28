import type { RemoteCategory, RemoteTransaction } from '@/lib/sync/sync-types';
import { CATEGORY_ICON_FALLBACK_NAME } from '@/lib/category-icons';
import type { Category, CategoryInput } from '@/types/category';
import type {
  Transaction,
  TransactionRestoreInput,
  TransactionTombstoneRestoreInput,
} from '@/types/transaction';

export function mapLocalTransactionToRemote({
  transaction,
  userId,
}: {
  transaction: Transaction;
  userId: string;
}): RemoteTransaction {
  return {
    id: transaction.id,
    userId,
    amount: transaction.amount,
    categoryId: transaction.category,
    isLeak: transaction.isLeak,
    leakReason: transaction.leakReason,
    note: transaction.note,
    createdAt: toRemoteTimestamp(transaction.createdAt),
    updatedAt: toRemoteTimestamp(transaction.updatedAt),
    deletedAt:
      transaction.deletedAt === null
        ? null
        : toRemoteTimestamp(transaction.deletedAt),
    schemaVersion: transaction.schemaVersion,
    sourceDeviceId: transaction.sourceDeviceId || null,
  };
}

export function mapLocalCategoryToRemote({
  category,
  userId,
}: {
  category: Category;
  userId: string;
}): RemoteCategory {
  return {
    id: category.id,
    userId,
    name: category.name,
    isDefault: category.isDefault,
    isArchived: category.isArchived,
    sortOrder: category.sortOrder,
    createdAt: toRemoteTimestamp(category.createdAt),
    updatedAt: toRemoteTimestamp(category.updatedAt),
    deletedAt:
      category.deletedAt === null
        ? null
        : toRemoteTimestamp(category.deletedAt),
    schemaVersion: category.schemaVersion,
    sourceDeviceId: category.sourceDeviceId || null,
  };
}

export function mapRemoteCategoryToLocalInput(
  category: RemoteCategory,
): CategoryInput {
  return {
    id: category.id,
    name: category.name,
    iconName: CATEGORY_ICON_FALLBACK_NAME,
    createdAt: parseRemoteTimestamp(category.createdAt),
    updatedAt: parseRemoteTimestamp(category.updatedAt),
    isDefault: category.isDefault,
    isArchived: category.isArchived,
    sortOrder: category.sortOrder,
  };
}

export function mapRemoteTransactionToLocalInput(
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

export function mapRemoteTransactionTombstoneToLocalInput(
  transaction: RemoteTransaction,
): TransactionTombstoneRestoreInput {
  if (transaction.deletedAt === null) {
    throw new Error('Remote transaction tombstone is missing.');
  }

  return {
    id: transaction.id,
    updatedAt: parseRemoteTimestamp(transaction.updatedAt),
    deletedAt: parseRemoteTimestamp(transaction.deletedAt),
  };
}

export function parseRemoteTimestamp(timestamp: string) {
  const parsedTimestamp = Date.parse(timestamp);

  if (!Number.isFinite(parsedTimestamp)) {
    throw new Error('Remote sync timestamp is invalid.');
  }

  return parsedTimestamp;
}

export function toRemoteTimestamp(epochMilliseconds: number) {
  if (
    typeof epochMilliseconds !== 'number' ||
    !Number.isFinite(epochMilliseconds)
  ) {
    throw new Error(
      'Remote sync timestamps must be finite epoch milliseconds.',
    );
  }

  return new Date(epochMilliseconds).toISOString();
}
