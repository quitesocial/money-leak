import { describe, expect, it } from '@jest/globals';

import { createAppStoreScreenshotFixture } from '@/features/dev/app-store-screenshot-fixture';

describe('createAppStoreScreenshotFixture', () => {
  it('returns deterministic current-day data for the App Store captures', () => {
    const referenceDate = new Date(2026, 6, 20, 9, 41, 0, 0);
    const firstFixture = createAppStoreScreenshotFixture({ referenceDate });
    const secondFixture = createAppStoreScreenshotFixture({ referenceDate });

    expect(firstFixture).toEqual(secondFixture);
    expect(firstFixture.transactions).toHaveLength(2);
    expect(firstFixture.balanceEntries).toHaveLength(1);
    expect(firstFixture.transactions.map(({ id }) => id)).toEqual([
      'app-store-2026-07-20-shopping-leak',
      'app-store-2026-07-20-food-normal',
    ]);
    expect(firstFixture.balanceEntries[0]?.id).toBe(
      'app-store-2026-07-20-salary',
    );
  });

  it('produces the intended balance and non-zero Analytics totals', () => {
    const fixture = createAppStoreScreenshotFixture({
      referenceDate: new Date(2026, 6, 20, 9, 41, 0, 0),
    });
    const income = fixture.balanceEntries.reduce(
      (total, entry) => total + entry.amount,
      0,
    );
    const expenses = fixture.transactions.reduce(
      (total, transaction) => total + transaction.amount,
      0,
    );
    const leaks = fixture.transactions
      .filter((transaction) => transaction.isLeak)
      .reduce((total, transaction) => total + transaction.amount, 0);

    expect(income).toBeCloseTo(1249.12);
    expect(expenses).toBeCloseTo(14.56);
    expect(leaks).toBeCloseTo(10);
    expect(income - expenses).toBeCloseTo(1234.56);
    expect(fixture.transactions.some(({ isLeak }) => isLeak)).toBe(true);
    expect(fixture.transactions.some(({ isLeak }) => !isLeak)).toBe(true);
  });

  it('contains only fictional finance data and stable domain identifiers', () => {
    const fixture = createAppStoreScreenshotFixture({
      referenceDate: new Date(2026, 6, 20, 9, 41, 0, 0),
    });
    const serializedFixture = JSON.stringify(fixture);

    expect(fixture.transactions.map(({ category }) => category)).toEqual([
      'shopping',
      'food',
    ]);
    expect(fixture.balanceEntries[0]?.typeId).toBe('salary');
    expect(serializedFixture).not.toMatch(
      /email|userId|ownerId|localOwnerId|deviceId|token|supabase|EXPO_PUBLIC/i,
    );
  });
});
