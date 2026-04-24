import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

import { TRANSACTIONS_CSV_COLUMNS } from '@/features/export/transactions-csv-format';
import {
  LEAK_REASONS,
  TRANSACTION_CATEGORIES,
  type LeakReason,
  type Transaction,
  type TransactionCategory,
} from '@/types/transaction';

const IMPORT_TRANSACTIONS_ERROR_MESSAGE = "Couldn't import CSV. Try again.";

export const IMPORT_TRANSACTIONS_UNSUPPORTED_ERROR_MESSAGE =
  'Import CSV is only available on native devices in this build.';

const EMPTY_TRANSACTIONS_CSV_ERROR_MESSAGE = 'This CSV file is empty.';

const INVALID_TRANSACTIONS_CSV_HEADER_ERROR_MESSAGE =
  "This CSV file doesn't match the Money Leak export format.";

const MALFORMED_TRANSACTIONS_CSV_ERROR_MESSAGE = 'This CSV file is malformed.';

const transactionCategorySet = new Set<string>(TRANSACTION_CATEGORIES);
const leakReasonSet = new Set<string>(LEAK_REASONS);

type TransactionsCsvImportResult =
  | { status: 'cancelled' }
  | {
      status: 'selected';
      transactions: Transaction[];
      skippedCount: number;
    };

type TransactionsCsvRow = {
  id: string;
  amount: string;
  category: string;
  isLeak: string;
  leakReason: string;
  note: string;
  createdAt: string;
};

const VALID_IMPORT_ERROR_MESSAGES = new Set<string>([
  IMPORT_TRANSACTIONS_UNSUPPORTED_ERROR_MESSAGE,
  EMPTY_TRANSACTIONS_CSV_ERROR_MESSAGE,
  INVALID_TRANSACTIONS_CSV_HEADER_ERROR_MESSAGE,
  MALFORMED_TRANSACTIONS_CSV_ERROR_MESSAGE,
]);

export async function pickTransactionsCsvImport(): Promise<TransactionsCsvImportResult> {
  if (Platform.OS === 'web') {
    throw new Error(IMPORT_TRANSACTIONS_UNSUPPORTED_ERROR_MESSAGE);
  }

  const selection = await DocumentPicker.getDocumentAsync({
    type: ['text/csv', 'text/plain'],
    copyToCacheDirectory: true,
    multiple: false,
  });

  if (selection.canceled) return { status: 'cancelled' };

  const asset = selection.assets[0];

  if (!asset?.uri) {
    throw new Error(IMPORT_TRANSACTIONS_ERROR_MESSAGE);
  }

  try {
    const csvContents = await FileSystem.readAsStringAsync(asset.uri);
    const { transactions, skippedCount } = parseTransactionsCsv(csvContents);

    return {
      status: 'selected',
      transactions,
      skippedCount,
    };
  } catch (error) {
    throw new Error(getImportErrorMessage(error));
  }
}

function getImportErrorMessage(error: unknown) {
  if (
    error instanceof Error &&
    VALID_IMPORT_ERROR_MESSAGES.has(error.message)
  ) {
    return error.message;
  }

  return IMPORT_TRANSACTIONS_ERROR_MESSAGE;
}

function parseTransactionsCsv(csvContents: string) {
  const rows = parseCsv(stripUtf8Bom(csvContents));
  const headerIndex = rows.findIndex((row) => !isIgnorableBlankRow(row));

  if (headerIndex === -1) {
    throw new Error(EMPTY_TRANSACTIONS_CSV_ERROR_MESSAGE);
  }

  const headerRow = rows[headerIndex];

  if (!isValidTransactionsCsvHeader(headerRow)) {
    throw new Error(INVALID_TRANSACTIONS_CSV_HEADER_ERROR_MESSAGE);
  }

  const transactions: Transaction[] = [];

  let skippedCount = 0;

  for (const row of rows.slice(headerIndex + 1)) {
    if (isIgnorableBlankRow(row)) continue;

    const transaction = parseTransactionsCsvRow(row);

    if (!transaction) {
      skippedCount += 1;

      continue;
    }

    transactions.push(transaction);
  }

  return { transactions, skippedCount };
}

function stripUtf8Bom(value: string) {
  return value.replace(/^\uFEFF/, '');
}

function isIgnorableBlankRow(row: string[]) {
  return row.length === 1 && row[0].trim() === '';
}

function isValidTransactionsCsvHeader(row: string[]) {
  return (
    row.length === TRANSACTIONS_CSV_COLUMNS.length &&
    row.every((column, index) => column === TRANSACTIONS_CSV_COLUMNS[index])
  );
}

function parseCsv(value: string) {
  const rows: string[][] = [];

  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let justClosedQuotedField = false;

  function pushField() {
    row.push(field);

    field = '';
    justClosedQuotedField = false;
  }

  function pushRow() {
    pushField();
    rows.push(row);

    row = [];
  }

  function getNextRowBreakIndex(currentIndex: number) {
    const character = value[currentIndex];

    if (character === '\n') {
      pushRow();

      return currentIndex;
    }

    if (character === '\r') {
      pushRow();

      return value[currentIndex + 1] === '\n' ? currentIndex + 1 : currentIndex;
    }

    return null;
  }

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];

    if (inQuotes) {
      if (character === '"') {
        if (value[index + 1] === '"') {
          field += '"';
          index += 1;

          continue;
        }

        inQuotes = false;
        justClosedQuotedField = true;

        continue;
      }

      field += character;

      continue;
    }

    if (justClosedQuotedField) {
      if (character === ',') {
        pushField();

        continue;
      }

      const nextRowBreakIndex = getNextRowBreakIndex(index);

      if (nextRowBreakIndex !== null) {
        index = nextRowBreakIndex;
        
        continue;
      }

      throw new Error(MALFORMED_TRANSACTIONS_CSV_ERROR_MESSAGE);
    }

    if (field === '' && character === '"') {
      inQuotes = true;

      continue;
    }

    if (character === ',') {
      pushField();

      continue;
    }

    const nextRowBreakIndex = getNextRowBreakIndex(index);

    if (nextRowBreakIndex !== null) {
      index = nextRowBreakIndex;
      
      continue;
    }

    if (character === '"') {
      throw new Error(MALFORMED_TRANSACTIONS_CSV_ERROR_MESSAGE);
    }

    field += character;
  }

  if (inQuotes) {
    throw new Error(MALFORMED_TRANSACTIONS_CSV_ERROR_MESSAGE);
  }

  if (field !== '' || row.length > 0 || value.length > 0) {
    pushRow();
  }

  return rows;
}

function parseTransactionsCsvRow(row: string[]) {
  if (row.length !== TRANSACTIONS_CSV_COLUMNS.length) return null;

  const csvRow = getTransactionsCsvRow(row);
  const id = csvRow.id.trim();
  const amount = Number(csvRow.amount);
  const category = parseTransactionCategory(csvRow.category);
  const isLeak = parseIsLeak(csvRow.isLeak);
  const note = parseNote(csvRow.note);
  const createdAt = parseCreatedAt(csvRow.createdAt);

  if (!id || !Number.isFinite(amount) || amount <= 0) return null;

  if (category === null || isLeak === null) return null;

  if (createdAt === null) return null;

  const leakReason = parseLeakReason(csvRow.leakReason, isLeak);

  if (leakReason === undefined) return null;

  return {
    id,
    amount,
    category,
    isLeak,
    leakReason,
    note,
    createdAt,
  };
}

function getTransactionsCsvRow(row: string[]): TransactionsCsvRow {
  const [id, amount, category, isLeak, leakReason, note, createdAt] = row;

  return {
    id,
    amount,
    category,
    isLeak,
    leakReason,
    note,
    createdAt,
  };
}

function parseTransactionCategory(value: string): TransactionCategory | null {
  const normalizedValue = value.trim();

  if (!transactionCategorySet.has(normalizedValue)) return null;

  return normalizedValue as TransactionCategory;
}

function parseIsLeak(value: string) {
  if (value === 'true') return true;

  if (value === 'false') return false;

  return null;
}

function parseLeakReason(
  value: string,
  isLeak: boolean,
): LeakReason | null | undefined {
  const normalizedValue = value.trim();

  if (!isLeak) return normalizedValue === '' ? null : undefined;

  if (!leakReasonSet.has(normalizedValue)) return;

  return normalizedValue as LeakReason;
}

function parseNote(value: string) {
  return value.trim() === '' ? null : value;
}

function parseCreatedAt(value: string) {
  const date = new Date(value);

  if (!Number.isFinite(date.getTime())) return null;

  if (date.toISOString() !== value) return null;

  return date.getTime();
}
