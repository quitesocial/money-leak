export const TRANSACTION_CATEGORIES = [
  'food',
  'transport',
  'alcohol',
  'shopping',
  'subscriptions',
  'other',
] as const;

export type DefaultTransactionCategory =
  (typeof TRANSACTION_CATEGORIES)[number];

export const LEAK_REASONS = [
  'stress',
  'boredom',
  'impulse',
  'habit',
  'social',
  'craving',
] as const;

export type TransactionCategory = string;

export type LeakReason = (typeof LEAK_REASONS)[number];

export type TransactionInput = {
  id: string;
  amount: number;
  category: TransactionCategory;
  isLeak: boolean;
  leakReason: LeakReason | null;
  note: string | null;
  createdAt: number;
};

export type TransactionRestoreInput = TransactionInput & {
  updatedAt: number;
};

export type TransactionTombstoneRestoreInput = {
  id: string;
  updatedAt: number;
  deletedAt: number;
};

export type Transaction = TransactionInput & {
  ownerId: string;
  updatedAt: number;
  deletedAt: number | null;
  schemaVersion: number;
  sourceDeviceId: string;
};
