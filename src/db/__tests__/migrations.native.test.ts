import { describe, expect, it } from '@jest/globals';

import {
  addBalanceSyncReadyLocalFields,
  addCategoryIcons,
  addSyncReadyLocalFields,
  runDatabaseMigrations,
  type MigrationDatabase,
  type MigrationTransactionDatabase,
} from '@/db/migrations.native';

type RawRow = Record<string, unknown>;

class FakeMigrationDatabase implements MigrationDatabase {
  schemaMigrations = new Set<string>();
  exclusiveTransactionCount = 0;
  transactionColumns = new Set([
    'id',
    'amount',
    'category',
    'is_leak',
    'leak_reason',
    'note',
    'created_at',
  ]);

  categoryColumns = new Set([
    'id',
    'name',
    'created_at',
    'updated_at',
    'is_default',
    'is_archived',
    'sort_order',
  ]);

  balanceEntryColumns = new Set(['id', 'amount', 'type_id', 'created_at']);

  balanceTypeColumns = new Set([
    'id',
    'name',
    'created_at',
    'updated_at',
    'is_default',
    'is_archived',
    'sort_order',
  ]);

  transactions: RawRow[] = [];
  categories: RawRow[] = [];
  balanceEntries: RawRow[] = [];
  balanceTypes: RawRow[] = [];
  transactionsSchemaSql = 'CREATE TABLE transactions (category TEXT NOT NULL)';

  async execAsync(source: string) {
    if (source.includes('CREATE TABLE IF NOT EXISTS schema_migrations')) {
      return;
    }

    if (source.includes('DROP TABLE IF EXISTS transactions_next')) {
      this.transactionsSchemaSql =
        'CREATE TABLE transactions (category TEXT NOT NULL)';
      return;
    }

    const alterMatch = source.match(
      /ALTER TABLE (transactions|categories|balance_entries|balance_types) ADD COLUMN ([a-z_]+)/,
    );

    if (!alterMatch) return;

    const [, tableName, columnName] = alterMatch;
    const columns = this.getColumns(tableName);

    columns.add(columnName);

    const rows = this.getRows(tableName);

    for (const row of rows) {
      row[columnName] = getDefaultColumnValue(columnName);
    }
  }

  async getAllAsync<T>(source: string): Promise<T[]> {
    if (source.includes('PRAGMA table_info(transactions)')) {
      return [...this.transactionColumns].map((name) => ({ name })) as T[];
    }

    if (source.includes('PRAGMA table_info(categories)')) {
      return [...this.categoryColumns].map((name) => ({ name })) as T[];
    }

    if (source.includes('PRAGMA table_info(balance_entries)')) {
      return [...this.balanceEntryColumns].map((name) => ({ name })) as T[];
    }

    if (source.includes('PRAGMA table_info(balance_types)')) {
      return [...this.balanceTypeColumns].map((name) => ({ name })) as T[];
    }

    return [];
  }

  async getFirstAsync<T>(
    source: string,
    ...params: unknown[]
  ): Promise<T | null> {
    if (source.includes('FROM schema_migrations')) {
      const id = params[0];

      return typeof id === 'string' && this.schemaMigrations.has(id)
        ? ({ id } as T)
        : null;
    }

    if (source.includes('FROM sqlite_master')) {
      return { sql: this.transactionsSchemaSql } as T;
    }

    return null;
  }

  async runAsync(source: string, ...params: unknown[]) {
    if (source.includes('INSERT OR IGNORE INTO schema_migrations')) {
      const id = params[0];

      if (typeof id === 'string') {
        this.schemaMigrations.add(id);
      }

      return { changes: 1 };
    }

    if (source.includes('UPDATE transactions')) {
      this.updateTransactions(source, params);
      return { changes: this.transactions.length };
    }

    if (source.includes('UPDATE categories')) {
      this.updateCategories(source, params);
      return { changes: this.categories.length };
    }

    if (source.includes('UPDATE balance_entries')) {
      this.updateBalanceRows(this.balanceEntries, source, params);
      return { changes: this.balanceEntries.length };
    }

    if (source.includes('UPDATE balance_types')) {
      this.updateBalanceRows(this.balanceTypes, source, params);
      return { changes: this.balanceTypes.length };
    }

    return { changes: 0 };
  }

  async withExclusiveTransactionAsync(
    callback: (
      transactionDatabase: MigrationTransactionDatabase,
    ) => Promise<void>,
  ) {
    this.exclusiveTransactionCount += 1;
    await callback(this);
  }

  private updateTransactions(source: string, params: unknown[]) {
    if (source.includes('SET owner_id = ?')) {
      for (const row of this.transactions) {
        if (!row.owner_id) row.owner_id = params[0];
      }
    } else if (source.includes('SET updated_at = CASE')) {
      for (const row of this.transactions) {
        if (typeof row.updated_at !== 'number' || row.updated_at <= 0) {
          row.updated_at =
            typeof row.created_at === 'number' && row.created_at > 0
              ? row.created_at
              : params[0];
        }
      }
    } else if (source.includes('SET deleted_at = NULL')) {
      for (const row of this.transactions) {
        if (typeof row.deleted_at === 'number' && row.deleted_at <= 0) {
          row.deleted_at = null;
        }
      }
    } else if (source.includes('SET schema_version = 1')) {
      for (const row of this.transactions) {
        if (typeof row.schema_version !== 'number' || row.schema_version <= 0) {
          row.schema_version = 1;
        }
      }
    } else if (source.includes('SET source_device_id = ?')) {
      for (const row of this.transactions) {
        if (!row.source_device_id) row.source_device_id = params[0];
      }
    }
  }

  private updateCategories(source: string, params: unknown[]) {
    if (source.includes('SET icon_name = ?')) {
      if (source.includes('WHERE id = ?')) {
        for (const row of this.categories) {
          if (row.id === params[1] && row.is_default === 1) {
            row.icon_name = params[0];
          }
        }
      } else {
        for (const row of this.categories) {
          if (!row.icon_name) row.icon_name = params[0];
        }
      }
    } else if (source.includes('SET owner_id = ?')) {
      for (const row of this.categories) {
        if (!row.owner_id) row.owner_id = params[0];
      }
    } else if (source.includes('SET updated_at = CASE')) {
      for (const row of this.categories) {
        if (typeof row.updated_at !== 'number' || row.updated_at <= 0) {
          row.updated_at =
            typeof row.created_at === 'number' && row.created_at > 0
              ? row.created_at
              : params[0];
        }
      }
    } else if (source.includes('SET deleted_at = NULL')) {
      for (const row of this.categories) {
        if (typeof row.deleted_at === 'number' && row.deleted_at <= 0) {
          row.deleted_at = null;
        }
      }
    } else if (source.includes('SET schema_version = 1')) {
      for (const row of this.categories) {
        if (typeof row.schema_version !== 'number' || row.schema_version <= 0) {
          row.schema_version = 1;
        }
      }
    } else if (source.includes('SET source_device_id = ?')) {
      for (const row of this.categories) {
        if (!row.source_device_id) row.source_device_id = params[0];
      }
    }
  }

  private updateBalanceRows(rows: RawRow[], source: string, params: unknown[]) {
    if (source.includes('SET owner_id = ?')) {
      for (const row of rows) {
        if (!row.owner_id) row.owner_id = params[0];
      }
    } else if (source.includes('SET updated_at = CASE')) {
      for (const row of rows) {
        if (typeof row.updated_at !== 'number' || row.updated_at <= 0) {
          row.updated_at =
            typeof row.created_at === 'number' && row.created_at > 0
              ? row.created_at
              : params[0];
        }
      }
    } else if (source.includes('SET deleted_at = NULL')) {
      for (const row of rows) {
        if (typeof row.deleted_at === 'number' && row.deleted_at <= 0) {
          row.deleted_at = null;
        }
      }
    } else if (source.includes('SET schema_version = 1')) {
      for (const row of rows) {
        if (typeof row.schema_version !== 'number' || row.schema_version <= 0) {
          row.schema_version = 1;
        }
      }
    } else if (source.includes('SET source_device_id = ?')) {
      for (const row of rows) {
        if (!row.source_device_id) row.source_device_id = params[0];
      }
    }
  }

  private getColumns(tableName: string) {
    if (tableName === 'transactions') return this.transactionColumns;
    if (tableName === 'categories') return this.categoryColumns;
    if (tableName === 'balance_entries') return this.balanceEntryColumns;

    return this.balanceTypeColumns;
  }

  private getRows(tableName: string) {
    if (tableName === 'transactions') return this.transactions;
    if (tableName === 'categories') return this.categories;
    if (tableName === 'balance_entries') return this.balanceEntries;

    return this.balanceTypes;
  }
}

function getDefaultColumnValue(columnName: string) {
  if (columnName === 'deleted_at') return null;
  if (columnName === 'icon_name') return 'tag';
  if (columnName === 'schema_version') return 1;
  if (columnName === 'updated_at') return 0;

  return '';
}

const identity = {
  localOwnerId: 'local_test-owner',
  deviceId: 'device_test-device',
};

describe('native SQLite migrations', () => {
  it('records migrations and skips already applied migrations', async () => {
    const database = new FakeMigrationDatabase();

    await runDatabaseMigrations({
      database,
      identity,
      now: () => 1000,
    });

    await runDatabaseMigrations({
      database,
      identity,
      now: () => 2000,
    });

    expect([...database.schemaMigrations]).toEqual([
      '001_remove_transactions_category_check',
      '002_add_sync_ready_local_fields',
      '003_add_category_icons',
      '004_add_balance_sync_ready_local_fields',
    ]);

    expect(database.exclusiveTransactionCount).toBe(4);
  });

  it('keeps sync-ready migration idempotent', async () => {
    const database = new FakeMigrationDatabase();

    database.transactions.push({
      id: 'txn-old',
      amount: 12.5,
      category: 'food',
      is_leak: 0,
      leak_reason: null,
      note: null,
      created_at: 111,
    });

    await addSyncReadyLocalFields(database, {
      ...identity,
      now: () => 999,
    });

    await addSyncReadyLocalFields(database, {
      ...identity,
      now: () => 999,
    });

    expect(
      [...database.transactionColumns].filter((name) => name === 'owner_id'),
    ).toHaveLength(1);

    expect(database.transactions[0]).toMatchObject({
      owner_id: identity.localOwnerId,
      updated_at: 111,
      deleted_at: null,
      schema_version: 1,
      source_device_id: identity.deviceId,
    });
  });

  it('backfills old transaction rows with local sync metadata', async () => {
    const database = new FakeMigrationDatabase();

    database.transactions.push({
      id: 'txn-legacy',
      amount: 5,
      category: 'shopping',
      is_leak: 1,
      leak_reason: 'impulse',
      note: null,
      created_at: 321,
    });

    await addSyncReadyLocalFields(database, {
      ...identity,
      now: () => 999,
    });

    expect(database.transactions[0]).toMatchObject({
      owner_id: identity.localOwnerId,
      updated_at: 321,
      deleted_at: null,
      schema_version: 1,
      source_device_id: identity.deviceId,
    });
  });

  it('backfills old category rows with local sync metadata', async () => {
    const database = new FakeMigrationDatabase();

    database.categories.push({
      id: 'coffee',
      name: 'Coffee',
      created_at: 456,
      updated_at: 0,
      is_default: 0,
      is_archived: 0,
      sort_order: 10,
    });

    await addSyncReadyLocalFields(database, {
      ...identity,
      now: () => 999,
    });

    expect(database.categories[0]).toMatchObject({
      owner_id: identity.localOwnerId,
      updated_at: 456,
      deleted_at: null,
      schema_version: 1,
      source_device_id: identity.deviceId,
    });
  });

  it('backfills category icon names idempotently', async () => {
    const database = new FakeMigrationDatabase();

    database.categories.push(
      {
        id: 'food',
        name: 'Food',
        created_at: 456,
        updated_at: 456,
        is_default: 1,
        is_archived: 0,
        sort_order: 0,
      },
      {
        id: 'coffee',
        name: 'Coffee',
        created_at: 789,
        updated_at: 789,
        is_default: 0,
        is_archived: 0,
        sort_order: 10,
      },
    );

    await addCategoryIcons(database);
    await addCategoryIcons(database);

    expect(
      [...database.categoryColumns].filter((name) => name === 'icon_name'),
    ).toHaveLength(1);

    expect(database.categories).toEqual([
      expect.objectContaining({
        id: 'food',
        icon_name: 'food',
      }),
      expect.objectContaining({
        id: 'coffee',
        icon_name: 'tag',
      }),
    ]);
  });

  it('backfills old balance rows with local sync metadata idempotently', async () => {
    const database = new FakeMigrationDatabase();

    database.balanceTypes.push({
      id: 'salary',
      name: 'Salary',
      created_at: 456,
      updated_at: 0,
      is_default: 1,
      is_archived: 0,
      sort_order: 0,
    });
    database.balanceEntries.push({
      id: 'entry-1',
      amount: 100,
      type_id: 'salary',
      created_at: 789,
    });

    await addBalanceSyncReadyLocalFields(database, {
      ...identity,
      now: () => 999,
    });

    await addBalanceSyncReadyLocalFields(database, {
      ...identity,
      now: () => 999,
    });

    expect(
      [...database.balanceTypeColumns].filter((name) => name === 'owner_id'),
    ).toHaveLength(1);
    expect(
      [...database.balanceEntryColumns].filter((name) => name === 'owner_id'),
    ).toHaveLength(1);
    expect(database.balanceTypes[0]).toMatchObject({
      owner_id: identity.localOwnerId,
      updated_at: 456,
      deleted_at: null,
      schema_version: 1,
      source_device_id: identity.deviceId,
    });
    expect(database.balanceEntries[0]).toMatchObject({
      owner_id: identity.localOwnerId,
      updated_at: 789,
      deleted_at: null,
      schema_version: 1,
      source_device_id: identity.deviceId,
    });
  });
});
