export const TRANSACTION_CATEGORIES = [
  'food',
  'transport',
  'alcohol',
  'shopping',
  'subscriptions',
  'other',
] as const;

export const LEAK_REASONS = [
  'stress',
  'boredom',
  'impulse',
  'habit',
  'social',
  'craving',
] as const;

export type TransactionCategory = (typeof TRANSACTION_CATEGORIES)[number];

export type LeakReason = (typeof LEAK_REASONS)[number];

export type Transaction = {
  id: string;
  amount: number;
  category: TransactionCategory;
  isLeak: boolean;
  leakReason: LeakReason | null;
  note: string | null;
  createdAt: number;
};
