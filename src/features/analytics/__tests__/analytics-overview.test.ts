import { describe, expect, it } from '@jest/globals';

import { calculateAnalyticsOverview } from '@/features/analytics/analytics-overview';
import type { BalanceEntry } from '@/types/balance';
import type { Transaction } from '@/types/transaction';

function createBalanceEntry(
  overrides: Partial<BalanceEntry> & Pick<BalanceEntry, 'id'>,
): BalanceEntry {
  const createdAt =
    overrides.createdAt ?? new Date(2026, 3, 23, 12, 0).getTime();

  return {
    id: overrides.id,
    amount: overrides.amount ?? 100,
    typeId: overrides.typeId ?? 'salary',
    createdAt,
    ownerId: overrides.ownerId ?? '',
    updatedAt: overrides.updatedAt ?? createdAt,
    deletedAt: overrides.deletedAt ?? null,
    schemaVersion: overrides.schemaVersion ?? 1,
    sourceDeviceId: overrides.sourceDeviceId ?? '',
  };
}

function createTransaction(
  overrides: Partial<Transaction> & Pick<Transaction, 'id'>,
): Transaction {
  const createdAt =
    overrides.createdAt ?? new Date(2026, 3, 23, 12, 0).getTime();

  return {
    id: overrides.id,
    amount: overrides.amount ?? 10,
    category: overrides.category ?? 'food',
    isLeak: overrides.isLeak ?? false,
    leakReason: overrides.leakReason ?? null,
    note: overrides.note ?? null,
    createdAt,
    ownerId: overrides.ownerId ?? '',
    updatedAt: overrides.updatedAt ?? createdAt,
    deletedAt: overrides.deletedAt ?? null,
    schemaVersion: overrides.schemaVersion ?? 1,
    sourceDeviceId: overrides.sourceDeviceId ?? '',
  };
}

function calculate(
  overrides: Partial<Parameters<typeof calculateAnalyticsOverview>[0]> = {},
) {
  return calculateAnalyticsOverview({
    balanceEntries: [],
    customDate: new Date(2026, 3, 23).getTime(),
    customPeriodType: null,
    customRangeEnd: new Date(2026, 3, 23).getTime(),
    customRangeStart: new Date(2026, 3, 23).getTime(),
    now: new Date(2026, 3, 23, 12, 0).getTime(),
    period: 'today',
    transactions: [],
    ...overrides,
  });
}

describe('calculateAnalyticsOverview', () => {
  it('returns zero totals for empty data', () => {
    expect(calculate()).toEqual({
      chartParts: {
        income: 0,
        normalExpenses: 0,
        leaks: 0,
      },
      expensesAmount: 0,
      incomeAmount: 0,
      leaksAmount: 0,
    });
  });

  it('counts active balance entries as income', () => {
    expect(
      calculate({
        balanceEntries: [createBalanceEntry({ id: 'salary', amount: 1200 })],
      }),
    ).toMatchObject({
      expensesAmount: 0,
      incomeAmount: 1200,
      leaksAmount: 0,
    });
  });

  it('counts normal transactions as expenses without leaks', () => {
    expect(
      calculate({
        transactions: [createTransaction({ id: 'food', amount: 15 })],
      }),
    ).toMatchObject({
      expensesAmount: 15,
      incomeAmount: 0,
      leaksAmount: 0,
    });
  });

  it('counts leak transactions as expenses and leaks', () => {
    expect(
      calculate({
        transactions: [
          createTransaction({ id: 'shopping', amount: 25, isLeak: true }),
        ],
      }),
    ).toMatchObject({
      expensesAmount: 25,
      incomeAmount: 0,
      leaksAmount: 25,
    });
  });

  it('counts mixed income, normal expenses, and leak expenses', () => {
    const overview = calculate({
      balanceEntries: [createBalanceEntry({ id: 'salary', amount: 1000 })],
      transactions: [
        createTransaction({ id: 'food', amount: 40 }),
        createTransaction({ id: 'shopping', amount: 10, isLeak: true }),
      ],
    });

    expect(overview).toMatchObject({
      expensesAmount: 50,
      incomeAmount: 1000,
      leaksAmount: 10,
    });
    expect(overview.chartParts.income).toBeCloseTo(1000 / 1050);
    expect(overview.chartParts.normalExpenses).toBeCloseTo(40 / 1050);
    expect(overview.chartParts.leaks).toBeCloseTo(10 / 1050);
  });

  it('ignores deleted rows', () => {
    expect(
      calculate({
        balanceEntries: [
          createBalanceEntry({
            id: 'deleted-balance',
            amount: 1000,
            deletedAt: 1,
          }),
        ],
        transactions: [
          createTransaction({
            id: 'deleted-transaction',
            amount: 20,
            deletedAt: 1,
            isLeak: true,
          }),
        ],
      }),
    ).toMatchObject({
      expensesAmount: 0,
      incomeAmount: 0,
      leaksAmount: 0,
    });
  });

  it('filters totals by the selected period', () => {
    const overview = calculate({
      period: 'week',
      transactions: [
        createTransaction({
          id: 'this-week',
          amount: 20,
          createdAt: new Date(2026, 3, 20, 12, 0).getTime(),
        }),
        createTransaction({
          id: 'last-week',
          amount: 40,
          createdAt: new Date(2026, 3, 17, 12, 0).getTime(),
        }),
      ],
    });

    expect(overview.expensesAmount).toBe(20);
  });

  it('sanitizes invalid and non-finite amounts', () => {
    expect(
      calculate({
        balanceEntries: [
          createBalanceEntry({ id: 'bad-income', amount: Number.NaN }),
        ],
        transactions: [
          createTransaction({
            id: 'bad-expense',
            amount: Number.POSITIVE_INFINITY,
            isLeak: true,
          }),
        ],
      }),
    ).toMatchObject({
      expensesAmount: 0,
      incomeAmount: 0,
      leaksAmount: 0,
    });
  });
});
