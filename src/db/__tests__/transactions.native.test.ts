import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { parseTransactionsCsv } from '@/features/export/import-transactions-csv';
import type {
  TransactionInput,
  TransactionRestoreInput,
} from '@/types/transaction';

import {
  applyTransactionSyncChanges,
  createTransaction,
  deleteTransaction,
  getTransactions,
  getTransactionsForBackup,
  importTransactions,
  restoreTransactionTombstones,
  restoreTransactions,
  updateTransaction,
} from '../transactions.native';

const mockInitDatabase = jest.fn<() => Promise<void>>();
const mockGetDatabase = jest.fn<() => Promise<FakeTransactionsDatabase>>();
const mockEnsureArchivedCategoriesForIds =
  jest.fn<(categoryIds: string[]) => Promise<void>>();

const mockEnsureLocalIdentity =
  jest.fn<() => Promise<{ localOwnerId: string; deviceId: string }>>();

jest.mock('../database.native', () => ({
  initDatabase: () => mockInitDatabase(),
  getDatabase: () => mockGetDatabase(),
}));

jest.mock('../categories.native', () => ({
  ensureArchivedCategoriesForIds: (categoryIds: string[]) =>
    mockEnsureArchivedCategoriesForIds(categoryIds),
}));

jest.mock('../local-identity.native', () => ({
  ensureLocalIdentity: () => mockEnsureLocalIdentity(),
}));

type RawTransactionRow = {
  id: string;
  owner_id: string;
  amount: number;
  category: string;
  is_leak: number;
  leak_reason: string | null;
  note: string | null;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
  schema_version: number;
  source_device_id: string;
};

class FakeTransactionsDatabase {
  transactions: RawTransactionRow[] = [];

  async runAsync(source: string, ...params: unknown[]) {
    if (source.includes('INSERT INTO transactions')) {
      this.insertTransaction(params, false);
      return { changes: 1 };
    }

    if (source.includes('INSERT OR IGNORE INTO transactions')) {
      return { changes: this.insertTransaction(params, true) ? 1 : 0 };
    }

    if (source.includes('amount = ?')) {
      return {
        changes: this.updateTransaction(params, {
          includeDeleted: source.includes('deleted_at = NULL'),
        })
          ? 1
          : 0,
      };
    }

    if (source.includes('deleted_at = ?')) {
      return { changes: this.softDeleteTransaction(params) ? 1 : 0 };
    }

    return { changes: 0 };
  }

  async getAllAsync<T>(source: string): Promise<T[]> {
    if (!source.includes('FROM transactions')) return [];

    const shouldFilterDeleted = source.includes('WHERE deleted_at IS NULL');

    return this.transactions
      .filter(
        (transaction) =>
          !shouldFilterDeleted || transaction.deleted_at === null,
      )
      .sort((firstTransaction, secondTransaction) => {
        if (secondTransaction.created_at !== firstTransaction.created_at) {
          return secondTransaction.created_at - firstTransaction.created_at;
        }

        return secondTransaction.id.localeCompare(firstTransaction.id);
      }) as T[];
  }

  async withExclusiveTransactionAsync(
    callback: (transactionDatabase: FakeTransactionsDatabase) => Promise<void>,
  ) {
    await callback(this);
  }

  private insertTransaction(params: unknown[], ignoreDuplicates: boolean) {
    const [
      id,
      ownerId,
      amount,
      category,
      isLeak,
      leakReason,
      note,
      createdAt,
      updatedAt,
      deletedAt,
      schemaVersion,
      sourceDeviceId,
    ] = params;

    if (
      typeof id !== 'string' ||
      typeof ownerId !== 'string' ||
      typeof amount !== 'number' ||
      typeof category !== 'string' ||
      typeof isLeak !== 'number' ||
      typeof createdAt !== 'number' ||
      typeof updatedAt !== 'number' ||
      typeof schemaVersion !== 'number' ||
      typeof sourceDeviceId !== 'string'
    ) {
      throw new Error('Invalid transaction insert params.');
    }

    if (this.transactions.some((transaction) => transaction.id === id)) {
      if (ignoreDuplicates) return false;

      throw new Error('Duplicate transaction id.');
    }

    this.transactions.push({
      id,
      owner_id: ownerId,
      amount,
      category,
      is_leak: isLeak,
      leak_reason: typeof leakReason === 'string' ? leakReason : null,
      note: typeof note === 'string' ? note : null,
      created_at: createdAt,
      updated_at: updatedAt,
      deleted_at: typeof deletedAt === 'number' ? deletedAt : null,
      schema_version: schemaVersion,
      source_device_id: sourceDeviceId,
    });

    return true;
  }

  private updateTransaction(
    params: unknown[],
    { includeDeleted }: { includeDeleted: boolean },
  ) {
    const [
      amount,
      category,
      isLeak,
      leakReason,
      note,
      updatedAt,
      sourceDeviceId,
      id,
    ] = params;

    const transaction = this.transactions.find(
      (currentTransaction) =>
        currentTransaction.id === id &&
        (includeDeleted || currentTransaction.deleted_at === null),
    );

    if (!transaction) return false;

    transaction.amount = amount as number;
    transaction.category = category as string;
    transaction.is_leak = isLeak as number;
    transaction.leak_reason = leakReason as string | null;
    transaction.note = note as string | null;
    transaction.updated_at = updatedAt as number;
    transaction.deleted_at = null;
    transaction.source_device_id = sourceDeviceId as string;

    return true;
  }

  private softDeleteTransaction(params: unknown[]) {
    const [deletedAt, updatedAt, sourceDeviceId, id] = params;
    const transaction = this.transactions.find(
      (currentTransaction) =>
        currentTransaction.id === id && currentTransaction.deleted_at === null,
    );

    if (!transaction) return false;

    transaction.deleted_at = deletedAt as number;
    transaction.updated_at = updatedAt as number;
    transaction.source_device_id = sourceDeviceId as string;

    return true;
  }
}

function createTransactionInput(
  overrides: Partial<TransactionInput> & Pick<TransactionInput, 'id'>,
): TransactionInput {
  return {
    amount: 12.5,
    category: 'food',
    isLeak: false,
    leakReason: null,
    note: null,
    createdAt: 1000,
    ...overrides,
  };
}

function createTransactionRestoreInput(
  overrides: Partial<TransactionRestoreInput> &
    Pick<TransactionRestoreInput, 'id'>,
): TransactionRestoreInput {
  return {
    amount: 12.5,
    category: 'coffee',
    isLeak: false,
    leakReason: null,
    note: null,
    createdAt: 1000,
    updatedAt: 2000,
    ...overrides,
  };
}

describe('native transaction persistence', () => {
  let database: FakeTransactionsDatabase;

  beforeEach(() => {
    jest.restoreAllMocks();

    database = new FakeTransactionsDatabase();

    mockInitDatabase.mockResolvedValue(undefined);
    mockGetDatabase.mockResolvedValue(database);
    mockEnsureArchivedCategoriesForIds.mockResolvedValue(undefined);
    mockEnsureLocalIdentity.mockResolvedValue({
      localOwnerId: 'local_test-owner',
      deviceId: 'device_test-device',
    });
  });

  it('adds sync-ready fields to new transaction rows', async () => {
    await createTransaction(
      createTransactionInput({
        id: 'txn-new',
        createdAt: 1234,
      }),
    );

    expect(database.transactions[0]).toMatchObject({
      id: 'txn-new',
      owner_id: 'local_test-owner',
      updated_at: 1234,
      deleted_at: null,
      schema_version: 1,
      source_device_id: 'device_test-device',
    });
  });

  it('updates updatedAt when editing a transaction', async () => {
    await createTransaction(createTransactionInput({ id: 'txn-edit' }));

    jest.spyOn(Date, 'now').mockReturnValue(5000);

    await updateTransaction(
      createTransactionInput({
        id: 'txn-edit',
        amount: 20,
        category: 'shopping',
        isLeak: true,
        leakReason: 'impulse',
        note: 'Edited',
      }),
    );

    expect(database.transactions[0]).toMatchObject({
      amount: 20,
      category: 'shopping',
      is_leak: 1,
      leak_reason: 'impulse',
      note: 'Edited',
      updated_at: 5000,
      source_device_id: 'device_test-device',
    });
  });

  it('hides soft-deleted rows from normal transaction reads', async () => {
    await createTransaction(createTransactionInput({ id: 'txn-visible' }));
    await createTransaction(createTransactionInput({ id: 'txn-deleted' }));

    jest.spyOn(Date, 'now').mockReturnValue(6000);

    await deleteTransaction('txn-deleted');

    expect(await getTransactions()).toHaveLength(1);
    expect((await getTransactions())[0].id).toBe('txn-visible');
    expect((await getTransactionsForBackup()).map((row) => row.id)).toEqual([
      'txn-visible',
      'txn-deleted',
    ]);
    expect(
      database.transactions.find((row) => row.id === 'txn-deleted'),
    ).toMatchObject({
      deleted_at: 6000,
      updated_at: 6000,
    });
  });

  it('imports CSV v1 rows with local metadata while preserving duplicate ignores', async () => {
    const { transactions } = parseTransactionsCsv(
      [
        'id,amount,category,isLeak,leakReason,note,createdAt',
        'txn-import,9.5,coffee,false,,,2025-01-01T12:00:00.000Z',
        'txn-import,10,food,false,,,2025-01-02T12:00:00.000Z',
      ].join('\n'),
    );

    await expect(importTransactions(transactions)).resolves.toBe(1);

    expect(database.transactions).toHaveLength(1);
    expect(database.transactions[0]).toMatchObject({
      id: 'txn-import',
      owner_id: 'local_test-owner',
      updated_at: Date.parse('2025-01-01T12:00:00.000Z'),
      deleted_at: null,
      schema_version: 1,
      source_device_id: 'device_test-device',
    });
  });

  it('restores backup rows without duplicating or overwriting existing local rows', async () => {
    await createTransaction(
      createTransactionInput({
        id: 'txn-existing',
        amount: 7,
        category: 'food',
        createdAt: 500,
      }),
    );
    await createTransaction(
      createTransactionInput({
        id: 'txn-local-only',
        amount: 3,
        category: 'transport',
        createdAt: 600,
      }),
    );

    await expect(
      restoreTransactions([
        createTransactionRestoreInput({
          id: 'txn-existing',
          amount: 99,
          category: 'shopping',
          updatedAt: 9000,
        }),
        createTransactionRestoreInput({
          id: 'txn-restored',
          amount: 11,
          category: 'coffee',
          isLeak: true,
          leakReason: 'impulse',
          note: 'Remote row',
          createdAt: 7000,
          updatedAt: 8000,
        }),
      ]),
    ).resolves.toBe(1);

    await expect(
      restoreTransactions([
        createTransactionRestoreInput({
          id: 'txn-restored',
          amount: 11,
          category: 'coffee',
          createdAt: 7000,
          updatedAt: 8000,
        }),
      ]),
    ).resolves.toBe(0);

    expect(database.transactions).toHaveLength(3);
    expect(
      database.transactions.find((row) => row.id === 'txn-existing'),
    ).toMatchObject({
      amount: 7,
      category: 'food',
      updated_at: 500,
    });
    expect(
      database.transactions.find((row) => row.id === 'txn-local-only'),
    ).toMatchObject({
      amount: 3,
      category: 'transport',
      deleted_at: null,
    });
    expect(
      database.transactions.find((row) => row.id === 'txn-restored'),
    ).toMatchObject({
      owner_id: 'local_test-owner',
      amount: 11,
      category: 'coffee',
      is_leak: 1,
      leak_reason: 'impulse',
      note: 'Remote row',
      created_at: 7000,
      updated_at: 8000,
      deleted_at: null,
      schema_version: 1,
      source_device_id: 'device_test-device',
    });
    expect(mockEnsureArchivedCategoriesForIds).toHaveBeenCalledWith([
      'shopping',
      'coffee',
    ]);
  });

  it('restores transaction tombstones only for matching active local rows', async () => {
    await createTransaction(
      createTransactionInput({
        id: 'txn-delete-me',
        amount: 7,
        category: 'food',
        createdAt: 500,
      }),
    );
    await createTransaction(
      createTransactionInput({
        id: 'txn-local-only',
        amount: 3,
        category: 'transport',
        createdAt: 600,
      }),
    );

    await expect(
      restoreTransactionTombstones([
        {
          id: 'txn-delete-me',
          updatedAt: 9000,
          deletedAt: 9000,
        },
        {
          id: 'txn-missing',
          updatedAt: 9100,
          deletedAt: 9100,
        },
      ]),
    ).resolves.toBe(1);

    await expect(
      restoreTransactionTombstones([
        {
          id: 'txn-delete-me',
          updatedAt: 9000,
          deletedAt: 9000,
        },
      ]),
    ).resolves.toBe(0);

    expect(await getTransactions()).toEqual([
      expect.objectContaining({
        id: 'txn-local-only',
        deletedAt: null,
      }),
    ]);
    expect(
      database.transactions.find((row) => row.id === 'txn-delete-me'),
    ).toMatchObject({
      deleted_at: 9000,
      updated_at: 9000,
      source_device_id: 'device_test-device',
    });
    expect(
      database.transactions.find((row) => row.id === 'txn-local-only'),
    ).toMatchObject({
      amount: 3,
      category: 'transport',
      deleted_at: null,
    });
    expect(database.transactions.some((row) => row.id === 'txn-missing')).toBe(
      false,
    );
  });

  it('applies sync transaction upserts with LWW overwrite semantics', async () => {
    await createTransaction(
      createTransactionInput({
        id: 'txn-existing',
        amount: 7,
        category: 'food',
        createdAt: 500,
      }),
    );
    await createTransaction(
      createTransactionInput({
        id: 'txn-deleted',
        amount: 3,
        category: 'transport',
        createdAt: 600,
      }),
    );
    await deleteTransaction('txn-deleted');

    await expect(
      applyTransactionSyncChanges({
        upserts: [
          createTransactionRestoreInput({
            id: 'txn-existing',
            amount: 99,
            category: 'shopping',
            isLeak: true,
            leakReason: 'impulse',
            note: 'Remote winner',
            createdAt: 9999,
            updatedAt: 9000,
          }),
          createTransactionRestoreInput({
            id: 'txn-deleted',
            amount: 11,
            category: 'coffee',
            createdAt: 600,
            updatedAt: 9100,
          }),
          createTransactionRestoreInput({
            id: 'txn-new',
            amount: 12,
            category: 'snacks',
            createdAt: 7000,
            updatedAt: 9200,
          }),
        ],
        tombstones: [],
      }),
    ).resolves.toEqual({
      upsertedTransactionsCount: 3,
      deletedTransactionsCount: 0,
    });

    expect(
      database.transactions.find((row) => row.id === 'txn-existing'),
    ).toMatchObject({
      amount: 99,
      category: 'shopping',
      created_at: 500,
      updated_at: 9000,
      deleted_at: null,
    });
    expect(
      database.transactions.find((row) => row.id === 'txn-deleted'),
    ).toMatchObject({
      amount: 11,
      category: 'coffee',
      created_at: 600,
      updated_at: 9100,
      deleted_at: null,
    });
    expect(
      database.transactions.find((row) => row.id === 'txn-new'),
    ).toMatchObject({
      owner_id: 'local_test-owner',
      amount: 12,
      category: 'snacks',
      created_at: 7000,
      updated_at: 9200,
      deleted_at: null,
    });
    expect(mockEnsureArchivedCategoriesForIds).toHaveBeenCalledWith([
      'shopping',
      'coffee',
      'snacks',
    ]);
  });

  it('applies sync transaction tombstones without creating visible orphan rows', async () => {
    await createTransaction(
      createTransactionInput({
        id: 'txn-delete-me',
        amount: 7,
        category: 'food',
        createdAt: 500,
      }),
    );

    await expect(
      applyTransactionSyncChanges({
        upserts: [],
        tombstones: [
          {
            id: 'txn-delete-me',
            updatedAt: 9000,
            deletedAt: 9000,
          },
          {
            id: 'txn-missing',
            updatedAt: 9100,
            deletedAt: 9100,
          },
        ],
      }),
    ).resolves.toEqual({
      upsertedTransactionsCount: 0,
      deletedTransactionsCount: 1,
    });

    expect(await getTransactions()).toEqual([]);
    expect(
      database.transactions.find((row) => row.id === 'txn-delete-me'),
    ).toMatchObject({
      deleted_at: 9000,
      updated_at: 9000,
    });
    expect(database.transactions.some((row) => row.id === 'txn-missing')).toBe(
      false,
    );
  });
});
