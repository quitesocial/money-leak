import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import type { BalanceEntryInput, BalanceTypeInput } from '@/types/balance';

import {
  createBalanceEntry,
  createBalanceType,
  getBalanceEntries,
  getBalanceTypes,
} from '../balance.native';

const mockInitDatabase = jest.fn<() => Promise<void>>();
const mockGetDatabase = jest.fn<() => Promise<FakeBalanceDatabase>>();

jest.mock('../database.native', () => ({
  initDatabase: () => mockInitDatabase(),
  getDatabase: () => mockGetDatabase(),
}));

type RawBalanceEntryRow = {
  id: string;
  amount: number;
  type_id: string;
  created_at: number;
};

type RawBalanceTypeRow = {
  id: string;
  name: string;
  created_at: number;
  updated_at: number;
  is_default: number;
  is_archived: number;
  sort_order: number;
};

class FakeBalanceDatabase {
  entries: RawBalanceEntryRow[] = [];
  types: RawBalanceTypeRow[] = [
    {
      id: 'investment',
      name: 'Investment',
      created_at: 1000,
      updated_at: 1000,
      is_default: 1,
      is_archived: 0,
      sort_order: 1,
    },
    {
      id: 'salary',
      name: 'Salary',
      created_at: 1000,
      updated_at: 1000,
      is_default: 1,
      is_archived: 0,
      sort_order: 0,
    },
  ];

  async runAsync(source: string, ...params: unknown[]) {
    if (source.includes('INSERT INTO balance_entries')) {
      this.insertEntry(params);
      return { changes: 1 };
    }

    if (source.includes('INSERT INTO balance_types')) {
      this.insertType(params);
      return { changes: 1 };
    }

    return { changes: 0 };
  }

  async getAllAsync<T>(source: string): Promise<T[]> {
    if (source.includes('FROM balance_entries')) {
      return this.entries
        .sort((firstEntry, secondEntry) => {
          if (secondEntry.created_at !== firstEntry.created_at) {
            return secondEntry.created_at - firstEntry.created_at;
          }

          return secondEntry.id.localeCompare(firstEntry.id);
        })
        .map((entry) => ({ ...entry })) as T[];
    }

    if (source.includes('FROM balance_types')) {
      return this.types
        .sort((firstType, secondType) => {
          if (firstType.sort_order !== secondType.sort_order) {
            return firstType.sort_order - secondType.sort_order;
          }

          if (firstType.created_at !== secondType.created_at) {
            return firstType.created_at - secondType.created_at;
          }

          return firstType.id.localeCompare(secondType.id);
        })
        .map((type) => ({ ...type })) as T[];
    }

    return [];
  }

  private insertEntry(params: unknown[]) {
    const [id, amount, typeId, createdAt] = params;

    if (
      typeof id !== 'string' ||
      typeof amount !== 'number' ||
      typeof typeId !== 'string' ||
      typeof createdAt !== 'number'
    ) {
      throw new Error('Invalid balance entry insert params.');
    }

    this.entries.push({
      id,
      amount,
      type_id: typeId,
      created_at: createdAt,
    });
  }

  private insertType(params: unknown[]) {
    const [id, name, createdAt, updatedAt, isDefault, isArchived, sortOrder] =
      params;

    if (
      typeof id !== 'string' ||
      typeof name !== 'string' ||
      typeof createdAt !== 'number' ||
      typeof updatedAt !== 'number' ||
      typeof isDefault !== 'number' ||
      typeof isArchived !== 'number' ||
      typeof sortOrder !== 'number'
    ) {
      throw new Error('Invalid balance type insert params.');
    }

    this.types.push({
      id,
      name,
      created_at: createdAt,
      updated_at: updatedAt,
      is_default: isDefault,
      is_archived: isArchived,
      sort_order: sortOrder,
    });
  }
}

describe('native balance persistence', () => {
  let database: FakeBalanceDatabase;

  beforeEach(() => {
    jest.clearAllMocks();

    database = new FakeBalanceDatabase();

    mockInitDatabase.mockResolvedValue(undefined);
    mockGetDatabase.mockResolvedValue(database);
  });

  it('creates and reads balance entries newest first', async () => {
    const firstEntry: BalanceEntryInput = {
      id: 'entry-1',
      amount: 100,
      typeId: 'salary',
      createdAt: 1000,
    };
    const secondEntry: BalanceEntryInput = {
      id: 'entry-2',
      amount: 25.5,
      typeId: 'investment',
      createdAt: 2000,
    };

    await createBalanceEntry(firstEntry);
    await createBalanceEntry(secondEntry);

    expect(await getBalanceEntries()).toEqual([secondEntry, firstEntry]);
  });

  it('creates and reads balance types sorted by sort order', async () => {
    const customType: BalanceTypeInput = {
      id: 'bonus',
      name: 'Bonus',
      createdAt: 3000,
      updatedAt: 3000,
      isDefault: false,
      isArchived: false,
      sortOrder: 2,
    };

    await createBalanceType(customType);

    expect(await getBalanceTypes()).toEqual([
      expect.objectContaining({
        id: 'salary',
        name: 'Salary',
        isDefault: true,
        isArchived: false,
        sortOrder: 0,
      }),
      expect.objectContaining({
        id: 'investment',
        name: 'Investment',
        sortOrder: 1,
      }),
      customType,
    ]);
  });
});
