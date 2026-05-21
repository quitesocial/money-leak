import { describe, expect, it, jest } from '@jest/globals';

import { createFakeRemoteSyncAdapter } from '@/lib/sync/fake-remote-sync-adapter';
import type { LocalSyncDataSource } from '@/lib/sync/local-sync-data-source';
import { createSyncService } from '@/lib/sync/sync-service';
import type {
  LocalSyncDataTarget,
  LocalSyncMetadataStore,
  RemoteCategory,
  RemoteSyncChanges,
  RemoteTransaction,
  SyncMetadata,
  SyncSummary,
} from '@/lib/sync/sync-types';
import type { Category } from '@/types/category';
import type { Transaction } from '@/types/transaction';

jest.mock('@/db/categories', () => ({
  applyCategorySyncChanges: jest.fn(),
  getCategories: jest.fn(),
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

function createDataSource({
  categories = [],
  shouldFail = false,
  transactions = [],
}: {
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
      };
    }),
  };
}

function createMetadataStore({
  initialMetadata = {
    lastSuccessfulSyncAt: TEST_CURSOR,
    lastSyncErrorAt: null,
    lastSyncSummary: null,
  },
  shouldFailRead = false,
  shouldFailWrite = false,
}: {
  initialMetadata?: SyncMetadata;
  shouldFailRead?: boolean;
  shouldFailWrite?: boolean;
} = {}): LocalSyncMetadataStore & {
  failures: number[];
  successes: SyncSummary[];
} {
  const metadata = { ...initialMetadata };
  const failures: number[] = [];
  const successes: SyncSummary[] = [];

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
    async recordSuccess(summary) {
      if (shouldFailWrite) throw new Error(RAW_FAILURE);

      successes.push(summary);
      metadata.lastSuccessfulSyncAt = summary.cursor;
      metadata.lastSyncSummary = summary;
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
  remoteAdapter?: ReturnType<typeof createFakeRemoteSyncAdapter>;
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
    const service = createService({
      dataSource,
      isSyncEnabled: false,
    });

    await expect(
      service.runIncrementalSync({
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
  });

  it('skips safely for guest mode, missing user id, missing session, and mismatched session', async () => {
    const remoteAdapter = createFakeRemoteSyncAdapter({
      sessionUserId: null,
    });
    const service = createService({ remoteAdapter });

    await expect(
      service.runIncrementalSync({
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
      service.runIncrementalSync({
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
      service.runIncrementalSync({
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
      service.runIncrementalSync({
        auth: {
          status: 'authenticated',
          userId: TEST_USER_ID,
        },
      }),
    ).resolves.toMatchObject({
      status: 'skipped',
      skippedReason: 'session_user_mismatch',
    });
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
        },
      }),
      remoteAdapter,
    });

    const result = await service.runIncrementalSync({
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
        transactions: [expect.objectContaining({ id: 'txn-1' })],
        categories: [expect.objectContaining({ id: 'coffee' })],
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

    const result = await service.runIncrementalSync({
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

    const result = await service.runIncrementalSync({
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

  it('does not duplicate remote rows on repeated sync', async () => {
    const remoteAdapter = createFakeRemoteSyncAdapter({
      sessionUserId: TEST_USER_ID,
    });
    const metadataStore = createMetadataStore({
      initialMetadata: {
        lastSuccessfulSyncAt: null,
        lastSyncErrorAt: null,
        lastSyncSummary: null,
      },
    });
    const service = createService({
      dataSource: createDataSource({
        transactions: [createTransaction()],
      }),
      metadataStore,
      remoteAdapter,
    });

    await service.runIncrementalSync({
      auth: {
        status: 'authenticated',
        userId: TEST_USER_ID,
      },
    });
    const secondResult = await service.runIncrementalSync({
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

  it('shares one in-flight sync operation for overlapping service calls', async () => {
    const deferredData = createDeferred<{
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

    const firstSync = service.runIncrementalSync(input);
    const secondSync = service.runIncrementalSync(input);

    expect(secondSync).toBe(firstSync);

    deferredData.resolve({
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

  it('uses LWW when the remote active row is newer', async () => {
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

    const result = await service.runIncrementalSync({
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

    const result = await service.runIncrementalSync({
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

    const result = await service.runIncrementalSync({
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

    const result = await service.runIncrementalSync({
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

    const result = await service.runIncrementalSync({
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
      service.runIncrementalSync({
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
        completedAt: TEST_NOW,
        cursor: TEST_NOW,
        pushedTransactionsCount: 1,
      }),
    ]);

    const failingMetadataStore = createMetadataStore({
      shouldFailWrite: true,
    });
    const failingService = createService({
      metadataStore: failingMetadataStore,
    });

    const result = await failingService.runIncrementalSync({
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
