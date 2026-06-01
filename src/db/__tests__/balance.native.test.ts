import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import type { BalanceEntryInput, BalanceTypeInput } from '@/types/balance';

import {
  createBalanceEntry,
  createBalanceType,
  deleteBalanceEntry,
  getBalanceEntries,
  getBalanceEntriesForBackup,
  getBalanceTypes,
  getBalanceTypesForBackup,
  updateBalanceEntry,
} from '../balance.native';

const mockInitDatabase = jest.fn<() => Promise<void>>();
const mockGetDatabase = jest.fn<() => Promise<FakeBalanceDatabase>>();

jest.mock('../database.native', () => ({
  initDatabase: () => mockInitDatabase(),
  getDatabase: () => mockGetDatabase(),
}));

jest.mock('../local-identity.native', () => ({
  ensureLocalIdentity: jest.fn(async () => ({
    localOwnerId: 'local_test-owner',
    deviceId: 'device_test-device',
  })),
}));

type RawBalanceEntryRow = {
  id: string;
  owner_id: string;
  amount: number;
  type_id: string;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
  schema_version: number;
  source_device_id: string;
};

type RawBalanceTypeRow = {
  id: string;
  owner_id: string;
  name: string;
  created_at: number;
  updated_at: number;
  is_default: number;
  is_archived: number;
  deleted_at: number | null;
  schema_version: number;
  source_device_id: string;
  sort_order: number;
};

class FakeBalanceDatabase {
  entries: RawBalanceEntryRow[] = [];
  types: RawBalanceTypeRow[] = [
    {
      id: 'investment',
      owner_id: 'local_test-owner',
      name: 'Investment',
      created_at: 1000,
      updated_at: 1000,
      is_default: 1,
      is_archived: 0,
      deleted_at: null,
      schema_version: 1,
      source_device_id: 'device_test-device',
      sort_order: 1,
    },
    {
      id: 'salary',
      owner_id: 'local_test-owner',
      name: 'Salary',
      created_at: 1000,
      updated_at: 1000,
      is_default: 1,
      is_archived: 0,
      deleted_at: null,
      schema_version: 1,
      source_device_id: 'device_test-device',
      sort_order: 0,
    },
  ];

  async runAsync(source: string, ...params: unknown[]) {
    if (source.includes('INSERT INTO balance_entries')) {
      this.insertEntry(params);
      return { changes: 1 };
    }

    if (
      source.includes('UPDATE balance_entries') &&
      source.includes('deleted_at = ?')
    ) {
      return { changes: this.deleteEntry(params) };
    }

    if (source.includes('UPDATE balance_entries')) {
      return { changes: this.updateEntry(params) };
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
        .filter((entry) => {
          return !source.includes('WHERE deleted_at IS NULL')
            ? true
            : entry.deleted_at === null;
        })
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
        .filter((type) => {
          return !source.includes('WHERE deleted_at IS NULL')
            ? true
            : type.deleted_at === null;
        })
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
    const [
      id,
      ownerId,
      amount,
      typeId,
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
      typeof typeId !== 'string' ||
      typeof createdAt !== 'number' ||
      typeof updatedAt !== 'number' ||
      !(deletedAt === null || typeof deletedAt === 'number') ||
      typeof schemaVersion !== 'number' ||
      typeof sourceDeviceId !== 'string'
    ) {
      throw new Error('Invalid balance entry insert params.');
    }

    this.entries.push({
      id,
      owner_id: ownerId,
      amount,
      type_id: typeId,
      created_at: createdAt,
      updated_at: updatedAt,
      deleted_at: deletedAt,
      schema_version: schemaVersion,
      source_device_id: sourceDeviceId,
    });
  }

  private insertType(params: unknown[]) {
    const [
      id,
      ownerId,
      name,
      createdAt,
      updatedAt,
      isDefault,
      isArchived,
      deletedAt,
      schemaVersion,
      sourceDeviceId,
      sortOrder,
    ] = params;

    if (
      typeof id !== 'string' ||
      typeof ownerId !== 'string' ||
      typeof name !== 'string' ||
      typeof createdAt !== 'number' ||
      typeof updatedAt !== 'number' ||
      typeof isDefault !== 'number' ||
      typeof isArchived !== 'number' ||
      !(deletedAt === null || typeof deletedAt === 'number') ||
      typeof schemaVersion !== 'number' ||
      typeof sourceDeviceId !== 'string' ||
      typeof sortOrder !== 'number'
    ) {
      throw new Error('Invalid balance type insert params.');
    }

    this.types.push({
      id,
      owner_id: ownerId,
      name,
      created_at: createdAt,
      updated_at: updatedAt,
      is_default: isDefault,
      is_archived: isArchived,
      deleted_at: deletedAt,
      schema_version: schemaVersion,
      source_device_id: sourceDeviceId,
      sort_order: sortOrder,
    });
  }

  private updateEntry(params: unknown[]) {
    const [amount, typeId, createdAt, updatedAt, sourceDeviceId, id] = params;

    if (
      typeof amount !== 'number' ||
      typeof typeId !== 'string' ||
      typeof createdAt !== 'number' ||
      typeof updatedAt !== 'number' ||
      typeof sourceDeviceId !== 'string' ||
      typeof id !== 'string'
    ) {
      throw new Error('Invalid balance entry update params.');
    }

    const entry = this.entries.find((currentEntry) => {
      return currentEntry.id === id && currentEntry.deleted_at === null;
    });

    if (!entry) return 0;

    entry.amount = amount;
    entry.type_id = typeId;
    entry.created_at = createdAt;
    entry.updated_at = updatedAt;
    entry.source_device_id = sourceDeviceId;

    return 1;
  }

  private deleteEntry(params: unknown[]) {
    const [deletedAt, updatedAt, sourceDeviceId, id] = params;

    if (
      typeof deletedAt !== 'number' ||
      typeof updatedAt !== 'number' ||
      typeof sourceDeviceId !== 'string' ||
      typeof id !== 'string'
    ) {
      throw new Error('Invalid balance entry delete params.');
    }

    const entry = this.entries.find((currentEntry) => {
      return currentEntry.id === id && currentEntry.deleted_at === null;
    });

    if (!entry) return 0;

    entry.deleted_at = deletedAt;
    entry.updated_at = updatedAt;
    entry.source_device_id = sourceDeviceId;

    return 1;
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

    expect(await getBalanceEntries()).toEqual([
      expect.objectContaining({
        ...secondEntry,
        ownerId: 'local_test-owner',
        updatedAt: secondEntry.createdAt,
        deletedAt: null,
        schemaVersion: 1,
        sourceDeviceId: 'device_test-device',
      }),
      expect.objectContaining({
        ...firstEntry,
        ownerId: 'local_test-owner',
        updatedAt: firstEntry.createdAt,
        deletedAt: null,
        schemaVersion: 1,
        sourceDeviceId: 'device_test-device',
      }),
    ]);
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
      expect.objectContaining({
        ...customType,
        ownerId: 'local_test-owner',
        deletedAt: null,
        schemaVersion: 1,
        sourceDeviceId: 'device_test-device',
      }),
    ]);
  });

  it('updates and soft-deletes balance entries', async () => {
    const entry: BalanceEntryInput = {
      id: 'entry-1',
      amount: 100,
      typeId: 'salary',
      createdAt: 1000,
    };

    await createBalanceEntry(entry);
    await updateBalanceEntry({
      ...entry,
      amount: 175,
      typeId: 'investment',
      createdAt: 2000,
    });

    expect(await getBalanceEntries()).toEqual([
      expect.objectContaining({
        id: 'entry-1',
        amount: 175,
        typeId: 'investment',
        createdAt: 2000,
        sourceDeviceId: 'device_test-device',
      }),
    ]);

    await deleteBalanceEntry('entry-1');

    expect(await getBalanceEntries()).toEqual([]);
    expect(await getBalanceEntriesForBackup()).toEqual([
      expect.objectContaining({
        id: 'entry-1',
        deletedAt: expect.any(Number),
      }),
    ]);
  });

  it('hides tombstones by default and includes them for backup reads', async () => {
    database.entries.push({
      id: 'deleted-entry',
      owner_id: 'local_test-owner',
      amount: 500,
      type_id: 'salary',
      created_at: 4000,
      updated_at: 4000,
      deleted_at: 5000,
      schema_version: 1,
      source_device_id: 'device_test-device',
    });
    database.types.push({
      id: 'deleted-type',
      owner_id: 'local_test-owner',
      name: 'Deleted Type',
      created_at: 4000,
      updated_at: 4000,
      is_default: 0,
      is_archived: 0,
      deleted_at: 5000,
      schema_version: 1,
      source_device_id: 'device_test-device',
      sort_order: 4,
    });

    expect(await getBalanceEntries()).toEqual([]);
    expect(await getBalanceEntriesForBackup()).toEqual([
      expect.objectContaining({
        id: 'deleted-entry',
        deletedAt: 5000,
      }),
    ]);
    expect(await getBalanceTypes()).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'deleted-type' })]),
    );
    expect(await getBalanceTypesForBackup()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'deleted-type',
          deletedAt: 5000,
        }),
      ]),
    );
  });
});
