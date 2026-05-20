import type {
  BackupPayload,
  RemoteBackupAdapter,
  RemoteCategory,
  RemoteTransaction,
} from '@/lib/sync/sync-types';

type FakeRemoteBackupAdapterOptions = {
  shouldFail?: boolean;
};

export type FakeRemoteBackupAdapter = RemoteBackupAdapter & {
  getTransactions: () => RemoteTransaction[];
  getCategories: () => RemoteCategory[];
  getWriteCount: () => number;
  setShouldFail: (shouldFail: boolean) => void;
};

export function createFakeRemoteBackupAdapter({
  shouldFail = false,
}: FakeRemoteBackupAdapterOptions = {}): FakeRemoteBackupAdapter {
  const transactionsByKey = new Map<string, RemoteTransaction>();
  const categoriesByKey = new Map<string, RemoteCategory>();
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

      return {
        uploadedTransactionsCount: payload.transactions.length,
        uploadedCategoriesCount: payload.categories.length,
      };
    },
    getTransactions() {
      return [...transactionsByKey.values()];
    },
    getCategories() {
      return [...categoriesByKey.values()];
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
