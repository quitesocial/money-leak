import { describe, expect, it, jest } from '@jest/globals';

import { createFakeRemoteSyncAdapter } from '@/lib/sync/fake-remote-sync-adapter';
import type { LocalSyncDataSource } from '@/lib/sync/local-sync-data-source';
import { createSyncService } from '@/lib/sync/sync-service';
import type {
  LocalSyncDataTarget,
  LocalSyncMetadataStore,
  RemoteBalanceEntry,
  RemoteBalanceType,
  RemoteCategory,
  RemoteSyncAdapter,
  RemoteSyncChanges,
  RemoteTransaction,
  SyncAttemptSource,
  SyncAuthContext,
  SyncMetadata,
  SyncService,
  SyncSummary,
} from '@/lib/sync/sync-types';
import type { BalanceEntry, BalanceType } from '@/types/balance';
import type { Category } from '@/types/category';
import type { Transaction } from '@/types/transaction';

jest.mock('@/db/categories', () => ({
  applyCategorySyncChanges: jest.fn(),
  getCategories: jest.fn(),
}));

jest.mock('@/db/balance', () => ({
  applyBalanceSyncChanges: jest.fn(),
  getBalanceEntriesForBackup: jest.fn(),
  getBalanceTypesForBackup: jest.fn(),
}));

jest.mock('@/db/transactions', () => ({
  applyTransactionSyncChanges: jest.fn(),
  getTransactionsForBackup: jest.fn(),
}));

jest.mock('@/db/sync-status', () => ({
  getSyncMetadata: jest.fn(),
  recordSyncFailure: jest.fn(),
  recordSyncSuccess: jest.fn(),
}));

const TEST_USER_ID = 'auth-user-test';
const TEST_NOW = Date.parse('2026-05-21T12:00:00.000Z');
const TEST_CURSOR = Date.parse('2026-05-20T12:00:00.000Z');
const RAW_FAILURE =
  'raw backend failure access_token refresh_token localOwnerId';

function createDeferred<T>() {
  let resolve: (value: T) => void = () => {};
  let reject: (reason?: unknown) => void = () => {};

  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return {
    promise,
    reject,
    resolve,
  };
}

function runManualIncrementalSync(
  service: SyncService,
  input: { auth: SyncAuthContext },
) {
  return service.runIncrementalSync({
    ...input,
    source: 'manual',
  });
}

function createTransaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'txn-1',
    ownerId: TEST_USER_ID,
    amount: 12.5,
    category: 'coffee',
    isLeak: true,
    leakReason: 'impulse',
    note: 'Too easy',
    createdAt: Date.parse('2026-05-19T10:00:00.000Z'),
    updatedAt: Date.parse('2026-05-21T10:05:00.000Z'),
    deletedAt: null,
    schemaVersion: 1,
    sourceDeviceId: 'device_test',
    ...overrides,
  };
}

function createCategory(overrides: Partial<Category> = {}): Category {
  return {
    id: 'coffee',
    ownerId: TEST_USER_ID,
    name: 'Coffee',
    iconName: 'tag',
    createdAt: Date.parse('2026-05-18T09:00:00.000Z'),
    updatedAt: Date.parse('2026-05-21T09:30:00.000Z'),
    isDefault: false,
    isArchived: false,
    deletedAt: null,
    schemaVersion: 1,
    sourceDeviceId: 'device_test',
    sortOrder: 10,
    ...overrides,
  };
}

function createBalanceType(overrides: Partial<BalanceType> = {}): BalanceType {
  return {
    id: 'income',
    ownerId: TEST_USER_ID,
    name: 'Income',
    createdAt: Date.parse('2026-05-18T08:00:00.000Z'),
    updatedAt: Date.parse('2026-05-21T08:30:00.000Z'),
    isDefault: true,
    isArchived: false,
    deletedAt: null,
    schemaVersion: 1,
    sourceDeviceId: 'device_test',
    sortOrder: 0,
    ...overrides,
  };
}

function createBalanceEntry(
  overrides: Partial<BalanceEntry> = {},
): BalanceEntry {
  return {
    id: 'balance-entry-1',
    ownerId: TEST_USER_ID,
    amount: 100,
    typeId: 'income',
    createdAt: Date.parse('2026-05-19T08:00:00.000Z'),
    updatedAt: Date.parse('2026-05-21T08:30:00.000Z'),
    deletedAt: null,
    schemaVersion: 1,
    sourceDeviceId: 'device_test',
    ...overrides,
  };
}

function createRemoteTransaction(
  overrides: Partial<RemoteTransaction> = {},
): RemoteTransaction {
  return {
    id: 'txn-1',
    userId: TEST_USER_ID,
    amount: 12.5,
    categoryId: 'coffee',
    isLeak: true,
    leakReason: 'impulse',
    note: 'Too easy',
    createdAt: '2026-05-19T10:00:00.000Z',
    updatedAt: '2026-05-21T10:05:00.000Z',
    deletedAt: null,
    schemaVersion: 1,
    sourceDeviceId: 'device_test',
    ...overrides,
  };
}

function createRemoteCategory(
  overrides: Partial<RemoteCategory> = {},
): RemoteCategory {
  return {
    id: 'coffee',
    userId: TEST_USER_ID,
    name: 'Coffee',
    isDefault: false,
    isArchived: false,
    sortOrder: 10,
    createdAt: '2026-05-18T09:00:00.000Z',
    updatedAt: '2026-05-21T09:30:00.000Z',
    deletedAt: null,
    schemaVersion: 1,
    sourceDeviceId: 'device_test',
    ...overrides,
  };
}

function createRemoteBalanceType(
  overrides: Partial<RemoteBalanceType> = {},
): RemoteBalanceType {
  return {
    id: 'income',
    userId: TEST_USER_ID,
    name: 'Income',
    isDefault: true,
    isArchived: false,
    sortOrder: 0,
    createdAt: '2026-05-18T08:00:00.000Z',
    updatedAt: '2026-05-21T08:30:00.000Z',
    deletedAt: null,
    schemaVersion: 1,
    sourceDeviceId: 'device_test',
    ...overrides,
  };
}

function createRemoteBalanceEntry(
  overrides: Partial<RemoteBalanceEntry> = {},
): RemoteBalanceEntry {
  return {
    id: 'balance-entry-1',
    userId: TEST_USER_ID,
    amount: 100,
    typeId: 'income',
    createdAt: '2026-05-19T08:00:00.000Z',
    updatedAt: '2026-05-21T08:30:00.000Z',
    deletedAt: null,
    schemaVersion: 1,
    sourceDeviceId: 'device_test',
    ...overrides,
  };
}

function createDataSource({
  balanceEntries = [],
  balanceTypes = [],
  categories = [],
  shouldFail = false,
  transactions = [],
}: {
  balanceEntries?: BalanceEntry[];
  balanceTypes?: BalanceType[];
  categories?: Category[];
  shouldFail?: boolean;
  transactions?: Transaction[];
} = {}): LocalSyncDataSource & {
  getSyncData: jest.MockedFunction<LocalSyncDataSource['getSyncData']>;
} {
  return {
    getSyncData: jest.fn(async () => {
      if (shouldFail) throw new Error(RAW_FAILURE);

      return {
        balanceEntries,
        balanceTypes,
        categories,
        transactions,
      };
    }),
  };
}

function createDataTarget({
  shouldFail = false,
}: {
  shouldFail?: boolean;
} = {}): LocalSyncDataTarget & {
  appliedChanges: RemoteSyncChanges[];
  applyRemoteChanges: jest.MockedFunction<
    LocalSyncDataTarget['applyRemoteChanges']
  >;
} {
  const appliedChanges: RemoteSyncChanges[] = [];

  return {
    appliedChanges,
    applyRemoteChanges: jest.fn(async (changes) => {
      if (shouldFail) throw new Error(RAW_FAILURE);

      appliedChanges.push(changes);

      return {
        appliedTransactionsCount: changes.transactions.length,
        appliedCategoriesCount: changes.categories.length,
        appliedBalanceTypesCount: changes.balanceTypes.length,
        appliedBalanceEntriesCount: changes.balanceEntries.length,
      };
    }),
  };
}

function createMetadataStore({
  initialMetadata = {
    lastSuccessfulSyncAt: TEST_CURSOR,
    lastSyncErrorAt: null,
    lastSyncSummary: null,
    lastSuccessfulSyncSource: null,
  },
  shouldFailRead = false,
  shouldFailWrite = false,
}: {
  initialMetadata?: SyncMetadata;
  shouldFailRead?: boolean;
  shouldFailWrite?: boolean;
} = {}): LocalSyncMetadataStore & {
  failures: number[];
  successes: { source: SyncAttemptSource; summary: SyncSummary }[];
} {
  const metadata = { ...initialMetadata };
  const failures: number[] = [];
  const successes: { source: SyncAttemptSource; summary: SyncSummary }[] = [];

  return {
    failures,
    successes,
    async getMetadata() {
      if (shouldFailRead) throw new Error(RAW_FAILURE);

      return metadata;
    },
    async recordFailure(timestamp) {
      failures.push(timestamp);
      metadata.lastSyncErrorAt = timestamp;
    },
    async recordSuccess({ source, summary }) {
      if (shouldFailWrite) throw new Error(RAW_FAILURE);

      successes.push({ source, summary });
      metadata.lastSuccessfulSyncAt = summary.cursor;
      metadata.lastSyncSummary = summary;
      metadata.lastSuccessfulSyncSource = source;
    },
  };
}

function createService({
  dataSource = createDataSource(),
  dataTarget = createDataTarget(),
  isSyncEnabled = true,
  metadataStore = createMetadataStore(),
  remoteAdapter = createFakeRemoteSyncAdapter({
    sessionUserId: TEST_USER_ID,
  }),
}: {
  dataSource?: LocalSyncDataSource;
  dataTarget?: LocalSyncDataTarget;
  isSyncEnabled?: boolean;
  metadataStore?: LocalSyncMetadataStore;
  remoteAdapter?: RemoteSyncAdapter;
} = {}) {
  return createSyncService({
    dataSource,
    dataTarget,
    isSyncEnabled,
    metadataStore,
    now: () => TEST_NOW,
    remoteAdapter,
  });
}

describe('incremental sync service', () => {
  it('skips safely when the feature flag is disabled', async () => {
    const dataSource = createDataSource();
    const metadataStore = createMetadataStore();
    const service = createService({
      dataSource,
      isSyncEnabled: false,
      metadataStore,
    });

    await expect(
      runManualIncrementalSync(service, {
        auth: {
          status: 'authenticated',
          userId: TEST_USER_ID,
        },
      }),
    ).resolves.toEqual({
      status: 'skipped',
      skippedReason: 'sync_disabled',
      isRecoverable: true,
    });
    expect(dataSource.getSyncData).not.toHaveBeenCalled();
    expect(metadataStore.failures).toEqual([]);
    expect(metadataStore.successes).toEqual([]);
  });

  it('skips safely for guest mode, missing user id, missing session, and mismatched session', async () => {
    const remoteAdapter = createFakeRemoteSyncAdapter({
      sessionUserId: null,
    });
    const metadataStore = createMetadataStore();
    const service = createService({ metadataStore, remoteAdapter });

    await expect(
      runManualIncrementalSync(service, {
        auth: {
          status: 'guest',
          userId: null,
        },
      }),
    ).resolves.toMatchObject({
      status: 'skipped',
      skippedReason: 'guest_mode',
    });

    await expect(
      runManualIncrementalSync(service, {
        auth: {
          status: 'authenticated',
          userId: '   ',
        },
      }),
    ).resolves.toMatchObject({
      status: 'skipped',
      skippedReason: 'missing_user_id',
    });

    await expect(
      runManualIncrementalSync(service, {
        auth: {
          status: 'authenticated',
          userId: TEST_USER_ID,
        },
      }),
    ).resolves.toMatchObject({
      status: 'skipped',
      skippedReason: 'missing_session',
    });

    remoteAdapter.setSessionUserId('other-user');

    await expect(
      runManualIncrementalSync(service, {
        auth: {
          status: 'authenticated',
          userId: TEST_USER_ID,
        },
      }),
    ).resolves.toMatchObject({
      status: 'skipped',
      skippedReason: 'session_user_mismatch',
    });
    expect(metadataStore.failures).toEqual([]);
    expect(metadataStore.successes).toEqual([]);
  });

  it('pulls remote-only active transactions and categories into local apply', async () => {
    const remoteAdapter = createFakeRemoteSyncAdapter({
      categories: [createRemoteCategory()],
      sessionUserId: TEST_USER_ID,
      transactions: [createRemoteTransaction()],
    });
    const dataTarget = createDataTarget();
    const service = createService({
      dataSource: createDataSource(),
      dataTarget,
      metadataStore: createMetadataStore({
        initialMetadata: {
          lastSuccessfulSyncAt: null,
          lastSyncErrorAt: null,
          lastSyncSummary: null,
          lastSuccessfulSyncSource: null,
        },
      }),
      remoteAdapter,
    });

    const result = await runManualIncrementalSync(service, {
      auth: {
        status: 'authenticated',
        userId: TEST_USER_ID,
      },
    });

    expect(result).toMatchObject({
      status: 'succeeded',
      pulledTransactionsCount: 1,
      pulledCategoriesCount: 1,
      appliedTransactionsCount: 1,
      appliedCategoriesCount: 1,
      pushedTransactionsCount: 0,
      pushedCategoriesCount: 0,
      conflictsCount: 0,
    });
    expect(dataTarget.appliedChanges).toEqual([
      {
        balanceEntries: [],
        balanceTypes: [],
        categories: [expect.objectContaining({ id: 'coffee' })],
        transactions: [expect.objectContaining({ id: 'txn-1' })],
      },
    ]);
  });

  it('applies matching remote transaction tombstones and ignores orphan tombstones', async () => {
    const remoteAdapter = createFakeRemoteSyncAdapter({
      sessionUserId: TEST_USER_ID,
      transactions: [
        createRemoteTransaction({
          id: 'txn-delete-me',
          updatedAt: '2026-05-21T11:00:00.000Z',
          deletedAt: '2026-05-21T11:00:00.000Z',
        }),
        createRemoteTransaction({
          id: 'txn-missing',
          updatedAt: '2026-05-21T11:30:00.000Z',
          deletedAt: '2026-05-21T11:30:00.000Z',
        }),
      ],
    });
    const dataTarget = createDataTarget();
    const service = createService({
      dataSource: createDataSource({
        transactions: [
          createTransaction({
            id: 'txn-delete-me',
            updatedAt: Date.parse('2026-05-21T10:00:00.000Z'),
          }),
        ],
      }),
      dataTarget,
      remoteAdapter,
    });

    const result = await runManualIncrementalSync(service, {
      auth: {
        status: 'authenticated',
        userId: TEST_USER_ID,
      },
    });

    expect(result).toMatchObject({
      status: 'succeeded',
      appliedTransactionsCount: 1,
      ignoredTransactionTombstonesCount: 1,
    });
    expect(dataTarget.appliedChanges[0].transactions).toEqual([
      expect.objectContaining({
        id: 'txn-delete-me',
        deletedAt: '2026-05-21T11:00:00.000Z',
      }),
    ]);
  });

  it('pushes local new and deleted transactions plus archived categories', async () => {
    const remoteAdapter = createFakeRemoteSyncAdapter({
      sessionUserId: TEST_USER_ID,
    });
    const service = createService({
      dataSource: createDataSource({
        categories: [
          createCategory({
            id: 'coffee',
            isArchived: true,
          }),
        ],
        transactions: [
          createTransaction({
            id: 'txn-local-new',
            amount: 4,
          }),
          createTransaction({
            id: 'txn-local-deleted',
            updatedAt: Date.parse('2026-05-21T10:15:00.000Z'),
            deletedAt: Date.parse('2026-05-21T10:15:00.000Z'),
          }),
        ],
      }),
      remoteAdapter,
    });

    const result = await runManualIncrementalSync(service, {
      auth: {
        status: 'authenticated',
        userId: TEST_USER_ID,
      },
    });

    expect(result).toMatchObject({
      status: 'succeeded',
      pushedTransactionsCount: 2,
      pushedCategoriesCount: 1,
    });
    expect(remoteAdapter.getTransactions()).toEqual([
      expect.objectContaining({
        id: 'txn-local-new',
        deletedAt: null,
      }),
      expect.objectContaining({
        id: 'txn-local-deleted',
        deletedAt: '2026-05-21T10:15:00.000Z',
      }),
    ]);
    expect(remoteAdapter.getCategories()).toEqual([
      expect.objectContaining({
        id: 'coffee',
        isArchived: true,
      }),
    ]);
  });

  it('pulls, applies, and pushes balance changes with aggregate counts only', async () => {
    const remoteAdapter = createFakeRemoteSyncAdapter({
      balanceEntries: [
        createRemoteBalanceEntry({
          id: 'remote-balance-entry',
          typeId: 'remote-income',
        }),
      ],
      balanceTypes: [
        createRemoteBalanceType({
          id: 'remote-income',
          name: 'Remote Income',
        }),
      ],
      sessionUserId: TEST_USER_ID,
    });
    const dataTarget = createDataTarget();
    const service = createService({
      dataSource: createDataSource({
        balanceEntries: [
          createBalanceEntry({
            id: 'local-balance-entry',
            typeId: 'local-income',
          }),
        ],
        balanceTypes: [
          createBalanceType({
            id: 'local-income',
            name: 'Local Income',
          }),
        ],
      }),
      dataTarget,
      metadataStore: createMetadataStore({
        initialMetadata: {
          lastSuccessfulSyncAt: null,
          lastSyncErrorAt: null,
          lastSyncSummary: null,
          lastSuccessfulSyncSource: null,
        },
      }),
      remoteAdapter,
    });

    const result = await runManualIncrementalSync(service, {
      auth: {
        status: 'authenticated',
        userId: TEST_USER_ID,
      },
    });

    expect(result).toMatchObject({
      status: 'succeeded',
      pulledBalanceTypesCount: 1,
      pulledBalanceEntriesCount: 1,
      appliedBalanceTypesCount: 1,
      appliedBalanceEntriesCount: 1,
      pushedBalanceTypesCount: 1,
      pushedBalanceEntriesCount: 1,
    });
    expect(dataTarget.appliedChanges[0]).toMatchObject({
      balanceTypes: [expect.objectContaining({ id: 'remote-income' })],
      balanceEntries: [expect.objectContaining({ id: 'remote-balance-entry' })],
    });
    expect(remoteAdapter.getBalanceTypes()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'remote-income' }),
        expect.objectContaining({ id: 'local-income' }),
      ]),
    );
    expect(remoteAdapter.getBalanceEntries()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'remote-balance-entry' }),
        expect.objectContaining({ id: 'local-balance-entry' }),
      ]),
    );
    expect(JSON.stringify(result)).not.toContain('local-balance-entry');
  });

  it('applies matching remote balance tombstones and ignores orphan balance tombstones', async () => {
    const remoteAdapter = createFakeRemoteSyncAdapter({
      balanceEntries: [
        createRemoteBalanceEntry({
          id: 'balance-delete-me',
          updatedAt: '2026-05-21T11:00:00.000Z',
          deletedAt: '2026-05-21T11:00:00.000Z',
        }),
        createRemoteBalanceEntry({
          id: 'balance-missing',
          updatedAt: '2026-05-21T11:30:00.000Z',
          deletedAt: '2026-05-21T11:30:00.000Z',
        }),
      ],
      balanceTypes: [
        createRemoteBalanceType({
          id: 'type-delete-me',
          updatedAt: '2026-05-21T11:00:00.000Z',
          deletedAt: '2026-05-21T11:00:00.000Z',
        }),
        createRemoteBalanceType({
          id: 'type-missing',
          updatedAt: '2026-05-21T11:30:00.000Z',
          deletedAt: '2026-05-21T11:30:00.000Z',
        }),
      ],
      sessionUserId: TEST_USER_ID,
    });
    const dataTarget = createDataTarget();
    const service = createService({
      dataSource: createDataSource({
        balanceEntries: [
          createBalanceEntry({
            id: 'balance-delete-me',
            updatedAt: Date.parse('2026-05-21T10:00:00.000Z'),
          }),
        ],
        balanceTypes: [
          createBalanceType({
            id: 'type-delete-me',
            updatedAt: Date.parse('2026-05-21T10:00:00.000Z'),
          }),
        ],
      }),
      dataTarget,
      remoteAdapter,
    });

    const result = await runManualIncrementalSync(service, {
      auth: {
        status: 'authenticated',
        userId: TEST_USER_ID,
      },
    });

    expect(result).toMatchObject({
      status: 'succeeded',
      appliedBalanceTypesCount: 1,
      appliedBalanceEntriesCount: 1,
      ignoredBalanceTypeTombstonesCount: 1,
      ignoredBalanceEntryTombstonesCount: 1,
    });
    expect(dataTarget.appliedChanges[0].balanceTypes).toEqual([
      expect.objectContaining({
        id: 'type-delete-me',
        deletedAt: '2026-05-21T11:00:00.000Z',
      }),
    ]);
    expect(dataTarget.appliedChanges[0].balanceEntries).toEqual([
      expect.objectContaining({
        id: 'balance-delete-me',
        deletedAt: '2026-05-21T11:00:00.000Z',
      }),
    ]);
  });

  it('does not duplicate remote rows on repeated sync', async () => {
    const remoteAdapter = createFakeRemoteSyncAdapter({
      sessionUserId: TEST_USER_ID,
    });
    const metadataStore = createMetadataStore({
      initialMetadata: {
        lastSuccessfulSyncAt: null,
        lastSyncErrorAt: null,
        lastSyncSummary: null,
        lastSuccessfulSyncSource: null,
      },
    });
    const service = createService({
      dataSource: createDataSource({
        transactions: [createTransaction()],
      }),
      metadataStore,
      remoteAdapter,
    });

    await runManualIncrementalSync(service, {
      auth: {
        status: 'authenticated',
        userId: TEST_USER_ID,
      },
    });
    const secondResult = await runManualIncrementalSync(service, {
      auth: {
        status: 'authenticated',
        userId: TEST_USER_ID,
      },
    });

    expect(remoteAdapter.getTransactions()).toHaveLength(1);
    expect(secondResult).toMatchObject({
      status: 'succeeded',
      pulledTransactionsCount: 0,
      pushedTransactionsCount: 0,
    });
  });

  it('does not reapply already-pulled remote rows on repeated sync', async () => {
    const remoteAdapter = createFakeRemoteSyncAdapter({
      sessionUserId: TEST_USER_ID,
      transactions: [createRemoteTransaction()],
    });
    const dataTarget = createDataTarget();
    const metadataStore = createMetadataStore({
      initialMetadata: {
        lastSuccessfulSyncAt: null,
        lastSyncErrorAt: null,
        lastSyncSummary: null,
        lastSuccessfulSyncSource: null,
      },
    });
    const service = createService({
      dataSource: createDataSource(),
      dataTarget,
      metadataStore,
      remoteAdapter,
    });

    const firstResult = await runManualIncrementalSync(service, {
      auth: {
        status: 'authenticated',
        userId: TEST_USER_ID,
      },
    });
    const secondResult = await runManualIncrementalSync(service, {
      auth: {
        status: 'authenticated',
        userId: TEST_USER_ID,
      },
    });

    expect(firstResult).toMatchObject({
      status: 'succeeded',
      pulledTransactionsCount: 1,
      appliedTransactionsCount: 1,
    });
    expect(secondResult).toMatchObject({
      status: 'succeeded',
      pulledTransactionsCount: 0,
      appliedTransactionsCount: 0,
    });
    expect(dataTarget.appliedChanges).toEqual([
      {
        balanceEntries: [],
        balanceTypes: [],
        categories: [],
        transactions: [expect.objectContaining({ id: 'txn-1' })],
      },
      {
        balanceEntries: [],
        balanceTypes: [],
        categories: [],
        transactions: [],
      },
    ]);
    expect(metadataStore.successes).toHaveLength(2);
  });

  it('shares one in-flight sync operation for overlapping service calls', async () => {
    const deferredData = createDeferred<{
      balanceEntries: BalanceEntry[];
      balanceTypes: BalanceType[];
      categories: Category[];
      transactions: Transaction[];
    }>();
    const dataSource: LocalSyncDataSource & {
      getSyncData: jest.MockedFunction<LocalSyncDataSource['getSyncData']>;
    } = {
      getSyncData: jest.fn(() => deferredData.promise),
    };
    const metadataStore = createMetadataStore({
      initialMetadata: {
        lastSuccessfulSyncAt: null,
        lastSyncErrorAt: null,
        lastSyncSummary: null,
        lastSuccessfulSyncSource: null,
      },
    });
    const remoteAdapter = createFakeRemoteSyncAdapter({
      sessionUserId: TEST_USER_ID,
    });
    const service = createService({
      dataSource,
      metadataStore,
      remoteAdapter,
    });
    const input = {
      auth: {
        status: 'authenticated' as const,
        userId: TEST_USER_ID,
      },
    };

    const firstSync = runManualIncrementalSync(service, input);
    const secondSync = runManualIncrementalSync(service, input);

    expect(secondSync).toBe(firstSync);

    deferredData.resolve({
      balanceEntries: [],
      balanceTypes: [],
      categories: [createCategory()],
      transactions: [createTransaction()],
    });

    const [firstResult, secondResult] = await Promise.all([
      firstSync,
      secondSync,
    ]);

    expect(firstResult).toMatchObject({
      status: 'succeeded',
      pushedTransactionsCount: 1,
      pushedCategoriesCount: 1,
    });
    expect(secondResult).toEqual(firstResult);
    expect(dataSource.getSyncData).toHaveBeenCalledTimes(1);
    expect(remoteAdapter.getTransactions()).toHaveLength(1);
    expect(remoteAdapter.getCategories()).toHaveLength(1);
    expect(metadataStore.successes).toHaveLength(1);
  });

  it('reports whether incremental sync is in flight', async () => {
    const deferredData = createDeferred<{
      balanceEntries: BalanceEntry[];
      balanceTypes: BalanceType[];
      categories: Category[];
      transactions: Transaction[];
    }>();
    const dataSource: LocalSyncDataSource = {
      getSyncData: jest.fn(() => deferredData.promise),
    };
    const service = createService({
      dataSource,
    });

    const syncPromise = runManualIncrementalSync(service, {
      auth: {
        status: 'authenticated',
        userId: TEST_USER_ID,
      },
    });

    expect(service.isIncrementalSyncInFlight()).toBe(true);

    deferredData.resolve({
      balanceEntries: [],
      balanceTypes: [],
      categories: [],
      transactions: [],
    });

    await syncPromise;

    expect(service.isIncrementalSyncInFlight()).toBe(false);
  });

  it('uses LWW when the local active transaction is newer than the remote active row', async () => {
    const remoteAdapter = createFakeRemoteSyncAdapter({
      sessionUserId: TEST_USER_ID,
      transactions: [
        createRemoteTransaction({
          amount: 20,
          updatedAt: '2026-05-21T10:00:00.000Z',
        }),
      ],
    });
    const dataTarget = createDataTarget();
    const service = createService({
      dataSource: createDataSource({
        transactions: [
          createTransaction({
            amount: 10,
            updatedAt: Date.parse('2026-05-21T11:00:00.000Z'),
          }),
        ],
      }),
      dataTarget,
      remoteAdapter,
    });

    const result = await runManualIncrementalSync(service, {
      auth: {
        status: 'authenticated',
        userId: TEST_USER_ID,
      },
    });

    expect(result).toMatchObject({
      status: 'succeeded',
      appliedTransactionsCount: 0,
      pushedTransactionsCount: 1,
      conflictsCount: 1,
    });
    expect(dataTarget.appliedChanges[0].transactions).toEqual([]);
    expect(remoteAdapter.getTransactions()).toEqual([
      expect.objectContaining({
        amount: 10,
        updatedAt: '2026-05-21T11:00:00.000Z',
      }),
    ]);
  });

  it('uses LWW when the remote active transaction is newer than the local active row', async () => {
    const remoteAdapter = createFakeRemoteSyncAdapter({
      sessionUserId: TEST_USER_ID,
      transactions: [
        createRemoteTransaction({
          amount: 20,
          updatedAt: '2026-05-21T11:00:00.000Z',
        }),
      ],
    });
    const dataTarget = createDataTarget();
    const service = createService({
      dataSource: createDataSource({
        transactions: [
          createTransaction({
            amount: 10,
            updatedAt: Date.parse('2026-05-21T10:00:00.000Z'),
          }),
        ],
      }),
      dataTarget,
      remoteAdapter,
    });

    const result = await runManualIncrementalSync(service, {
      auth: {
        status: 'authenticated',
        userId: TEST_USER_ID,
      },
    });

    expect(result).toMatchObject({
      status: 'succeeded',
      appliedTransactionsCount: 1,
      pushedTransactionsCount: 0,
      conflictsCount: 1,
    });
    expect(dataTarget.appliedChanges[0].transactions).toEqual([
      expect.objectContaining({
        amount: 20,
      }),
    ]);
    expect(remoteAdapter.getTransactions()).toEqual([
      expect.objectContaining({
        amount: 20,
      }),
    ]);
  });

  it('keeps local data on equal timestamp conflicts and pushes local winner', async () => {
    const remoteAdapter = createFakeRemoteSyncAdapter({
      sessionUserId: TEST_USER_ID,
      transactions: [
        createRemoteTransaction({
          amount: 20,
          updatedAt: '2026-05-21T10:00:00.000Z',
        }),
      ],
    });
    const service = createService({
      dataSource: createDataSource({
        transactions: [
          createTransaction({
            amount: 10,
            updatedAt: Date.parse('2026-05-21T10:00:00.000Z'),
          }),
        ],
      }),
      remoteAdapter,
    });

    const result = await runManualIncrementalSync(service, {
      auth: {
        status: 'authenticated',
        userId: TEST_USER_ID,
      },
    });

    expect(result).toMatchObject({
      status: 'succeeded',
      appliedTransactionsCount: 0,
      pushedTransactionsCount: 1,
      conflictsCount: 1,
    });
    expect(remoteAdapter.getTransactions()).toEqual([
      expect.objectContaining({
        amount: 10,
      }),
    ]);
  });

  it('pushes a newer local transaction tombstone over a remote active row', async () => {
    const remoteAdapter = createFakeRemoteSyncAdapter({
      sessionUserId: TEST_USER_ID,
      transactions: [
        createRemoteTransaction({
          id: 'txn-delete-local',
          updatedAt: '2026-05-21T10:00:00.000Z',
          deletedAt: null,
        }),
      ],
    });
    const dataTarget = createDataTarget();
    const service = createService({
      dataSource: createDataSource({
        transactions: [
          createTransaction({
            id: 'txn-delete-local',
            updatedAt: Date.parse('2026-05-21T11:30:00.000Z'),
            deletedAt: Date.parse('2026-05-21T11:30:00.000Z'),
          }),
        ],
      }),
      dataTarget,
      remoteAdapter,
    });

    const result = await runManualIncrementalSync(service, {
      auth: {
        status: 'authenticated',
        userId: TEST_USER_ID,
      },
    });

    expect(result).toMatchObject({
      status: 'succeeded',
      appliedTransactionsCount: 0,
      pushedTransactionsCount: 1,
      conflictsCount: 1,
    });
    expect(dataTarget.appliedChanges[0].transactions).toEqual([]);
    expect(remoteAdapter.getTransactions()).toEqual([
      expect.objectContaining({
        id: 'txn-delete-local',
        deletedAt: '2026-05-21T11:30:00.000Z',
      }),
    ]);
  });

  it('applies a newer remote transaction tombstone over a local active row', async () => {
    const remoteAdapter = createFakeRemoteSyncAdapter({
      sessionUserId: TEST_USER_ID,
      transactions: [
        createRemoteTransaction({
          id: 'txn-delete-remote',
          updatedAt: '2026-05-21T11:30:00.000Z',
          deletedAt: '2026-05-21T11:30:00.000Z',
        }),
      ],
    });
    const dataTarget = createDataTarget();
    const service = createService({
      dataSource: createDataSource({
        transactions: [
          createTransaction({
            id: 'txn-delete-remote',
            updatedAt: Date.parse('2026-05-21T10:00:00.000Z'),
            deletedAt: null,
          }),
        ],
      }),
      dataTarget,
      remoteAdapter,
    });

    const result = await runManualIncrementalSync(service, {
      auth: {
        status: 'authenticated',
        userId: TEST_USER_ID,
      },
    });

    expect(result).toMatchObject({
      status: 'succeeded',
      appliedTransactionsCount: 1,
      pushedTransactionsCount: 0,
      conflictsCount: 1,
    });
    expect(dataTarget.appliedChanges[0].transactions).toEqual([
      expect.objectContaining({
        id: 'txn-delete-remote',
        deletedAt: '2026-05-21T11:30:00.000Z',
      }),
    ]);
  });

  it('ignores remote transaction tombstones with no local matching row', async () => {
    const remoteAdapter = createFakeRemoteSyncAdapter({
      sessionUserId: TEST_USER_ID,
      transactions: [
        createRemoteTransaction({
          id: 'txn-orphan-tombstone',
          updatedAt: '2026-05-21T11:30:00.000Z',
          deletedAt: '2026-05-21T11:30:00.000Z',
        }),
      ],
    });
    const dataTarget = createDataTarget();
    const service = createService({
      dataSource: createDataSource(),
      dataTarget,
      remoteAdapter,
    });

    const result = await runManualIncrementalSync(service, {
      auth: {
        status: 'authenticated',
        userId: TEST_USER_ID,
      },
    });

    expect(result).toMatchObject({
      status: 'succeeded',
      appliedTransactionsCount: 0,
      pushedTransactionsCount: 0,
      ignoredTransactionTombstonesCount: 1,
      conflictsCount: 0,
    });
    expect(dataTarget.appliedChanges[0].transactions).toEqual([]);
  });

  it('uses transaction tombstone timestamps against active rows', async () => {
    const remoteAdapter = createFakeRemoteSyncAdapter({
      sessionUserId: TEST_USER_ID,
      transactions: [
        createRemoteTransaction({
          id: 'txn-remote-delete',
          updatedAt: '2026-05-21T11:00:00.000Z',
          deletedAt: '2026-05-21T11:00:00.000Z',
        }),
        createRemoteTransaction({
          id: 'txn-local-delete',
          updatedAt: '2026-05-21T10:00:00.000Z',
          deletedAt: null,
        }),
      ],
    });
    const dataTarget = createDataTarget();
    const service = createService({
      dataSource: createDataSource({
        transactions: [
          createTransaction({
            id: 'txn-remote-delete',
            updatedAt: Date.parse('2026-05-21T10:00:00.000Z'),
          }),
          createTransaction({
            id: 'txn-local-delete',
            updatedAt: Date.parse('2026-05-21T11:30:00.000Z'),
            deletedAt: Date.parse('2026-05-21T11:30:00.000Z'),
          }),
        ],
      }),
      dataTarget,
      remoteAdapter,
    });

    const result = await runManualIncrementalSync(service, {
      auth: {
        status: 'authenticated',
        userId: TEST_USER_ID,
      },
    });

    expect(result).toMatchObject({
      status: 'succeeded',
      appliedTransactionsCount: 1,
      pushedTransactionsCount: 1,
      conflictsCount: 2,
    });
    expect(dataTarget.appliedChanges[0].transactions).toEqual([
      expect.objectContaining({
        id: 'txn-remote-delete',
        deletedAt: '2026-05-21T11:00:00.000Z',
      }),
    ]);
    expect(remoteAdapter.getTransactions()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'txn-local-delete',
          deletedAt: '2026-05-21T11:30:00.000Z',
        }),
      ]),
    );
  });

  it('ignores category tombstones safely and pushes local archived category winners', async () => {
    const remoteAdapter = createFakeRemoteSyncAdapter({
      categories: [
        createRemoteCategory({
          id: 'coffee',
          deletedAt: '2026-05-21T11:00:00.000Z',
          updatedAt: '2026-05-21T11:00:00.000Z',
        }),
      ],
      sessionUserId: TEST_USER_ID,
    });
    const service = createService({
      dataSource: createDataSource({
        categories: [
          createCategory({
            id: 'coffee',
            isArchived: true,
            updatedAt: Date.parse('2026-05-21T11:30:00.000Z'),
          }),
        ],
      }),
      remoteAdapter,
    });

    const result = await runManualIncrementalSync(service, {
      auth: {
        status: 'authenticated',
        userId: TEST_USER_ID,
      },
    });

    expect(result).toMatchObject({
      status: 'succeeded',
      appliedCategoriesCount: 0,
      pushedCategoriesCount: 1,
      ignoredCategoryTombstonesCount: 1,
    });
    expect(remoteAdapter.getCategories()).toEqual([
      expect.objectContaining({
        id: 'coffee',
        deletedAt: null,
        isArchived: true,
      }),
    ]);
  });

  it('applies newer remote category active and archived changes through LWW', async () => {
    const remoteAdapter = createFakeRemoteSyncAdapter({
      categories: [
        createRemoteCategory({
          id: 'coffee',
          name: 'Remote Coffee',
          isArchived: true,
          updatedAt: '2026-05-21T11:00:00.000Z',
        }),
      ],
      sessionUserId: TEST_USER_ID,
    });
    const dataTarget = createDataTarget();
    const service = createService({
      dataSource: createDataSource({
        categories: [
          createCategory({
            id: 'coffee',
            name: 'Local Coffee',
            isArchived: false,
            updatedAt: Date.parse('2026-05-21T10:00:00.000Z'),
          }),
        ],
      }),
      dataTarget,
      remoteAdapter,
    });

    const result = await runManualIncrementalSync(service, {
      auth: {
        status: 'authenticated',
        userId: TEST_USER_ID,
      },
    });

    expect(result).toMatchObject({
      status: 'succeeded',
      appliedCategoriesCount: 1,
      pushedCategoriesCount: 0,
      conflictsCount: 1,
    });
    expect(dataTarget.appliedChanges[0].categories).toEqual([
      expect.objectContaining({
        id: 'coffee',
        name: 'Remote Coffee',
        isArchived: true,
      }),
    ]);
  });

  it('does not apply local changes, push, or write success metadata when pull fails', async () => {
    const metadataStore = createMetadataStore();
    const dataTarget = createDataTarget();
    const remoteAdapter = createFakeRemoteSyncAdapter({
      sessionUserId: TEST_USER_ID,
      shouldFailPull: true,
    });
    const service = createService({
      dataSource: createDataSource({
        transactions: [createTransaction({ id: 'txn-local-only' })],
      }),
      dataTarget,
      metadataStore,
      remoteAdapter,
    });

    const result = await runManualIncrementalSync(service, {
      auth: {
        status: 'authenticated',
        userId: TEST_USER_ID,
      },
    });

    expect(result).toMatchObject({
      status: 'failed',
      error: {
        code: 'remote_read_failed',
        isRecoverable: true,
      },
    });
    expect(dataTarget.applyRemoteChanges).not.toHaveBeenCalled();
    expect(remoteAdapter.getTransactions()).toEqual([]);
    expect(metadataStore.successes).toEqual([]);
    expect(metadataStore.failures).toEqual([TEST_NOW]);
  });

  it('does not push or write success metadata when local apply fails', async () => {
    const metadataStore = createMetadataStore();
    const remoteAdapter = createFakeRemoteSyncAdapter({
      sessionUserId: TEST_USER_ID,
      transactions: [createRemoteTransaction({ id: 'txn-remote-only' })],
    });
    const service = createService({
      dataSource: createDataSource({
        transactions: [createTransaction({ id: 'txn-local-only' })],
      }),
      dataTarget: createDataTarget({ shouldFail: true }),
      metadataStore,
      remoteAdapter,
    });

    const result = await runManualIncrementalSync(service, {
      auth: {
        status: 'authenticated',
        userId: TEST_USER_ID,
      },
    });

    expect(result).toMatchObject({
      status: 'failed',
      error: {
        code: 'local_write_failed',
        isRecoverable: true,
      },
    });
    expect(remoteAdapter.getTransactions()).toEqual([
      expect.objectContaining({ id: 'txn-remote-only' }),
    ]);
    expect(remoteAdapter.getTransactions()).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'txn-local-only' }),
      ]),
    );
    expect(metadataStore.successes).toEqual([]);
    expect(metadataStore.failures).toEqual([TEST_NOW]);
  });

  it('does not write success metadata when push fails after local apply', async () => {
    const metadataStore = createMetadataStore();
    const dataTarget = createDataTarget();
    const remoteAdapter = createFakeRemoteSyncAdapter({
      sessionUserId: TEST_USER_ID,
      shouldFailPush: true,
    });
    const service = createService({
      dataSource: createDataSource({
        transactions: [createTransaction({ id: 'txn-local-only' })],
      }),
      dataTarget,
      metadataStore,
      remoteAdapter,
    });

    const result = await runManualIncrementalSync(service, {
      auth: {
        status: 'authenticated',
        userId: TEST_USER_ID,
      },
    });

    expect(result).toMatchObject({
      status: 'failed',
      error: {
        code: 'remote_write_failed',
        isRecoverable: true,
      },
    });
    expect(dataTarget.applyRemoteChanges).toHaveBeenCalledTimes(1);
    expect(remoteAdapter.getTransactions()).toEqual([]);
    expect(metadataStore.successes).toEqual([]);
    expect(metadataStore.failures).toEqual([TEST_NOW]);
  });

  it('returns safe failures without raw backend or token values', async () => {
    const metadataStore = createMetadataStore();
    const remoteAdapter = createFakeRemoteSyncAdapter({
      sessionUserId: TEST_USER_ID,
      shouldFailPull: true,
    });
    const service = createService({
      metadataStore,
      remoteAdapter,
    });

    const result = await runManualIncrementalSync(service, {
      auth: {
        status: 'authenticated',
        userId: TEST_USER_ID,
      },
    });

    expect(result).toMatchObject({
      status: 'failed',
      error: {
        code: 'remote_read_failed',
        isRecoverable: true,
      },
    });
    expect(JSON.stringify(result)).not.toContain(RAW_FAILURE);
    expect(JSON.stringify(result)).not.toContain('access_token');
    expect(metadataStore.failures).toEqual([TEST_NOW]);
  });

  it('records safe success metadata and reports metadata write failure safely', async () => {
    const metadataStore = createMetadataStore();
    const service = createService({
      dataSource: createDataSource({
        transactions: [createTransaction()],
      }),
      metadataStore,
    });

    await expect(
      runManualIncrementalSync(service, {
        auth: {
          status: 'authenticated',
          userId: TEST_USER_ID,
        },
      }),
    ).resolves.toMatchObject({
      status: 'succeeded',
      lastSuccessfulSyncAt: TEST_NOW,
    });
    expect(metadataStore.successes).toEqual([
      expect.objectContaining({
        source: 'manual',
        summary: expect.objectContaining({
          appliedCategoriesCount: 0,
          appliedTransactionsCount: 0,
          completedAt: TEST_NOW,
          conflictsCount: 0,
          cursor: TEST_NOW,
          ignoredCategoryTombstonesCount: 0,
          ignoredTransactionTombstonesCount: 0,
          pulledCategoriesCount: 0,
          pulledTransactionsCount: 0,
          pushedCategoriesCount: 0,
          pushedTransactionsCount: 1,
        }),
      }),
    ]);
    expect(metadataStore.failures).toEqual([]);

    const failingMetadataStore = createMetadataStore({
      shouldFailWrite: true,
    });
    const failingService = createService({
      metadataStore: failingMetadataStore,
    });

    const result = await runManualIncrementalSync(failingService, {
      auth: {
        status: 'authenticated',
        userId: TEST_USER_ID,
      },
    });

    expect(result).toMatchObject({
      status: 'failed',
      error: {
        code: 'metadata_write_failed',
      },
    });
    expect(JSON.stringify(result)).not.toContain(RAW_FAILURE);
  });
});
