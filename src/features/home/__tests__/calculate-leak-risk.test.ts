import { describe, expect, it } from '@jest/globals';

import {
  calculateLeakRisk,
  type LeakRiskSummary,
} from '@/features/home/calculate-leak-risk';
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
const REFERENCE_DATE = new Date(REFERENCE_NOW);

function expectSummary(transactions: Transaction[], expected: LeakRiskSummary) {
  expect(calculateLeakRisk(transactions, REFERENCE_DATE)).toEqual(expected);
}

describe('calculateLeakRisk', () => {
  it('returns unknown for empty transactions', () => {
    expectSummary([], {
      riskLevel: 'unknown',
      hasEnoughData: false,
      matchingWeekdayLeakCount: 0,
      totalLeakCount: 0,
      topCategory: null,
      topReason: null,
      peakHour: null,
      suggestedWindow: null,
    });
  });

  it('returns unknown when only normal transactions exist', () => {
    const transactions = [
      createTransaction({
        id: 'txn-normal-1',
        amount: 10,
        createdAt: createLocalTimestamp(2026, 3, 25, 9, 0),
      }),
      createTransaction({
        id: 'txn-normal-2',
        amount: 15,
        category: 'shopping',
        createdAt: createLocalTimestamp(2026, 3, 24, 20, 0),
      }),
    ];

    expectSummary(transactions, {
      riskLevel: 'unknown',
      hasEnoughData: false,
      matchingWeekdayLeakCount: 0,
      totalLeakCount: 0,
      topCategory: null,
      topReason: null,
      peakHour: null,
      suggestedWindow: null,
    });
  });

  it('returns unknown when fewer than three valid leaks exist', () => {
    const transactions = [
      createTransaction({
        id: 'txn-leak-today',
        amount: 14,
        category: 'shopping',
        isLeak: true,
        leakReason: 'impulse',
        createdAt: createLocalTimestamp(2026, 3, 25, 21, 0),
      }),
      createTransaction({
        id: 'txn-leak-yesterday',
        amount: 7,
        category: 'food',
        isLeak: true,
        leakReason: 'stress',
        createdAt: createLocalTimestamp(2026, 3, 24, 11, 0),
      }),
    ];

    expectSummary(transactions, {
      riskLevel: 'unknown',
      hasEnoughData: false,
      matchingWeekdayLeakCount: 1,
      totalLeakCount: 2,
      topCategory: 'shopping',
      topReason: 'impulse',
      peakHour: 21,
      suggestedWindow: '21:00-23:00',
    });
  });

  it('returns low when enough leaks exist but none match today weekday', () => {
    const transactions = [
      createTransaction({
        id: 'txn-friday-food',
        amount: 4,
        isLeak: true,
        leakReason: 'stress',
        createdAt: createLocalTimestamp(2026, 3, 24, 8, 0),
      }),
      createTransaction({
        id: 'txn-friday-food-2',
        amount: 6,
        isLeak: true,
        leakReason: 'habit',
        createdAt: createLocalTimestamp(2026, 3, 24, 8, 30),
      }),
      createTransaction({
        id: 'txn-thursday-transport',
        amount: 10,
        category: 'transport',
        isLeak: true,
        leakReason: 'impulse',
        createdAt: createLocalTimestamp(2026, 3, 23, 9, 0),
      }),
    ];

    expectSummary(transactions, {
      riskLevel: 'low',
      hasEnoughData: true,
      matchingWeekdayLeakCount: 0,
      totalLeakCount: 3,
      topCategory: 'food',
      topReason: 'stress',
      peakHour: 8,
      suggestedWindow: '08:00-10:00',
    });
  });

  it('returns medium when one weekday leak matches today', () => {
    const transactions = [
      createTransaction({
        id: 'txn-today-shopping',
        amount: 12,
        category: 'shopping',
        isLeak: true,
        leakReason: 'social',
        createdAt: createLocalTimestamp(2026, 3, 25, 19, 0),
      }),
      createTransaction({
        id: 'txn-friday-food',
        amount: 8,
        isLeak: true,
        leakReason: 'stress',
        createdAt: createLocalTimestamp(2026, 3, 24, 10, 0),
      }),
      createTransaction({
        id: 'txn-thursday-other',
        amount: 5,
        category: 'other',
        isLeak: true,
        leakReason: 'habit',
        createdAt: createLocalTimestamp(2026, 3, 23, 13, 0),
      }),
    ];

    expectSummary(transactions, {
      riskLevel: 'medium',
      hasEnoughData: true,
      matchingWeekdayLeakCount: 1,
      totalLeakCount: 3,
      topCategory: 'shopping',
      topReason: 'social',
      peakHour: 19,
      suggestedWindow: '19:00-21:00',
    });
  });

  it('returns medium when two weekday leaks match today', () => {
    const transactions = [
      createTransaction({
        id: 'txn-today-food',
        amount: 9,
        isLeak: true,
        leakReason: 'stress',
        createdAt: createLocalTimestamp(2026, 3, 25, 12, 0),
      }),
      createTransaction({
        id: 'txn-today-shopping',
        amount: 11,
        category: 'shopping',
        isLeak: true,
        leakReason: 'impulse',
        createdAt: createLocalTimestamp(2026, 3, 25, 18, 0),
      }),
      createTransaction({
        id: 'txn-friday-other',
        amount: 6,
        category: 'other',
        isLeak: true,
        leakReason: 'habit',
        createdAt: createLocalTimestamp(2026, 3, 24, 21, 0),
      }),
    ];

    expectSummary(transactions, {
      riskLevel: 'medium',
      hasEnoughData: true,
      matchingWeekdayLeakCount: 2,
      totalLeakCount: 3,
      topCategory: 'shopping',
      topReason: 'stress',
      peakHour: 12,
      suggestedWindow: '12:00-14:00',
    });
  });

  it('returns high when three or more weekday leaks match today', () => {
    const transactions = [
      createTransaction({
        id: 'txn-today-food-1',
        amount: 7,
        isLeak: true,
        leakReason: 'stress',
        createdAt: createLocalTimestamp(2026, 3, 25, 18, 0),
      }),
      createTransaction({
        id: 'txn-today-food-2',
        amount: 9,
        isLeak: true,
        leakReason: 'stress',
        createdAt: createLocalTimestamp(2026, 3, 25, 18, 45),
      }),
      createTransaction({
        id: 'txn-today-shopping',
        amount: 5,
        category: 'shopping',
        isLeak: true,
        leakReason: 'impulse',
        createdAt: createLocalTimestamp(2026, 3, 25, 20, 0),
      }),
    ];

    expectSummary(transactions, {
      riskLevel: 'high',
      hasEnoughData: true,
      matchingWeekdayLeakCount: 3,
      totalLeakCount: 3,
      topCategory: 'food',
      topReason: 'stress',
      peakHour: 18,
      suggestedWindow: '18:00-20:00',
    });
  });

  it('breaks top category ties by higher amount first', () => {
    const transactions = [
      createTransaction({
        id: 'txn-food',
        amount: 8,
        isLeak: true,
        leakReason: 'stress',
        createdAt: createLocalTimestamp(2026, 3, 25, 9, 0),
      }),
      createTransaction({
        id: 'txn-shopping',
        amount: 10,
        category: 'shopping',
        isLeak: true,
        leakReason: 'impulse',
        createdAt: createLocalTimestamp(2026, 3, 25, 10, 0),
      }),
      createTransaction({
        id: 'txn-other',
        amount: 1,
        category: 'other',
        isLeak: true,
        leakReason: 'habit',
        createdAt: createLocalTimestamp(2026, 3, 25, 11, 0),
      }),
    ];

    expect(calculateLeakRisk(transactions, REFERENCE_DATE).topCategory).toBe(
      'shopping',
    );
  });

  it('breaks top category ties by higher count after amount', () => {
    const transactions = [
      createTransaction({
        id: 'txn-food-1',
        amount: 6,
        isLeak: true,
        leakReason: 'stress',
        createdAt: createLocalTimestamp(2026, 3, 25, 9, 0),
      }),
      createTransaction({
        id: 'txn-food-2',
        amount: 4,
        isLeak: true,
        leakReason: 'habit',
        createdAt: createLocalTimestamp(2026, 3, 25, 10, 0),
      }),
      createTransaction({
        id: 'txn-shopping',
        amount: 10,
        category: 'shopping',
        isLeak: true,
        leakReason: 'impulse',
        createdAt: createLocalTimestamp(2026, 3, 25, 11, 0),
      }),
    ];

    expect(calculateLeakRisk(transactions, REFERENCE_DATE).topCategory).toBe(
      'food',
    );
  });

  it('breaks top category ties by transaction category order', () => {
    const transactions = [
      createTransaction({
        id: 'txn-food',
        amount: 10,
        isLeak: true,
        leakReason: 'stress',
        createdAt: createLocalTimestamp(2026, 3, 25, 9, 0),
      }),
      createTransaction({
        id: 'txn-transport',
        amount: 10,
        category: 'transport',
        isLeak: true,
        leakReason: 'impulse',
        createdAt: createLocalTimestamp(2026, 3, 25, 10, 0),
      }),
      createTransaction({
        id: 'txn-other',
        amount: 1,
        category: 'other',
        isLeak: true,
        leakReason: 'habit',
        createdAt: createLocalTimestamp(2026, 3, 25, 11, 0),
      }),
    ];

    expect(calculateLeakRisk(transactions, REFERENCE_DATE).topCategory).toBe(
      'food',
    );
  });

  it('breaks top reason ties by higher count first', () => {
    const transactions = [
      createTransaction({
        id: 'txn-stress-1',
        isLeak: true,
        leakReason: 'stress',
        createdAt: createLocalTimestamp(2026, 3, 25, 9, 0),
      }),
      createTransaction({
        id: 'txn-stress-2',
        category: 'shopping',
        isLeak: true,
        leakReason: 'stress',
        createdAt: createLocalTimestamp(2026, 3, 25, 10, 0),
      }),
      createTransaction({
        id: 'txn-boredom',
        category: 'other',
        isLeak: true,
        leakReason: 'boredom',
        createdAt: createLocalTimestamp(2026, 3, 25, 11, 0),
      }),
    ];

    expect(calculateLeakRisk(transactions, REFERENCE_DATE).topReason).toBe(
      'stress',
    );
  });

  it('breaks top reason ties by leak reason order', () => {
    const transactions = [
      createTransaction({
        id: 'txn-stress',
        isLeak: true,
        leakReason: 'stress',
        createdAt: createLocalTimestamp(2026, 3, 25, 9, 0),
      }),
      createTransaction({
        id: 'txn-boredom',
        category: 'shopping',
        isLeak: true,
        leakReason: 'boredom',
        createdAt: createLocalTimestamp(2026, 3, 25, 10, 0),
      }),
      createTransaction({
        id: 'txn-null-reason',
        category: 'other',
        isLeak: true,
        leakReason: null,
        createdAt: createLocalTimestamp(2026, 3, 25, 11, 0),
      }),
    ];

    expect(calculateLeakRisk(transactions, REFERENCE_DATE).topReason).toBe(
      'stress',
    );
  });

  it('picks peak hour by higher count before lower-hour tie-breaks', () => {
    const transactions = [
      createTransaction({
        id: 'txn-hour-9-1',
        isLeak: true,
        leakReason: 'stress',
        createdAt: createLocalTimestamp(2026, 3, 25, 9, 0),
      }),
      createTransaction({
        id: 'txn-hour-9-2',
        category: 'shopping',
        isLeak: true,
        leakReason: 'habit',
        createdAt: createLocalTimestamp(2026, 3, 25, 9, 30),
      }),
      createTransaction({
        id: 'txn-hour-11',
        category: 'other',
        isLeak: true,
        leakReason: 'impulse',
        createdAt: createLocalTimestamp(2026, 3, 25, 11, 0),
      }),
    ];

    expect(calculateLeakRisk(transactions, REFERENCE_DATE).peakHour).toBe(9);
  });

  it('breaks peak hour ties by lower hour', () => {
    const transactions = [
      createTransaction({
        id: 'txn-hour-9-1',
        isLeak: true,
        leakReason: 'stress',
        createdAt: createLocalTimestamp(2026, 3, 25, 9, 0),
      }),
      createTransaction({
        id: 'txn-hour-9-2',
        category: 'shopping',
        isLeak: true,
        leakReason: 'habit',
        createdAt: createLocalTimestamp(2026, 3, 25, 9, 15),
      }),
      createTransaction({
        id: 'txn-hour-11-1',
        category: 'transport',
        isLeak: true,
        leakReason: 'impulse',
        createdAt: createLocalTimestamp(2026, 3, 25, 11, 0),
      }),
      createTransaction({
        id: 'txn-hour-11-2',
        category: 'other',
        isLeak: true,
        leakReason: 'social',
        createdAt: createLocalTimestamp(2026, 3, 25, 11, 30),
      }),
    ];

    expect(calculateLeakRisk(transactions, REFERENCE_DATE).peakHour).toBe(9);
  });

  it('ignores invalid createdAt values', () => {
    const transactions = [
      createTransaction({
        id: 'txn-invalid',
        amount: 20,
        category: 'shopping',
        isLeak: true,
        leakReason: 'impulse',
        createdAt: Number.NaN,
      }),
      createTransaction({
        id: 'txn-valid-today',
        amount: 9,
        isLeak: true,
        leakReason: 'stress',
        createdAt: createLocalTimestamp(2026, 3, 25, 13, 0),
      }),
      createTransaction({
        id: 'txn-valid-other-day',
        amount: 7,
        category: 'transport',
        isLeak: true,
        leakReason: 'habit',
        createdAt: createLocalTimestamp(2026, 3, 24, 10, 0),
      }),
    ];

    expectSummary(transactions, {
      riskLevel: 'unknown',
      hasEnoughData: false,
      matchingWeekdayLeakCount: 1,
      totalLeakCount: 2,
      topCategory: 'food',
      topReason: 'stress',
      peakHour: 13,
      suggestedWindow: '13:00-15:00',
    });
  });

  it('does not mutate the input array', () => {
    const transactions = [
      createTransaction({
        id: 'txn-1',
        amount: 4,
        isLeak: true,
        leakReason: 'stress',
        createdAt: createLocalTimestamp(2026, 3, 25, 8, 0),
      }),
      createTransaction({
        id: 'txn-2',
        amount: 5,
        category: 'shopping',
        isLeak: true,
        leakReason: 'habit',
        createdAt: createLocalTimestamp(2026, 3, 24, 9, 0),
      }),
      createTransaction({
        id: 'txn-3',
        amount: 6,
        category: 'other',
        isLeak: true,
        leakReason: 'impulse',
        createdAt: createLocalTimestamp(2026, 3, 23, 10, 0),
      }),
    ];
    const originalTransactions = JSON.parse(
      JSON.stringify(transactions),
    ) as Transaction[];

    calculateLeakRisk(transactions, REFERENCE_DATE);

    expect(transactions).toEqual(originalTransactions);
  });

  it('formats the suggested window safely near midnight', () => {
    const transactions = [
      createTransaction({
        id: 'txn-23-1',
        isLeak: true,
        leakReason: 'stress',
        createdAt: createLocalTimestamp(2026, 3, 25, 23, 5),
      }),
      createTransaction({
        id: 'txn-23-2',
        category: 'shopping',
        isLeak: true,
        leakReason: 'impulse',
        createdAt: createLocalTimestamp(2026, 3, 25, 23, 45),
      }),
      createTransaction({
        id: 'txn-01',
        category: 'other',
        isLeak: true,
        leakReason: 'habit',
        createdAt: createLocalTimestamp(2026, 3, 25, 1, 0),
      }),
    ];

    expect(
      calculateLeakRisk(transactions, REFERENCE_DATE).suggestedWindow,
    ).toBe('23:00-01:00');
  });
});
