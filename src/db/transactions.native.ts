import {
  LEAK_REASONS,
  type LeakReason,
  type Transaction,
  type TransactionCategory,
  type TransactionInput,
  type TransactionRestoreInput,
  type TransactionTombstoneRestoreInput,
} from '@/types/transaction';
import { ensureArchivedCategoriesForIds } from '@/db/categories.native';

import { ensureLocalIdentity } from './local-identity.native';
import { getDatabase, initDatabase } from './database.native';

export { initDatabase };

type TransactionRow = {
  id: unknown;
  owner_id: unknown;
  amount: unknown;
  category: unknown;
  is_leak: unknown;
  leak_reason: unknown;
  note: unknown;
  created_at: unknown;
  updated_at: unknown;
  deleted_at: unknown;
  schema_version: unknown;
  source_device_id: unknown;
};

const leakReasonSet = new Set<string>(LEAK_REASONS);

export async function createTransaction(transaction: TransactionInput) {
  await initDatabase();
  await ensureArchivedCategoriesForIds([transaction.category]);

  const database = await getDatabase();
  const identity = await ensureLocalIdentity(database);

  await database.runAsync(
    `
      INSERT INTO transactions (
        id,
        owner_id,
        amount,
        category,
        is_leak,
        leak_reason,
        note,
        created_at,
        updated_at,
        deleted_at,
        schema_version,
        source_device_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    transaction.id,
    identity.localOwnerId,
    transaction.amount,
    transaction.category,
    transaction.isLeak ? 1 : 0,
    transaction.leakReason,
    transaction.note,
    transaction.createdAt,
    transaction.createdAt,
    null,
    1,
    identity.deviceId,
  );
}

export async function importTransactions(transactions: TransactionInput[]) {
  if (!transactions.length) return 0;

  await initDatabase();

  await ensureArchivedCategoriesForIds(
    transactions.map((transaction) => transaction.category),
  );

  const database = await getDatabase();
  const identity = await ensureLocalIdentity(database);

  let importedCount = 0;

  await database.withExclusiveTransactionAsync(async (transactionDatabase) => {
    for (const transaction of transactions) {
      const result = await transactionDatabase.runAsync(
        `
          INSERT OR IGNORE INTO transactions (
            id,
            owner_id,
            amount,
            category,
            is_leak,
            leak_reason,
            note,
            created_at,
            updated_at,
            deleted_at,
            schema_version,
            source_device_id
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        transaction.id,
        identity.localOwnerId,
        transaction.amount,
        transaction.category,
        transaction.isLeak ? 1 : 0,
        transaction.leakReason,
        transaction.note,
        transaction.createdAt,
        transaction.createdAt,
        null,
        1,
        identity.deviceId,
      );

      importedCount += result.changes;
    }
  });

  return importedCount;
}

export async function restoreTransactions(
  transactions: TransactionRestoreInput[],
) {
  if (!transactions.length) return 0;

  await initDatabase();

  await ensureArchivedCategoriesForIds(
    transactions.map((transaction) => transaction.category),
  );

  const database = await getDatabase();
  const identity = await ensureLocalIdentity(database);

  let restoredCount = 0;

  await database.withExclusiveTransactionAsync(async (transactionDatabase) => {
    for (const transaction of transactions) {
      const result = await transactionDatabase.runAsync(
        `
          INSERT OR IGNORE INTO transactions (
            id,
            owner_id,
            amount,
            category,
            is_leak,
            leak_reason,
            note,
            created_at,
            updated_at,
            deleted_at,
            schema_version,
            source_device_id
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        transaction.id,
        identity.localOwnerId,
        transaction.amount,
        transaction.category,
        transaction.isLeak ? 1 : 0,
        transaction.leakReason,
        transaction.note,
        transaction.createdAt,
        transaction.updatedAt,
        null,
        1,
        identity.deviceId,
      );

      restoredCount += getChangedRowCount(result);
    }
  });

  return restoredCount;
}

export async function restoreTransactionTombstones(
  tombstones: TransactionTombstoneRestoreInput[],
) {
  if (!tombstones.length) return 0;

  await initDatabase();

  const database = await getDatabase();
  const identity = await ensureLocalIdentity(database);

  let restoredCount = 0;

  await database.withExclusiveTransactionAsync(async (transactionDatabase) => {
    for (const tombstone of tombstones) {
      const result = await transactionDatabase.runAsync(
        `
          UPDATE transactions
          SET
            deleted_at = ?,
            updated_at = ?,
            source_device_id = ?
          WHERE id = ? AND deleted_at IS NULL
        `,
        tombstone.deletedAt,
        tombstone.updatedAt,
        identity.deviceId,
        tombstone.id,
      );

      restoredCount += getChangedRowCount(result);
    }
  });

  return restoredCount;
}

export async function applyTransactionSyncChanges({
  tombstones,
  upserts,
}: {
  upserts: TransactionRestoreInput[];
  tombstones: TransactionTombstoneRestoreInput[];
}) {
  if (!upserts.length && !tombstones.length) {
    return {
      upsertedTransactionsCount: 0,
      deletedTransactionsCount: 0,
    };
  }

  await initDatabase();
  await ensureArchivedCategoriesForIds(
    upserts.map((transaction) => transaction.category),
  );

  const database = await getDatabase();
  const identity = await ensureLocalIdentity(database);
  let upsertedTransactionsCount = 0;
  let deletedTransactionsCount = 0;

  await database.withExclusiveTransactionAsync(async (transactionDatabase) => {
    for (const transaction of upserts) {
      const updateResult = await transactionDatabase.runAsync(
        `
          UPDATE transactions
          SET
            amount = ?,
            category = ?,
            is_leak = ?,
            leak_reason = ?,
            note = ?,
            updated_at = ?,
            deleted_at = NULL,
            source_device_id = ?
          WHERE id = ?
        `,
        transaction.amount,
        transaction.category,
        transaction.isLeak ? 1 : 0,
        transaction.leakReason,
        transaction.note,
        transaction.updatedAt,
        identity.deviceId,
        transaction.id,
      );

      const updatedRows = getChangedRowCount(updateResult);

      if (updatedRows > 0) {
        upsertedTransactionsCount += updatedRows;

        continue;
      }

      const insertResult = await transactionDatabase.runAsync(
        `
          INSERT OR IGNORE INTO transactions (
            id,
            owner_id,
            amount,
            category,
            is_leak,
            leak_reason,
            note,
            created_at,
            updated_at,
            deleted_at,
            schema_version,
            source_device_id
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        transaction.id,
        identity.localOwnerId,
        transaction.amount,
        transaction.category,
        transaction.isLeak ? 1 : 0,
        transaction.leakReason,
        transaction.note,
        transaction.createdAt,
        transaction.updatedAt,
        null,
        1,
        identity.deviceId,
      );

      upsertedTransactionsCount += getChangedRowCount(insertResult);
    }

    for (const tombstone of tombstones) {
      const result = await transactionDatabase.runAsync(
        `
          UPDATE transactions
          SET
            deleted_at = ?,
            updated_at = ?,
            source_device_id = ?
          WHERE id = ?
            AND (
              deleted_at IS NULL
              OR deleted_at < ?
              OR updated_at < ?
            )
        `,
        tombstone.deletedAt,
        tombstone.updatedAt,
        identity.deviceId,
        tombstone.id,
        tombstone.deletedAt,
        tombstone.updatedAt,
      );

      deletedTransactionsCount += getChangedRowCount(result);
    }
  });

  return {
    upsertedTransactionsCount,
    deletedTransactionsCount,
  };
}

export async function updateTransaction(transaction: TransactionInput) {
  await initDatabase();
  await ensureArchivedCategoriesForIds([transaction.category]);

  const database = await getDatabase();
  const identity = await ensureLocalIdentity(database);
  const updatedAt = Date.now();

  await database.runAsync(
    `
      UPDATE transactions
      SET
        amount = ?,
        category = ?,
        is_leak = ?,
        leak_reason = ?,
        note = ?,
        updated_at = ?,
        source_device_id = ?
      WHERE id = ? AND deleted_at IS NULL
    `,
    transaction.amount,
    transaction.category,
    transaction.isLeak ? 1 : 0,
    transaction.leakReason,
    transaction.note,
    updatedAt,
    identity.deviceId,
    transaction.id,
  );
}

function getChangedRowCount(result: { changes?: unknown }) {
  return typeof result.changes === 'number' && Number.isFinite(result.changes)
    ? result.changes
    : 0;
}

export async function getTransactions() {
  await initDatabase();

  const database = await getDatabase();
  const rows = await database.getAllAsync<TransactionRow>(
    `
      SELECT
        id,
        owner_id,
        amount,
        category,
        is_leak,
        leak_reason,
        note,
        created_at,
        updated_at,
        deleted_at,
        schema_version,
        source_device_id
      FROM transactions
      WHERE deleted_at IS NULL
      ORDER BY created_at DESC, id DESC
    `,
  );

  return rows.map(mapTransactionRow);
}

export async function getTransactionsForBackup() {
  await initDatabase();

  const database = await getDatabase();
  const rows = await database.getAllAsync<TransactionRow>(
    `
      SELECT
        id,
        owner_id,
        amount,
        category,
        is_leak,
        leak_reason,
        note,
        created_at,
        updated_at,
        deleted_at,
        schema_version,
        source_device_id
      FROM transactions
      ORDER BY created_at DESC, id DESC
    `,
  );

  return rows.map(mapTransactionRow);
}

export async function deleteTransaction(id: string) {
  await initDatabase();

  const database = await getDatabase();
  const identity = await ensureLocalIdentity(database);
  const deletedAt = Date.now();

  await database.runAsync(
    `
      UPDATE transactions
      SET
        deleted_at = ?,
        updated_at = ?,
        source_device_id = ?
      WHERE id = ? AND deleted_at IS NULL
    `,
    deletedAt,
    deletedAt,
    identity.deviceId,
    id,
  );
}

function mapTransactionRow(row: TransactionRow): Transaction {
  assertRecord(row, 'Transaction row must be an object.');

  return {
    id: parseString(row.id, 'id'),
    ownerId: parseString(row.owner_id, 'owner_id'),
    amount: parseNumber(row.amount, 'amount'),
    category: parseTransactionCategory(row.category),
    isLeak: parseBooleanInteger(row.is_leak),
    leakReason: parseLeakReason(row.leak_reason),
    note: parseNullableString(row.note, 'note'),
    createdAt: parseNumber(row.created_at, 'created_at'),
    updatedAt: parseNumber(row.updated_at, 'updated_at'),
    deletedAt: parseNullableNumber(row.deleted_at, 'deleted_at'),
    schemaVersion: parseNumber(row.schema_version, 'schema_version'),
    sourceDeviceId: parseString(row.source_device_id, 'source_device_id'),
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

function parseNullableNumber(value: unknown, fieldName: string) {
  if (value === null) return null;

  return parseNumber(value, fieldName);
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
