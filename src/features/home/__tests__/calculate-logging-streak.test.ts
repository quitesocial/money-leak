import { describe, expect, it } from '@jest/globals';

import {
  calculateLoggingStreak,
  type LoggingStreakSummary,
} from '@/features/home/calculate-logging-streak';
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

function expectSummary(
  transactions: Transaction[],
  expected: LoggingStreakSummary,
) {
  expect(calculateLoggingStreak(transactions, REFERENCE_DATE)).toEqual(
    expected,
  );
}

describe('calculateLoggingStreak', () => {
  it('returns an empty summary for empty transactions', () => {
    expectSummary([], {
      currentStreakDays: 0,
      hasLoggedToday: false,
      lastLoggedAt: null,
    });
  });

  it('counts a streak when only today has a transaction', () => {
    const transaction = createTransaction({
      id: 'txn-today',
      createdAt: createLocalTimestamp(2026, 3, 25, 8, 45),
    });

    expectSummary([transaction], {
      currentStreakDays: 1,
      hasLoggedToday: true,
      lastLoggedAt: transaction.createdAt,
    });
  });

  it('counts today and yesterday as a two-day streak', () => {
    const todayTransaction = createTransaction({
      id: 'txn-today',
      createdAt: createLocalTimestamp(2026, 3, 25, 9, 30),
    });
    const yesterdayTransaction = createTransaction({
      id: 'txn-yesterday',
      createdAt: createLocalTimestamp(2026, 3, 24, 18, 10),
    });

    expectSummary([yesterdayTransaction, todayTransaction], {
      currentStreakDays: 2,
      hasLoggedToday: true,
      lastLoggedAt: todayTransaction.createdAt,
    });
  });

  it('counts consecutive days through the day before yesterday', () => {
    const dayBeforeYesterdayTransaction = createTransaction({
      id: 'txn-day-before-yesterday',
      createdAt: createLocalTimestamp(2026, 3, 23, 20, 15),
    });
    const yesterdayTransaction = createTransaction({
      id: 'txn-yesterday',
      createdAt: createLocalTimestamp(2026, 3, 24, 12, 5),
    });
    const todayTransaction = createTransaction({
      id: 'txn-today',
      createdAt: createLocalTimestamp(2026, 3, 25, 7, 55),
    });

    expectSummary(
      [dayBeforeYesterdayTransaction, yesterdayTransaction, todayTransaction],
      {
        currentStreakDays: 3,
        hasLoggedToday: true,
        lastLoggedAt: todayTransaction.createdAt,
      },
    );
  });

  it('uses yesterday as the streak anchor when today is empty', () => {
    const yesterdayTransaction = createTransaction({
      id: 'txn-yesterday',
      createdAt: createLocalTimestamp(2026, 3, 24, 19, 45),
    });

    expectSummary([yesterdayTransaction], {
      currentStreakDays: 1,
      hasLoggedToday: false,
      lastLoggedAt: yesterdayTransaction.createdAt,
    });
  });

  it('breaks the streak when a day is missing', () => {
    const todayTransaction = createTransaction({
      id: 'txn-today',
      createdAt: createLocalTimestamp(2026, 3, 25, 6, 15),
    });
    const olderTransaction = createTransaction({
      id: 'txn-older',
      createdAt: createLocalTimestamp(2026, 3, 23, 21, 10),
    });

    expectSummary([olderTransaction, todayTransaction], {
      currentStreakDays: 1,
      hasLoggedToday: true,
      lastLoggedAt: todayTransaction.createdAt,
    });
  });

  it('counts multiple transactions on the same day only once', () => {
    const firstTodayTransaction = createTransaction({
      id: 'txn-today-1',
      createdAt: createLocalTimestamp(2026, 3, 25, 8, 0),
    });
    const secondTodayTransaction = createTransaction({
      id: 'txn-today-2',
      createdAt: createLocalTimestamp(2026, 3, 25, 21, 0),
    });
    const yesterdayTransaction = createTransaction({
      id: 'txn-yesterday',
      createdAt: createLocalTimestamp(2026, 3, 24, 22, 45),
    });

    expectSummary(
      [firstTodayTransaction, secondTodayTransaction, yesterdayTransaction],
      {
        currentStreakDays: 2,
        hasLoggedToday: true,
        lastLoggedAt: secondTodayTransaction.createdAt,
      },
    );
  });

  it('returns a zero streak for historical activity without today or yesterday', () => {
    const olderTransaction = createTransaction({
      id: 'txn-older',
      createdAt: createLocalTimestamp(2026, 3, 20, 14, 30),
    });
    const oldestTransaction = createTransaction({
      id: 'txn-oldest',
      createdAt: createLocalTimestamp(2026, 3, 18, 9, 5),
    });

    expectSummary([oldestTransaction, olderTransaction], {
      currentStreakDays: 0,
      hasLoggedToday: false,
      lastLoggedAt: olderTransaction.createdAt,
    });
  });

  it('returns the newest valid createdAt as lastLoggedAt', () => {
    const newestTransaction = createTransaction({
      id: 'txn-newest',
      createdAt: createLocalTimestamp(2026, 3, 24, 23, 59),
    });
    const olderTransaction = createTransaction({
      id: 'txn-older',
      createdAt: createLocalTimestamp(2026, 3, 22, 10, 0),
    });
    const invalidTimestampTransaction = createTransaction({
      id: 'txn-invalid',
      createdAt: Number.NaN,
    });

    expectSummary(
      [olderTransaction, invalidTimestampTransaction, newestTransaction],
      {
        currentStreakDays: 1,
        hasLoggedToday: false,
        lastLoggedAt: newestTransaction.createdAt,
      },
    );
  });
});
