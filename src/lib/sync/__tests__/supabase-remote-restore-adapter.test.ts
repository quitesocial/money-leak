import { describe, expect, it, jest } from '@jest/globals';

import { createRestoreService } from '@/lib/sync/restore-service';
import { createSupabaseRemoteRestoreAdapter } from '@/lib/sync/supabase-remote-restore-adapter';
import type { LocalRestoreDataTarget } from '@/lib/sync/sync-types';

const mockGetCategories = jest.fn();
const mockRestoreCategories = jest.fn();
const mockGetTransactions = jest.fn();
const mockRestoreTransactions = jest.fn();
const mockGetBalanceEntries = jest.fn();
const mockGetBalanceTypes = jest.fn();
const mockRestoreBalanceEntries = jest.fn();
const mockRestoreBalanceEntryTombstones = jest.fn();
const mockRestoreBalanceTypes = jest.fn();
const mockRestoreBalanceTypeTombstones = jest.fn();

jest.mock('@/db/categories', () => ({
  getCategories: (...args: unknown[]) => mockGetCategories(...args),
  restoreCategories: (...args: unknown[]) => mockRestoreCategories(...args),
}));

jest.mock('@/db/transactions', () => ({
  getTransactions: (...args: unknown[]) => mockGetTransactions(...args),
  restoreTransactions: (...args: unknown[]) => mockRestoreTransactions(...args),
}));

jest.mock('@/db/balance', () => ({
  getBalanceEntries: (...args: unknown[]) => mockGetBalanceEntries(...args),
  getBalanceTypes: (...args: unknown[]) => mockGetBalanceTypes(...args),
  restoreBalanceEntries: (...args: unknown[]) =>
    mockRestoreBalanceEntries(...args),
  restoreBalanceEntryTombstones: (...args: unknown[]) =>
    mockRestoreBalanceEntryTombstones(...args),
  restoreBalanceTypes: (...args: unknown[]) => mockRestoreBalanceTypes(...args),
  restoreBalanceTypeTombstones: (...args: unknown[]) =>
    mockRestoreBalanceTypeTombstones(...args),
}));

type RemoteTableName =
  | 'remote_balance_entries'
  | 'remote_balance_types'
  | 'remote_categories'
  | 'remote_transactions';

type RemoteCategoryRow = {
  user_id: string;
  id: string;
  name: string;
  is_default: boolean;
  is_archived: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  schema_version: number;
  source_device_id: string | null;
};

type RemoteTransactionRow = {
  user_id: string;
  id: string;
  amount: number;
  category_id: string;
  is_leak: boolean;
  leak_reason: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  schema_version: number;
  source_device_id: string | null;
};

type RemoteBalanceTypeRow = {
  user_id: string;
  id: string;
  name: string;
  is_default: boolean;
  is_archived: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  schema_version: number;
  source_device_id: string | null;
};

type RemoteBalanceEntryRow = {
  user_id: string;
  id: string;
  amount: number;
  type_id: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  schema_version: number;
  source_device_id: string | null;
};

const TEST_USER_ID = 'user-test';
const RAW_BACKEND_ERROR = 'raw backend failure access_token localOwnerId';

function createCategoryRow(
  overrides: Partial<RemoteCategoryRow> = {},
): RemoteCategoryRow {
  return {
    user_id: TEST_USER_ID,
    id: 'coffee',
    name: 'Coffee',
    is_default: false,
    is_archived: false,
    sort_order: 10,
    created_at: '2026-05-18T09:00:00.000Z',
    updated_at: '2026-05-18T09:30:00.000Z',
    deleted_at: null,
    schema_version: 1,
    source_device_id: 'device_test',
    ...overrides,
  };
}

function createTransactionRow(
  overrides: Partial<RemoteTransactionRow> = {},
): RemoteTransactionRow {
  return {
    user_id: TEST_USER_ID,
    id: 'txn-1',
    amount: 12.5,
    category_id: 'coffee',
    is_leak: true,
    leak_reason: 'impulse',
    note: 'Too easy',
    created_at: '2026-05-19T10:00:00.000Z',
    updated_at: '2026-05-19T10:05:00.000Z',
    deleted_at: null,
    schema_version: 1,
    source_device_id: 'device_test',
    ...overrides,
  };
}

function createBalanceTypeRow(
  overrides: Partial<RemoteBalanceTypeRow> = {},
): RemoteBalanceTypeRow {
  return {
    user_id: TEST_USER_ID,
    id: 'income',
    name: 'Income',
    is_default: true,
    is_archived: false,
    sort_order: 0,
    created_at: '2026-05-18T08:00:00.000Z',
    updated_at: '2026-05-18T08:30:00.000Z',
    deleted_at: null,
    schema_version: 1,
    source_device_id: 'device_test',
    ...overrides,
  };
}

function createBalanceEntryRow(
  overrides: Partial<RemoteBalanceEntryRow> = {},
): RemoteBalanceEntryRow {
  return {
    user_id: TEST_USER_ID,
    id: 'balance-entry-1',
    amount: 100,
    type_id: 'income',
    created_at: '2026-05-19T08:00:00.000Z',
    updated_at: '2026-05-19T08:30:00.000Z',
    deleted_at: null,
    schema_version: 1,
    source_device_id: 'device_test',
    ...overrides,
  };
}

function createDataTarget(): LocalRestoreDataTarget & {
  restoreBackup: jest.MockedFunction<LocalRestoreDataTarget['restoreBackup']>;
} {
  return {
    hasLocalData: jest.fn(async () => false),
    restoreBackup: jest.fn(async () => ({
      restoredBalanceEntriesCount: 1,
      restoredBalanceTypesCount: 1,
      restoredCategoriesCount: 1,
      restoredTransactionsCount: 1,
    })),
  };
}

function createMockRemoteRestoreClient({
  failTable,
  remoteBalanceEntries = [createBalanceEntryRow()],
  remoteBalanceTypes = [createBalanceTypeRow()],
  remoteCategories = [createCategoryRow()],
  remoteTransactions = [createTransactionRow()],
}: {
  failTable?: RemoteTableName;
  remoteBalanceEntries?: RemoteBalanceEntryRow[];
  remoteBalanceTypes?: RemoteBalanceTypeRow[];
  remoteCategories?: RemoteCategoryRow[];
  remoteTransactions?: RemoteTransactionRow[];
} = {}) {
  const read = jest.fn(
    (
      tableName: RemoteTableName,
      columns: string,
      columnName: string,
      value: string,
    ) => {
      if (tableName === failTable) {
        return {
          data: null,
          error: new Error(RAW_BACKEND_ERROR),
        };
      }

      return {
        data: getRowsForTable({
          remoteBalanceEntries,
          remoteBalanceTypes,
          remoteCategories,
          remoteTransactions,
          tableName,
          userId: value,
        }),
        error: null,
        columns,
        columnName,
      };
    },
  );

  const from = jest.fn((tableName: RemoteTableName) => ({
    select: (columns: string) => ({
      eq: (columnName: string, value: string) =>
        read(tableName, columns, columnName, value),
    }),
  }));

  return {
    client: {
      from,
    },
    from,
    read,
  };
}

function getRowsForTable({
  remoteBalanceEntries,
  remoteBalanceTypes,
  remoteCategories,
  remoteTransactions,
  tableName,
  userId,
}: {
  remoteBalanceEntries: RemoteBalanceEntryRow[];
  remoteBalanceTypes: RemoteBalanceTypeRow[];
  remoteCategories: RemoteCategoryRow[];
  remoteTransactions: RemoteTransactionRow[];
  tableName: RemoteTableName;
  userId: string;
}) {
  if (tableName === 'remote_balance_entries') {
    return remoteBalanceEntries.filter((row) => row.user_id === userId);
  }

  if (tableName === 'remote_balance_types') {
    return remoteBalanceTypes.filter((row) => row.user_id === userId);
  }

  if (tableName === 'remote_categories') {
    return remoteCategories.filter((row) => row.user_id === userId);
  }

  return remoteTransactions.filter((row) => row.user_id === userId);
}

describe('Supabase remote restore adapter', () => {
  it('reads authenticated remote backup rows and maps snake_case fields', async () => {
    const { client, from, read } = createMockRemoteRestoreClient();
    const adapter = createSupabaseRemoteRestoreAdapter({
      getClient: () => client as never,
    });

    await expect(
      adapter.readBackup({ userId: ` ${TEST_USER_ID} ` }),
    ).resolves.toMatchObject({
      userId: TEST_USER_ID,
      schemaVersion: 2,
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
      balanceTypes: [
        {
          id: 'income',
          userId: TEST_USER_ID,
          name: 'Income',
          isDefault: true,
          isArchived: false,
          sortOrder: 0,
          createdAt: '2026-05-18T08:00:00.000Z',
          updatedAt: '2026-05-18T08:30:00.000Z',
          deletedAt: null,
          schemaVersion: 1,
          sourceDeviceId: 'device_test',
        },
      ],
      balanceEntries: [
        {
          id: 'balance-entry-1',
          userId: TEST_USER_ID,
          amount: 100,
          typeId: 'income',
          createdAt: '2026-05-19T08:00:00.000Z',
          updatedAt: '2026-05-19T08:30:00.000Z',
          deletedAt: null,
          schemaVersion: 1,
          sourceDeviceId: 'device_test',
        },
      ],
    });

    expect(from).toHaveBeenNthCalledWith(1, 'remote_categories');
    expect(from).toHaveBeenNthCalledWith(2, 'remote_transactions');
    expect(from).toHaveBeenNthCalledWith(3, 'remote_balance_types');
    expect(from).toHaveBeenNthCalledWith(4, 'remote_balance_entries');
    expect(read).toHaveBeenNthCalledWith(
      1,
      'remote_categories',
      expect.stringContaining('user_id'),
      'user_id',
      TEST_USER_ID,
    );
    expect(read).toHaveBeenNthCalledWith(
      2,
      'remote_transactions',
      expect.stringContaining('category_id'),
      'user_id',
      TEST_USER_ID,
    );
    expect(read).toHaveBeenNthCalledWith(
      3,
      'remote_balance_types',
      expect.stringContaining('sort_order'),
      'user_id',
      TEST_USER_ID,
    );
    expect(read).toHaveBeenNthCalledWith(
      4,
      'remote_balance_entries',
      expect.stringContaining('type_id'),
      'user_id',
      TEST_USER_ID,
    );
  });

  it('maps remote transaction deleted_at tombstones', async () => {
    const { client } = createMockRemoteRestoreClient({
      remoteTransactions: [
        createTransactionRow({
          id: 'txn-deleted',
          updated_at: '2026-05-20T08:00:00.000Z',
          deleted_at: '2026-05-20T08:00:00.000Z',
        }),
      ],
    });
    const adapter = createSupabaseRemoteRestoreAdapter({
      getClient: () => client as never,
    });

    await expect(adapter.readBackup({ userId: TEST_USER_ID })).resolves.toEqual(
      expect.objectContaining({
        transactions: [
          expect.objectContaining({
            id: 'txn-deleted',
            updatedAt: '2026-05-20T08:00:00.000Z',
            deletedAt: '2026-05-20T08:00:00.000Z',
          }),
        ],
      }),
    );
  });

  it('returns a safe recoverable service failure when the Supabase client is unavailable', async () => {
    const adapter = createSupabaseRemoteRestoreAdapter({
      getClient: () => null,
    });
    const service = createRestoreService({
      adapter,
      dataTarget: createDataTarget(),
      isRestoreEnabled: true,
    });

    const result = await service.runRestore({
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
    expect(JSON.stringify(result)).not.toContain('Supabase');
    expect(JSON.stringify(result)).not.toContain('access_token');
  });

  it('returns a safe recoverable service failure when a remote read fails', async () => {
    const { client } = createMockRemoteRestoreClient({
      failTable: 'remote_transactions',
    });
    const adapter = createSupabaseRemoteRestoreAdapter({
      getClient: () => client as never,
    });
    const service = createRestoreService({
      adapter,
      dataTarget: createDataTarget(),
      isRestoreEnabled: true,
    });

    const result = await service.runRestore({
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
    expect(JSON.stringify(result)).not.toContain(RAW_BACKEND_ERROR);
    expect(JSON.stringify(result)).not.toContain('localOwnerId');
  });

  it('returns an empty restore state when all remote tables are empty', async () => {
    const { client } = createMockRemoteRestoreClient({
      remoteBalanceEntries: [],
      remoteBalanceTypes: [],
      remoteCategories: [],
      remoteTransactions: [],
    });
    const adapter = createSupabaseRemoteRestoreAdapter({
      getClient: () => client as never,
    });
    const dataTarget = createDataTarget();
    const service = createRestoreService({
      adapter,
      dataTarget,
      isRestoreEnabled: true,
    });

    await expect(
      service.runRestore({
        auth: {
          status: 'authenticated',
          userId: TEST_USER_ID,
        },
      }),
    ).resolves.toMatchObject({
      status: 'empty',
      restoredTransactionsCount: 0,
      restoredCategoriesCount: 0,
      restoredBalanceTypesCount: 0,
      restoredBalanceEntriesCount: 0,
    });
    expect(dataTarget.restoreBackup).not.toHaveBeenCalled();
  });
});
