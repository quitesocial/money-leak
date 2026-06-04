import { describe, expect, it } from '@jest/globals';

import {
  buildAnalyticsLedgerItems,
  createDefaultAnalyticsFilter,
  formatAnalyticsAmount,
  formatAnalyticsCustomDateLabel,
  groupAnalyticsLedgerItems,
} from '@/features/analytics/analytics-ledger';
import type { BalanceEntry } from '@/types/balance';
import type { Transaction } from '@/types/transaction';

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

const REFERENCE_NOW = new Date(2026, 3, 23, 15, 45);

function buildItems(
  overrides: Partial<Parameters<typeof buildAnalyticsLedgerItems>[0]> = {},
) {
  return buildAnalyticsLedgerItems({
    balanceEntries: [],
    customDate: REFERENCE_NOW.getTime(),
    customPeriodType: null,
    customRangeEnd: REFERENCE_NOW.getTime(),
    customRangeStart: REFERENCE_NOW.getTime(),
    filter: createDefaultAnalyticsFilter(),
    now: REFERENCE_NOW,
    period: 'today',
    transactions: [],
    ...overrides,
  });
}

describe('analytics ledger helpers', () => {
  it('formats signed euro values with spaced thousands', () => {
    expect(formatAnalyticsAmount({ amount: 1000, sign: '+' })).toBe(
      '+1 000.00 €',
    );
    expect(formatAnalyticsAmount({ amount: 10, sign: '-' })).toBe('-10.00 €');
    expect(formatAnalyticsAmount({ amount: Number.NaN, sign: '-' })).toBe(
      '-0.00 €',
    );
  });

  it('builds a newest-first union feed grouped by local date', () => {
    const morningTransaction = createTransaction({
      id: 'txn-morning',
      createdAt: new Date(2026, 3, 23, 9, 0).getTime(),
    });
    const afternoonBalance = createBalanceEntry({
      id: 'balance-afternoon',
      createdAt: new Date(2026, 3, 23, 15, 45).getTime(),
    });
    const yesterdayTransaction = createTransaction({
      id: 'txn-yesterday',
      createdAt: new Date(2026, 3, 22, 23, 59).getTime(),
    });

    const items = buildItems({
      balanceEntries: [afternoonBalance],
      transactions: [morningTransaction, yesterdayTransaction],
    });

    expect(items.map((item) => item.id)).toEqual([
      'balance:balance-afternoon',
      'transaction:txn-morning',
    ]);

    expect(groupAnalyticsLedgerItems(items)).toEqual([
      {
        dateKey: '2026-04-23',
        label: '23 April 2026',
        items,
      },
    ]);
  });

  it('filters today, week, and month ranges', () => {
    const todayTransaction = createTransaction({
      id: 'txn-today',
      createdAt: new Date(2026, 3, 23, 11, 0).getTime(),
    });
    const weekTransaction = createTransaction({
      id: 'txn-week',
      createdAt: new Date(2026, 3, 20, 11, 0).getTime(),
    });
    const monthTransaction = createTransaction({
      id: 'txn-month',
      createdAt: new Date(2026, 3, 1, 11, 0).getTime(),
    });
    const olderTransaction = createTransaction({
      id: 'txn-older',
      createdAt: new Date(2026, 2, 31, 11, 0).getTime(),
    });

    const transactions = [
      todayTransaction,
      weekTransaction,
      monthTransaction,
      olderTransaction,
    ];

    expect(buildItems({ transactions }).map((item) => item.id)).toEqual([
      'transaction:txn-today',
    ]);
    expect(
      buildItems({ period: 'week', transactions }).map((item) => item.id),
    ).toEqual(['transaction:txn-today', 'transaction:txn-week']);
    expect(
      buildItems({ period: 'month', transactions }).map((item) => item.id),
    ).toEqual([
      'transaction:txn-today',
      'transaction:txn-week',
      'transaction:txn-month',
    ]);
  });

  it('supports custom day, month, year, and date ranges', () => {
    const dayTransaction = createTransaction({
      id: 'txn-day',
      createdAt: new Date(2026, 10, 12, 10, 0).getTime(),
    });
    const monthTransaction = createTransaction({
      id: 'txn-month',
      createdAt: new Date(2026, 10, 2, 10, 0).getTime(),
    });
    const yearTransaction = createTransaction({
      id: 'txn-year',
      createdAt: new Date(2026, 1, 2, 10, 0).getTime(),
    });
    const outsideRangeTransaction = createTransaction({
      id: 'txn-outside',
      createdAt: new Date(2025, 10, 12, 10, 0).getTime(),
    });
    const transactions = [
      dayTransaction,
      monthTransaction,
      yearTransaction,
      outsideRangeTransaction,
    ];
    const customDate = new Date(2026, 10, 12).getTime();

    expect(
      buildItems({
        customDate,
        customPeriodType: 'day',
        period: 'custom',
        transactions,
      }).map((item) => item.id),
    ).toEqual(['transaction:txn-day']);

    expect(
      buildItems({
        customDate,
        customPeriodType: 'month',
        period: 'custom',
        transactions,
      }).map((item) => item.id),
    ).toEqual(['transaction:txn-day', 'transaction:txn-month']);

    expect(
      buildItems({
        customDate,
        customPeriodType: 'year',
        period: 'custom',
        transactions,
      }).map((item) => item.id),
    ).toEqual([
      'transaction:txn-day',
      'transaction:txn-month',
      'transaction:txn-year',
    ]);

    expect(
      buildItems({
        customPeriodType: 'custom_dates',
        customRangeEnd: new Date(2026, 10, 12).getTime(),
        customRangeStart: new Date(2026, 10, 2).getTime(),
        period: 'custom',
        transactions,
      }).map((item) => item.id),
    ).toEqual(['transaction:txn-day', 'transaction:txn-month']);
  });

  it('renders custom date labels safely', () => {
    const customDate = new Date(2026, 10, 12).getTime();

    expect(
      formatAnalyticsCustomDateLabel({
        customDate,
        customPeriodType: 'day',
        customRangeEnd: customDate,
        customRangeStart: customDate,
      }),
    ).toBe('12 Nov 2026');
    expect(
      formatAnalyticsCustomDateLabel({
        customDate,
        customPeriodType: 'month',
        customRangeEnd: customDate,
        customRangeStart: customDate,
      }),
    ).toBe('Nov 2026');
    expect(
      formatAnalyticsCustomDateLabel({
        customDate,
        customPeriodType: 'year',
        customRangeEnd: customDate,
        customRangeStart: customDate,
      }),
    ).toBe('2026');
    expect(
      formatAnalyticsCustomDateLabel({
        customDate,
        customPeriodType: 'custom_dates',
        customRangeEnd: new Date(2026, 3, 26).getTime(),
        customRangeStart: new Date(2026, 3, 20).getTime(),
      }),
    ).toBe('20 Apr 2026 - 26 Apr 2026');
  });

  it('applies operation, balance type, category, and leak reason filters', () => {
    const salaryEntry = createBalanceEntry({
      id: 'balance-salary',
      typeId: 'salary',
    });
    const giftEntry = createBalanceEntry({
      id: 'balance-regalo',
      typeId: 'regalo',
    });
    const foodNormal = createTransaction({
      id: 'txn-food-normal',
      category: 'food',
      isLeak: false,
      leakReason: null,
    });
    const shoppingLeak = createTransaction({
      id: 'txn-shopping-leak',
      category: 'shopping',
      isLeak: true,
      leakReason: 'impulse',
    });

    expect(
      buildItems({
        balanceEntries: [salaryEntry, giftEntry],
        filter: {
          ...createDefaultAnalyticsFilter(),
          balanceTypeId: 'salary',
          operation: 'added',
        },
        transactions: [foodNormal, shoppingLeak],
      }).map((item) => item.id),
    ).toEqual(['balance:balance-salary']);

    expect(
      buildItems({
        balanceEntries: [salaryEntry, giftEntry],
        filter: {
          ...createDefaultAnalyticsFilter(),
          operation: 'spent',
        },
        transactions: [foodNormal, shoppingLeak],
      }).map((item) => item.id),
    ).toEqual(['transaction:txn-shopping-leak', 'transaction:txn-food-normal']);

    expect(
      buildItems({
        filter: {
          ...createDefaultAnalyticsFilter(),
          categoryId: 'shopping',
          leakReason: 'impulse',
          operation: 'spent',
          transactionKind: 'leak',
        },
        transactions: [foodNormal, shoppingLeak],
      }).map((item) => item.id),
    ).toEqual(['transaction:txn-shopping-leak']);
  });
});
