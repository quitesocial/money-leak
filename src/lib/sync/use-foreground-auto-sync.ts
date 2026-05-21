import { useEffect, useRef, type MutableRefObject } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { getSyncMetadata } from '@/db/sync-status';
import { featureFlags } from '@/lib/feature-flags';
import { manualSyncService } from '@/lib/sync/manual-sync-service';
import type {
  SyncAuthContext,
  SyncMetadata,
  SyncService,
} from '@/lib/sync/sync-types';
import { useAuthStore } from '@/store/auth-store';
import { useCategoriesStore } from '@/store/categories-store';
import { useTransactionsStore } from '@/store/transactions-store';

export const FOREGROUND_AUTO_SYNC_THROTTLE_MS = 15 * 60 * 1000;

type ForegroundAutoSyncOptions = {
  now?: () => number;
  readMetadata?: () => Promise<SyncMetadata>;
  refreshAfterSuccess?: () => Promise<void>;
  syncService?: Pick<
    SyncService,
    'isIncrementalSyncInFlight' | 'runIncrementalSync'
  >;
  throttleWindowMs?: number;
};

const DEFAULT_REFRESH_AFTER_SUCCESS = async () => {
  await Promise.all([
    useTransactionsStore.getState().loadTransactions(),
    useCategoriesStore.getState().loadCategories(),
  ]);
};

export function useForegroundAutoSync({
  now = Date.now,
  readMetadata = getSyncMetadata,
  refreshAfterSuccess = DEFAULT_REFRESH_AFTER_SUCCESS,
  syncService = manualSyncService,
  throttleWindowMs = FOREGROUND_AUTO_SYNC_THROTTLE_MS,
}: ForegroundAutoSyncOptions = {}) {
  const authStatus = useAuthStore((state) => state.status);
  const authUserId = useAuthStore((state) => state.user?.id);
  const authRef = useRef<SyncAuthContext>({
    status: authStatus,
    userId: authUserId,
  });
  const isForegroundSyncInFlightRef = useRef(false);
  const previousAppStateRef = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    authRef.current = {
      status: authStatus,
      userId: authUserId,
    };
  }, [authStatus, authUserId]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      const previousState = previousAppStateRef.current;

      previousAppStateRef.current = nextState;

      if (!isForegroundReturn({ nextState, previousState })) return;

      void runForegroundSyncIfNeeded({
        authRef,
        isForegroundSyncInFlightRef,
        now,
        readMetadata,
        refreshAfterSuccess,
        syncService,
        throttleWindowMs,
      });
    });

    return () => {
      subscription.remove();
    };
  }, [now, readMetadata, refreshAfterSuccess, syncService, throttleWindowMs]);
}

async function runForegroundSyncIfNeeded({
  authRef,
  isForegroundSyncInFlightRef,
  now,
  readMetadata,
  refreshAfterSuccess,
  syncService,
  throttleWindowMs,
}: {
  authRef: MutableRefObject<SyncAuthContext>;
  isForegroundSyncInFlightRef: MutableRefObject<boolean>;
  now: () => number;
  readMetadata: () => Promise<SyncMetadata>;
  refreshAfterSuccess: () => Promise<void>;
  syncService: Pick<
    SyncService,
    'isIncrementalSyncInFlight' | 'runIncrementalSync'
  >;
  throttleWindowMs: number;
}) {
  if (!featureFlags.incrementalSyncEnabled) return;
  if (isForegroundSyncInFlightRef.current) return;
  if (syncService.isIncrementalSyncInFlight()) return;

  const initialAuth = getAuthenticatedSyncContext(authRef.current);

  if (!initialAuth) return;

  isForegroundSyncInFlightRef.current = true;

  try {
    const metadata = await readMetadata();

    if (
      !isLastSuccessfulSyncStale({ metadata, now: now(), throttleWindowMs })
    ) {
      return;
    }

    if (syncService.isIncrementalSyncInFlight()) return;

    const auth = getAuthenticatedSyncContext(authRef.current);

    if (!auth) return;

    const result = await syncService.runIncrementalSync({
      auth,
    });

    if (result.status !== 'succeeded') return;

    await refreshAfterSuccess();
  } catch {
    // Foreground sync is opportunistic. Local app usage must never depend on it.
  } finally {
    isForegroundSyncInFlightRef.current = false;
  }
}

function getAuthenticatedSyncContext(
  auth: SyncAuthContext,
): SyncAuthContext | null {
  if (auth.status !== 'authenticated') return null;

  const userId = auth.userId?.trim();

  if (!userId) return null;

  return {
    status: 'authenticated',
    userId,
  };
}

function isForegroundReturn({
  nextState,
  previousState,
}: {
  nextState: AppStateStatus;
  previousState: AppStateStatus;
}) {
  return (
    nextState === 'active' &&
    (previousState === 'background' || previousState === 'inactive')
  );
}

function isLastSuccessfulSyncStale({
  metadata,
  now,
  throttleWindowMs,
}: {
  metadata: SyncMetadata;
  now: number;
  throttleWindowMs: number;
}) {
  const lastSuccessfulSyncAt =
    getSafeTimestamp(metadata.lastSyncSummary?.completedAt) ??
    getSafeTimestamp(metadata.lastSuccessfulSyncAt);

  if (lastSuccessfulSyncAt === null) return true;

  return now - lastSuccessfulSyncAt >= throttleWindowMs;
}

function getSafeTimestamp(value: unknown) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return null;
  }

  return Math.trunc(value);
}
