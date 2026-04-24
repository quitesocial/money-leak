import { describe, expect, it, jest } from '@jest/globals';
import { parseTransactionsCsv } from '@/features/export/import-transactions-csv';

jest.mock('expo-document-picker', () => ({
  getDocumentAsync: jest.fn(),
}));

jest.mock('expo-file-system/legacy', () => ({
  readAsStringAsync: jest.fn(),
}));

const HEADER = 'id,amount,category,isLeak,leakReason,note,createdAt';

describe('parseTransactionsCsv', () => {
  it('parses a CSV with a UTF-8 BOM at the start', () => {
    const csv = [
      `\uFEFF${HEADER}`,
      'txn-1,12.5,food,false,,,2025-01-01T12:00:00.000Z',
    ].join('\n');

    expect(parseTransactionsCsv(csv)).toEqual({
      transactions: [
        {
          id: 'txn-1',
          amount: 12.5,
          category: 'food',
          isLeak: false,
          leakReason: null,
          note: null,
          createdAt: 1735732800000,
        },
      ],
      skippedCount: 0,
    });
  });

  it('parses CRLF row endings', () => {
    const csv = [
      HEADER,
      'txn-1,12.5,food,false,,,2025-01-01T12:00:00.000Z',
      'txn-2,18.4,shopping,true,impulse,Keep it,2025-01-02T12:00:00.000Z',
    ].join('\r\n');

    expect(parseTransactionsCsv(csv)).toEqual({
      transactions: [
        {
          id: 'txn-1',
          amount: 12.5,
          category: 'food',
          isLeak: false,
          leakReason: null,
          note: null,
          createdAt: 1735732800000,
        },
        {
          id: 'txn-2',
          amount: 18.4,
          category: 'shopping',
          isLeak: true,
          leakReason: 'impulse',
          note: 'Keep it',
          createdAt: 1735819200000,
        },
      ],
      skippedCount: 0,
    });
  });

  it('fails when the header does not match the Money Leak export format', () => {
    const csv = [
      'id,amount,category,isLeak,note,leakReason,createdAt',
      'txn-1,12.5,food,false,,,2025-01-01T12:00:00.000Z',
    ].join('\n');

    expect(() => parseTransactionsCsv(csv)).toThrow(
      "This CSV file doesn't match the Money Leak export format.",
    );
  });

  it('fails for an empty file', () => {
    expect(() => parseTransactionsCsv('')).toThrow('This CSV file is empty.');
  });

  it('fails for malformed quoted CSV', () => {
    const csv = [
      HEADER,
      'txn-1,12.5,food,false,,"broken note,2025-01-01T12:00:00.000Z',
    ].join('\n');

    expect(() => parseTransactionsCsv(csv)).toThrow(
      'This CSV file is malformed.',
    );
  });

  it('skips invalid rows without failing the whole import', () => {
    const csv = [
      HEADER,
      'txn-1,12.5,food,false,,,2025-01-01T12:00:00.000Z',
      'txn-bad-amount,0,food,false,,,2025-01-01T12:00:00.000Z',
      'txn-bad-category,5,invalid,false,,,2025-01-01T12:00:00.000Z',
      'txn-bad-leak,9,shopping,true,not-a-reason,,2025-01-01T12:00:00.000Z',
      '',
      'txn-2,18.4,shopping,true,impulse,"line 1\nline 2",2025-01-02T12:00:00.000Z',
    ].join('\n');

    expect(parseTransactionsCsv(csv)).toEqual({
      transactions: [
        {
          id: 'txn-1',
          amount: 12.5,
          category: 'food',
          isLeak: false,
          leakReason: null,
          note: null,
          createdAt: 1735732800000,
        },
        {
          id: 'txn-2',
          amount: 18.4,
          category: 'shopping',
          isLeak: true,
          leakReason: 'impulse',
          note: 'line 1\nline 2',
          createdAt: 1735819200000,
        },
      ],
      skippedCount: 3,
    });
  });

  it('keeps duplicate IDs as valid parsed rows', () => {
    const csv = [
      HEADER,
      'txn-dup,12.5,food,false,,,2025-01-01T12:00:00.000Z',
      'txn-dup,18.4,shopping,true,impulse,Later duplicate,2025-01-02T12:00:00.000Z',
    ].join('\n');

    expect(parseTransactionsCsv(csv)).toEqual({
      transactions: [
        {
          id: 'txn-dup',
          amount: 12.5,
          category: 'food',
          isLeak: false,
          leakReason: null,
          note: null,
          createdAt: 1735732800000,
        },
        {
          id: 'txn-dup',
          amount: 18.4,
          category: 'shopping',
          isLeak: true,
          leakReason: 'impulse',
          note: 'Later duplicate',
          createdAt: 1735819200000,
        },
      ],
      skippedCount: 0,
    });
  });
});
