import {
  LEAK_REASONS,
  type LeakReason,
  type Transaction,
  type TransactionCategory,
} from '@/types/transaction';
import { ensureArchivedCategoriesForIds } from '@/db/categories.native';

import { getDatabase, initDatabase } from './database.native';

export { initDatabase };

type TransactionRow = {
  id: unknown;
  amount: unknown;
  category: unknown;
  is_leak: unknown;
  leak_reason: unknown;
  note: unknown;
  created_at: unknown;
};

const leakReasonSet = new Set<string>(LEAK_REASONS);

export async function createTransaction(transaction: Transaction) {
  await initDatabase();
  await ensureArchivedCategoriesForIds([transaction.category]);

  const database = await getDatabase();

  await database.runAsync(
    `
      INSERT INTO transactions (
        id,
        amount,
        category,
        is_leak,
        leak_reason,
        note,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    transaction.id,
    transaction.amount,
    transaction.category,
    transaction.isLeak ? 1 : 0,
    transaction.leakReason,
    transaction.note,
    transaction.createdAt,
  );
}

export async function importTransactions(transactions: Transaction[]) {
  if (!transactions.length) return 0;

  await initDatabase();

  await ensureArchivedCategoriesForIds(
    transactions.map((transaction) => transaction.category),
  );

  const database = await getDatabase();

  let importedCount = 0;

  await database.withExclusiveTransactionAsync(async (transactionDatabase) => {
    for (const transaction of transactions) {
      const result = await transactionDatabase.runAsync(
        `
          INSERT OR IGNORE INTO transactions (
            id,
            amount,
            category,
            is_leak,
            leak_reason,
            note,
            created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
        transaction.id,
        transaction.amount,
        transaction.category,
        transaction.isLeak ? 1 : 0,
        transaction.leakReason,
        transaction.note,
        transaction.createdAt,
      );

      importedCount += result.changes;
    }
  });

  return importedCount;
}

export async function updateTransaction(transaction: Transaction) {
  await initDatabase();
  await ensureArchivedCategoriesForIds([transaction.category]);

  const database = await getDatabase();

  await database.runAsync(
    `
      UPDATE transactions
      SET
        amount = ?,
        category = ?,
        is_leak = ?,
        leak_reason = ?,
        note = ?
      WHERE id = ?
    `,
    transaction.amount,
    transaction.category,
    transaction.isLeak ? 1 : 0,
    transaction.leakReason,
    transaction.note,
    transaction.id,
  );
}

export async function getTransactions() {
  await initDatabase();

  const database = await getDatabase();
  const rows = await database.getAllAsync<TransactionRow>(
    `
      SELECT
        id,
        amount,
        category,
        is_leak,
        leak_reason,
        note,
        created_at
      FROM transactions
      ORDER BY created_at DESC, id DESC
    `,
  );

  return rows.map(mapTransactionRow);
}

export async function deleteTransaction(id: string) {
  await initDatabase();

  const database = await getDatabase();

  await database.runAsync('DELETE FROM transactions WHERE id = ?', id);
}

function mapTransactionRow(row: TransactionRow): Transaction {
  assertRecord(row, 'Transaction row must be an object.');

  return {
    id: parseString(row.id, 'id'),
    amount: parseNumber(row.amount, 'amount'),
    category: parseTransactionCategory(row.category),
    isLeak: parseBooleanInteger(row.is_leak),
    leakReason: parseLeakReason(row.leak_reason),
    note: parseNullableString(row.note, 'note'),
    createdAt: parseNumber(row.created_at, 'created_at'),
  };
}

function assertRecord(
  value: unknown,
  message: string,
): asserts value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) {
    throw new Error(message);
  }
}

function parseString(value: unknown, fieldName: string) {
  if (typeof value !== 'string') {
    throw new Error(`Invalid transaction row: ${fieldName} must be a string.`);
  }

  return value;
}

function parseNullableString(value: unknown, fieldName: string) {
  if (value === null) return null;

  if (typeof value !== 'string') {
    throw new Error(
      `Invalid transaction row: ${fieldName} must be a string or null.`,
    );
  }

  return value;
}

function parseNumber(value: unknown, fieldName: string) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`Invalid transaction row: ${fieldName} must be a number.`);
  }

  return value;
}

function parseBooleanInteger(value: unknown) {
  if (value === 0) return false;

  if (value === 1) return true;

  throw new Error('Invalid transaction row: is_leak must be 0 or 1.');
}

function parseTransactionCategory(value: unknown): TransactionCategory {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error('Invalid transaction row: category must be a string.');
  }

  return value;
}

function parseLeakReason(value: unknown): LeakReason | null {
  if (value === null) return null;

  if (typeof value !== 'string' || !leakReasonSet.has(value)) {
    throw new Error('Invalid transaction row: leak_reason is not supported.');
  }

  return value as LeakReason;
}
