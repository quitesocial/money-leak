import { describe, expect, it } from '@jest/globals';

import { generateActionSuggestion } from '@/features/analytics/generate-action-suggestion';
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
    ...rest,
  };
}

describe('generateActionSuggestion', () => {
  it('returns null when there are no transactions', () => {
    expect(generateActionSuggestion([])).toBeNull();
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

    expect(generateActionSuggestion(transactions)).toBeNull();
  });

  it('returns the high leak percentage suggestion first', () => {
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

    expect(generateActionSuggestion(transactions)).toBe(
      'For the next 24 hours, delay every non-essential purchase by 10 minutes.',
    );
  });

  it('returns the alcohol suggestion when leak percentage stays at or below 40', () => {
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

    expect(generateActionSuggestion(transactions)).toBe(
      'Before buying alcohol, log the expected amount first. If it still feels worth it after 10 minutes, decide consciously.',
    );
  });

  it('returns the Friday suggestion before evening and boredom', () => {
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

    expect(generateActionSuggestion(transactions)).toBe(
      'Plan Friday spending before the evening starts. Your pattern breaks before the first purchase, not after.',
    );
  });

  it('returns the evening suggestion before boredom', () => {
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

    expect(generateActionSuggestion(transactions)).toBe(
      'Set a simple evening rule: no impulse purchases after 20:00 without a 10-minute pause.',
    );
  });

  it('returns the boredom suggestion when earlier conditions do not match', () => {
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

    expect(generateActionSuggestion(transactions)).toBe(
      'When boredom hits, do one free action first: walk, shower, game, message someone, or make tea.',
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

    expect(generateActionSuggestion(transactions)).toBe(
      'Pick one repeat leak and block it once this week. Do not fix everything at once.',
    );
  });

  it('prefers higher-priority rules when multiple suggestion conditions match', () => {
    const transactions = [
      createTransaction({
        id: 'txn-priority-friday-evening',
        amount: 15,
        category: 'shopping',
        isLeak: true,
        leakReason: 'boredom',
        createdAt: createLocalTimestamp(2026, 4, 1, 21, 0),
      }),
      createTransaction({
        id: 'txn-priority-friday-evening-2',
        amount: 10,
        category: 'food',
        isLeak: true,
        leakReason: 'boredom',
        createdAt: createLocalTimestamp(2026, 4, 1, 21, 30),
      }),
      createTransaction({
        id: 'txn-normal-buffer',
        amount: 50,
        category: 'transport',
        createdAt: createLocalTimestamp(2026, 4, 6, 10, 0),
      }),
    ];

    expect(generateActionSuggestion(transactions)).toBe(
      'Plan Friday spending before the evening starts. Your pattern breaks before the first purchase, not after.',
    );
  });
});
