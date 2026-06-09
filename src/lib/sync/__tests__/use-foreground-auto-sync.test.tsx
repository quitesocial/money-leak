import {
  afterAll,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import * as React from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { featureFlags } from '@/lib/feature-flags';
import {
  FOREGROUND_AUTO_SYNC_THROTTLE_MS,
  useForegroundAutoSync,
} from '@/lib/sync/use-foreground-auto-sync';
import type {
  SyncMetadata,
  SyncResult,
  SyncService,
} from '@/lib/sync/sync-types';
import type { AuthStatus, AuthUser } from '@/types/auth';

const TEST_NOW = Date.parse('2026-05-21T12:00:00.000Z');
const TEST_USER_ID = 'auth-user-test';

type HookOptions = Parameters<typeof useForegroundAutoSync>[0];

const mockAuthStoreState: {
  status: AuthStatus;
  user: AuthUser | null;
} = {
  status: 'guest',
  user: null,
};

const mockGetForegroundSyncEnabled = jest.fn<() => Promise<boolean>>();

jest.mock('@/store/auth-store', () => ({
  useAuthStore: (selector: (state: typeof mockAuthStoreState) => unknown) => {
    return selector(mockAuthStoreState);
  },
}));

jest.mock('@/db/sync-status', () => ({
  getSyncMetadata: jest.fn(),
}));

jest.mock('@/lib/sync/manual-sync-service', () => ({
  manualSyncService: {
    isIncrementalSyncInFlight: jest.fn(() => false),
    runIncrementalSync: jest.fn(),
  },
}));

jest.mock('@/lib/settings-preferences', () => ({
  getForegroundSyncEnabled: () => mockGetForegroundSyncEnabled(),
}));

jest.mock('@/store/categories-store', () => ({
  useCategoriesStore: {
    getState: () => ({
      loadCategories: jest.fn(),
    }),
  },
}));

jest.mock('@/store/balance-store', () => ({
  useBalanceStore: {
    getState: () => ({
      loadBalance: jest.fn(),
    }),
  },
}));

jest.mock('@/store/transactions-store', () => ({
  useTransactionsStore: {
    getState: () => ({
      loadTransactions: jest.fn(),
    }),
  },
}));

const mutableFeatureFlags = featureFlags as {
  incrementalSyncEnabled: boolean;
};

const originalAppState = AppState.currentState;
let currentAppState: AppStateStatus = 'active';
let appStateListener: ((state: AppStateStatus) => void) | null = null;
const appStateRemove = jest.fn();
const appStateAddEventListenerSpy = jest.spyOn(AppState, 'addEventListener');

function TestForegroundAutoSync({ options }: { options: HookOptions }) {
  useForegroundAutoSync(options);

  return null;
}

function setCurrentAppState(state: AppStateStatus) {
  currentAppState = state;

  Object.defineProperty(AppState, 'currentState', {
    configurable: true,
    get: () => currentAppState,
  });
}

function createAuthUser(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: TEST_USER_ID,
    provider: 'google',
    email: 'test@example.com',
    displayName: 'Test User',
    photoUrl: null,
    ...overrides,
  };
}

function createMetadata(overrides: Partial<SyncMetadata> = {}): SyncMetadata {
  return {
    lastSuccessfulSyncAt: null,
    lastSyncErrorAt: null,
    lastSyncSummary: null,
    lastSuccessfulSyncSource: null,
    ...overrides,
  };
}

function createSucceededSyncResult(
  overrides: Partial<Extract<SyncResult, { status: 'succeeded' }>> = {},
): SyncResult {
  return {
    status: 'succeeded',
    lastSuccessfulSyncAt: TEST_NOW,
    pulledTransactionsCount: 1,
    pulledCategoriesCount: 1,
    pulledBalanceTypesCount: 1,
    pulledBalanceEntriesCount: 1,
    appliedTransactionsCount: 1,
    appliedCategoriesCount: 1,
    appliedBalanceTypesCount: 1,
    appliedBalanceEntriesCount: 1,
    pushedTransactionsCount: 1,
    pushedCategoriesCount: 1,
    pushedBalanceTypesCount: 1,
    pushedBalanceEntriesCount: 1,
    ignoredTransactionTombstonesCount: 0,
    ignoredCategoryTombstonesCount: 0,
    ignoredBalanceTypeTombstonesCount: 0,
    ignoredBalanceEntryTombstonesCount: 0,
    conflictsCount: 0,
    ...overrides,
  };
}

function createSyncService({
  isInFlight = false,
  result = createSucceededSyncResult(),
}: {
  isInFlight?: boolean;
  result?: SyncResult | Promise<SyncResult>;
} = {}): Pick<
  SyncService,
  'isIncrementalSyncInFlight' | 'runIncrementalSync'
> & {
  isIncrementalSyncInFlight: jest.MockedFunction<
    SyncService['isIncrementalSyncInFlight']
  >;
  runIncrementalSync: jest.MockedFunction<SyncService['runIncrementalSync']>;
} {
  return {
    isIncrementalSyncInFlight: jest.fn(() => isInFlight),
    runIncrementalSync: jest.fn(async () => result),
  };
}

function createDeferred<T>() {
  let resolve: (value: T) => void = () => {};
  let reject: (reason?: unknown) => void = () => {};

  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return {
    promise,
    reject,
    resolve,
  };
}

async function renderForegroundAutoSync(options: HookOptions) {
  let renderer: ReactTestRenderer | null = null;

  await act(async () => {
    renderer = create(React.createElement(TestForegroundAutoSync, { options }));
    await Promise.resolve();
  });

  if (!renderer) throw new Error('Foreground auto sync did not render.');

  return renderer;
}

async function emitAppStateChange(nextState: AppStateStatus) {
  await act(async () => {
    setCurrentAppState(nextState);
    appStateListener?.(nextState);
    await Promise.resolve();
    await Promise.resolve();
  });
}

async function returnToForeground(fromState: AppStateStatus = 'background') {
  await emitAppStateChange(fromState);
  await emitAppStateChange('active');
}

beforeEach(() => {
  jest.clearAllMocks();

  mutableFeatureFlags.incrementalSyncEnabled = true;
  mockGetForegroundSyncEnabled.mockResolvedValue(true);
  mockAuthStoreState.status = 'guest';
  mockAuthStoreState.user = null;
  appStateListener = null;
  appStateRemove.mockImplementation(() => {});
  appStateAddEventListenerSpy.mockImplementation((_event, listener) => {
    appStateListener = listener;

    return {
      remove: appStateRemove,
    };
  });
  setCurrentAppState('active');
});

afterAll(() => {
  appStateAddEventListenerSpy.mockRestore();
  setCurrentAppState(originalAppState);
});

describe('useForegroundAutoSync', () => {
  it('does not sync on initial mount while already active', async () => {
    mockAuthStoreState.status = 'authenticated';
    mockAuthStoreState.user = createAuthUser();
    const readMetadata = jest.fn(async () => createMetadata());
    const refreshAfterSuccess = jest.fn<() => Promise<void>>();
    const syncService = createSyncService();

    await renderForegroundAutoSync({
      now: () => TEST_NOW,
      readMetadata,
      refreshAfterSuccess,
      syncService,
    });

    expect(readMetadata).not.toHaveBeenCalled();
    expect(syncService.runIncrementalSync).not.toHaveBeenCalled();
    expect(refreshAfterSuccess).not.toHaveBeenCalled();
  });

  it('keeps guest mode from starting foreground sync', async () => {
    const readMetadata = jest.fn(async () => createMetadata());
    const refreshAfterSuccess = jest.fn<() => Promise<void>>();
    const syncService = createSyncService();

    await renderForegroundAutoSync({
      now: () => TEST_NOW,
      readMetadata,
      refreshAfterSuccess,
      syncService,
    });

    await returnToForeground();

    expect(readMetadata).not.toHaveBeenCalled();
    expect(syncService.runIncrementalSync).not.toHaveBeenCalled();
    expect(refreshAfterSuccess).not.toHaveBeenCalled();
  });

  it('skips foreground sync when incremental sync is disabled', async () => {
    mutableFeatureFlags.incrementalSyncEnabled = false;
    mockAuthStoreState.status = 'authenticated';
    mockAuthStoreState.user = createAuthUser();
    const readMetadata = jest.fn(async () => createMetadata());
    const refreshAfterSuccess = jest.fn<() => Promise<void>>();
    const syncService = createSyncService();

    await renderForegroundAutoSync({
      now: () => TEST_NOW,
      readMetadata,
      refreshAfterSuccess,
      syncService,
    });

    await returnToForeground('inactive');

    expect(readMetadata).not.toHaveBeenCalled();
    expect(syncService.runIncrementalSync).not.toHaveBeenCalled();
    expect(refreshAfterSuccess).not.toHaveBeenCalled();
  });

  it('skips foreground sync when the local preference is disabled', async () => {
    mockGetForegroundSyncEnabled.mockResolvedValue(false);
    mockAuthStoreState.status = 'authenticated';
    mockAuthStoreState.user = createAuthUser();
    const readMetadata = jest.fn(async () => createMetadata());
    const refreshAfterSuccess = jest.fn<() => Promise<void>>();
    const syncService = createSyncService();

    await renderForegroundAutoSync({
      now: () => TEST_NOW,
      readMetadata,
      refreshAfterSuccess,
      syncService,
    });

    await returnToForeground('inactive');

    expect(mockGetForegroundSyncEnabled).toHaveBeenCalledTimes(1);
    expect(readMetadata).not.toHaveBeenCalled();
    expect(syncService.runIncrementalSync).not.toHaveBeenCalled();
    expect(refreshAfterSuccess).not.toHaveBeenCalled();
  });

  it('runs foreground sync for authenticated users when last sync is missing', async () => {
    mockAuthStoreState.status = 'authenticated';
    mockAuthStoreState.user = createAuthUser();
    const readMetadata = jest.fn(async () => createMetadata());
    const refreshAfterSuccess = jest.fn<() => Promise<void>>();
    const syncService = createSyncService();

    await renderForegroundAutoSync({
      now: () => TEST_NOW,
      readMetadata,
      refreshAfterSuccess,
      syncService,
    });

    await returnToForeground();

    expect(readMetadata).toHaveBeenCalledTimes(1);
    expect(syncService.runIncrementalSync).toHaveBeenCalledWith({
      auth: {
        status: 'authenticated',
        userId: TEST_USER_ID,
      },
      source: 'foreground',
    });
    expect(refreshAfterSuccess).toHaveBeenCalledTimes(1);
  });

  it('runs foreground sync when the last successful sync is stale', async () => {
    mockAuthStoreState.status = 'authenticated';
    mockAuthStoreState.user = createAuthUser();
    const readMetadata = jest.fn(async () =>
      createMetadata({
        lastSuccessfulSyncAt: TEST_NOW - FOREGROUND_AUTO_SYNC_THROTTLE_MS - 1,
      }),
    );
    const refreshAfterSuccess = jest.fn<() => Promise<void>>();
    const syncService = createSyncService();

    await renderForegroundAutoSync({
      now: () => TEST_NOW,
      readMetadata,
      refreshAfterSuccess,
      syncService,
    });

    await returnToForeground();

    expect(syncService.runIncrementalSync).toHaveBeenCalledTimes(1);
    expect(refreshAfterSuccess).toHaveBeenCalledTimes(1);
  });

  it('skips foreground sync when the last successful sync is recent', async () => {
    mockAuthStoreState.status = 'authenticated';
    mockAuthStoreState.user = createAuthUser();
    const readMetadata = jest.fn(async () =>
      createMetadata({
        lastSuccessfulSyncAt: TEST_NOW - FOREGROUND_AUTO_SYNC_THROTTLE_MS + 1,
      }),
    );
    const refreshAfterSuccess = jest.fn<() => Promise<void>>();
    const syncService = createSyncService();

    await renderForegroundAutoSync({
      now: () => TEST_NOW,
      readMetadata,
      refreshAfterSuccess,
      syncService,
    });

    await returnToForeground();

    expect(readMetadata).toHaveBeenCalledTimes(1);
    expect(syncService.runIncrementalSync).not.toHaveBeenCalled();
    expect(refreshAfterSuccess).not.toHaveBeenCalled();
  });

  it('does not start a second foreground sync while one is pending', async () => {
    const deferred = createDeferred<SyncResult>();

    mockAuthStoreState.status = 'authenticated';
    mockAuthStoreState.user = createAuthUser();
    const readMetadata = jest.fn(async () => createMetadata());
    const refreshAfterSuccess = jest.fn<() => Promise<void>>();
    const syncService = createSyncService({ result: deferred.promise });

    await renderForegroundAutoSync({
      now: () => TEST_NOW,
      readMetadata,
      refreshAfterSuccess,
      syncService,
    });

    await returnToForeground();
    await returnToForeground('inactive');

    expect(readMetadata).toHaveBeenCalledTimes(1);
    expect(syncService.runIncrementalSync).toHaveBeenCalledTimes(1);
    expect(refreshAfterSuccess).not.toHaveBeenCalled();

    await act(async () => {
      deferred.resolve(createSucceededSyncResult());
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(refreshAfterSuccess).toHaveBeenCalledTimes(1);
  });

  it('skips foreground sync when another sync is already in flight', async () => {
    mockAuthStoreState.status = 'authenticated';
    mockAuthStoreState.user = createAuthUser();
    const readMetadata = jest.fn(async () => createMetadata());
    const refreshAfterSuccess = jest.fn<() => Promise<void>>();
    const syncService = createSyncService({ isInFlight: true });

    await renderForegroundAutoSync({
      now: () => TEST_NOW,
      readMetadata,
      refreshAfterSuccess,
      syncService,
    });

    await returnToForeground();

    expect(readMetadata).not.toHaveBeenCalled();
    expect(syncService.runIncrementalSync).not.toHaveBeenCalled();
    expect(refreshAfterSuccess).not.toHaveBeenCalled();
  });

  it('refreshes local stores only after a successful foreground sync finishes', async () => {
    const deferred = createDeferred<SyncResult>();

    mockAuthStoreState.status = 'authenticated';
    mockAuthStoreState.user = createAuthUser();
    const readMetadata = jest.fn(async () => createMetadata());
    const refreshAfterSuccess = jest.fn<() => Promise<void>>();
    const syncService = createSyncService({ result: deferred.promise });

    await renderForegroundAutoSync({
      now: () => TEST_NOW,
      readMetadata,
      refreshAfterSuccess,
      syncService,
    });

    await returnToForeground();

    expect(syncService.runIncrementalSync).toHaveBeenCalledTimes(1);
    expect(refreshAfterSuccess).not.toHaveBeenCalled();

    await act(async () => {
      deferred.resolve(createSucceededSyncResult());
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(refreshAfterSuccess).toHaveBeenCalledTimes(1);
  });

  it('does not refresh local stores after failed foreground sync', async () => {
    mockAuthStoreState.status = 'authenticated';
    mockAuthStoreState.user = createAuthUser();
    const readMetadata = jest.fn(async () => createMetadata());
    const refreshAfterSuccess = jest.fn<() => Promise<void>>();
    const syncService = createSyncService({
      result: {
        status: 'failed',
        error: {
          code: 'remote_read_failed',
          isRecoverable: true,
          message:
            'raw backend failure access_token refresh_token localOwnerId deviceId',
        },
      },
    });

    await renderForegroundAutoSync({
      now: () => TEST_NOW,
      readMetadata,
      refreshAfterSuccess,
      syncService,
    });

    await returnToForeground();

    expect(syncService.runIncrementalSync).toHaveBeenCalledTimes(1);
    expect(refreshAfterSuccess).not.toHaveBeenCalled();
  });
});
