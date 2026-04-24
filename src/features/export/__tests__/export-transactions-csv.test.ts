import { describe, expect, it, jest } from '@jest/globals';
import { transactionsToCsv } from '@/features/export/export-transactions-csv';
import type { Transaction } from '@/types/transaction';

jest.mock('expo-file-system/legacy', () => ({
  cacheDirectory: 'file:///cache/',
  writeAsStringAsync: jest.fn(),
}));

jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn(),
  shareAsync: jest.fn(),
}));

const NORMAL_TRANSACTION: Transaction = {
  id: 'txn-normal',
  amount: 12.5,
  category: 'food',
  isLeak: false,
  leakReason: null,
  note: null,
  createdAt: 1735732800000,
};

const LEAK_TRANSACTION: Transaction = {
  id: 'txn-leak',
  amount: 18.4,
  category: 'shopping',
  isLeak: true,
  leakReason: 'impulse',
  note: 'Late-night impulse',
  createdAt: 1735819200000,
};

describe('transactionsToCsv', () => {
  it('returns the header only for empty transactions', () => {
    expect(transactionsToCsv([])).toBe(
      'id,amount,category,isLeak,leakReason,note,createdAt',
    );
  });

  it('exports a normal transaction row', () => {
    expect(transactionsToCsv([NORMAL_TRANSACTION])).toBe(
      [
        'id,amount,category,isLeak,leakReason,note,createdAt',
        'txn-normal,12.5,food,false,,,2025-01-01T12:00:00.000Z',
      ].join('\n'),
    );
  });

  it('exports a leak transaction row', () => {
    expect(transactionsToCsv([LEAK_TRANSACTION])).toBe(
      [
        'id,amount,category,isLeak,leakReason,note,createdAt',
        'txn-leak,18.4,shopping,true,impulse,Late-night impulse,2025-01-02T12:00:00.000Z',
      ].join('\n'),
    );
  });

  it('escapes commas, quotes, CRLF, LF, and embedded newlines inside quoted fields', () => {
    const transaction: Transaction = {
      id: 'txn-escape',
      amount: 42,
      category: 'other',
      isLeak: true,
      leakReason: 'stress',
      note: 'comma, "quote"\r\nline two\nline three\rand line four',
      createdAt: 1735905600000,
    };

    expect(transactionsToCsv([transaction])).toBe(
      [
        'id,amount,category,isLeak,leakReason,note,createdAt',
        'txn-escape,42,other,true,stress,"comma, ""quote""\r\nline two\nline three\rand line four",2025-01-03T12:00:00.000Z',
      ].join('\n'),
    );
  });
});
