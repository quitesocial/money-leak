import { describe, expect, it, jest } from '@jest/globals';

import { createLocalRestoreDataTarget } from '@/lib/sync/local-restore-data-target';
import type { RestorePayload } from '@/lib/sync/sync-types';
import type { CategoryInput } from '@/types/category';
import type {
  TransactionRestoreInput,
  TransactionTombstoneRestoreInput,
} from '@/types/transaction';

const mockGetCategories = jest.fn();
const mockRestoreCategories = jest.fn();
const mockGetTransactions = jest.fn();
const mockRestoreTransactions = jest.fn();
const mockRestoreTransactionTombstones = jest.fn();

jest.mock('@/db/categories', () => ({
  getCategories: (...args: unknown[]) => mockGetCategories(...args),
  restoreCategories: (...args: unknown[]) => mockRestoreCategories(...args),
}));

jest.mock('@/db/transactions', () => ({
  getTransactions: (...args: unknown[]) => mockGetTransactions(...args),
  restoreTransactions: (...args: unknown[]) => mockRestoreTransactions(...args),
  restoreTransactionTombstones: (...args: unknown[]) =>
    mockRestoreTransactionTombstones(...args),
}));

const TEST_USER_ID = 'user-test';

function createPayload(
  overrides: Partial<RestorePayload> = {},
): RestorePayload {
  return {
    userId: TEST_USER_ID,
    schemaVersion: 1,
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
    ...overrides,
  };
}

describe('local restore data target', () => {
  it('reports whether local transaction or category data exists', async () => {
    const target = createLocalRestoreDataTarget({
      readCategories: jest.fn(async () => []),
      readTransactions: jest.fn(async () => [
        {
          id: 'txn-local',
          ownerId: 'local-owner',
          amount: 4,
          category: 'food',
          isLeak: false,
          leakReason: null,
          note: null,
          createdAt: 1000,
          updatedAt: 1000,
          deletedAt: null,
          schemaVersion: 1,
          sourceDeviceId: 'device-test',
        },
      ]),
    });

    await expect(target.hasLocalData()).resolves.toBe(true);
  });

  it('writes remote categories before active transactions and tombstones', async () => {
    const calls: string[] = [];
    const writeCategories = jest.fn(async () => {
      calls.push('categories');

      return 1;
    });
    const writeTransactions = jest.fn(async () => {
      calls.push('transactions');

      return 1;
    });
    const writeTransactionTombstones = jest.fn(async () => {
      calls.push('tombstones');

      return 0;
    });
    const target = createLocalRestoreDataTarget({
      writeCategories,
      writeTransactions,
      writeTransactionTombstones,
    });

    await expect(target.restoreBackup(createPayload())).resolves.toEqual({
      restoredCategoriesCount: 1,
      restoredTransactionsCount: 1,
    });

    expect(calls).toEqual(['categories', 'transactions', 'tombstones']);
  });

  it('maps remote category_id back to local transaction.category', async () => {
    const writeCategories = jest.fn(async (_categories: CategoryInput[]) => 1);

    const writeTransactions = jest.fn(
      async (_transactions: TransactionRestoreInput[]) => 1,
    );
    const writeTransactionTombstones = jest.fn(
      async (_tombstones: TransactionTombstoneRestoreInput[]) => 0,
    );
    const target = createLocalRestoreDataTarget({
      writeCategories,
      writeTransactions,
      writeTransactionTombstones,
    });

    await target.restoreBackup(createPayload());

    expect(writeCategories).toHaveBeenCalledWith([
      {
        id: 'coffee',
        name: 'Coffee',
        createdAt: Date.parse('2026-05-18T09:00:00.000Z'),
        updatedAt: Date.parse('2026-05-18T09:30:00.000Z'),
        isDefault: false,
        isArchived: false,
        sortOrder: 10,
      },
    ]);
    expect(writeTransactions).toHaveBeenCalledWith([
      {
        id: 'txn-1',
        amount: 12.5,
        category: 'coffee',
        isLeak: true,
        leakReason: 'impulse',
        note: 'Too easy',
        createdAt: Date.parse('2026-05-19T10:00:00.000Z'),
        updatedAt: Date.parse('2026-05-19T10:05:00.000Z'),
      },
    ]);
    expect(writeTransactionTombstones).toHaveBeenCalledWith([]);
  });

  it('ignores category tombstones and applies transaction tombstones', async () => {
    const writeCategories = jest.fn(async () => 0);
    const writeTransactions = jest.fn(async () => 0);
    const writeTransactionTombstones = jest.fn(async () => 1);
    const target = createLocalRestoreDataTarget({
      writeCategories,
      writeTransactions,
      writeTransactionTombstones,
    });

    await target.restoreBackup(
      createPayload({
        categories: [
          {
            ...createPayload().categories[0],
            deletedAt: '2026-05-20T12:00:00.000Z',
          },
        ],
        transactions: [
          {
            ...createPayload().transactions[0],
            deletedAt: '2026-05-20T12:00:00.000Z',
          },
        ],
      }),
    );

    expect(writeCategories).toHaveBeenCalledWith([]);
    expect(writeTransactions).toHaveBeenCalledWith([]);
    expect(writeTransactionTombstones).toHaveBeenCalledWith([
      {
        id: 'txn-1',
        updatedAt: Date.parse('2026-05-19T10:05:00.000Z'),
        deletedAt: Date.parse('2026-05-20T12:00:00.000Z'),
      },
    ]);
  });

  it('fails safely through the service when a remote timestamp is invalid', async () => {
    const target = createLocalRestoreDataTarget({
      writeCategories: jest.fn(async () => 0),
      writeTransactions: jest.fn(async () => 0),
      writeTransactionTombstones: jest.fn(async () => 0),
    });

    await expect(
      target.restoreBackup(
        createPayload({
          categories: [
            {
              ...createPayload().categories[0],
              createdAt: 'not-a-date',
            },
          ],
        }),
      ),
    ).rejects.toThrow('timestamp');
  });
});
