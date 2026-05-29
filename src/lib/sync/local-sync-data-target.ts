import { applyBalanceSyncChanges } from '@/db/balance';
import { applyCategorySyncChanges } from '@/db/categories';
import { applyTransactionSyncChanges } from '@/db/transactions';
import {
  mapRemoteBalanceEntryToLocalInput,
  mapRemoteBalanceEntryTombstoneToLocalInput,
  mapRemoteBalanceTypeToLocalInput,
  mapRemoteBalanceTypeTombstoneToLocalInput,
  mapRemoteCategoryToLocalInput,
  mapRemoteTransactionToLocalInput,
  mapRemoteTransactionTombstoneToLocalInput,
} from '@/lib/sync/sync-mappers';
import type {
  LocalSyncDataTarget,
  LocalSyncWriteResult,
  RemoteSyncChanges,
} from '@/lib/sync/sync-types';
import type {
  BalanceEntryRestoreInput,
  BalanceEntryTombstoneRestoreInput,
  BalanceTypeInput,
  BalanceTypeTombstoneRestoreInput,
} from '@/types/balance';
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
  writeBalance?: (input: {
    typeUpserts: BalanceTypeInput[];
    typeTombstones: BalanceTypeTombstoneRestoreInput[];
    entryUpserts: BalanceEntryRestoreInput[];
    entryTombstones: BalanceEntryTombstoneRestoreInput[];
  }) => Promise<{
    upsertedBalanceTypesCount: number;
    deletedBalanceTypesCount: number;
    upsertedBalanceEntriesCount: number;
    deletedBalanceEntriesCount: number;
  }>;
};

export function createLocalSyncDataTarget({
  writeCategories = applyCategorySyncChanges,
  writeTransactions = applyTransactionSyncChanges,
  writeBalance = applyBalanceSyncChanges,
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

      const balanceTypeUpserts = changes.balanceTypes
        .filter((balanceType) => balanceType.deletedAt === null)
        .map(mapRemoteBalanceTypeToLocalInput);

      const balanceTypeTombstones = changes.balanceTypes
        .filter((balanceType) => balanceType.deletedAt !== null)
        .map(mapRemoteBalanceTypeTombstoneToLocalInput);

      const balanceEntryUpserts = changes.balanceEntries
        .filter((balanceEntry) => balanceEntry.deletedAt === null)
        .map(mapRemoteBalanceEntryToLocalInput);

      const balanceEntryTombstones = changes.balanceEntries
        .filter((balanceEntry) => balanceEntry.deletedAt !== null)
        .map(mapRemoteBalanceEntryTombstoneToLocalInput);

      const appliedCategoriesCount = await writeCategories(categories);
      const balanceResult = await writeBalance({
        typeUpserts: balanceTypeUpserts,
        typeTombstones: balanceTypeTombstones,
        entryUpserts: balanceEntryUpserts,
        entryTombstones: balanceEntryTombstones,
      });
      const transactionResult = await writeTransactions({
        upserts: transactionUpserts,
        tombstones: transactionTombstones,
      });

      return {
        appliedTransactionsCount:
          transactionResult.upsertedTransactionsCount +
          transactionResult.deletedTransactionsCount,
        appliedCategoriesCount,
        appliedBalanceTypesCount:
          balanceResult.upsertedBalanceTypesCount +
          balanceResult.deletedBalanceTypesCount,
        appliedBalanceEntriesCount:
          balanceResult.upsertedBalanceEntriesCount +
          balanceResult.deletedBalanceEntriesCount,
      } satisfies LocalSyncWriteResult;
    },
  };
}
