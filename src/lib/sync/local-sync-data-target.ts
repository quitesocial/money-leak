import { applyCategorySyncChanges } from '@/db/categories';
import { applyTransactionSyncChanges } from '@/db/transactions';
import {
  mapRemoteCategoryToLocalInput,
  mapRemoteTransactionToLocalInput,
  mapRemoteTransactionTombstoneToLocalInput,
} from '@/lib/sync/sync-mappers';
import type {
  LocalSyncDataTarget,
  LocalSyncWriteResult,
  RemoteSyncChanges,
} from '@/lib/sync/sync-types';
import type { CategoryInput } from '@/types/category';
import type {
  TransactionRestoreInput,
  TransactionTombstoneRestoreInput,
} from '@/types/transaction';

type LocalSyncDataTargetOptions = {
  writeCategories?: (categories: CategoryInput[]) => Promise<number>;
  writeTransactions?: (input: {
    upserts: TransactionRestoreInput[];
    tombstones: TransactionTombstoneRestoreInput[];
  }) => Promise<{
    upsertedTransactionsCount: number;
    deletedTransactionsCount: number;
  }>;
};

export function createLocalSyncDataTarget({
  writeCategories = applyCategorySyncChanges,
  writeTransactions = applyTransactionSyncChanges,
}: LocalSyncDataTargetOptions = {}): LocalSyncDataTarget {
  return {
    async applyRemoteChanges(changes: RemoteSyncChanges) {
      const categories = changes.categories
        .filter((category) => category.deletedAt === null)
        .map(mapRemoteCategoryToLocalInput);

      const transactionUpserts = changes.transactions
        .filter((transaction) => transaction.deletedAt === null)
        .map(mapRemoteTransactionToLocalInput);

      const transactionTombstones = changes.transactions
        .filter((transaction) => transaction.deletedAt !== null)
        .map(mapRemoteTransactionTombstoneToLocalInput);

      const appliedCategoriesCount = await writeCategories(categories);
      const transactionResult = await writeTransactions({
        upserts: transactionUpserts,
        tombstones: transactionTombstones,
      });

      return {
        appliedTransactionsCount:
          transactionResult.upsertedTransactionsCount +
          transactionResult.deletedTransactionsCount,
        appliedCategoriesCount,
      } satisfies LocalSyncWriteResult;
    },
  };
}
