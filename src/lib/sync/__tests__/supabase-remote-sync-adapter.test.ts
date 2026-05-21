import { describe, expect, it, jest } from '@jest/globals';

import { createSyncService } from '@/lib/sync/sync-service';
import { createSupabaseRemoteSyncAdapter } from '@/lib/sync/supabase-remote-sync-adapter';

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

type RemoteTableName = 'remote_categories' | 'remote_transactions';

type RemoteRow = {
  user_id: string;
  id: string;
  [key: string]: unknown;
};

const TEST_USER_ID = 'auth-user-test';
const TEST_CURSOR = Date.parse('2026-05-20T12:00:00.000Z');
const RAW_BACKEND_ERROR = 'raw backend failure access_token ownerId';

function createCategoryRow(overrides: Partial<RemoteRow> = {}): RemoteRow {
  return {
    user_id: TEST_USER_ID,
    id: 'coffee',
    name: 'Coffee',
    is_default: false,
    is_archived: false,
    sort_order: 10,
    created_at: '2026-05-18T09:00:00.000Z',
    updated_at: '2026-05-21T09:30:00.000Z',
    deleted_at: null,
    schema_version: 1,
    source_device_id: 'device_test',
    ...overrides,
  };
}

function createTransactionRow(overrides: Partial<RemoteRow> = {}): RemoteRow {
  return {
    user_id: TEST_USER_ID,
    id: 'txn-1',
    amount: 12.5,
    category_id: 'coffee',
    is_leak: true,
    leak_reason: 'impulse',
    note: 'Too easy',
    created_at: '2026-05-19T10:00:00.000Z',
    updated_at: '2026-05-21T10:05:00.000Z',
    deleted_at: null,
    schema_version: 1,
    source_device_id: 'device_test',
    ...overrides,
  };
}

function createMockRemoteSyncClient({
  failTable,
  remoteCategories = [createCategoryRow()],
  remoteTransactions = [createTransactionRow()],
  sessionUserId = TEST_USER_ID,
}: {
  failTable?: RemoteTableName;
  remoteCategories?: RemoteRow[];
  remoteTransactions?: RemoteRow[];
  sessionUserId?: string | null;
} = {}) {
  const filtersByTable: Partial<Record<RemoteTableName, string>> = {};
  const rowsByTable: Record<RemoteTableName, Map<string, RemoteRow>> = {
    remote_categories: new Map(
      remoteCategories.map((row) => [`${row.user_id}\u0000${row.id}`, row]),
    ),
    remote_transactions: new Map(
      remoteTransactions.map((row) => [`${row.user_id}\u0000${row.id}`, row]),
    ),
  };

  function createReadQuery(tableName: RemoteTableName) {
    let selectedUserId = '';

    const query = {
      eq: jest.fn((_columnName: string, value: string) => {
        selectedUserId = value;

        return query;
      }),
      or: jest.fn((filters: string) => {
        filtersByTable[tableName] = filters;

        return query;
      }),
      then: (
        resolve: (value: unknown) => unknown,
        reject: (reason: unknown) => unknown,
      ) => {
        const result =
          tableName === failTable
            ? {
                data: null,
                error: new Error(RAW_BACKEND_ERROR),
              }
            : {
                data: [...rowsByTable[tableName].values()].filter(
                  (row) => row.user_id === selectedUserId,
                ),
                error: null,
              };

        return Promise.resolve(result).then(resolve, reject);
      },
    };

    return query;
  }

  const upsert = jest.fn(
    async (
      tableName: RemoteTableName,
      rows: RemoteRow[],
      options: { onConflict: string },
    ) => {
      if (tableName === failTable) {
        return {
          error: new Error(RAW_BACKEND_ERROR),
        };
      }

      for (const row of rows) {
        rowsByTable[tableName].set(`${row.user_id}\u0000${row.id}`, row);
      }

      return {
        data: rows,
        error: null,
        options,
      };
    },
  );

  const from = jest.fn((tableName: RemoteTableName) => ({
    select: jest.fn(() => createReadQuery(tableName)),
    upsert: (rows: RemoteRow[], options: { onConflict: string }) =>
      upsert(tableName, rows, options),
  }));

  return {
    client: {
      auth: {
        getSession: jest.fn(async () => ({
          data: {
            session:
              sessionUserId === null
                ? null
                : {
                    user: {
                      id: sessionUserId,
                    },
                  },
          },
          error: null,
        })),
      },
      from,
    },
    filtersByTable,
    from,
    getRows(tableName: RemoteTableName) {
      return [...rowsByTable[tableName].values()];
    },
    upsert,
  };
}

describe('Supabase remote sync adapter', () => {
  it('reads the authenticated Supabase session user id safely', async () => {
    const { client } = createMockRemoteSyncClient();
    const adapter = createSupabaseRemoteSyncAdapter({
      getClient: () => client as never,
    });

    await expect(adapter.getAuthenticatedUserId()).resolves.toBe(TEST_USER_ID);
  });

  it('pulls changed rows with a cursor filter and maps snake_case fields', async () => {
    const { client, filtersByTable, from } = createMockRemoteSyncClient();
    const adapter = createSupabaseRemoteSyncAdapter({
      getClient: () => client as never,
    });

    await expect(
      adapter.pullChanges({
        userId: ` ${TEST_USER_ID} `,
        since: TEST_CURSOR,
      }),
    ).resolves.toMatchObject({
      categories: [
        {
          id: 'coffee',
          userId: TEST_USER_ID,
          isArchived: false,
        },
      ],
      transactions: [
        {
          id: 'txn-1',
          userId: TEST_USER_ID,
          categoryId: 'coffee',
        },
      ],
    });
    expect(from).toHaveBeenNthCalledWith(1, 'remote_categories');
    expect(from).toHaveBeenNthCalledWith(2, 'remote_transactions');
    expect(filtersByTable.remote_categories).toContain('updated_at.gt.');
    expect(filtersByTable.remote_transactions).toContain('deleted_at.gt.');
  });

  it('pushes transactions and categories through authenticated remote tables', async () => {
    const { client, getRows, upsert } = createMockRemoteSyncClient({
      remoteCategories: [],
      remoteTransactions: [],
    });
    const adapter = createSupabaseRemoteSyncAdapter({
      getClient: () => client as never,
    });

    await expect(
      adapter.pushChanges({
        userId: TEST_USER_ID,
        categories: [
          {
            id: 'coffee',
            userId: TEST_USER_ID,
            name: 'Coffee',
            isDefault: false,
            isArchived: true,
            sortOrder: 10,
            createdAt: '2026-05-18T09:00:00.000Z',
            updatedAt: '2026-05-21T09:30:00.000Z',
            deletedAt: null,
            schemaVersion: 1,
            sourceDeviceId: 'device_test',
          },
        ],
        transactions: [
          {
            id: 'txn-deleted',
            userId: TEST_USER_ID,
            amount: 12.5,
            categoryId: 'coffee',
            isLeak: true,
            leakReason: 'impulse',
            note: null,
            createdAt: '2026-05-19T10:00:00.000Z',
            updatedAt: '2026-05-21T10:05:00.000Z',
            deletedAt: '2026-05-21T10:05:00.000Z',
            schemaVersion: 1,
            sourceDeviceId: 'device_test',
          },
        ],
      }),
    ).resolves.toEqual({
      pushedTransactionsCount: 1,
      pushedCategoriesCount: 1,
    });
    expect(upsert).toHaveBeenNthCalledWith(
      1,
      'remote_categories',
      [expect.objectContaining({ is_archived: true, user_id: TEST_USER_ID })],
      { onConflict: 'user_id,id' },
    );
    expect(getRows('remote_transactions')).toEqual([
      expect.objectContaining({
        id: 'txn-deleted',
        deleted_at: '2026-05-21T10:05:00.000Z',
      }),
    ]);
  });

  it('returns safe service errors without leaking raw backend values', async () => {
    const { client } = createMockRemoteSyncClient({
      failTable: 'remote_transactions',
    });
    const adapter = createSupabaseRemoteSyncAdapter({
      getClient: () => client as never,
    });
    const service = createSyncService({
      dataSource: {
        getSyncData: jest.fn(async () => ({
          transactions: [],
          categories: [],
        })),
      },
      dataTarget: {
        applyRemoteChanges: jest.fn(async () => ({
          appliedTransactionsCount: 0,
          appliedCategoriesCount: 0,
        })),
      },
      isSyncEnabled: true,
      metadataStore: {
        getMetadata: jest.fn(async () => ({
          lastSuccessfulSyncAt: null,
          lastSyncErrorAt: null,
          lastSyncSummary: null,
          lastSuccessfulSyncSource: null,
        })),
        recordFailure: jest.fn(async () => {}),
        recordSuccess: jest.fn(async () => {}),
      },
      now: () => TEST_CURSOR,
      remoteAdapter: adapter,
    });

    const result = await service.runIncrementalSync({
      auth: {
        status: 'authenticated',
        userId: TEST_USER_ID,
      },
      source: 'manual',
    });

    expect(result).toMatchObject({
      status: 'failed',
      error: {
        code: 'remote_read_failed',
        isRecoverable: true,
      },
    });
    expect(JSON.stringify(result)).not.toContain(RAW_BACKEND_ERROR);
    expect(JSON.stringify(result)).not.toContain('access_token');
  });
});
