import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it, jest } from '@jest/globals';

import { parseTransactionsCsv } from '@/features/export/import-transactions-csv';

jest.mock('expo-document-picker', () => ({
  getDocumentAsync: jest.fn(),
}));

jest.mock('expo-file-system/legacy', () => ({
  readAsStringAsync: jest.fn(),
}));

function readCsvFixture(fileName: string) {
  return readFileSync(
    path.join(process.cwd(), 'docs', 'qa-fixtures', fileName),
    'utf8',
  );
}

const VALID_MONEY_LEAK_TRANSACTIONS = [
  {
    id: 'txn-fixture-normal',
    amount: 12.5,
    category: 'food',
    isLeak: false,
    leakReason: null,
    note: null,
    createdAt: Date.parse('2025-01-01T12:00:00.000Z'),
  },
  {
    id: 'txn-fixture-leak',
    amount: 18.4,
    category: 'shopping',
    isLeak: true,
    leakReason: 'impulse',
    note: 'comma, "quote"\nline two',
    createdAt: Date.parse('2025-01-02T12:00:00.000Z'),
  },
];

const VALID_CRLF_TRANSACTIONS = [
  {
    id: 'txn-crlf-normal',
    amount: 9.99,
    category: 'transport',
    isLeak: false,
    leakReason: null,
    note: null,
    createdAt: Date.parse('2025-01-03T12:00:00.000Z'),
  },
  {
    id: 'txn-crlf-leak',
    amount: 27.5,
    category: 'other',
    isLeak: true,
    leakReason: 'stress',
    note: 'first line\r\nsecond line',
    createdAt: Date.parse('2025-01-04T12:00:00.000Z'),
  },
];

const DUPLICATE_ID_TRANSACTIONS = [
  {
    id: 'txn-duplicate',
    amount: 12.5,
    category: 'food',
    isLeak: false,
    leakReason: null,
    note: null,
    createdAt: Date.parse('2025-01-01T12:00:00.000Z'),
  },
  {
    id: 'txn-duplicate',
    amount: 18.4,
    category: 'shopping',
    isLeak: true,
    leakReason: 'impulse',
    note: 'Later duplicate',
    createdAt: Date.parse('2025-01-02T12:00:00.000Z'),
  },
];

describe('parseTransactionsCsv', () => {
  it('parses the shared valid-money-leak fixture', () => {
    expect(
      parseTransactionsCsv(readCsvFixture('valid-money-leak.csv')),
    ).toEqual({
      transactions: VALID_MONEY_LEAK_TRANSACTIONS,
      skippedCount: 0,
    });
  });

  it('parses the shared UTF-8 BOM fixture', () => {
    expect(parseTransactionsCsv(readCsvFixture('valid-with-bom.csv'))).toEqual({
      transactions: VALID_MONEY_LEAK_TRANSACTIONS,
      skippedCount: 0,
    });
  });

  it('parses the shared CRLF fixture and preserves embedded CRLF notes', () => {
    expect(parseTransactionsCsv(readCsvFixture('valid-crlf.csv'))).toEqual({
      transactions: VALID_CRLF_TRANSACTIONS,
      skippedCount: 0,
    });
  });

  it('fails when the header does not match the Money Leak export format', () => {
    expect(() =>
      parseTransactionsCsv(readCsvFixture('wrong-header.csv')),
    ).toThrow("This CSV file doesn't match the Money Leak export format.");
  });

  it('fails for an empty file', () => {
    expect(() => parseTransactionsCsv('')).toThrow('This CSV file is empty.');
  });

  it('fails for malformed quoted CSV', () => {
    expect(() => parseTransactionsCsv(readCsvFixture('malformed.csv'))).toThrow(
      'This CSV file is malformed.',
    );
  });

  it('skips invalid rows from the mixed-valid-invalid fixture', () => {
    expect(
      parseTransactionsCsv(readCsvFixture('mixed-valid-invalid.csv')),
    ).toEqual({
      transactions: [
        {
          id: 'txn-valid-1',
          amount: 12.5,
          category: 'food',
          isLeak: false,
          leakReason: null,
          note: null,
          createdAt: Date.parse('2025-01-01T12:00:00.000Z'),
        },
      ],
      skippedCount: 5,
    });
  });

  it('keeps duplicate IDs from the fixture as valid parsed rows', () => {
    expect(parseTransactionsCsv(readCsvFixture('duplicate-ids.csv'))).toEqual({
      transactions: DUPLICATE_ID_TRANSACTIONS,
      skippedCount: 0,
    });
  });
});
