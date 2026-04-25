import { describe, expect, it } from '@jest/globals';

import { calculateDailyReviewSummary } from '@/features/home/calculate-daily-review-summary';
import type { Transaction } from '@/types/transaction';

function createLocalTimestamp(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute = 0,
) {
  return new Date(year, month, day, hour, minute, 0, 0).getTime();
}

function createTransaction(
  overrides: Partial<Transaction> & Pick<Transaction, 'id' | 'createdAt'>,
): Transaction {
  const { id, createdAt, ...rest } = overrides;

  return {
    id,
    amount: 12.5,
    category: 'food',
    isLeak: false,
    leakReason: null,
    note: null,
    createdAt,
    ...rest,
  };
}

const REFERENCE_NOW = createLocalTimestamp(2026, 3, 25, 15, 30);

describe('calculateDailyReviewSummary', () => {
  it('returns an empty summary for empty transactions', () => {
    expect(
      calculateDailyReviewSummary({
        transactions: [],
        now: REFERENCE_NOW,
      }),
    ).toEqual({
      transactionCount: 0,
      totalSpent: 0,
      totalLeaks: 0,
      leakPercentage: 0,
      topLeakCategory: null,
    });
  });

  it('excludes transactions from yesterday', () => {
    const transactions = [
      createTransaction({
        id: 'txn-yesterday-1',
        amount: 8.5,
        createdAt: createLocalTimestamp(2026, 3, 24, 12, 0),
      }),
      createTransaction({
        id: 'txn-yesterday-2',
        amount: 4.25,
        isLeak: true,
        leakReason: 'impulse',
        createdAt: createLocalTimestamp(2026, 3, 24, 23, 59),
      }),
    ];

    expect(
      calculateDailyReviewSummary({
        transactions,
        now: REFERENCE_NOW,
      }),
    ).toEqual({
      transactionCount: 0,
      totalSpent: 0,
      totalLeaks: 0,
      leakPercentage: 0,
      topLeakCategory: null,
    });
  });

  it('summarizes today normal transactions without leaks', () => {
    const transactions = [
      createTransaction({
        id: 'txn-today-normal-1',
        amount: 10,
        category: 'food',
        createdAt: createLocalTimestamp(2026, 3, 25, 8, 15),
      }),
      createTransaction({
        id: 'txn-today-normal-2',
        amount: 6.75,
        category: 'transport',
        createdAt: createLocalTimestamp(2026, 3, 25, 12, 45),
      }),
    ];

    expect(
      calculateDailyReviewSummary({
        transactions,
        now: REFERENCE_NOW,
      }),
    ).toEqual({
      transactionCount: 2,
      totalSpent: 16.75,
      totalLeaks: 0,
      leakPercentage: 0,
      topLeakCategory: null,
    });
  });

  it('summarizes today leak transactions and picks the top leak category deterministically', () => {
    const transactions = [
      createTransaction({
        id: 'txn-food-leak-1',
        amount: 5,
        category: 'food',
        isLeak: true,
        leakReason: 'stress',
        createdAt: createLocalTimestamp(2026, 3, 25, 9, 0),
      }),
      createTransaction({
        id: 'txn-food-leak-2',
        amount: 5,
        category: 'food',
        isLeak: true,
        leakReason: 'habit',
        createdAt: createLocalTimestamp(2026, 3, 25, 10, 0),
      }),
      createTransaction({
        id: 'txn-shopping-leak-1',
        amount: 5,
        category: 'shopping',
        isLeak: true,
        leakReason: 'impulse',
        createdAt: createLocalTimestamp(2026, 3, 25, 11, 0),
      }),
      createTransaction({
        id: 'txn-shopping-leak-2',
        amount: 5,
        category: 'shopping',
        isLeak: true,
        leakReason: 'craving',
        createdAt: createLocalTimestamp(2026, 3, 25, 12, 0),
      }),
      createTransaction({
        id: 'txn-transport-leak',
        amount: 10,
        category: 'transport',
        isLeak: true,
        leakReason: 'social',
        createdAt: createLocalTimestamp(2026, 3, 25, 13, 0),
      }),
    ];

    expect(
      calculateDailyReviewSummary({
        transactions,
        now: REFERENCE_NOW,
      }),
    ).toEqual({
      transactionCount: 5,
      totalSpent: 30,
      totalLeaks: 30,
      leakPercentage: 100,
      topLeakCategory: {
        category: 'food',
        totalLeaks: 10,
        count: 2,
      },
    });
  });

  it('includes only today transactions when today and yesterday straddle midnight', () => {
    const transactions = [
      createTransaction({
        id: 'txn-yesterday-late',
        amount: 40,
        category: 'shopping',
        isLeak: true,
        leakReason: 'impulse',
        createdAt: createLocalTimestamp(2026, 3, 24, 23, 59),
      }),
      createTransaction({
        id: 'txn-today-early',
        amount: 9.5,
        category: 'food',
        createdAt: createLocalTimestamp(2026, 3, 25, 0, 1),
      }),
      createTransaction({
        id: 'txn-today-leak',
        amount: 3.5,
        category: 'other',
        isLeak: true,
        leakReason: 'boredom',
        createdAt: createLocalTimestamp(2026, 3, 25, 0, 2),
      }),
    ];

    expect(
      calculateDailyReviewSummary({
        transactions,
        now: REFERENCE_NOW,
      }),
    ).toMatchObject({
      transactionCount: 2,
      totalSpent: 13,
      totalLeaks: 3.5,
      topLeakCategory: {
        category: 'other',
        totalLeaks: 3.5,
        count: 1,
      },
    });

    expect(
      calculateDailyReviewSummary({
        transactions,
        now: REFERENCE_NOW,
      }).leakPercentage,
    ).toBeCloseTo(26.9230769231, 6);
  });

  it('returns 0 leak percentage when today total is zero', () => {
    const transactions = [
      createTransaction({
        id: 'txn-zero-leak',
        amount: 0,
        category: 'shopping',
        isLeak: true,
        leakReason: 'impulse',
        createdAt: createLocalTimestamp(2026, 3, 25, 14, 0),
      }),
    ];

    expect(
      calculateDailyReviewSummary({
        transactions,
        now: REFERENCE_NOW,
      }),
    ).toEqual({
      transactionCount: 1,
      totalSpent: 0,
      totalLeaks: 0,
      leakPercentage: 0,
      topLeakCategory: {
        category: 'shopping',
        totalLeaks: 0,
        count: 1,
      },
    });
  });
});
