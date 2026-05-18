import { describe, expect, it } from '@jest/globals';

import { generateAiInsight } from '@/features/analytics/generate-ai-insight';
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
    amount: 10,
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
    ...rest,
  };
}

describe('generateAiInsight', () => {
  it('returns null when there are no transactions', () => {
    expect(generateAiInsight([])).toBeNull();
  });

  it('returns null when there are no leaks', () => {
    const transactions = [
      createTransaction({
        id: 'txn-normal-1',
        amount: 18,
        createdAt: createLocalTimestamp(2026, 4, 4, 9, 0),
      }),
      createTransaction({
        id: 'txn-normal-2',
        amount: 24,
        category: 'shopping',
        createdAt: createLocalTimestamp(2026, 4, 5, 18, 0),
      }),
    ];

    expect(generateAiInsight(transactions)).toBeNull();
  });

  it('prioritizes high leak percentage over lower-priority signals', () => {
    const transactions = [
      createTransaction({
        id: 'txn-leak-priority',
        amount: 50,
        category: 'alcohol',
        isLeak: true,
        leakReason: 'boredom',
        createdAt: createLocalTimestamp(2026, 4, 1, 21, 0),
      }),
      createTransaction({
        id: 'txn-normal-buffer',
        amount: 10,
        category: 'transport',
        createdAt: createLocalTimestamp(2026, 4, 4, 10, 0),
      }),
    ];

    expect(generateAiInsight(transactions)).toBe(
      "You're not occasionally leaking money. This is your default behavior.",
    );
  });

  it('returns the alcohol insight when leak percentage stays at or below 40', () => {
    const transactions = [
      createTransaction({
        id: 'txn-alcohol-leak',
        amount: 20,
        category: 'alcohol',
        isLeak: true,
        leakReason: 'social',
        createdAt: createLocalTimestamp(2026, 4, 4, 18, 0),
      }),
      createTransaction({
        id: 'txn-normal-buffer',
        amount: 40,
        category: 'food',
        createdAt: createLocalTimestamp(2026, 4, 4, 12, 0),
      }),
    ];

    expect(generateAiInsight(transactions)).toBe(
      "Alcohol is your main leak. This is not random — it's a pattern.",
    );
  });

  it('returns the Friday insight before evening and boredom', () => {
    const transactions = [
      createTransaction({
        id: 'txn-friday-boredom-1',
        amount: 12,
        category: 'shopping',
        isLeak: true,
        leakReason: 'boredom',
        createdAt: createLocalTimestamp(2026, 4, 1, 21, 0),
      }),
      createTransaction({
        id: 'txn-friday-boredom-2',
        amount: 8,
        category: 'transport',
        isLeak: true,
        leakReason: 'boredom',
        createdAt: createLocalTimestamp(2026, 4, 1, 21, 30),
      }),
      createTransaction({
        id: 'txn-normal-buffer',
        amount: 60,
        category: 'food',
        createdAt: createLocalTimestamp(2026, 4, 4, 9, 0),
      }),
    ];

    expect(generateAiInsight(transactions)).toBe(
      'Friday is your danger zone. You consistently lose control there.',
    );
  });

  it('returns the evening insight before boredom', () => {
    const transactions = [
      createTransaction({
        id: 'txn-evening-boredom-1',
        amount: 10,
        category: 'shopping',
        isLeak: true,
        leakReason: 'boredom',
        createdAt: createLocalTimestamp(2026, 4, 4, 20, 0),
      }),
      createTransaction({
        id: 'txn-evening-boredom-2',
        amount: 10,
        category: 'transport',
        isLeak: true,
        leakReason: 'impulse',
        createdAt: createLocalTimestamp(2026, 4, 5, 20, 30),
      }),
      createTransaction({
        id: 'txn-normal-buffer',
        amount: 40,
        category: 'food',
        createdAt: createLocalTimestamp(2026, 4, 6, 10, 0),
      }),
    ];

    expect(generateAiInsight(transactions)).toBe(
      'Your leaks happen in the evening. This is emotional, not practical spending.',
    );
  });

  it('returns the boredom insight when earlier conditions do not match', () => {
    const transactions = [
      createTransaction({
        id: 'txn-boredom-1',
        amount: 10,
        category: 'shopping',
        isLeak: true,
        leakReason: 'boredom',
        createdAt: createLocalTimestamp(2026, 4, 4, 10, 0),
      }),
      createTransaction({
        id: 'txn-boredom-2',
        amount: 10,
        category: 'transport',
        isLeak: true,
        leakReason: 'boredom',
        createdAt: createLocalTimestamp(2026, 4, 5, 11, 0),
      }),
      createTransaction({
        id: 'txn-normal-buffer',
        amount: 60,
        category: 'food',
        createdAt: createLocalTimestamp(2026, 4, 6, 9, 0),
      }),
    ];

    expect(generateAiInsight(transactions)).toBe(
      "You're not spending because you need things. You're spending because you're bored.",
    );
  });

  it('falls back when leaks exist but no higher-priority condition matches', () => {
    const transactions = [
      createTransaction({
        id: 'txn-fallback-1',
        amount: 10,
        category: 'shopping',
        isLeak: true,
        leakReason: 'stress',
        createdAt: createLocalTimestamp(2026, 4, 4, 10, 0),
      }),
      createTransaction({
        id: 'txn-fallback-2',
        amount: 10,
        category: 'food',
        isLeak: true,
        leakReason: 'impulse',
        createdAt: createLocalTimestamp(2026, 4, 5, 11, 0),
      }),
      createTransaction({
        id: 'txn-normal-buffer',
        amount: 40,
        category: 'transport',
        createdAt: createLocalTimestamp(2026, 4, 6, 14, 0),
      }),
    ];

    expect(generateAiInsight(transactions)).toBe(
      'Your spending leaks are consistent. This is a habit, not a coincidence.',
    );
  });
});
