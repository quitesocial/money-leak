import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import type { SyncSummary } from '@/lib/sync/sync-types';

import {
  getSyncMetadata,
  recordSyncFailure,
  recordSyncSuccess,
} from '../sync-status.native';

const mockInitDatabase = jest.fn<() => Promise<void>>();
const mockGetDatabase = jest.fn<() => Promise<FakeSyncStatusDatabase>>();
const mockEnsureAppMetadataTable = jest.fn<() => Promise<void>>();

jest.mock('../database.native', () => ({
  initDatabase: () => mockInitDatabase(),
  getDatabase: () => mockGetDatabase(),
}));

jest.mock('../local-identity.native', () => ({
  ensureAppMetadataTable: () => mockEnsureAppMetadataTable(),
}));

class FakeSyncStatusDatabase {
  appMetadata = new Map<string, { value: string; updated_at: number }>();

  async getAllAsync<T>(_source: string, ...keys: unknown[]): Promise<T[]> {
    return keys
      .filter((key): key is string => typeof key === 'string')
      .flatMap((key) => {
        const row = this.appMetadata.get(key);

        return row ? [{ key, value: row.value }] : [];
      }) as T[];
  }

  async runAsync(_source: string, ...params: unknown[]) {
    const [key, value, updatedAt] = params;

    if (
      typeof key === 'string' &&
      typeof value === 'string' &&
      typeof updatedAt === 'number'
    ) {
      this.appMetadata.set(key, {
        value,
        updated_at: updatedAt,
      });
    }

    return { changes: 1 };
  }

  async withExclusiveTransactionAsync(
    callback: (database: FakeSyncStatusDatabase) => Promise<void>,
  ) {
    await callback(this);
  }
}

function createSummary(overrides: Partial<SyncSummary> = {}): SyncSummary {
  return {
    completedAt: 1000,
    cursor: 2000,
    pulledTransactionsCount: 1,
    pulledCategoriesCount: 2,
    appliedTransactionsCount: 3,
    appliedCategoriesCount: 4,
    pushedTransactionsCount: 5,
    pushedCategoriesCount: 6,
    ignoredTransactionTombstonesCount: 7,
    ignoredCategoryTombstonesCount: 8,
    conflictsCount: 9,
    ...overrides,
  };
}

describe('native sync metadata persistence', () => {
  let database: FakeSyncStatusDatabase;

  beforeEach(() => {
    jest.restoreAllMocks();

    database = new FakeSyncStatusDatabase();

    mockInitDatabase.mockResolvedValue(undefined);
    mockGetDatabase.mockResolvedValue(database);
    mockEnsureAppMetadataTable.mockResolvedValue(undefined);
  });

  it('returns null metadata when no sync status is stored', async () => {
    await expect(getSyncMetadata()).resolves.toEqual({
      lastSuccessfulSyncAt: null,
      lastSyncErrorAt: null,
      lastSyncSummary: null,
    });
  });

  it('records and reads the last successful sync cursor and safe summary', async () => {
    const summary = createSummary();

    await recordSyncSuccess(summary);

    await expect(getSyncMetadata()).resolves.toEqual({
      lastSuccessfulSyncAt: 2000,
      lastSyncErrorAt: null,
      lastSyncSummary: summary,
    });
    expect(
      database.appMetadata.get('last_successful_incremental_sync_at'),
    ).toEqual({
      value: '2000',
      updated_at: 1000,
    });
    expect(database.appMetadata.get('last_incremental_sync_summary')).toEqual({
      value: JSON.stringify(summary),
      updated_at: 1000,
    });
  });

  it('records the last sync error timestamp independently from success', async () => {
    await recordSyncSuccess(createSummary());
    await recordSyncFailure(3000);

    await expect(getSyncMetadata()).resolves.toMatchObject({
      lastSuccessfulSyncAt: 2000,
      lastSyncErrorAt: 3000,
    });
  });

  it('ignores malformed stored summary values safely', async () => {
    database.appMetadata.set('last_incremental_sync_summary', {
      value: '{"access_token":"raw"}',
      updated_at: 1000,
    });

    await expect(getSyncMetadata()).resolves.toMatchObject({
      lastSyncSummary: null,
    });
  });
});
