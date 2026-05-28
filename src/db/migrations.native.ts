import {
  CATEGORY_ICON_FALLBACK_NAME,
  DEFAULT_CATEGORY_ICON_NAMES,
} from '@/lib/category-icons';
import { LEAK_REASONS } from '@/types/transaction';

import type { LocalDatabaseIdentity } from './local-identity.native';

export type MigrationTransactionDatabase = {
  execAsync(source: string): Promise<void>;
  getAllAsync<T>(source: string, ...params: unknown[]): Promise<T[]>;
  getFirstAsync<T>(source: string, ...params: unknown[]): Promise<T | null>;
  runAsync(source: string, ...params: unknown[]): Promise<unknown>;
};

export type MigrationDatabase = MigrationTransactionDatabase & {
  withExclusiveTransactionAsync(
    callback: (
      transactionDatabase: MigrationTransactionDatabase,
    ) => Promise<void>,
  ): Promise<void>;
};

type MigrationContext = LocalDatabaseIdentity & {
  now: () => number;
};

type Migration = {
  id: string;
  up: (
    database: MigrationTransactionDatabase,
    context: MigrationContext,
  ) => Promise<void>;
};

type SchemaMigrationRow = {
  id: unknown;
};

type SqliteSchemaRow = {
  sql: unknown;
};

type TableInfoRow = {
  name: unknown;
};

export const CREATE_SCHEMA_MIGRATIONS_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS schema_migrations (
    id TEXT PRIMARY KEY NOT NULL,
    applied_at INTEGER NOT NULL
  );
`;

const LEAK_REASON_VALUES_SQL = LEAK_REASONS.map((reason) => `'${reason}'`).join(
  ', ',
);

const migrations: Migration[] = [
  {
    id: '001_remove_transactions_category_check',
    up: removeTransactionsCategoryCheck,
  },
  {
    id: '002_add_sync_ready_local_fields',
    up: addSyncReadyLocalFields,
  },
  {
    id: '003_add_category_icons',
    up: addCategoryIcons,
  },
];

export async function ensureSchemaMigrationsTable(
  database: MigrationTransactionDatabase,
) {
  await database.execAsync(CREATE_SCHEMA_MIGRATIONS_TABLE_SQL);
}

export async function runDatabaseMigrations({
  database,
  identity,
  now = Date.now,
}: {
  database: MigrationDatabase;
  identity: LocalDatabaseIdentity;
  now?: () => number;
}) {
  await ensureSchemaMigrationsTable(database);

  for (const migration of migrations) {
    const appliedMigration = await database.getFirstAsync<SchemaMigrationRow>(
      `
        SELECT id
        FROM schema_migrations
        WHERE id = ?
      `,
      migration.id,
    );

    if (appliedMigration?.id === migration.id) continue;

    await database.withExclusiveTransactionAsync(
      async (transactionDatabase) => {
        await migration.up(transactionDatabase, {
          ...identity,
          now,
        });

        await transactionDatabase.runAsync(
          `
            INSERT OR IGNORE INTO schema_migrations (
              id,
              applied_at
            ) VALUES (?, ?)
          `,
          migration.id,
          now(),
        );
      },
    );
  }
}

export async function removeTransactionsCategoryCheck(
  database: MigrationTransactionDatabase,
) {
  const schemaRow = await database.getFirstAsync<SqliteSchemaRow>(
    `
      SELECT sql
      FROM sqlite_master
      WHERE type = 'table' AND name = 'transactions'
    `,
  );

  if (
    typeof schemaRow?.sql !== 'string' ||
    !schemaRow.sql.includes('category IN')
  ) {
    return;
  }

  await database.execAsync(`
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
}

export async function addSyncReadyLocalFields(
  database: MigrationTransactionDatabase,
  { localOwnerId, deviceId, now }: MigrationContext,
) {
  await addColumnIfMissing({
    database,
    tableName: 'transactions',
    columnName: 'owner_id',
    sql: "ALTER TABLE transactions ADD COLUMN owner_id TEXT NOT NULL DEFAULT '';",
  });

  await addColumnIfMissing({
    database,
    tableName: 'transactions',
    columnName: 'updated_at',
    sql: 'ALTER TABLE transactions ADD COLUMN updated_at INTEGER NOT NULL DEFAULT 0;',
  });

  await addColumnIfMissing({
    database,
    tableName: 'transactions',
    columnName: 'deleted_at',
    sql: 'ALTER TABLE transactions ADD COLUMN deleted_at INTEGER;',
  });

  await addColumnIfMissing({
    database,
    tableName: 'transactions',
    columnName: 'schema_version',
    sql: 'ALTER TABLE transactions ADD COLUMN schema_version INTEGER NOT NULL DEFAULT 1;',
  });

  await addColumnIfMissing({
    database,
    tableName: 'transactions',
    columnName: 'source_device_id',
    sql: "ALTER TABLE transactions ADD COLUMN source_device_id TEXT NOT NULL DEFAULT '';",
  });

  await database.runAsync(
    `
      UPDATE transactions
      SET owner_id = ?
      WHERE owner_id IS NULL OR owner_id = ''
    `,
    localOwnerId,
  );

  await database.runAsync(
    `
      UPDATE transactions
      SET updated_at = CASE
        WHEN created_at IS NOT NULL AND created_at > 0 THEN created_at
        ELSE ?
      END
      WHERE updated_at IS NULL OR updated_at <= 0
    `,
    now(),
  );

  await database.runAsync(
    `
      UPDATE transactions
      SET deleted_at = NULL
      WHERE deleted_at IS NOT NULL AND deleted_at <= 0
    `,
  );

  await database.runAsync(
    `
      UPDATE transactions
      SET schema_version = 1
      WHERE schema_version IS NULL OR schema_version <= 0
    `,
  );

  await database.runAsync(
    `
      UPDATE transactions
      SET source_device_id = ?
      WHERE source_device_id IS NULL OR source_device_id = ''
    `,
    deviceId,
  );

  await addColumnIfMissing({
    database,
    tableName: 'categories',
    columnName: 'owner_id',
    sql: "ALTER TABLE categories ADD COLUMN owner_id TEXT NOT NULL DEFAULT '';",
  });

  await addColumnIfMissing({
    database,
    tableName: 'categories',
    columnName: 'deleted_at',
    sql: 'ALTER TABLE categories ADD COLUMN deleted_at INTEGER;',
  });

  await addColumnIfMissing({
    database,
    tableName: 'categories',
    columnName: 'schema_version',
    sql: 'ALTER TABLE categories ADD COLUMN schema_version INTEGER NOT NULL DEFAULT 1;',
  });

  await addColumnIfMissing({
    database,
    tableName: 'categories',
    columnName: 'source_device_id',
    sql: "ALTER TABLE categories ADD COLUMN source_device_id TEXT NOT NULL DEFAULT '';",
  });

  await database.runAsync(
    `
      UPDATE categories
      SET owner_id = ?
      WHERE owner_id IS NULL OR owner_id = ''
    `,
    localOwnerId,
  );

  await database.runAsync(
    `
      UPDATE categories
      SET updated_at = CASE
        WHEN updated_at IS NOT NULL AND updated_at > 0 THEN updated_at
        WHEN created_at IS NOT NULL AND created_at > 0 THEN created_at
        ELSE ?
      END
      WHERE updated_at IS NULL OR updated_at <= 0
    `,
    now(),
  );

  await database.runAsync(
    `
      UPDATE categories
      SET deleted_at = NULL
      WHERE deleted_at IS NOT NULL AND deleted_at <= 0
    `,
  );

  await database.runAsync(
    `
      UPDATE categories
      SET schema_version = 1
      WHERE schema_version IS NULL OR schema_version <= 0
    `,
  );

  await database.runAsync(
    `
      UPDATE categories
      SET source_device_id = ?
      WHERE source_device_id IS NULL OR source_device_id = ''
    `,
    deviceId,
  );
}

export async function addCategoryIcons(database: MigrationTransactionDatabase) {
  await addColumnIfMissing({
    database,
    tableName: 'categories',
    columnName: 'icon_name',
    sql: `ALTER TABLE categories ADD COLUMN icon_name TEXT NOT NULL DEFAULT '${CATEGORY_ICON_FALLBACK_NAME}';`,
  });

  await database.runAsync(
    `
      UPDATE categories
      SET icon_name = ?
      WHERE icon_name IS NULL OR icon_name = ''
    `,
    CATEGORY_ICON_FALLBACK_NAME,
  );

  for (const [categoryId, iconName] of Object.entries(
    DEFAULT_CATEGORY_ICON_NAMES,
  )) {
    await database.runAsync(
      `
        UPDATE categories
        SET icon_name = ?
        WHERE id = ? AND is_default = 1
      `,
      iconName,
      categoryId,
    );
  }
}

async function addColumnIfMissing({
  database,
  tableName,
  columnName,
  sql,
}: {
  database: MigrationTransactionDatabase;
  tableName: 'categories' | 'transactions';
  columnName: string;
  sql: string;
}) {
  const columns = await getTableColumns(database, tableName);

  if (columns.has(columnName)) return;

  await database.execAsync(sql);
}

async function getTableColumns(
  database: MigrationTransactionDatabase,
  tableName: 'categories' | 'transactions',
) {
  const rows = await database.getAllAsync<TableInfoRow>(
    `PRAGMA table_info(${tableName})`,
  );

  return new Set(
    rows
      .map((row) => row.name)
      .filter((name): name is string => typeof name === 'string'),
  );
}
