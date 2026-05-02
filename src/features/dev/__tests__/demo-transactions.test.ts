import { afterEach, describe, expect, it, jest } from '@jest/globals';

import { createDemoTransactions } from '@/features/dev/demo-transactions';
import { LEAK_REASONS, TRANSACTION_CATEGORIES } from '@/types/transaction';

const referenceNow = new Date(2026, 4, 2, 15, 30, 0, 0).getTime();

function getStartOfDay(referenceDate: Date) {
  return new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate(),
    0,
    0,
    0,
    0,
  ).getTime();
}

function addDays({
  referenceDate,
  days,
}: {
  referenceDate: Date;
  days: number;
}) {
  const nextDate = new Date(referenceDate);

  nextDate.setDate(nextDate.getDate() + days);
  nextDate.setHours(0, 0, 0, 0);

  return nextDate;
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe('createDemoTransactions', () => {
  it('returns valid relative demo transactions with streak and leak coverage', () => {
    jest.spyOn(Date, 'now').mockReturnValue(referenceNow);

    const transactions = createDemoTransactions();
    const today = new Date(referenceNow);
    const todayStart = getStartOfDay(today);
    const yesterdayStart = getStartOfDay(
      addDays({ referenceDate: today, days: -1 }),
    );
    const validCategories = new Set<string>(TRANSACTION_CATEGORIES);
    const validLeakReasons = new Set<string>(LEAK_REASONS);

    expect(Array.isArray(transactions)).toBe(true);
    expect(transactions.length).toBeGreaterThan(0);
    expect(transactions.some((transaction) => transaction.isLeak)).toBe(true);
    expect(transactions.some((transaction) => !transaction.isLeak)).toBe(true);
    expect(
      transactions.some((transaction) => {
        return getStartOfDay(new Date(transaction.createdAt)) === todayStart;
      }),
    ).toBe(true);
    expect(
      transactions.some((transaction) => {
        return (
          getStartOfDay(new Date(transaction.createdAt)) === yesterdayStart
        );
      }),
    ).toBe(true);

    const leakTransactions = transactions.filter(
      (transaction) => transaction.isLeak,
    );

    expect(leakTransactions.length).toBeGreaterThanOrEqual(3);

    const distinctLoggedDays = [
      ...new Set(
        transactions.map((transaction) =>
          getStartOfDay(new Date(transaction.createdAt)),
        ),
      ),
    ].sort((firstDay, secondDay) => firstDay - secondDay);

    let longestStreak = 0;
    let currentStreak = 0;

    for (let index = 0; index < distinctLoggedDays.length; index += 1) {
      const currentDay = distinctLoggedDays[index];
      const previousDay = distinctLoggedDays[index - 1];

      if (index === 0 || currentDay - previousDay === 24 * 60 * 60 * 1000) {
        currentStreak += 1;
      } else {
        currentStreak = 1;
      }

      longestStreak = Math.max(longestStreak, currentStreak);
    }

    expect(longestStreak).toBeGreaterThanOrEqual(3);

    for (const transaction of transactions) {
      expect(typeof transaction.id).toBe('string');
      expect(transaction.id.length).toBeGreaterThan(0);
      expect(transaction.amount).toBeGreaterThan(0);
      expect(validCategories.has(transaction.category)).toBe(true);
      expect(Number.isFinite(transaction.createdAt)).toBe(true);

      if (transaction.isLeak) {
        expect(transaction.leakReason).not.toBeNull();
        expect(validLeakReasons.has(transaction.leakReason ?? '')).toBe(true);
      } else {
        expect(transaction.leakReason).toBeNull();
      }
    }
  });
});
