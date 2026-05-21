import type { SyncMetadata, SyncSummary } from '@/lib/sync/sync-types';

import { getDatabase, initDatabase } from './database.native';
import { ensureAppMetadataTable } from './local-identity.native';

type AppMetadataRow = {
  key: unknown;
  value: unknown;
};

const LAST_SUCCESSFUL_SYNC_AT_KEY = 'last_successful_incremental_sync_at';
const LAST_SYNC_ERROR_AT_KEY = 'last_incremental_sync_error_at';
const LAST_SYNC_SUMMARY_KEY = 'last_incremental_sync_summary';

export async function getSyncMetadata(): Promise<SyncMetadata> {
  await initDatabase();

  const database = await getDatabase();

  await ensureAppMetadataTable(database);

  const rows = await database.getAllAsync<AppMetadataRow>(
    `
      SELECT key, value
      FROM app_metadata
      WHERE key IN (?, ?, ?)
    `,
    LAST_SUCCESSFUL_SYNC_AT_KEY,
    LAST_SYNC_ERROR_AT_KEY,
    LAST_SYNC_SUMMARY_KEY,
  );

  const values = new Map(
    rows
      .filter(
        (row): row is { key: string; value: string } =>
          typeof row.key === 'string' && typeof row.value === 'string',
      )
      .map((row) => [row.key, row.value]),
  );

  return {
    lastSuccessfulSyncAt: parseStoredTimestamp(
      values.get(LAST_SUCCESSFUL_SYNC_AT_KEY),
    ),
    lastSyncErrorAt: parseStoredTimestamp(values.get(LAST_SYNC_ERROR_AT_KEY)),
    lastSyncSummary: parseStoredSummary(values.get(LAST_SYNC_SUMMARY_KEY)),
  };
}

export async function recordSyncSuccess(summary: SyncSummary) {
  const safeSummary = normalizeSummary(summary);

  await initDatabase();

  const database = await getDatabase();

  await ensureAppMetadataTable(database);

  await database.withExclusiveTransactionAsync(async (transactionDatabase) => {
    await upsertMetadataValue({
      database: transactionDatabase,
      key: LAST_SUCCESSFUL_SYNC_AT_KEY,
      timestamp: safeSummary.completedAt,
      value: String(Math.trunc(safeSummary.cursor)),
    });

    await upsertMetadataValue({
      database: transactionDatabase,
      key: LAST_SYNC_SUMMARY_KEY,
      timestamp: safeSummary.completedAt,
      value: JSON.stringify(safeSummary),
    });
  });
}

export async function recordSyncFailure(timestamp: number) {
  if (!Number.isFinite(timestamp)) {
    throw new Error('Last sync error timestamp must be finite.');
  }

  await initDatabase();

  const database = await getDatabase();
  const normalizedTimestamp = Math.trunc(timestamp);

  await ensureAppMetadataTable(database);

  await upsertMetadataValue({
    database,
    key: LAST_SYNC_ERROR_AT_KEY,
    timestamp: normalizedTimestamp,
    value: String(normalizedTimestamp),
  });
}

function parseStoredTimestamp(value: unknown) {
  if (typeof value !== 'string' || value.trim().length === 0) return null;

  const timestamp = Number(value);

  if (!Number.isFinite(timestamp)) return null;

  return Math.trunc(timestamp);
}

function parseStoredSummary(value: unknown): SyncSummary | null {
  if (typeof value !== 'string' || value.trim().length === 0) return null;

  try {
    const parsed = JSON.parse(value) as Partial<SyncSummary>;

    return normalizeSummary(parsed);
  } catch {
    return null;
  }
}

function normalizeSummary(summary: Partial<SyncSummary>): SyncSummary {
  const numericFields: (keyof SyncSummary)[] = [
    'completedAt',
    'cursor',
    'pulledTransactionsCount',
    'pulledCategoriesCount',
    'appliedTransactionsCount',
    'appliedCategoriesCount',
    'pushedTransactionsCount',
    'pushedCategoriesCount',
    'ignoredTransactionTombstonesCount',
    'ignoredCategoryTombstonesCount',
    'conflictsCount',
  ];

  for (const field of numericFields) {
    const value = summary[field];

    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
      throw new Error('Sync summary must contain finite safe counts.');
    }
  }

  const safeSummary = summary as SyncSummary;

  return {
    completedAt: safeSummary.completedAt,
    cursor: safeSummary.cursor,
    pulledTransactionsCount: safeSummary.pulledTransactionsCount,
    pulledCategoriesCount: safeSummary.pulledCategoriesCount,
    appliedTransactionsCount: safeSummary.appliedTransactionsCount,
    appliedCategoriesCount: safeSummary.appliedCategoriesCount,
    pushedTransactionsCount: safeSummary.pushedTransactionsCount,
    pushedCategoriesCount: safeSummary.pushedCategoriesCount,
    ignoredTransactionTombstonesCount:
      safeSummary.ignoredTransactionTombstonesCount,
    ignoredCategoryTombstonesCount: safeSummary.ignoredCategoryTombstonesCount,
    conflictsCount: safeSummary.conflictsCount,
  };
}

async function upsertMetadataValue({
  database,
  key,
  timestamp,
  value,
}: {
  database: {
    runAsync(source: string, ...params: unknown[]): Promise<unknown>;
  };
  key: string;
  timestamp: number;
  value: string;
}) {
  await database.runAsync(
    `
      INSERT OR REPLACE INTO app_metadata (
        key,
        value,
        updated_at
      ) VALUES (?, ?, ?)
    `,
    key,
    value,
    Math.trunc(timestamp),
  );
}
