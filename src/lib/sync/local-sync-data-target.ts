import { applyBalanceSyncChanges } from '@/db/balance';
import { applyCategorySyncChanges } from '@/db/categories';
import { applyTransactionSyncChanges } from '@/db/transactions';
import {
  mapRemoteBalanceEntryToLocalInput,
  mapRemoteBalanceEntryTombstoneToLocalInput,
  mapRemoteBalanceTypeToLocalInput,
  mapRemoteBalanceTypeTombstoneToLocalInput,
  mapRemoteCategoryToLocalInput,
  mapRemoteSettingToLocalInput,
  mapRemoteTransactionToLocalInput,
  mapRemoteTransactionTombstoneToLocalInput,
} from '@/lib/sync/sync-mappers';
import {
  applyRemoteSettingsPreferences,
  getSettingsCurrency,
  getSettingsLanguage,
  type ApplySettingsPreferencesResult,
  type SettingsPreferenceRemoteInput,
} from '@/lib/settings-preferences';
import { notifySettingsCurrencyChanged } from '@/lib/use-settings-currency';
import { notifySettingsLanguageChanged } from '@/lib/use-settings-language';
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
  writeSettings?: (
    settings: SettingsPreferenceRemoteInput[],
  ) => Promise<ApplySettingsPreferencesResult>;
};

export function createLocalSyncDataTarget({
  writeCategories = applyCategorySyncChanges,
  writeTransactions = applyTransactionSyncChanges,
  writeBalance = applyBalanceSyncChanges,
  writeSettings = applyRemoteSettingsPreferences,
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
      const settings = (changes.settings ?? []).map(
        mapRemoteSettingToLocalInput,
      );

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
      const settingsResult = await writeSettings(settings);
      await notifyAppliedSettings(settingsResult);

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
        appliedSettingsCount: settingsResult.restoredSettingsCount,
        ignoredSettingsCount: settingsResult.ignoredSettingsCount,
      } satisfies LocalSyncWriteResult;
    },
  };
}

async function notifyAppliedSettings(result: ApplySettingsPreferencesResult) {
  if (result.restoredSettingsCount === 0) return;

  const [currency, language] = await Promise.all([
    getSettingsCurrency(),
    getSettingsLanguage(),
  ]);

  notifySettingsCurrencyChanged(currency);
  notifySettingsLanguageChanged(language);
}
