import {
  getBalanceEntries,
  getBalanceTypes,
  restoreBalanceEntries,
  restoreBalanceEntryTombstones,
  restoreBalanceTypes,
  restoreBalanceTypeTombstones,
} from '@/db/balance';
import { getCategories, restoreCategories } from '@/db/categories';
import {
  getTransactions,
  restoreTransactionTombstones,
  restoreTransactions,
} from '@/db/transactions';
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
  LocalRestoreDataTarget,
  LocalRestoreWriteResult,
  RestorePayload,
} from '@/lib/sync/sync-types';
import type {
  BalanceEntry,
  BalanceEntryRestoreInput,
  BalanceEntryTombstoneRestoreInput,
  BalanceType,
  BalanceTypeInput,
  BalanceTypeTombstoneRestoreInput,
} from '@/types/balance';
import type { Category, CategoryInput } from '@/types/category';
import type {
  Transaction,
  TransactionRestoreInput,
  TransactionTombstoneRestoreInput,
} from '@/types/transaction';

type LocalRestoreDataTargetOptions = {
  readCategories?: () => Promise<Category[]>;
  readTransactions?: () => Promise<Transaction[]>;
  readBalanceTypes?: () => Promise<BalanceType[]>;
  readBalanceEntries?: () => Promise<BalanceEntry[]>;
  writeCategories?: (categories: CategoryInput[]) => Promise<number>;
  writeBalanceTypes?: (balanceTypes: BalanceTypeInput[]) => Promise<number>;
  writeBalanceTypeTombstones?: (
    tombstones: BalanceTypeTombstoneRestoreInput[],
  ) => Promise<number>;
  writeBalanceEntries?: (
    entries: BalanceEntryRestoreInput[],
  ) => Promise<number>;
  writeBalanceEntryTombstones?: (
    tombstones: BalanceEntryTombstoneRestoreInput[],
  ) => Promise<number>;
  writeTransactions?: (
    transactions: TransactionRestoreInput[],
  ) => Promise<number>;
  writeTransactionTombstones?: (
    tombstones: TransactionTombstoneRestoreInput[],
  ) => Promise<number>;
  writeSettings?: (
    settings: SettingsPreferenceRemoteInput[],
  ) => Promise<ApplySettingsPreferencesResult>;
};

export function createLocalRestoreDataTarget({
  readCategories = getCategories,
  readTransactions = getTransactions,
  readBalanceTypes = getBalanceTypes,
  readBalanceEntries = getBalanceEntries,
  writeCategories = restoreCategories,
  writeBalanceTypes = restoreBalanceTypes,
  writeBalanceTypeTombstones = restoreBalanceTypeTombstones,
  writeBalanceEntries = restoreBalanceEntries,
  writeBalanceEntryTombstones = restoreBalanceEntryTombstones,
  writeTransactions = restoreTransactions,
  writeTransactionTombstones = restoreTransactionTombstones,
  writeSettings = applyRemoteSettingsPreferences,
}: LocalRestoreDataTargetOptions = {}): LocalRestoreDataTarget {
  return {
    async hasLocalData() {
      const [categories, transactions, balanceTypes, balanceEntries] =
        await Promise.all([
          readCategories(),
          readTransactions(),
          readBalanceTypes(),
          readBalanceEntries(),
        ]);

      return (
        categories.length > 0 ||
        transactions.length > 0 ||
        balanceTypes.length > 0 ||
        balanceEntries.length > 0
      );
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

      const balanceTypes = payload.balanceTypes
        .filter(isActiveRemoteRow)
        .map(mapRemoteBalanceTypeToLocalInput);

      const balanceTypeTombstones = payload.balanceTypes
        .filter(isDeletedRemoteRow)
        .map(mapRemoteBalanceTypeTombstoneToLocalInput);

      const balanceEntries = payload.balanceEntries
        .filter(isActiveRemoteRow)
        .map(mapRemoteBalanceEntryToLocalInput);

      const balanceEntryTombstones = payload.balanceEntries
        .filter(isDeletedRemoteRow)
        .map(mapRemoteBalanceEntryTombstoneToLocalInput);
      const settings = (payload.settings ?? []).map(
        mapRemoteSettingToLocalInput,
      );

      const restoredCategoriesCount = await writeCategories(categories);
      const restoredActiveBalanceTypesCount =
        await writeBalanceTypes(balanceTypes);
      const restoredActiveTransactionsCount =
        await writeTransactions(transactions);
      const restoredActiveBalanceEntriesCount =
        await writeBalanceEntries(balanceEntries);
      const restoredTransactionTombstonesCount =
        await writeTransactionTombstones(transactionTombstones);
      const restoredBalanceTypeTombstonesCount =
        await writeBalanceTypeTombstones(balanceTypeTombstones);
      const restoredBalanceEntryTombstonesCount =
        await writeBalanceEntryTombstones(balanceEntryTombstones);
      const settingsResult = await writeSettings(settings);
      await notifyAppliedSettings(settingsResult);

      return {
        restoredTransactionsCount:
          restoredActiveTransactionsCount + restoredTransactionTombstonesCount,
        restoredCategoriesCount,
        restoredBalanceTypesCount:
          restoredActiveBalanceTypesCount + restoredBalanceTypeTombstonesCount,
        restoredBalanceEntriesCount:
          restoredActiveBalanceEntriesCount +
          restoredBalanceEntryTombstonesCount,
        ignoredSettingsCount: settingsResult.ignoredSettingsCount,
        restoredSettingsCount: settingsResult.restoredSettingsCount,
      } satisfies LocalRestoreWriteResult;
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

function isActiveRemoteRow(row: { deletedAt: string | null }) {
  return row.deletedAt === null;
}

function isDeletedRemoteRow(row: { deletedAt: string | null }) {
  return row.deletedAt !== null;
}
