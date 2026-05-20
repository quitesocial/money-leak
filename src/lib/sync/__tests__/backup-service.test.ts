import { describe, expect, it, jest } from '@jest/globals';

import { createBackupService } from '@/lib/sync/backup-service';
import { createFakeRemoteBackupAdapter } from '@/lib/sync/fake-remote-backup-adapter';
import {
  createLocalBackupDataSource,
  type LocalBackupDataSource,
} from '@/lib/sync/local-backup-data-source';
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
    createdAt: new Date(TEST_NOW).toISOString(),
    includesTombstones: false,
    transactions: [],
    categories: [],
    ...overrides,
  };
}

describe('backup service foundation', () => {
  it('local backup data source reads configured boundaries without tombstones', async () => {
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

    const dataSource = createLocalBackupDataSource({
      readTransactions,
      readCategories,
    });

    await expect(dataSource.getBackupData()).resolves.toEqual({
      transactions: [expect.objectContaining({ id: 'txn-active' })],
      categories: [
        expect.objectContaining({
          id: 'coffee',
          isArchived: true,
        }),
      ],
    });
    expect(readTransactions).toHaveBeenCalledTimes(1);
    expect(readCategories).toHaveBeenCalledTimes(1);
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

  it('excludes deleted rows and includes archived categories explicitly', async () => {
    const adapter = createFakeRemoteBackupAdapter();
    const service = createBackupService({
      adapter,
      dataSource: createDataSource({
        transactions: [
          createTransaction({ id: 'txn-active' }),
          createTransaction({
            id: 'txn-deleted',
            deletedAt: Date.parse('2026-05-20T08:00:00.000Z'),
          }),
        ],
        categories: [
          createCategory({ id: 'coffee', isArchived: true }),
          createCategory({
            id: 'deleted-category',
            deletedAt: Date.parse('2026-05-20T08:00:00.000Z'),
          }),
        ],
      }),
      isBackupEnabled: true,
      now: () => TEST_NOW,
    });

    const payload = await service.prepareBackupPayload({
      userId: TEST_USER_ID,
    });

    expect(payload.includesTombstones).toBe(false);
    expect(payload.transactions.map((transaction) => transaction.id)).toEqual([
      'txn-active',
    ]);
    expect(payload.categories).toEqual([
      expect.objectContaining({
        id: 'coffee',
        isArchived: true,
        deletedAt: null,
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
  });
});
