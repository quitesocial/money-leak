import type {
  BackupPayload,
  RemoteBalanceEntry,
  RemoteBalanceType,
  RemoteBackupAdapter,
  RemoteCategory,
  RemoteSetting,
  RemoteTransaction,
} from '@/lib/sync/sync-types';

type FakeRemoteBackupAdapterOptions = {
  shouldFail?: boolean;
};

export type FakeRemoteBackupAdapter = RemoteBackupAdapter & {
  getTransactions: () => RemoteTransaction[];
  getCategories: () => RemoteCategory[];
  getBalanceTypes: () => RemoteBalanceType[];
  getBalanceEntries: () => RemoteBalanceEntry[];
  getSettings: () => RemoteSetting[];
  getWriteCount: () => number;
  setShouldFail: (shouldFail: boolean) => void;
};

export function createFakeRemoteBackupAdapter({
  shouldFail = false,
}: FakeRemoteBackupAdapterOptions = {}): FakeRemoteBackupAdapter {
  const transactionsByKey = new Map<string, RemoteTransaction>();
  const categoriesByKey = new Map<string, RemoteCategory>();
  const balanceTypesByKey = new Map<string, RemoteBalanceType>();
  const balanceEntriesByKey = new Map<string, RemoteBalanceEntry>();
  const settingsByKey = new Map<string, RemoteSetting>();
  let writeCount = 0;
  let isFailing = shouldFail;

  return {
    async writeBackup(payload: BackupPayload) {
      writeCount += 1;

      if (isFailing) {
        throw new Error('Fake remote backup failure.');
      }

      const userId = payload.userId.trim();

      if (!userId) {
        throw new Error('Remote backup payload requires a user id.');
      }

      for (const transaction of payload.transactions) {
        if (transaction.userId !== userId) {
          throw new Error('Remote transaction user id does not match payload.');
        }

        transactionsByKey.set(getUserOwnedKey(transaction), transaction);
      }

      for (const category of payload.categories) {
        if (category.userId !== userId) {
          throw new Error('Remote category user id does not match payload.');
        }

        categoriesByKey.set(getUserOwnedKey(category), category);
      }

      for (const balanceType of payload.balanceTypes) {
        if (balanceType.userId !== userId) {
          throw new Error(
            'Remote balance type user id does not match payload.',
          );
        }

        balanceTypesByKey.set(getUserOwnedKey(balanceType), balanceType);
      }

      for (const entry of payload.balanceEntries) {
        if (entry.userId !== userId) {
          throw new Error(
            'Remote balance entry user id does not match payload.',
          );
        }

        balanceEntriesByKey.set(getUserOwnedKey(entry), entry);
      }

      for (const setting of payload.settings ?? []) {
        if (setting.userId !== userId) {
          throw new Error('Remote setting user id does not match payload.');
        }

        settingsByKey.set(getUserOwnedSettingKey(setting), setting);
      }

      return {
        uploadedTransactionsCount: payload.transactions.length,
        uploadedCategoriesCount: payload.categories.length,
        uploadedBalanceTypesCount: payload.balanceTypes.length,
        uploadedBalanceEntriesCount: payload.balanceEntries.length,
        uploadedSettingsCount: payload.settings?.length ?? 0,
      };
    },
    getTransactions() {
      return [...transactionsByKey.values()];
    },
    getCategories() {
      return [...categoriesByKey.values()];
    },
    getBalanceTypes() {
      return [...balanceTypesByKey.values()];
    },
    getBalanceEntries() {
      return [...balanceEntriesByKey.values()];
    },
    getSettings() {
      return [...settingsByKey.values()];
    },
    getWriteCount() {
      return writeCount;
    },
    setShouldFail(nextShouldFail: boolean) {
      isFailing = nextShouldFail;
    },
  };
}

function getUserOwnedKey(row: { userId: string; id: string }) {
  return `${row.userId}\u0000${row.id}`;
}

function getUserOwnedSettingKey(row: { userId: string; key: string }) {
  return `${row.userId}\u0000${row.key}`;
}
