import { describe, expect, it } from '@jest/globals';

import { calculateCurrentBalance } from '@/features/home/calculate-current-balance';
import type { BalanceEntry } from '@/types/balance';
import type { Transaction } from '@/types/transaction';

function createBalanceEntry(
  overrides: Partial<BalanceEntry> & Pick<BalanceEntry, 'id'>,
): BalanceEntry {
  return {
    id: overrides.id,
    ownerId: overrides.ownerId ?? 'local_test-owner',
    amount: overrides.amount ?? 100,
    typeId: overrides.typeId ?? 'salary',
    createdAt: overrides.createdAt ?? 1000,
    updatedAt: overrides.updatedAt ?? overrides.createdAt ?? 1000,
    deletedAt: overrides.deletedAt ?? null,
    schemaVersion: overrides.schemaVersion ?? 1,
    sourceDeviceId: overrides.sourceDeviceId ?? 'device_test-device',
  };
}

function createTransaction(
  overrides: Partial<Transaction> & Pick<Transaction, 'id'>,
): Transaction {
  return {
    id: overrides.id,
    amount: overrides.amount ?? 12.5,
    category: overrides.category ?? 'food',
    isLeak: overrides.isLeak ?? false,
    leakReason: overrides.leakReason ?? null,
    note: overrides.note ?? null,
    createdAt: overrides.createdAt ?? 1000,
    ownerId: overrides.ownerId ?? 'local_test-owner',
    updatedAt: overrides.updatedAt ?? 1000,
    deletedAt: overrides.deletedAt ?? null,
    schemaVersion: overrides.schemaVersion ?? 1,
    sourceDeviceId: overrides.sourceDeviceId ?? 'device_test-device',
  };
}

describe('calculateCurrentBalance', () => {
  it('returns 0 for empty state', () => {
    expect(
      calculateCurrentBalance({
        balanceEntries: [],
        transactions: [],
      }),
    ).toBe(0);
  });

  it('sums balance entries when there are no transactions', () => {
    expect(
      calculateCurrentBalance({
        balanceEntries: [
          createBalanceEntry({ id: 'balance-1', amount: 100 }),
          createBalanceEntry({ id: 'balance-2', amount: 25.5 }),
        ],
        transactions: [],
      }),
    ).toBe(125.5);
  });

  it('subtracts active expense transactions from balance entries', () => {
    expect(
      calculateCurrentBalance({
        balanceEntries: [
          createBalanceEntry({ id: 'balance-1', amount: 100 }),
          createBalanceEntry({ id: 'balance-2', amount: 50 }),
        ],
        transactions: [
          createTransaction({ id: 'txn-1', amount: 12.25 }),
          createTransaction({ id: 'txn-2', amount: 37.75 }),
        ],
      }),
    ).toBe(100);
  });

  it('does not subtract deleted transaction tombstones', () => {
    expect(
      calculateCurrentBalance({
        balanceEntries: [createBalanceEntry({ id: 'balance-1', amount: 100 })],
        transactions: [
          createTransaction({ id: 'txn-active', amount: 20 }),
          createTransaction({
            id: 'txn-deleted',
            amount: 70,
            deletedAt: 2000,
          }),
        ],
      }),
    ).toBe(80);
  });

  it('does not add deleted balance tombstones', () => {
    expect(
      calculateCurrentBalance({
        balanceEntries: [
          createBalanceEntry({ id: 'balance-active', amount: 100 }),
          createBalanceEntry({
            id: 'balance-deleted',
            amount: 500,
            deletedAt: 2000,
          }),
        ],
        transactions: [createTransaction({ id: 'txn-active', amount: 20 })],
      }),
    ).toBe(80);
  });

  it('handles invalid amounts without returning NaN or Infinity', () => {
    const balance = calculateCurrentBalance({
      balanceEntries: [
        createBalanceEntry({
          id: 'balance-invalid',
          amount: Number.POSITIVE_INFINITY,
        }),
        createBalanceEntry({ id: 'balance-valid', amount: 50 }),
      ],
      transactions: [
        createTransaction({
          id: 'txn-invalid',
          amount: Number.NaN,
        }),
        createTransaction({ id: 'txn-valid', amount: 10 }),
      ],
    });

    expect(Number.isFinite(balance)).toBe(true);
    expect(balance).toBe(40);
  });
});
