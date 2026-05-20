import { describe, expect, it, jest } from '@jest/globals';

import { createRestoreService } from '@/lib/sync/restore-service';
import type {
  LocalRestoreDataTarget,
  RemoteRestoreAdapter,
  RestorePayload,
} from '@/lib/sync/sync-types';

const mockGetCategories = jest.fn();
const mockRestoreCategories = jest.fn();
const mockGetTransactions = jest.fn();
const mockRestoreTransactions = jest.fn();

jest.mock('@/db/categories', () => ({
  getCategories: (...args: unknown[]) => mockGetCategories(...args),
  restoreCategories: (...args: unknown[]) => mockRestoreCategories(...args),
}));

jest.mock('@/db/transactions', () => ({
  getTransactions: (...args: unknown[]) => mockGetTransactions(...args),
  restoreTransactions: (...args: unknown[]) => mockRestoreTransactions(...args),
}));

const TEST_USER_ID = 'user-test';
const RAW_FAILURE = 'raw backend failure access_token localOwnerId deviceId';

function createPayload(
  overrides: Partial<RestorePayload> = {},
): RestorePayload {
  return {
    userId: TEST_USER_ID,
    schemaVersion: 1,
    categories: [
      {
        id: 'coffee',
        userId: TEST_USER_ID,
        name: 'Coffee',
        isDefault: false,
        isArchived: false,
        sortOrder: 10,
        createdAt: '2026-05-18T09:00:00.000Z',
        updatedAt: '2026-05-18T09:30:00.000Z',
        deletedAt: null,
        schemaVersion: 1,
        sourceDeviceId: 'device_test',
      },
    ],
    transactions: [
      {
        id: 'txn-1',
        userId: TEST_USER_ID,
        amount: 12.5,
        categoryId: 'coffee',
        isLeak: true,
        leakReason: 'impulse',
        note: 'Too easy',
        createdAt: '2026-05-19T10:00:00.000Z',
        updatedAt: '2026-05-19T10:05:00.000Z',
        deletedAt: null,
        schemaVersion: 1,
        sourceDeviceId: 'device_test',
      },
    ],
    ...overrides,
  };
}

function createAdapter({
  payload = createPayload(),
  shouldFail = false,
}: {
  payload?: RestorePayload;
  shouldFail?: boolean;
} = {}): RemoteRestoreAdapter & {
  readBackup: jest.MockedFunction<RemoteRestoreAdapter['readBackup']>;
} {
  return {
    readBackup: jest.fn(async () => {
      if (shouldFail) throw new Error(RAW_FAILURE);

      return payload;
    }),
  };
}

function createDataTarget({
  hasLocalData = false,
  restoredCategoriesCount = 1,
  restoredTransactionsCount = 1,
  shouldFail = false,
}: {
  hasLocalData?: boolean;
  restoredCategoriesCount?: number;
  restoredTransactionsCount?: number;
  shouldFail?: boolean;
} = {}): LocalRestoreDataTarget & {
  hasLocalData: jest.MockedFunction<LocalRestoreDataTarget['hasLocalData']>;
  restoreBackup: jest.MockedFunction<LocalRestoreDataTarget['restoreBackup']>;
} {
  return {
    hasLocalData: jest.fn(async () => hasLocalData),
    restoreBackup: jest.fn(async () => {
      if (shouldFail) throw new Error(RAW_FAILURE);

      return {
        restoredCategoriesCount,
        restoredTransactionsCount,
      };
    }),
  };
}

describe('restore service', () => {
  it('does not attempt restore in guest mode', async () => {
    const adapter = createAdapter();
    const dataTarget = createDataTarget();
    const service = createRestoreService({
      adapter,
      dataTarget,
      isRestoreEnabled: true,
    });

    await expect(
      service.runRestore({
        auth: {
          status: 'guest',
          userId: null,
        },
      }),
    ).resolves.toEqual({
      status: 'skipped',
      skippedReason: 'guest_mode',
      isRecoverable: true,
    });

    expect(adapter.readBackup).not.toHaveBeenCalled();
    expect(dataTarget.restoreBackup).not.toHaveBeenCalled();
  });

  it('skips restore when the feature flag is disabled', async () => {
    const adapter = createAdapter();
    const dataTarget = createDataTarget();
    const service = createRestoreService({
      adapter,
      dataTarget,
      isRestoreEnabled: false,
    });

    await expect(
      service.runRestore({
        auth: {
          status: 'authenticated',
          userId: TEST_USER_ID,
        },
      }),
    ).resolves.toEqual({
      status: 'skipped',
      skippedReason: 'restore_disabled',
      isRecoverable: true,
    });

    expect(adapter.readBackup).not.toHaveBeenCalled();
    expect(dataTarget.restoreBackup).not.toHaveBeenCalled();
  });

  it('requires an authenticated user id before remote reads', async () => {
    const adapter = createAdapter();
    const dataTarget = createDataTarget();
    const service = createRestoreService({
      adapter,
      dataTarget,
      isRestoreEnabled: true,
    });

    await expect(
      service.runRestore({
        auth: {
          status: 'authenticated',
          userId: '   ',
        },
      }),
    ).resolves.toEqual({
      status: 'skipped',
      skippedReason: 'missing_user_id',
      isRecoverable: true,
    });

    expect(adapter.readBackup).not.toHaveBeenCalled();
    expect(dataTarget.restoreBackup).not.toHaveBeenCalled();
  });

  it('returns an empty state when the remote backup has no active rows', async () => {
    const adapter = createAdapter({
      payload: createPayload({
        categories: [],
        transactions: [],
      }),
    });
    const dataTarget = createDataTarget();
    const service = createRestoreService({
      adapter,
      dataTarget,
      isRestoreEnabled: true,
    });

    await expect(
      service.runRestore({
        auth: {
          status: 'authenticated',
          userId: TEST_USER_ID,
        },
      }),
    ).resolves.toEqual({
      status: 'empty',
      restoredTransactionsCount: 0,
      restoredCategoriesCount: 0,
      isRecoverable: true,
    });

    expect(adapter.readBackup).toHaveBeenCalledWith({ userId: TEST_USER_ID });
    expect(dataTarget.restoreBackup).not.toHaveBeenCalled();
  });

  it('returns restored counts after a successful merge-only restore', async () => {
    const adapter = createAdapter();
    const dataTarget = createDataTarget({
      restoredCategoriesCount: 2,
      restoredTransactionsCount: 3,
    });
    const service = createRestoreService({
      adapter,
      dataTarget,
      isRestoreEnabled: true,
    });

    await expect(
      service.runRestore({
        auth: {
          status: 'authenticated',
          userId: ` ${TEST_USER_ID} `,
        },
      }),
    ).resolves.toEqual({
      status: 'succeeded',
      restoredTransactionsCount: 3,
      restoredCategoriesCount: 2,
    });

    expect(adapter.readBackup).toHaveBeenCalledWith({ userId: TEST_USER_ID });
    expect(dataTarget.restoreBackup).toHaveBeenCalledWith(createPayload());
  });

  it('returns a safe recoverable result when remote read fails', async () => {
    const adapter = createAdapter({ shouldFail: true });
    const dataTarget = createDataTarget();
    const service = createRestoreService({
      adapter,
      dataTarget,
      isRestoreEnabled: true,
    });

    const result = await service.runRestore({
      auth: {
        status: 'authenticated',
        userId: TEST_USER_ID,
      },
    });

    expect(result).toMatchObject({
      status: 'failed',
      error: {
        code: 'remote_read_failed',
        isRecoverable: true,
      },
    });
    expect(JSON.stringify(result)).not.toContain(RAW_FAILURE);
    expect(dataTarget.restoreBackup).not.toHaveBeenCalled();
  });

  it('returns a safe recoverable result when local write fails', async () => {
    const adapter = createAdapter();
    const dataTarget = createDataTarget({ shouldFail: true });
    const service = createRestoreService({
      adapter,
      dataTarget,
      isRestoreEnabled: true,
    });

    const result = await service.runRestore({
      auth: {
        status: 'authenticated',
        userId: TEST_USER_ID,
      },
    });

    expect(result).toMatchObject({
      status: 'failed',
      error: {
        code: 'local_write_failed',
        isRecoverable: true,
      },
    });
    expect(JSON.stringify(result)).not.toContain(RAW_FAILURE);
  });
});
