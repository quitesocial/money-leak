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
    pulledBalanceTypesCount: 0,
    pulledBalanceEntriesCount: 0,
    pulledSettingsCount: 0,
    appliedTransactionsCount: 3,
    appliedCategoriesCount: 4,
    appliedBalanceTypesCount: 0,
    appliedBalanceEntriesCount: 0,
    appliedSettingsCount: 0,
    pushedTransactionsCount: 5,
    pushedCategoriesCount: 6,
    pushedBalanceTypesCount: 0,
    pushedBalanceEntriesCount: 0,
    pushedSettingsCount: 0,
    ignoredTransactionTombstonesCount: 7,
    ignoredCategoryTombstonesCount: 8,
    ignoredBalanceTypeTombstonesCount: 0,
    ignoredBalanceEntryTombstonesCount: 0,
    ignoredSettingsCount: 0,
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
      lastSuccessfulSyncSource: null,
    });
  });

  it('records and reads the last successful sync cursor and safe summary', async () => {
    const summary = createSummary();

    await recordSyncSuccess({ source: 'manual', summary });

    await expect(getSyncMetadata()).resolves.toEqual({
      lastSuccessfulSyncAt: 2000,
      lastSyncErrorAt: null,
      lastSyncSummary: summary,
      lastSuccessfulSyncSource: 'manual',
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
    expect(
      database.appMetadata.get('last_successful_incremental_sync_source'),
    ).toEqual({
      value: 'manual',
      updated_at: 1000,
    });
  });

  it('records the last sync error timestamp independently from success', async () => {
    await recordSyncSuccess({ source: 'foreground', summary: createSummary() });
    await recordSyncFailure(3000);

    await expect(getSyncMetadata()).resolves.toMatchObject({
      lastSuccessfulSyncAt: 2000,
      lastSyncErrorAt: 3000,
      lastSuccessfulSyncSource: 'foreground',
    });
  });

  it('ignores unknown stored sync sources safely', async () => {
    database.appMetadata.set('last_successful_incremental_sync_source', {
      value: 'access_token',
      updated_at: 1000,
    });

    await expect(getSyncMetadata()).resolves.toMatchObject({
      lastSuccessfulSyncSource: null,
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

  it('parses old stored summaries without balance counts as zero', async () => {
    const oldSummary = {
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
    };

    database.appMetadata.set('last_incremental_sync_summary', {
      value: JSON.stringify(oldSummary),
      updated_at: 1000,
    });

    await expect(getSyncMetadata()).resolves.toMatchObject({
      lastSyncSummary: createSummary(),
    });
  });

  it('ignores non-finite or negative stored summary values safely', async () => {
    database.appMetadata.set('last_incremental_sync_summary', {
      value: JSON.stringify({
        ...createSummary(),
        conflictsCount: -1,
      }),
      updated_at: 1000,
    });

    await expect(getSyncMetadata()).resolves.toMatchObject({
      lastSyncSummary: null,
    });

    database.appMetadata.set('last_incremental_sync_summary', {
      value: JSON.stringify({
        ...createSummary(),
        pulledTransactionsCount: null,
      }),
      updated_at: 1000,
    });

    await expect(getSyncMetadata()).resolves.toMatchObject({
      lastSyncSummary: null,
    });
  });

  it('stores only known numeric summary fields on success', async () => {
    const summary = {
      ...createSummary(),
      access_token: 'raw-token',
      deviceId: 'device_test',
      ownerId: 'owner_test',
    } as SyncSummary;

    await recordSyncSuccess({ source: 'manual', summary });

    const storedSummary = database.appMetadata.get(
      'last_incremental_sync_summary',
    );

    expect(storedSummary?.value).not.toContain('access_token');
    expect(storedSummary?.value).not.toContain('deviceId');
    expect(storedSummary?.value).not.toContain('ownerId');
    expect(storedSummary?.value).not.toContain('manual');
    await expect(getSyncMetadata()).resolves.toEqual({
      lastSuccessfulSyncAt: 2000,
      lastSyncErrorAt: null,
      lastSyncSummary: createSummary(),
      lastSuccessfulSyncSource: 'manual',
    });
  });
});
