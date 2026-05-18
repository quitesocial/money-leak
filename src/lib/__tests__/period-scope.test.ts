import { describe, expect, it } from '@jest/globals';

import { filterTransactionsByPeriod } from '@/lib/period-scope';
import type { PeriodScope } from '@/lib/period-scope';
import type { Transaction } from '@/types/transaction';

function createLocalTimestamp({
  year,
  month,
  day,
  hour,
  minute = 0,
  second = 0,
  millisecond = 0,
}: {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute?: number;
  second?: number;
  millisecond?: number;
}) {
  return new Date(
    year,
    month,
    day,
    hour,
    minute,
    second,
    millisecond,
  ).getTime();
}

function createTransaction({
  id,
  createdAt,
}: Pick<Transaction, 'id' | 'createdAt'>): Transaction {
  return {
    id,
    amount: 12.5,
    category: 'food',
    isLeak: false,
    leakReason: null,
    note: null,
    createdAt,
    ownerId: 'local_test',
    updatedAt: createdAt,
    deletedAt: null,
    schemaVersion: 1,
    sourceDeviceId: 'device_test',
  };
}

const REFERENCE_NOW = createLocalTimestamp({
  year: 2026,
  month: 3,
  day: 15,
  hour: 12,
});

function filterIds({
  transactions,
  period,
  selectedCustomDateStart,
}: {
  transactions: Transaction[];
  period: PeriodScope;
  selectedCustomDateStart?: number | null;
}) {
  return filterTransactionsByPeriod({
    transactions,
    period,
    selectedCustomDateStart,
    now: REFERENCE_NOW,
  }).map((transaction) => transaction.id);
}

describe('filterTransactionsByPeriod', () => {
  it('includes only today transactions', () => {
    const transactions = [
      createTransaction({
        id: 'yesterday',
        createdAt: createLocalTimestamp({
          year: 2026,
          month: 3,
          day: 14,
          hour: 23,
          minute: 59,
        }),
      }),
      createTransaction({
        id: 'today-morning',
        createdAt: createLocalTimestamp({
          year: 2026,
          month: 3,
          day: 15,
          hour: 8,
        }),
      }),
      createTransaction({
        id: 'today-evening',
        createdAt: createLocalTimestamp({
          year: 2026,
          month: 3,
          day: 15,
          hour: 22,
        }),
      }),
      createTransaction({
        id: 'tomorrow',
        createdAt: createLocalTimestamp({
          year: 2026,
          month: 3,
          day: 16,
          hour: 0,
        }),
      }),
      createTransaction({
        id: 'invalid',
        createdAt: Number.NaN,
      }),
    ];

    expect(filterIds({ transactions, period: 'today' })).toEqual([
      'today-morning',
      'today-evening',
    ]);
  });

  it('includes only yesterday transactions', () => {
    const transactions = [
      createTransaction({
        id: 'two-days-ago',
        createdAt: createLocalTimestamp({
          year: 2026,
          month: 3,
          day: 13,
          hour: 23,
          minute: 59,
        }),
      }),
      createTransaction({
        id: 'yesterday-start',
        createdAt: createLocalTimestamp({
          year: 2026,
          month: 3,
          day: 14,
          hour: 0,
        }),
      }),
      createTransaction({
        id: 'yesterday-end',
        createdAt: createLocalTimestamp({
          year: 2026,
          month: 3,
          day: 14,
          hour: 23,
          minute: 59,
        }),
      }),
      createTransaction({
        id: 'today-start',
        createdAt: createLocalTimestamp({
          year: 2026,
          month: 3,
          day: 15,
          hour: 0,
        }),
      }),
    ];

    expect(filterIds({ transactions, period: 'yesterday' })).toEqual([
      'yesterday-start',
      'yesterday-end',
    ]);
  });

  it('includes current Monday-start week transactions', () => {
    const transactions = [
      createTransaction({
        id: 'previous-sunday',
        createdAt: createLocalTimestamp({
          year: 2026,
          month: 3,
          day: 12,
          hour: 23,
          minute: 59,
        }),
      }),
      createTransaction({
        id: 'monday-start',
        createdAt: createLocalTimestamp({
          year: 2026,
          month: 3,
          day: 13,
          hour: 0,
        }),
      }),
      createTransaction({
        id: 'reference-day',
        createdAt: createLocalTimestamp({
          year: 2026,
          month: 3,
          day: 15,
          hour: 10,
        }),
      }),
      createTransaction({
        id: 'sunday-end',
        createdAt: createLocalTimestamp({
          year: 2026,
          month: 3,
          day: 19,
          hour: 23,
          minute: 59,
        }),
      }),
      createTransaction({
        id: 'next-monday',
        createdAt: createLocalTimestamp({
          year: 2026,
          month: 3,
          day: 20,
          hour: 0,
        }),
      }),
    ];

    expect(filterIds({ transactions, period: 'this_week' })).toEqual([
      'monday-start',
      'reference-day',
      'sunday-end',
    ]);
  });

  it('includes only the selected custom local calendar day', () => {
    const selectedCustomDateStart = createLocalTimestamp({
      year: 2026,
      month: 3,
      day: 10,
      hour: 15,
    });

    const transactions = [
      createTransaction({
        id: 'previous-day',
        createdAt: createLocalTimestamp({
          year: 2026,
          month: 3,
          day: 9,
          hour: 23,
          minute: 59,
        }),
      }),
      createTransaction({
        id: 'custom-start',
        createdAt: createLocalTimestamp({
          year: 2026,
          month: 3,
          day: 10,
          hour: 0,
        }),
      }),
      createTransaction({
        id: 'custom-afternoon',
        createdAt: createLocalTimestamp({
          year: 2026,
          month: 3,
          day: 10,
          hour: 16,
        }),
      }),
      createTransaction({
        id: 'next-day',
        createdAt: createLocalTimestamp({
          year: 2026,
          month: 3,
          day: 11,
          hour: 0,
        }),
      }),
    ];

    expect(
      filterIds({
        transactions,
        period: 'custom_date',
        selectedCustomDateStart,
      }),
    ).toEqual(['custom-start', 'custom-afternoon']);
  });

  it('handles invalid or missing custom dates safely', () => {
    const transactions = [
      createTransaction({
        id: 'today',
        createdAt: REFERENCE_NOW,
      }),
    ];

    expect(
      filterIds({
        transactions,
        period: 'custom_date',
        selectedCustomDateStart: null,
      }),
    ).toEqual([]);

    expect(
      filterIds({
        transactions,
        period: 'custom_date',
        selectedCustomDateStart: Number.NaN,
      }),
    ).toEqual([]);
  });

  it('uses inclusive start and exclusive end day boundaries', () => {
    const transactions = [
      createTransaction({
        id: 'before-start',
        createdAt: createLocalTimestamp({
          year: 2026,
          month: 3,
          day: 14,
          hour: 23,
          minute: 59,
          second: 59,
          millisecond: 999,
        }),
      }),
      createTransaction({
        id: 'start',
        createdAt: createLocalTimestamp({
          year: 2026,
          month: 3,
          day: 15,
          hour: 0,
        }),
      }),
      createTransaction({
        id: 'before-end',
        createdAt: createLocalTimestamp({
          year: 2026,
          month: 3,
          day: 15,
          hour: 23,
          minute: 59,
          second: 59,
          millisecond: 999,
        }),
      }),
      createTransaction({
        id: 'end',
        createdAt: createLocalTimestamp({
          year: 2026,
          month: 3,
          day: 16,
          hour: 0,
        }),
      }),
    ];

    expect(filterIds({ transactions, period: 'today' })).toEqual([
      'start',
      'before-end',
    ]);
  });
});
