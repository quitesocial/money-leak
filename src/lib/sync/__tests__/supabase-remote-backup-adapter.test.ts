import { describe, expect, it, jest } from '@jest/globals';

import { createBackupService } from '@/lib/sync/backup-service';
import { createSupabaseRemoteBackupAdapter } from '@/lib/sync/supabase-remote-backup-adapter';
import type { LocalBackupDataSource } from '@/lib/sync/local-backup-data-source';
import type { BackupPayload } from '@/lib/sync/sync-types';
import type { Category } from '@/types/category';
import type { Transaction } from '@/types/transaction';

const mockGetTransactions = jest.fn();
const mockGetCategories = jest.fn();

jest.mock('@/db/transactions', () => ({
  getTransactions: (...args: unknown[]) => mockGetTransactions(...args),
}));

jest.mock('@/db/categories', () => ({
  getCategories: (...args: unknown[]) => mockGetCategories(...args),
}));

type RemoteTableName = 'remote_categories' | 'remote_transactions';

type RemoteRow = {
  user_id: string;
  id: string;
  [key: string]: unknown;
};

const TEST_USER_ID = 'auth-user-test';
const TEST_NOW = Date.parse('2026-05-20T12:00:00.000Z');
const RAW_BACKEND_ERROR = 'raw backend failure with access_token ownerId';

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
    updatedAt: Date.parse('2026-05-19T10:05:00.000Z'),
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
    updatedAt: Date.parse('2026-05-18T09:30:00.000Z'),
    isDefault: false,
    isArchived: false,
    deletedAt: null,
    schemaVersion: 1,
    sourceDeviceId: 'device_test',
    sortOrder: 10,
    ...overrides,
  };
}

function createDataSource({
  transactions = [createTransaction()],
  categories = [createCategory()],
}: {
  transactions?: Transaction[];
  categories?: Category[];
} = {}): LocalBackupDataSource {
  return {
    getBackupData: jest.fn(async () => ({
      transactions,
      categories,
    })),
  };
}

function createPayload(overrides: Partial<BackupPayload> = {}): BackupPayload {
  return {
    userId: TEST_USER_ID,
    schemaVersion: 1,
    createdAt: '2026-05-20T12:00:00.000Z',
    includesTombstones: false,
    transactions: [
      {
        id: 'txn-1',
        userId: TEST_USER_ID,
        amount: 12.5,
        categoryId: 'coffee',
        isLeak: true,
        leakReason: 'impulse',
        note: 'Too easy',
        createdAt: '2026-05-19T10:00:00.000Z',
        updatedAt: '2026-05-19T10:05:00.000Z',
        deletedAt: null,
        schemaVersion: 1,
        sourceDeviceId: 'device_test',
      },
    ],
    categories: [
      {
        id: 'coffee',
        userId: TEST_USER_ID,
        name: 'Coffee',
        isDefault: false,
        isArchived: false,
        sortOrder: 10,
        createdAt: '2026-05-18T09:00:00.000Z',
        updatedAt: '2026-05-18T09:30:00.000Z',
        deletedAt: null,
        schemaVersion: 1,
        sourceDeviceId: 'device_test',
      },
    ],
    ...overrides,
  };
}

function createMockRemoteBackupClient({
  failTable,
}: {
  failTable?: RemoteTableName;
} = {}) {
  const rowsByTable: Record<RemoteTableName, Map<string, RemoteRow>> = {
    remote_categories: new Map(),
    remote_transactions: new Map(),
  };

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
    upsert: (rows: RemoteRow[], options: { onConflict: string }) =>
      upsert(tableName, rows, options),
  }));

  return {
    client: {
      from,
    },
    from,
    getRows(tableName: RemoteTableName) {
      return [...rowsByTable[tableName].values()];
    },
    upsert,
  };
}

describe('Supabase remote backup adapter', () => {
  it('runs authenticated manual backup through the service boundary', async () => {
    const { client, from, upsert } = createMockRemoteBackupClient();
    const adapter = createSupabaseRemoteBackupAdapter({
      getClient: () => client as never,
    });

    const service = createBackupService({
      adapter,
      dataSource: createDataSource(),
      isBackupEnabled: true,
      now: () => TEST_NOW,
    });

    const result = await service.runBackup({
      auth: {
        status: 'authenticated',
        userId: TEST_USER_ID,
      },
    });

    expect(result).toMatchObject({
      status: 'succeeded',
      uploadedTransactionsCount: 1,
      uploadedCategoriesCount: 1,
    });
    expect(from).toHaveBeenNthCalledWith(1, 'remote_categories');
    expect(from).toHaveBeenNthCalledWith(2, 'remote_transactions');
    expect(upsert).toHaveBeenNthCalledWith(
      1,
      'remote_categories',
      [
        expect.objectContaining({
          user_id: TEST_USER_ID,
          id: 'coffee',
          name: 'Coffee',
          is_default: false,
          is_archived: false,
          sort_order: 10,
          source_device_id: 'device_test',
        }),
      ],
      { onConflict: 'user_id,id' },
    );
    expect(upsert).toHaveBeenNthCalledWith(
      2,
      'remote_transactions',
      [
        expect.objectContaining({
          user_id: TEST_USER_ID,
          id: 'txn-1',
          amount: 12.5,
          category_id: 'coffee',
          is_leak: true,
          source_device_id: 'device_test',
        }),
      ],
      { onConflict: 'user_id,id' },
    );
  });

  it('upserts repeatedly without duplicating rows by user id and local id', async () => {
    const { client, getRows, upsert } = createMockRemoteBackupClient();
    const adapter = createSupabaseRemoteBackupAdapter({
      getClient: () => client as never,
    });
    const payload = createPayload();

    await adapter.writeBackup(payload);
    await adapter.writeBackup(payload);

    expect(upsert).toHaveBeenCalledTimes(4);
    expect(getRows('remote_categories')).toEqual([
      expect.objectContaining({
        user_id: TEST_USER_ID,
        id: 'coffee',
      }),
    ]);
    expect(getRows('remote_transactions')).toEqual([
      expect.objectContaining({
        user_id: TEST_USER_ID,
        id: 'txn-1',
      }),
    ]);
  });

  it('returns a safe recoverable service error when the Supabase client is unavailable', async () => {
    const adapter = createSupabaseRemoteBackupAdapter({
      getClient: () => null,
    });

    const service = createBackupService({
      adapter,
      dataSource: createDataSource(),
      isBackupEnabled: true,
      now: () => TEST_NOW,
    });

    const result = await service.runBackup({
      auth: {
        status: 'authenticated',
        userId: TEST_USER_ID,
      },
    });

    expect(result).toMatchObject({
      status: 'failed',
      payload: null,
      error: {
        code: 'remote_write_failed',
        isRecoverable: true,
      },
    });
    expect(JSON.stringify(result)).not.toContain('Supabase');
    expect(JSON.stringify(result)).not.toContain('access_token');
  });

  it('returns a safe recoverable service error when a remote write fails', async () => {
    const { client, getRows } = createMockRemoteBackupClient({
      failTable: 'remote_transactions',
    });
    const adapter = createSupabaseRemoteBackupAdapter({
      getClient: () => client as never,
    });

    const service = createBackupService({
      adapter,
      dataSource: createDataSource(),
      isBackupEnabled: true,
      now: () => TEST_NOW,
    });

    const result = await service.runBackup({
      auth: {
        status: 'authenticated',
        userId: TEST_USER_ID,
      },
    });

    expect(result).toMatchObject({
      status: 'failed',
      payload: null,
      error: {
        code: 'remote_write_failed',
        isRecoverable: true,
      },
    });
    expect(JSON.stringify(result)).not.toContain(RAW_BACKEND_ERROR);
    expect(JSON.stringify(result)).not.toContain('access_token');
    expect(getRows('remote_transactions')).toEqual([]);
  });
});
