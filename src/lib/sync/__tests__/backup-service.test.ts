import { describe, expect, it, jest } from '@jest/globals';

import { createBackupService } from '@/lib/sync/backup-service';
import { createFakeRemoteBackupAdapter } from '@/lib/sync/fake-remote-backup-adapter';
import type { SettingsPreferenceSnapshot } from '@/lib/settings-preferences';
import {
  createLocalBackupDataSource,
  type LocalBackupDataSource,
} from '@/lib/sync/local-backup-data-source';
import type { BackupPayload } from '@/lib/sync/sync-types';
import type { BalanceEntry, BalanceType } from '@/types/balance';
import type { Category } from '@/types/category';
import type { Transaction } from '@/types/transaction';

const mockGetTransactions = jest.fn();
const mockGetTransactionsForBackup = jest.fn();
const mockGetCategories = jest.fn();
const mockGetBalanceEntriesForBackup = jest.fn();
const mockGetBalanceTypesForBackup = jest.fn();

jest.mock('@/db/transactions', () => ({
  getTransactions: (...args: unknown[]) => mockGetTransactions(...args),
  getTransactionsForBackup: (...args: unknown[]) =>
    mockGetTransactionsForBackup(...args),
}));

jest.mock('@/db/categories', () => ({
  getCategories: (...args: unknown[]) => mockGetCategories(...args),
}));

jest.mock('@/db/balance', () => ({
  getBalanceEntriesForBackup: (...args: unknown[]) =>
    mockGetBalanceEntriesForBackup(...args),
  getBalanceTypesForBackup: (...args: unknown[]) =>
    mockGetBalanceTypesForBackup(...args),
}));

const TEST_USER_ID = 'auth-user-test';
const TEST_NOW = Date.parse('2026-05-20T12:00:00.000Z');

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
    iconName: 'tag',
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

function createBalanceType(overrides: Partial<BalanceType> = {}): BalanceType {
  return {
    id: 'income',
    ownerId: TEST_USER_ID,
    name: 'Income',
    createdAt: Date.parse('2026-05-18T08:00:00.000Z'),
    updatedAt: Date.parse('2026-05-18T08:30:00.000Z'),
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
    updatedAt: Date.parse('2026-05-19T08:30:00.000Z'),
    deletedAt: null,
    schemaVersion: 1,
    sourceDeviceId: 'device_test',
    ...overrides,
  };
}

function createSettingsSnapshot(): SettingsPreferenceSnapshot {
  return {
    currency: {
      key: 'currency',
      value: 'Euro',
      updatedAt: Date.parse('2026-05-19T07:00:00.000Z'),
      schemaVersion: 1,
      sourceDeviceId: null,
    },
    language: {
      key: 'language',
      value: 'English',
      updatedAt: Date.parse('2026-05-19T07:05:00.000Z'),
      schemaVersion: 1,
      sourceDeviceId: null,
    },
  };
}

function createDataSource({
  balanceEntries = [createBalanceEntry()],
  balanceTypes = [createBalanceType()],
  transactions = [createTransaction()],
  categories = [createCategory()],
  settings = createSettingsSnapshot(),
}: {
  balanceEntries?: BalanceEntry[];
  balanceTypes?: BalanceType[];
  transactions?: Transaction[];
  categories?: Category[];
  settings?: SettingsPreferenceSnapshot;
} = {}): LocalBackupDataSource {
  return {
    getBackupData: jest.fn(async () => ({
      balanceEntries,
      balanceTypes,
      transactions,
      categories,
      settings,
    })),
  };
}

function createPayload(overrides: Partial<BackupPayload> = {}): BackupPayload {
  return {
    userId: TEST_USER_ID,
    schemaVersion: 2,
    createdAt: new Date(TEST_NOW).toISOString(),
    includesTombstones: true,
    includesBalance: true,
    transactions: [],
    categories: [],
    balanceTypes: [],
    balanceEntries: [],
    ...overrides,
  };
}

describe('backup service foundation', () => {
  it('local backup data source includes transaction tombstones and filters category tombstones', async () => {
    const readTransactions = jest.fn(async () => [
      createTransaction({ id: 'txn-active' }),
      createTransaction({
        id: 'txn-deleted',
        deletedAt: Date.parse('2026-05-20T08:00:00.000Z'),
      }),
    ]);

    const readCategories = jest.fn(async () => [
      createCategory({ id: 'coffee', isArchived: true }),
      createCategory({
        id: 'deleted-category',
        deletedAt: Date.parse('2026-05-20T08:00:00.000Z'),
      }),
    ]);

    const readBalanceTypes = jest.fn(async () => [
      createBalanceType({ id: 'income' }),
      createBalanceType({
        id: 'deleted-balance-type',
        deletedAt: Date.parse('2026-05-20T08:00:00.000Z'),
      }),
    ]);

    const readBalanceEntries = jest.fn(async () => [
      createBalanceEntry({ id: 'balance-active' }),
      createBalanceEntry({
        id: 'balance-deleted',
        deletedAt: Date.parse('2026-05-20T08:00:00.000Z'),
      }),
    ]);

    const dataSource = createLocalBackupDataSource({
      readTransactions,
      readCategories,
      readBalanceTypes,
      readBalanceEntries,
      readSettings: jest.fn(async () => createSettingsSnapshot()),
    });

    await expect(dataSource.getBackupData()).resolves.toEqual({
      transactions: [
        expect.objectContaining({ id: 'txn-active' }),
        expect.objectContaining({
          id: 'txn-deleted',
          deletedAt: Date.parse('2026-05-20T08:00:00.000Z'),
        }),
      ],
      categories: [
        expect.objectContaining({
          id: 'coffee',
          isArchived: true,
        }),
      ],
      balanceTypes: [
        expect.objectContaining({ id: 'income' }),
        expect.objectContaining({
          id: 'deleted-balance-type',
          deletedAt: Date.parse('2026-05-20T08:00:00.000Z'),
        }),
      ],
      balanceEntries: [
        expect.objectContaining({ id: 'balance-active' }),
        expect.objectContaining({
          id: 'balance-deleted',
          deletedAt: Date.parse('2026-05-20T08:00:00.000Z'),
        }),
      ],
      settings: createSettingsSnapshot(),
    });
    expect(readTransactions).toHaveBeenCalledTimes(1);
    expect(readCategories).toHaveBeenCalledTimes(1);
    expect(readBalanceTypes).toHaveBeenCalledTimes(1);
    expect(readBalanceEntries).toHaveBeenCalledTimes(1);
  });

  it('maps local transactions and categories into the remote backup contract', async () => {
    const adapter = createFakeRemoteBackupAdapter();
    const service = createBackupService({
      adapter,
      dataSource: createDataSource(),
      isBackupEnabled: true,
      now: () => TEST_NOW,
    });

    const payload = await service.prepareBackupPayload({
      userId: ` ${TEST_USER_ID} `,
    });

    expect(payload).toMatchObject({
      userId: TEST_USER_ID,
      schemaVersion: 2,
      createdAt: '2026-05-20T12:00:00.000Z',
      includesTombstones: true,
      includesBalance: true,
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
      settings: [
        {
          key: 'currency',
          userId: TEST_USER_ID,
          value: 'Euro',
          updatedAt: '2026-05-19T07:00:00.000Z',
          schemaVersion: 1,
          sourceDeviceId: null,
        },
        {
          key: 'language',
          userId: TEST_USER_ID,
          value: 'English',
          updatedAt: '2026-05-19T07:05:00.000Z',
          schemaVersion: 1,
          sourceDeviceId: null,
        },
      ],
    });
  });

  it('requires an authenticated user id before remote writes', async () => {
    const adapter = createFakeRemoteBackupAdapter();
    const dataSource = createDataSource();
    const service = createBackupService({
      adapter,
      dataSource,
      isBackupEnabled: true,
      now: () => TEST_NOW,
    });

    await expect(
      adapter.writeBackup(createPayload({ userId: '' })),
    ).rejects.toThrow('user id');

    await expect(
      service.runBackup({
        auth: {
          status: 'authenticated',
          userId: '   ',
        },
      }),
    ).resolves.toEqual({
      status: 'skipped',
      payload: null,
      skippedReason: 'missing_user_id',
      isRecoverable: true,
    });

    expect(dataSource.getBackupData).not.toHaveBeenCalled();
    expect(adapter.getWriteCount()).toBe(1);
    expect(adapter.getTransactions()).toEqual([]);
  });

  it('does not attempt backup in guest mode', async () => {
    const adapter = createFakeRemoteBackupAdapter();
    const dataSource = createDataSource();
    const service = createBackupService({
      adapter,
      dataSource,
      isBackupEnabled: true,
      now: () => TEST_NOW,
    });

    await expect(
      service.runBackup({
        auth: {
          status: 'guest',
          userId: null,
        },
      }),
    ).resolves.toEqual({
      status: 'skipped',
      payload: null,
      skippedReason: 'guest_mode',
      isRecoverable: true,
    });

    expect(dataSource.getBackupData).not.toHaveBeenCalled();
    expect(adapter.getWriteCount()).toBe(0);
  });

  it('skips backup when the feature flag is disabled', async () => {
    const adapter = createFakeRemoteBackupAdapter();
    const dataSource = createDataSource();
    const service = createBackupService({
      adapter,
      dataSource,
      isBackupEnabled: false,
      now: () => TEST_NOW,
    });

    await expect(
      service.runBackup({
        auth: {
          status: 'authenticated',
          userId: TEST_USER_ID,
        },
      }),
    ).resolves.toEqual({
      status: 'skipped',
      payload: null,
      skippedReason: 'backup_disabled',
      isRecoverable: true,
    });

    expect(dataSource.getBackupData).not.toHaveBeenCalled();
    expect(adapter.getWriteCount()).toBe(0);
  });

  it('does not mutate local data while preparing a payload', async () => {
    const transactions = [createTransaction()];
    const categories = [createCategory({ isArchived: true })];
    const before = JSON.stringify({ transactions, categories });
    const adapter = createFakeRemoteBackupAdapter();
    const service = createBackupService({
      adapter,
      dataSource: createDataSource({ transactions, categories }),
      isBackupEnabled: true,
      now: () => TEST_NOW,
    });

    await service.prepareBackupPayload({ userId: TEST_USER_ID });

    expect(JSON.stringify({ transactions, categories })).toBe(before);
  });

  it('includes deleted transaction tombstones and archived categories explicitly', async () => {
    const adapter = createFakeRemoteBackupAdapter();
    const service = createBackupService({
      adapter,
      dataSource: createDataSource({
        balanceTypes: [
          createBalanceType({ id: 'income' }),
          createBalanceType({
            id: 'deleted-balance-type',
            deletedAt: Date.parse('2026-05-20T08:00:00.000Z'),
          }),
        ],
        balanceEntries: [
          createBalanceEntry({ id: 'balance-active' }),
          createBalanceEntry({
            id: 'balance-deleted',
            deletedAt: Date.parse('2026-05-20T08:00:00.000Z'),
            updatedAt: Date.parse('2026-05-20T08:00:00.000Z'),
          }),
        ],
        transactions: [
          createTransaction({ id: 'txn-active' }),
          createTransaction({
            id: 'txn-deleted',
            deletedAt: Date.parse('2026-05-20T08:00:00.000Z'),
          }),
        ],
        categories: [createCategory({ id: 'coffee', isArchived: true })],
      }),
      isBackupEnabled: true,
      now: () => TEST_NOW,
    });

    const payload = await service.prepareBackupPayload({
      userId: TEST_USER_ID,
    });

    expect(payload.includesTombstones).toBe(true);
    expect(payload.includesBalance).toBe(true);
    expect(payload.transactions.map((transaction) => transaction.id)).toEqual([
      'txn-active',
      'txn-deleted',
    ]);
    expect(payload.transactions).toEqual([
      expect.objectContaining({
        id: 'txn-active',
        deletedAt: null,
      }),
      expect.objectContaining({
        id: 'txn-deleted',
        deletedAt: '2026-05-20T08:00:00.000Z',
      }),
    ]);
    expect(payload.categories).toEqual([
      expect.objectContaining({
        id: 'coffee',
        isArchived: true,
        deletedAt: null,
      }),
    ]);
    expect(payload.balanceTypes).toEqual([
      expect.objectContaining({
        id: 'income',
        deletedAt: null,
      }),
      expect.objectContaining({
        id: 'deleted-balance-type',
        deletedAt: '2026-05-20T08:00:00.000Z',
      }),
    ]);
    expect(payload.balanceEntries).toEqual([
      expect.objectContaining({
        id: 'balance-active',
        deletedAt: null,
      }),
      expect.objectContaining({
        id: 'balance-deleted',
        deletedAt: '2026-05-20T08:00:00.000Z',
      }),
    ]);
  });

  it('sends transaction tombstones to the remote adapter', async () => {
    const adapter = createFakeRemoteBackupAdapter();
    const service = createBackupService({
      adapter,
      dataSource: createDataSource({
        transactions: [
          createTransaction({
            id: 'txn-deleted',
            deletedAt: Date.parse('2026-05-20T08:00:00.000Z'),
            updatedAt: Date.parse('2026-05-20T08:00:00.000Z'),
          }),
        ],
      }),
      isBackupEnabled: true,
      now: () => TEST_NOW,
    });

    await service.runBackup({
      auth: {
        status: 'authenticated',
        userId: TEST_USER_ID,
      },
    });

    expect(adapter.getTransactions()).toEqual([
      expect.objectContaining({
        id: 'txn-deleted',
        deletedAt: '2026-05-20T08:00:00.000Z',
      }),
    ]);
  });

  it('fake adapter upserts without duplicates by user id and row id', async () => {
    const adapter = createFakeRemoteBackupAdapter();
    const dataSource = createDataSource();
    const service = createBackupService({
      adapter,
      dataSource,
      isBackupEnabled: true,
      now: () => TEST_NOW,
    });

    await service.runBackup({
      auth: {
        status: 'authenticated',
        userId: TEST_USER_ID,
      },
    });

    await service.runBackup({
      auth: {
        status: 'authenticated',
        userId: TEST_USER_ID,
      },
    });

    await service.runBackup({
      auth: {
        status: 'authenticated',
        userId: 'second-user',
      },
    });

    expect(adapter.getTransactions()).toHaveLength(2);
    expect(adapter.getCategories()).toHaveLength(2);
    expect(adapter.getBalanceTypes()).toHaveLength(2);
    expect(adapter.getBalanceEntries()).toHaveLength(2);
    expect(adapter.getSettings()).toHaveLength(4);
    expect(
      adapter
        .getTransactions()
        .map((transaction) => [transaction.userId, transaction.id]),
    ).toEqual([
      [TEST_USER_ID, 'txn-1'],
      ['second-user', 'txn-1'],
    ]);
  });

  it('returns a safe recoverable result when local reads fail', async () => {
    const adapter = createFakeRemoteBackupAdapter();
    const dataSource: LocalBackupDataSource = {
      getBackupData: jest.fn(async () => {
        throw new Error('raw local owner id failure');
      }),
    };

    const service = createBackupService({
      adapter,
      dataSource,
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
        code: 'local_read_failed',
        isRecoverable: true,
      },
    });
    expect(JSON.stringify(result)).not.toContain('raw local owner id');
    expect(adapter.getWriteCount()).toBe(0);
  });

  it('returns a safe recoverable result when the adapter fails', async () => {
    const adapter = createFakeRemoteBackupAdapter({ shouldFail: true });
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
    expect(JSON.stringify(result)).not.toContain('Fake remote backup failure');
    expect(adapter.getTransactions()).toEqual([]);
    expect(adapter.getCategories()).toEqual([]);
    expect(adapter.getBalanceTypes()).toEqual([]);
    expect(adapter.getBalanceEntries()).toEqual([]);
  });
});
