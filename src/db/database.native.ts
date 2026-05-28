import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

import { DEFAULT_CATEGORIES } from '@/types/category';
import { LEAK_REASONS } from '@/types/transaction';

import {
  ensureAppMetadataTable,
  ensureLocalIdentity,
  type LocalDatabaseIdentity,
} from './local-identity.native';
import {
  ensureSchemaMigrationsTable,
  runDatabaseMigrations,
} from './migrations.native';

const DATABASE_NAME = 'money-leak.db';

const LEAK_REASON_VALUES_SQL = LEAK_REASONS.map((reason) => `'${reason}'`).join(
  ', ',
);

const CREATE_TRANSACTIONS_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY NOT NULL,
    owner_id TEXT NOT NULL,
    amount REAL NOT NULL,
    category TEXT NOT NULL,
    is_leak INTEGER NOT NULL CHECK (is_leak IN (0, 1)),
    leak_reason TEXT CHECK (
      leak_reason IS NULL OR leak_reason IN (${LEAK_REASON_VALUES_SQL})
    ),
    note TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    deleted_at INTEGER,
    schema_version INTEGER NOT NULL DEFAULT 1,
    source_device_id TEXT NOT NULL
  );
`;

const CREATE_CATEGORIES_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY NOT NULL,
    owner_id TEXT NOT NULL,
    name TEXT NOT NULL,
    icon_name TEXT NOT NULL DEFAULT 'tag',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    is_default INTEGER NOT NULL CHECK (is_default IN (0, 1)),
    is_archived INTEGER NOT NULL CHECK (is_archived IN (0, 1)),
    deleted_at INTEGER,
    schema_version INTEGER NOT NULL DEFAULT 1,
    source_device_id TEXT NOT NULL,
    sort_order INTEGER NOT NULL
  );

  CREATE UNIQUE INDEX IF NOT EXISTS categories_active_name_unique
  ON categories (LOWER(name))
  WHERE is_archived = 0;
`;

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
      await ensureAppMetadataTable(database);
      await ensureSchemaMigrationsTable(database);

      const identity = await ensureLocalIdentity(database);

      await ensureTransactionsTable(database);
      await database.execAsync(CREATE_CATEGORIES_TABLE_SQL);

      await runDatabaseMigrations({
        database,
        identity,
      });

      await seedDefaultCategories(database, identity);
    })().catch((error) => {
      initPromise = null;

      throw error;
    });
  }

  return initPromise;
}

async function ensureTransactionsTable(database: SQLiteDatabase) {
  await database.execAsync(CREATE_TRANSACTIONS_TABLE_SQL);
}

async function seedDefaultCategories(
  database: SQLiteDatabase,
  identity: LocalDatabaseIdentity,
) {
  const now = Date.now();

  for (const category of DEFAULT_CATEGORIES) {
    await database.runAsync(
      `
        INSERT OR IGNORE INTO categories (
          id,
          owner_id,
          name,
          icon_name,
          created_at,
          updated_at,
          is_default,
          is_archived,
          deleted_at,
          schema_version,
          source_device_id,
          sort_order
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      category.id,
      identity.localOwnerId,
      category.name,
      category.iconName,
      now,
      now,
      1,
      0,
      null,
      1,
      identity.deviceId,
      category.sortOrder,
    );
  }
}
