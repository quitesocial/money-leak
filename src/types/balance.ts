export type BalanceEntryInput = {
  id: string;
  amount: number;
  typeId: string;
  createdAt: number;
};

export type BalanceEntry = BalanceEntryInput;

export type BalanceTypeInput = {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  isDefault: boolean;
  isArchived: boolean;
  sortOrder: number;
};

export type BalanceType = BalanceTypeInput;

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
