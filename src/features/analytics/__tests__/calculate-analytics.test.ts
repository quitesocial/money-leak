import { describe, expect, it } from '@jest/globals';

import { groupLeakTransactionsByCategory } from '@/features/analytics/calculate-analytics';
import type { Transaction } from '@/types/transaction';

function createTransaction(overrides: Partial<Transaction>): Transaction {
  return {
    id: 'txn',
    amount: 10,
    category: 'food',
    isLeak: true,
    leakReason: 'impulse',
    note: null,
    createdAt: Date.parse('2026-05-01T12:00:00.000Z'),
    ...overrides,
  };
}

describe('groupLeakTransactionsByCategory', () => {
  it('includes custom category IDs and sorts ties deterministically', () => {
    const transactions = [
      createTransaction({
        id: 'txn-z-custom',
        category: 'z-custom',
      }),
      createTransaction({
        id: 'txn-a-custom',
        category: 'a-custom',
      }),
      createTransaction({
        id: 'txn-food',
        category: 'food',
      }),
    ];

    expect(
      groupLeakTransactionsByCategory(transactions).map(
        (group) => group.category,
      ),
    ).toEqual(['food', 'a-custom', 'z-custom']);
  });
});
