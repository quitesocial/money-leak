import { parseRemoteTimestamp } from '@/lib/sync/sync-mappers';
import type {
  RemoteBalanceEntry,
  RemoteBalanceType,
  RemoteCategory,
  RemoteSyncAdapter,
  RemoteTransaction,
} from '@/lib/sync/sync-types';

type FakeRemoteSyncAdapterOptions = {
  balanceEntries?: RemoteBalanceEntry[];
  balanceTypes?: RemoteBalanceType[];
  categories?: RemoteCategory[];
  sessionUserId?: string | null;
  shouldFailPull?: boolean;
  shouldFailPush?: boolean;
  transactions?: RemoteTransaction[];
};

export type FakeRemoteSyncAdapter = RemoteSyncAdapter & {
  getBalanceEntries: () => RemoteBalanceEntry[];
  getBalanceTypes: () => RemoteBalanceType[];
  getCategories: () => RemoteCategory[];
  getTransactions: () => RemoteTransaction[];
  setSessionUserId: (userId: string | null) => void;
  setShouldFailPull: (shouldFail: boolean) => void;
  setShouldFailPush: (shouldFail: boolean) => void;
};

export function createFakeRemoteSyncAdapter({
  balanceEntries = [],
  balanceTypes = [],
  categories = [],
  sessionUserId = null,
  shouldFailPull = false,
  shouldFailPush = false,
  transactions = [],
}: FakeRemoteSyncAdapterOptions = {}): FakeRemoteSyncAdapter {
  const balanceEntriesByKey = new Map<string, RemoteBalanceEntry>();
  const balanceTypesByKey = new Map<string, RemoteBalanceType>();
  const categoriesByKey = new Map<string, RemoteCategory>();
  const transactionsByKey = new Map<string, RemoteTransaction>();
  let currentSessionUserId = sessionUserId;
  let isPullFailing = shouldFailPull;
  let isPushFailing = shouldFailPush;

  for (const balanceType of balanceTypes) {
    balanceTypesByKey.set(getUserOwnedKey(balanceType), balanceType);
  }

  for (const balanceEntry of balanceEntries) {
    balanceEntriesByKey.set(getUserOwnedKey(balanceEntry), balanceEntry);
  }

  for (const category of categories) {
    categoriesByKey.set(getUserOwnedKey(category), category);
  }

  for (const transaction of transactions) {
    transactionsByKey.set(getUserOwnedKey(transaction), transaction);
  }

  return {
    async getAuthenticatedUserId() {
      return currentSessionUserId;
    },

    async pullChanges({ userId, since }) {
      if (isPullFailing) throw new Error('Fake remote pull failure.');

      return {
        categories: getRowsSince({
          rows: [...categoriesByKey.values()].filter(
            (category) => category.userId === userId,
          ),
          since,
        }),
        transactions: getRowsSince({
          rows: [...transactionsByKey.values()].filter(
            (transaction) => transaction.userId === userId,
          ),
          since,
        }),
        balanceTypes: getRowsSince({
          rows: [...balanceTypesByKey.values()].filter(
            (balanceType) => balanceType.userId === userId,
          ),
          since,
        }),
        balanceEntries: getRowsSince({
          rows: [...balanceEntriesByKey.values()].filter(
            (balanceEntry) => balanceEntry.userId === userId,
          ),
          since,
        }),
      };
    },

    async pushChanges({
      balanceEntries,
      balanceTypes,
      categories,
      transactions,
    }) {
      if (isPushFailing) throw new Error('Fake remote push failure.');

      for (const category of categories) {
        categoriesByKey.set(getUserOwnedKey(category), category);
      }

      for (const balanceType of balanceTypes) {
        balanceTypesByKey.set(getUserOwnedKey(balanceType), balanceType);
      }

      for (const transaction of transactions) {
        transactionsByKey.set(getUserOwnedKey(transaction), transaction);
      }

      for (const balanceEntry of balanceEntries) {
        balanceEntriesByKey.set(getUserOwnedKey(balanceEntry), balanceEntry);
      }

      return {
        pushedTransactionsCount: transactions.length,
        pushedCategoriesCount: categories.length,
        pushedBalanceTypesCount: balanceTypes.length,
        pushedBalanceEntriesCount: balanceEntries.length,
      };
    },

    getBalanceEntries() {
      return [...balanceEntriesByKey.values()];
    },

    getBalanceTypes() {
      return [...balanceTypesByKey.values()];
    },

    getCategories() {
      return [...categoriesByKey.values()];
    },

    getTransactions() {
      return [...transactionsByKey.values()];
    },

    setSessionUserId(userId: string | null) {
      currentSessionUserId = userId;
    },

    setShouldFailPull(shouldFail: boolean) {
      isPullFailing = shouldFail;
    },

    setShouldFailPush(shouldFail: boolean) {
      isPushFailing = shouldFail;
    },
  };
}

function getRowsSince<
  T extends { deletedAt: string | null; updatedAt: string },
>({ rows, since }: { rows: T[]; since: number | null }) {
  if (since === null) return rows;

  return rows.filter((row) => {
    const updatedAt = parseRemoteTimestamp(row.updatedAt);
    const deletedAt =
      row.deletedAt === null ? null : parseRemoteTimestamp(row.deletedAt);
    const effectiveTimestamp =
      deletedAt === null ? updatedAt : Math.max(updatedAt, deletedAt);

    return effectiveTimestamp > since;
  });
}

function getUserOwnedKey(row: { userId: string; id: string }) {
  return `${row.userId}\u0000${row.id}`;
}
