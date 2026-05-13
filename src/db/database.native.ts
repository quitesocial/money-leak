import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

import { DEFAULT_CATEGORIES } from '@/types/category';
import { LEAK_REASONS } from '@/types/transaction';

const DATABASE_NAME = 'money-leak.db';

const LEAK_REASON_VALUES_SQL = LEAK_REASONS.map((reason) => `'${reason}'`).join(
  ', ',
);

const CREATE_TRANSACTIONS_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY NOT NULL,
    amount REAL NOT NULL,
    category TEXT NOT NULL,
    is_leak INTEGER NOT NULL CHECK (is_leak IN (0, 1)),
    leak_reason TEXT CHECK (
      leak_reason IS NULL OR leak_reason IN (${LEAK_REASON_VALUES_SQL})
    ),
    note TEXT,
    created_at INTEGER NOT NULL
  );
`;

const CREATE_CATEGORIES_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    is_default INTEGER NOT NULL CHECK (is_default IN (0, 1)),
    is_archived INTEGER NOT NULL CHECK (is_archived IN (0, 1)),
    sort_order INTEGER NOT NULL
  );

  CREATE UNIQUE INDEX IF NOT EXISTS categories_active_name_unique
  ON categories (LOWER(name))
  WHERE is_archived = 0;
`;

type SqliteSchemaRow = {
  sql: unknown;
};

let databasePromise: Promise<SQLiteDatabase> | null = null;
let initPromise: Promise<void> | null = null;

export function getDatabase() {
  if (!databasePromise) {
    databasePromise = openDatabaseAsync(DATABASE_NAME).catch((error) => {
      databasePromise = null;
      throw error;
    });
  }

  return databasePromise;
}

export async function initDatabase() {
  if (!initPromise) {
    initPromise = (async () => {
      const database = await getDatabase();

      await database.execAsync('PRAGMA journal_mode = WAL;');
      await ensureTransactionsTable(database);
      await database.execAsync(CREATE_CATEGORIES_TABLE_SQL);
      await seedDefaultCategories(database);
    })().catch((error) => {
      initPromise = null;

      throw error;
    });
  }

  return initPromise;
}

async function ensureTransactionsTable(database: SQLiteDatabase) {
  await database.execAsync(CREATE_TRANSACTIONS_TABLE_SQL);

  const schemaRow = await database.getFirstAsync<SqliteSchemaRow>(
    `
      SELECT sql
      FROM sqlite_master
      WHERE type = 'table' AND name = 'transactions'
    `,
  );

  if (
    typeof schemaRow?.sql === 'string' &&
    schemaRow.sql.includes('category IN')
  ) {
    await migrateTransactionsCategoryConstraint(database);
  }
}

async function migrateTransactionsCategoryConstraint(database: SQLiteDatabase) {
  await database.withExclusiveTransactionAsync(async (transactionDatabase) => {
    await transactionDatabase.execAsync(`
      DROP TABLE IF EXISTS transactions_next;

      CREATE TABLE transactions_next (
        id TEXT PRIMARY KEY NOT NULL,
        amount REAL NOT NULL,
        category TEXT NOT NULL,
        is_leak INTEGER NOT NULL CHECK (is_leak IN (0, 1)),
        leak_reason TEXT CHECK (
          leak_reason IS NULL OR leak_reason IN (${LEAK_REASON_VALUES_SQL})
        ),
        note TEXT,
        created_at INTEGER NOT NULL
      );

      INSERT OR IGNORE INTO transactions_next (
        id,
        amount,
        category,
        is_leak,
        leak_reason,
        note,
        created_at
      )
      SELECT
        id,
        amount,
        category,
        is_leak,
        leak_reason,
        note,
        created_at
      FROM transactions;

      DROP TABLE transactions;
      ALTER TABLE transactions_next RENAME TO transactions;
    `);
  });
}

async function seedDefaultCategories(database: SQLiteDatabase) {
  const now = Date.now();

  for (const category of DEFAULT_CATEGORIES) {
    await database.runAsync(
      `
        INSERT OR IGNORE INTO categories (
          id,
          name,
          created_at,
          updated_at,
          is_default,
          is_archived,
          sort_order
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      category.id,
      category.name,
      now,
      now,
      1,
      0,
      category.sortOrder,
    );
  }
}
