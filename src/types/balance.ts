export type BalanceEntryInput = {
  id: string;
  amount: number;
  typeId: string;
  createdAt: number;
};

export type BalanceEntryRestoreInput = BalanceEntryInput & {
  updatedAt: number;
};

export type BalanceEntryTombstoneRestoreInput = {
  id: string;
  updatedAt: number;
  deletedAt: number;
};

export type BalanceEntry = BalanceEntryInput & {
  ownerId: string;
  updatedAt: number;
  deletedAt: number | null;
  schemaVersion: number;
  sourceDeviceId: string;
};

export type BalanceTypeInput = {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  isDefault: boolean;
  isArchived: boolean;
  sortOrder: number;
};

export type BalanceTypeTombstoneRestoreInput = {
  id: string;
  updatedAt: number;
  deletedAt: number;
};

export type BalanceType = BalanceTypeInput & {
  ownerId: string;
  deletedAt: number | null;
  schemaVersion: number;
  sourceDeviceId: string;
};

export const DEFAULT_BALANCE_TYPES: BalanceTypeInput[] = [
  {
    id: 'salary',
    name: 'Salary',
    createdAt: 0,
    updatedAt: 0,
    isDefault: true,
    isArchived: false,
    sortOrder: 0,
  },
  {
    id: 'investment',
    name: 'Investment',
    createdAt: 0,
    updatedAt: 0,
    isDefault: true,
    isArchived: false,
    sortOrder: 1,
  },
  {
    id: 'regalo',
    name: 'Regalo',
    createdAt: 0,
    updatedAt: 0,
    isDefault: true,
    isArchived: false,
    sortOrder: 2,
  },
];
