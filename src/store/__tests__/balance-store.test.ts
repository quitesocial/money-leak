import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { useBalanceStore } from '@/store/balance-store';
import type {
  BalanceEntry,
  BalanceEntryInput,
  BalanceType,
  BalanceTypeInput,
} from '@/types/balance';

const mockGetBalanceEntries = jest.fn<() => Promise<BalanceEntry[]>>();
const mockCreateBalanceEntry =
  jest.fn<(entry: BalanceEntryInput) => Promise<void>>();
const mockUpdateBalanceEntry =
  jest.fn<(entry: BalanceEntryInput) => Promise<void>>();
const mockDeleteBalanceEntry = jest.fn<(id: string) => Promise<void>>();
const mockGetBalanceTypes = jest.fn<() => Promise<BalanceType[]>>();
const mockCreateBalanceType =
  jest.fn<(balanceType: BalanceTypeInput) => Promise<void>>();

jest.mock('@/db/balance', () => ({
  getBalanceEntries: () => mockGetBalanceEntries(),
  createBalanceEntry: (entry: BalanceEntryInput) =>
    mockCreateBalanceEntry(entry),
  updateBalanceEntry: (entry: BalanceEntryInput) =>
    mockUpdateBalanceEntry(entry),
  deleteBalanceEntry: (id: string) => mockDeleteBalanceEntry(id),
  getBalanceTypes: () => mockGetBalanceTypes(),
  createBalanceType: (balanceType: BalanceTypeInput) =>
    mockCreateBalanceType(balanceType),
}));

function createBalanceType(
  overrides: Partial<BalanceType> & Pick<BalanceType, 'id'>,
): BalanceType {
  return {
    id: overrides.id,
    ownerId: overrides.ownerId ?? 'local_test-owner',
    name: overrides.name ?? overrides.id,
    createdAt: overrides.createdAt ?? 1,
    updatedAt: overrides.updatedAt ?? 1,
    isDefault: overrides.isDefault ?? false,
    isArchived: overrides.isArchived ?? false,
    deletedAt: overrides.deletedAt ?? null,
    schemaVersion: overrides.schemaVersion ?? 1,
    sourceDeviceId: overrides.sourceDeviceId ?? 'device_test-device',
    sortOrder: overrides.sortOrder ?? 1,
  };
}

function createBalanceEntry(
  overrides: Partial<BalanceEntry> & Pick<BalanceEntry, 'id'>,
): BalanceEntry {
  return {
    id: overrides.id,
    ownerId: overrides.ownerId ?? 'local_test-owner',
    amount: overrides.amount ?? 100,
    typeId: overrides.typeId ?? 'salary',
    createdAt: overrides.createdAt ?? 1,
    updatedAt: overrides.updatedAt ?? overrides.createdAt ?? 1,
    deletedAt: overrides.deletedAt ?? null,
    schemaVersion: overrides.schemaVersion ?? 1,
    sourceDeviceId: overrides.sourceDeviceId ?? 'device_test-device',
  };
}

function resetStore({
  balanceEntries = [],
  balanceTypes = [],
}: {
  balanceEntries?: BalanceEntry[];
  balanceTypes?: BalanceType[];
} = {}) {
  useBalanceStore.setState({
    balanceEntries,
    balanceTypes,
    activeBalanceTypes: balanceTypes.filter(
      (balanceType) => !balanceType.isArchived,
    ),
    isLoading: false,
    isInitialized: false,
    error: null,
  });
}

describe('balance store', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetStore();
  });

  it('loads balance entries and active balance types', async () => {
    const entries = [createBalanceEntry({ id: 'entry-1', amount: 250 })];
    const types = [
      createBalanceType({
        id: 'salary',
        name: 'Salary',
        isDefault: true,
        sortOrder: 0,
      }),
      createBalanceType({
        id: 'archived',
        name: 'Archived',
        isArchived: true,
        sortOrder: 1,
      }),
    ];

    mockGetBalanceEntries.mockResolvedValue(entries);
    mockGetBalanceTypes.mockResolvedValue(types);

    await useBalanceStore.getState().loadBalance();

    expect(useBalanceStore.getState()).toMatchObject({
      balanceEntries: entries,
      balanceTypes: types,
      activeBalanceTypes: [types[0]],
      isInitialized: true,
      error: null,
    });
  });

  it('persists a balance entry then refreshes entries', async () => {
    const entry = createBalanceEntry({
      id: 'entry-new',
      amount: 100,
    });

    mockCreateBalanceEntry.mockResolvedValue(undefined);
    mockGetBalanceEntries.mockResolvedValue([entry]);

    await useBalanceStore.getState().addBalanceEntry(entry);

    expect(mockCreateBalanceEntry).toHaveBeenCalledWith(entry);
    expect(useBalanceStore.getState().balanceEntries).toEqual([entry]);
  });

  it('updates a balance entry then refreshes entries', async () => {
    const entry = createBalanceEntry({
      id: 'entry-existing',
      amount: 200,
    });

    mockUpdateBalanceEntry.mockResolvedValue(undefined);
    mockGetBalanceEntries.mockResolvedValue([entry]);

    await useBalanceStore.getState().updateBalanceEntry(entry);

    expect(mockUpdateBalanceEntry).toHaveBeenCalledWith(entry);
    expect(useBalanceStore.getState().balanceEntries).toEqual([entry]);
  });

  it('removes a balance entry then refreshes entries', async () => {
    mockDeleteBalanceEntry.mockResolvedValue(undefined);
    mockGetBalanceEntries.mockResolvedValue([]);

    await useBalanceStore.getState().removeBalanceEntry('entry-existing');

    expect(mockDeleteBalanceEntry).toHaveBeenCalledWith('entry-existing');
    expect(useBalanceStore.getState().balanceEntries).toEqual([]);
  });

  it('creates a trimmed custom balance type', async () => {
    const existingType = createBalanceType({
      id: 'salary',
      name: 'Salary',
      sortOrder: 0,
    });
    const createdType = createBalanceType({
      id: 'bonus',
      name: 'Bonus',
      sortOrder: 1,
    });

    resetStore({ balanceTypes: [existingType] });
    mockCreateBalanceType.mockResolvedValue(undefined);
    mockGetBalanceTypes.mockResolvedValue([existingType, createdType]);

    await useBalanceStore.getState().addBalanceType({
      name: '  Bonus  ',
    });

    expect(mockCreateBalanceType).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Bonus',
        isDefault: false,
        isArchived: false,
        sortOrder: 1,
      }),
    );
    expect(useBalanceStore.getState().activeBalanceTypes).toEqual([
      existingType,
      createdType,
    ]);
  });

  it('rejects duplicate active balance type names case-insensitively', async () => {
    resetStore({
      balanceTypes: [
        createBalanceType({
          id: 'salary',
          name: 'Salary',
          sortOrder: 0,
        }),
      ],
    });

    await useBalanceStore.getState().addBalanceType({
      name: ' salary ',
    });

    expect(mockCreateBalanceType).not.toHaveBeenCalled();
    expect(useBalanceStore.getState().error).toBe(
      'An active balance type with this name already exists.',
    );
  });
});
