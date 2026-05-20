import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import type { AuthSession } from '@/types/auth';

import { linkLocalAccount } from '../account-linking.native';

const mockInitDatabase = jest.fn<() => Promise<void>>();
const mockGetDatabase = jest.fn<() => Promise<FakeAccountLinkingDatabase>>();

const mockEnsureLocalIdentity =
  jest.fn<() => Promise<{ localOwnerId: string; deviceId: string }>>();

jest.mock('../database.native', () => ({
  initDatabase: () => mockInitDatabase(),
  getDatabase: () => mockGetDatabase(),
}));

jest.mock('../local-identity.native', () => ({
  ensureLocalIdentity: () => mockEnsureLocalIdentity(),
}));

type RawTransactionRow = {
  id: string;
  owner_id: string;
  updated_at: number;
  deleted_at: number | null;
  source_device_id: string;
};

type RawCategoryRow = {
  id: string;
  owner_id: string;
  updated_at: number;
  deleted_at: number | null;
  source_device_id: string;
};

class FakeAccountLinkingDatabase {
  appMetadata = new Map<string, { value: string; updated_at: number }>();
  transactions: RawTransactionRow[] = [];
  categories: RawCategoryRow[] = [];

  async getFirstAsync<T>(source: string, ...params: unknown[]): Promise<T> {
    const ownerId = params[0];

    if (typeof ownerId !== 'string') {
      return { count: 0 } as T;
    }

    if (source.includes('FROM transactions')) {
      return {
        count: this.transactions.filter((row) => row.owner_id === ownerId)
          .length,
      } as T;
    }

    if (source.includes('FROM categories')) {
      return {
        count: this.categories.filter((row) => row.owner_id === ownerId).length,
      } as T;
    }

    return { count: 0 } as T;
  }

  async runAsync(source: string, ...params: unknown[]) {
    if (source.includes('UPDATE transactions')) {
      return this.linkRows(this.transactions, params);
    }

    if (source.includes('UPDATE categories')) {
      return this.linkRows(this.categories, params);
    }

    if (source.includes('INSERT OR REPLACE INTO app_metadata')) {
      const [key, value, updatedAt] = params;

      if (
        typeof key === 'string' &&
        typeof value === 'string' &&
        typeof updatedAt === 'number'
      ) {
        this.appMetadata.set(key, {
          value,
          updated_at: updatedAt,
        });
      }

      return { changes: 1 };
    }

    return { changes: 0 };
  }

  async withExclusiveTransactionAsync(
    callback: (
      transactionDatabase: FakeAccountLinkingDatabase,
    ) => Promise<void>,
  ) {
    await callback(this);
  }

  private linkRows(
    rows: (RawCategoryRow | RawTransactionRow)[],
    params: unknown[],
  ) {
    const [appUserId, updatedAt, sourceDeviceId, localOwnerId] = params;
    let changes = 0;

    for (const row of rows) {
      if (row.owner_id !== localOwnerId) continue;

      row.owner_id = appUserId as string;
      row.updated_at = updatedAt as number;
      row.source_device_id = sourceDeviceId as string;
      changes += 1;
    }

    return { changes };
  }
}

const TEST_SESSION: AuthSession = {
  provider: 'google',
  createdAt: 1760000000000,
  expiresAt: null,
  user: {
    id: 'auth-user-test',
    provider: 'google',
    email: 'test@example.com',
    displayName: 'Test User',
    photoUrl: null,
  },
};

function createTransactionRow(
  overrides: Partial<RawTransactionRow> & Pick<RawTransactionRow, 'id'>,
): RawTransactionRow {
  return {
    owner_id: 'local_test-owner',
    updated_at: 1000,
    deleted_at: null,
    source_device_id: 'device_seed',
    ...overrides,
  };
}

function createCategoryRow(
  overrides: Partial<RawCategoryRow> & Pick<RawCategoryRow, 'id'>,
): RawCategoryRow {
  return {
    owner_id: 'local_test-owner',
    updated_at: 1000,
    deleted_at: null,
    source_device_id: 'device_seed',
    ...overrides,
  };
}

describe('native local account linking', () => {
  let database: FakeAccountLinkingDatabase;

  beforeEach(() => {
    jest.restoreAllMocks();

    database = new FakeAccountLinkingDatabase();

    mockInitDatabase.mockResolvedValue(undefined);
    mockGetDatabase.mockResolvedValue(database);
    mockEnsureLocalIdentity.mockResolvedValue({
      localOwnerId: 'local_test-owner',
      deviceId: 'device_test-device',
    });
    jest.spyOn(Date, 'now').mockReturnValue(5000);
  });

  it('relinks guest transactions to the authenticated app user id', async () => {
    database.transactions.push(createTransactionRow({ id: 'txn-guest' }));

    await expect(linkLocalAccount(TEST_SESSION)).resolves.toMatchObject({
      status: 'linked',
      linkedTransactionsCount: 1,
      linkedCategoriesCount: 0,
      alreadyLinkedTransactionsCount: 0,
      alreadyLinkedCategoriesCount: 0,
    });

    expect(database.transactions).toEqual([
      {
        id: 'txn-guest',
        owner_id: 'auth-user-test',
        updated_at: 5000,
        deleted_at: null,
        source_device_id: 'device_test-device',
      },
    ]);
  });

  it('relinks guest categories to the authenticated app user id', async () => {
    database.categories.push(createCategoryRow({ id: 'coffee' }));

    await expect(linkLocalAccount(TEST_SESSION)).resolves.toMatchObject({
      status: 'linked',
      linkedTransactionsCount: 0,
      linkedCategoriesCount: 1,
    });

    expect(database.categories).toEqual([
      {
        id: 'coffee',
        owner_id: 'auth-user-test',
        updated_at: 5000,
        deleted_at: null,
        source_device_id: 'device_test-device',
      },
    ]);
  });

  it('keeps repeated linking idempotent without duplicating rows', async () => {
    database.transactions.push(createTransactionRow({ id: 'txn-guest' }));
    database.categories.push(createCategoryRow({ id: 'coffee' }));

    await linkLocalAccount(TEST_SESSION);
    const secondResult = await linkLocalAccount(TEST_SESSION);

    expect(secondResult).toMatchObject({
      status: 'already_linked',
      linkedTransactionsCount: 0,
      linkedCategoriesCount: 0,
      alreadyLinkedTransactionsCount: 1,
      alreadyLinkedCategoriesCount: 1,
    });

    expect(database.transactions).toHaveLength(1);
    expect(database.categories).toHaveLength(1);
    expect(database.transactions[0].owner_id).toBe('auth-user-test');
    expect(database.categories[0].owner_id).toBe('auth-user-test');
  });

  it('does not duplicate rows already owned by the authenticated app user', async () => {
    database.transactions.push(
      createTransactionRow({
        id: 'txn-auth',
        owner_id: 'auth-user-test',
      }),
    );
    database.categories.push(
      createCategoryRow({
        id: 'coffee',
        owner_id: 'auth-user-test',
      }),
    );

    await expect(linkLocalAccount(TEST_SESSION)).resolves.toMatchObject({
      status: 'already_linked',
      linkedTransactionsCount: 0,
      linkedCategoriesCount: 0,
      alreadyLinkedTransactionsCount: 1,
      alreadyLinkedCategoriesCount: 1,
    });

    expect(database.transactions).toHaveLength(1);
    expect(database.categories).toHaveLength(1);
  });

  it('does not touch rows owned by another owner id', async () => {
    database.transactions.push(
      createTransactionRow({
        id: 'txn-other',
        owner_id: 'other-owner',
      }),
    );
    database.categories.push(
      createCategoryRow({
        id: 'other-category',
        owner_id: 'other-owner',
      }),
    );

    await linkLocalAccount(TEST_SESSION);

    expect(database.transactions[0]).toMatchObject({
      owner_id: 'other-owner',
      updated_at: 1000,
      source_device_id: 'device_seed',
    });
    expect(database.categories[0]).toMatchObject({
      owner_id: 'other-owner',
      updated_at: 1000,
      source_device_id: 'device_seed',
    });
  });

  it('preserves and relinks soft-deleted transaction tombstones', async () => {
    database.transactions.push(
      createTransactionRow({
        id: 'txn-deleted',
        deleted_at: 3000,
      }),
    );

    await linkLocalAccount(TEST_SESSION);

    expect(database.transactions[0]).toMatchObject({
      id: 'txn-deleted',
      owner_id: 'auth-user-test',
      updated_at: 5000,
      deleted_at: 3000,
      source_device_id: 'device_test-device',
    });
  });

  it('writes non-secret account linking metadata markers', async () => {
    database.transactions.push(createTransactionRow({ id: 'txn-guest' }));

    await linkLocalAccount(TEST_SESSION);

    expect(database.appMetadata.get('account_linked_app_user_id')).toEqual({
      value: 'auth-user-test',
      updated_at: 5000,
    });
    expect(database.appMetadata.get('account_linked_at')).toEqual({
      value: '5000',
      updated_at: 5000,
    });
  });
});
