import { useEffect, useRef, useState } from 'react';
import * as AppleAuthentication from 'expo-apple-authentication';
import {
  Alert,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, type Href } from 'expo-router';

import { exportTransactionsCsv } from '@/features/export/export-transactions-csv';
import {
  IMPORT_TRANSACTIONS_UNSUPPORTED_ERROR_MESSAGE,
  pickTransactionsCsvImport,
} from '@/features/export/import-transactions-csv';
import {
  getLastSuccessfulBackupAt,
  setLastSuccessfulBackupAt,
} from '@/db/backup-status';
import { getSyncMetadata } from '@/db/sync-status';
import {
  getGoogleAuthSafeErrorMessage,
  googleAuthAdapter,
} from '@/lib/auth/google-auth-adapter';
import {
  appleAuthAdapter,
  getAppleAuthSafeErrorMessage,
} from '@/lib/auth/apple-auth-adapter';
import { deleteAccountService } from '@/lib/account/delete-account-service';
import {
  cancelDailyCheckInReminder,
  getReminderPermissionStatus,
  requestReminderPermissions,
  scheduleDailyCheckInReminder,
  type ReminderPermissionStatus,
} from '@/lib/reminder-notifications';
import { APP_LINKS } from '@/lib/app-links';
import { getValidDate } from '@/lib/date-utils';
import { featureFlags } from '@/lib/feature-flags';
import { getReminderEnabled, setReminderEnabled } from '@/lib/reminder-storage';
import { manualBackupService } from '@/lib/sync/manual-backup-service';
import { manualRestoreService } from '@/lib/sync/manual-restore-service';
import { manualSyncService } from '@/lib/sync/manual-sync-service';
import type {
  SyncAttemptSource,
  SyncResult,
  SyncSummary,
} from '@/lib/sync/sync-types';
import { useTransactionsRefresh } from '@/lib/use-transactions-refresh';
import { useAuthStore } from '@/store/auth-store';
import { useCategoriesStore } from '@/store/categories-store';
import { useTransactionsStore } from '@/store/transactions-store';
import type { AuthUser } from '@/types/auth';

type ImportResult = {
  importedCount: number;
  skippedCount: number;
};

type BackupResult = {
  uploadedTransactionsCount: number;
  uploadedCategoriesCount: number;
};

type RestoreUiResult = {
  restoredTransactionsCount: number;
  restoredCategoriesCount: number;
};

type SyncUiResult = {
  appliedCount: number;
  conflictsCount: number;
  ignoredCount: number;
  pulledCount: number;
  pushedCount: number;
};

const timestampFormatter = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

function getReminderPermissionError(
  permissionStatus: ReminderPermissionStatus,
): string {
  if (permissionStatus === 'denied') {
    return 'Notifications are off for Money Leak. Turn them on in system settings to get the daily check-in.';
  }

  if (permissionStatus === 'unsupported') {
    return "Daily reminders aren't available on this platform.";
  }

  return 'Allow notifications to get the daily check-in.';
}

function formatCountLabel(
  count: number,
  singularLabel: string,
  pluralLabel = `${singularLabel}s`,
) {
  return `${count} ${count === 1 ? singularLabel : pluralLabel}`;
}

function formatImportResult({ importedCount, skippedCount }: ImportResult) {
  return `Imported ${formatCountLabel(importedCount, 'transaction')}. Skipped ${formatCountLabel(skippedCount, 'row')}.`;
}

function formatBackupResult({
  uploadedCategoriesCount,
  uploadedTransactionsCount,
}: BackupResult) {
  return `Backup created. ${formatCountLabel(uploadedTransactionsCount, 'transaction')} and ${formatCountLabel(uploadedCategoriesCount, 'category', 'categories')} saved.`;
}

function formatRestoreResult({
  restoredCategoriesCount,
  restoredTransactionsCount,
}: RestoreUiResult) {
  return `Backup restored. ${formatCountLabel(restoredTransactionsCount, 'transaction')} and ${formatCountLabel(restoredCategoriesCount, 'category', 'categories')} restored.`;
}

function formatSyncResult({
  appliedCount,
  conflictsCount,
  ignoredCount,
  pulledCount,
  pushedCount,
}: SyncUiResult) {
  return `Sync complete. Pulled ${formatCountLabel(pulledCount, 'change')}. Pushed ${formatCountLabel(pushedCount, 'change')}. Applied ${formatCountLabel(appliedCount, 'change')}. Conflicts ${conflictsCount}. Ignored ${formatCountLabel(ignoredCount, 'change')}.`;
}

function formatLastBackup(timestamp: number) {
  const date = getValidDate(timestamp);

  if (!date) return null;

  return `Last backup: ${timestampFormatter.format(date)}`;
}

function formatLastSync({
  source,
  timestamp,
}: {
  source: unknown;
  timestamp: number;
}) {
  const date = getValidDate(timestamp);

  if (!date) return null;

  const sourceLabel = getSafeSyncSourceLabel(source);

  return sourceLabel
    ? `Last sync: ${timestampFormatter.format(date)} · ${sourceLabel}`
    : `Last sync: ${timestampFormatter.format(date)}`;
}

function createSyncUiResult(
  result: Extract<SyncResult, { status: 'succeeded' }>,
) {
  return {
    appliedCount:
      result.appliedTransactionsCount + result.appliedCategoriesCount,
    conflictsCount: result.conflictsCount,
    ignoredCount:
      result.ignoredTransactionTombstonesCount +
      result.ignoredCategoryTombstonesCount,
    pulledCount: result.pulledTransactionsCount + result.pulledCategoriesCount,
    pushedCount: result.pushedTransactionsCount + result.pushedCategoriesCount,
  };
}

function createSyncUiResultFromSummary(
  summary: SyncSummary | Partial<SyncSummary> | null | undefined,
) {
  if (!summary || typeof summary !== 'object') return null;

  const pulledTransactionsCount = getSafeSyncCount(
    summary.pulledTransactionsCount,
  );
  const pulledCategoriesCount = getSafeSyncCount(summary.pulledCategoriesCount);
  const pushedTransactionsCount = getSafeSyncCount(
    summary.pushedTransactionsCount,
  );
  const pushedCategoriesCount = getSafeSyncCount(summary.pushedCategoriesCount);
  const appliedTransactionsCount = getSafeSyncCount(
    summary.appliedTransactionsCount,
  );
  const appliedCategoriesCount = getSafeSyncCount(
    summary.appliedCategoriesCount,
  );
  const conflictsCount = getSafeSyncCount(summary.conflictsCount);
  const ignoredTransactionTombstonesCount = getSafeSyncCount(
    summary.ignoredTransactionTombstonesCount,
  );
  const ignoredCategoryTombstonesCount = getSafeSyncCount(
    summary.ignoredCategoryTombstonesCount,
  );

  if (
    pulledTransactionsCount === null ||
    pulledCategoriesCount === null ||
    pushedTransactionsCount === null ||
    pushedCategoriesCount === null ||
    appliedTransactionsCount === null ||
    appliedCategoriesCount === null ||
    conflictsCount === null ||
    ignoredTransactionTombstonesCount === null ||
    ignoredCategoryTombstonesCount === null
  )
    return null;

  return {
    appliedCount: appliedTransactionsCount + appliedCategoriesCount,
    conflictsCount,
    ignoredCount:
      ignoredTransactionTombstonesCount + ignoredCategoryTombstonesCount,
    pulledCount: pulledTransactionsCount + pulledCategoriesCount,
    pushedCount: pushedTransactionsCount + pushedCategoriesCount,
  };
}

function getSafeSyncCount(value: unknown) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return null;
  }

  return value;
}

function getSafeSyncTimestamp(value: unknown) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return null;
  }

  return Math.trunc(value);
}

function getSafeSyncSource(value: unknown): SyncAttemptSource | null {
  return value === 'manual' || value === 'foreground' ? value : null;
}

function getSafeSyncSourceLabel(value: unknown) {
  const source = getSafeSyncSource(value);

  if (source === 'manual') return 'Manual';
  if (source === 'foreground') return 'Auto';

  return null;
}

function getAccountDisplayName(user: AuthUser) {
  if (user.email) return user.email;
  if (user.displayName) return user.displayName;

  return user.provider === 'apple' ? 'Apple account' : 'Google account';
}

export function SettingsScreen() {
  const authStatus = useAuthStore((state) => state.status);
  const authUser = useAuthStore((state) => state.user);
  const authError = useAuthStore((state) => state.error);
  const setAuthSession = useAuthStore((state) => state.setSession);
  const signOut = useAuthStore((state) => state.signOut);
  const clearAuthError = useAuthStore((state) => state.clearAuthError);

  const transactions = useTransactionsStore((state) => state.transactions);

  const isTransactionsLoading = useTransactionsStore(
    (state) => state.isLoading,
  );

  const transactionsError = useTransactionsStore((state) => state.error);

  const isTransactionsInitialized = useTransactionsStore(
    (state) => state.isInitialized,
  );

  const loadTransactions = useTransactionsStore(
    (state) => state.loadTransactions,
  );

  const loadCategories = useCategoriesStore((state) => state.loadCategories);

  const importTransactions = useTransactionsStore(
    (state) => state.importTransactions,
  );

  const clearTransactionsError = useTransactionsStore(
    (state) => state.clearError,
  );

  const [isReminderEnabled, setIsReminderEnabled] = useState(false);
  const [isReminderLoading, setIsReminderLoading] = useState(true);
  const [isReminderBusy, setIsReminderBusy] = useState(false);
  const [isAuthBusy, setIsAuthBusy] = useState(false);
  const [isAppleAuthAvailable, setIsAppleAuthAvailable] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [deleteAccountError, setDeleteAccountError] = useState<string | null>(
    null,
  );
  const [backupError, setBackupError] = useState<string | null>(null);
  const [backupResult, setBackupResult] = useState<BackupResult | null>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [restoreResult, setRestoreResult] = useState<RestoreUiResult | null>(
    null,
  );
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<SyncUiResult | null>(null);
  const [persistedSyncResult, setPersistedSyncResult] =
    useState<SyncUiResult | null>(null);
  const [isRestoreEmpty, setIsRestoreEmpty] = useState(false);
  const [lastSuccessfulBackupAt, setLastSuccessfulBackupAtState] = useState<
    number | null
  >(null);
  const [lastSuccessfulSyncAt, setLastSuccessfulSyncAtState] = useState<
    number | null
  >(null);
  const [lastSuccessfulSyncSource, setLastSuccessfulSyncSourceState] =
    useState<SyncAttemptSource | null>(null);
  const [reminderError, setReminderError] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [externalLinkError, setExternalLinkError] = useState<string | null>(
    null,
  );

  const [reminderPermissionStatus, setReminderPermissionStatus] =
    useState<ReminderPermissionStatus>('undetermined');
  const isSyncInFlightRef = useRef(false);

  const isReminderUnsupported = reminderPermissionStatus === 'unsupported';
  const isImportUnsupported = Platform.OS === 'web';
  const isAuthenticated = authStatus === 'authenticated' && authUser !== null;
  const isGoogleAuthAvailable =
    featureFlags.googleAuthEnabled && googleAuthAdapter.isEnabled;
  const shouldCheckAppleAuthAvailability =
    featureFlags.appleAuthEnabled &&
    appleAuthAdapter.isEnabled &&
    Platform.OS === 'ios';
  const shouldShowAppleAuth =
    shouldCheckAppleAuthAvailability && isAppleAuthAvailable;
  const shouldShowBackup = featureFlags.backupEnabled && isAuthenticated;
  const shouldShowRestore = featureFlags.restoreEnabled && isAuthenticated;
  const shouldShowSync = featureFlags.incrementalSyncEnabled && isAuthenticated;

  const isReminderDisabled =
    isReminderLoading || isReminderBusy || isReminderUnsupported;

  const isDataActionBusy = isExporting || isImporting;
  const isBackupDisabled = isBackingUp || !shouldShowBackup;
  const isRestoreDisabled = isRestoring || !shouldShowRestore;
  const isSyncDisabled = isSyncing || !shouldShowSync;
  const isGoogleAuthDisabled = isAuthBusy || authStatus === 'loading';
  const isAppleAuthDisabled = isAuthBusy || authStatus === 'loading';
  const isSignOutDisabled =
    isAuthBusy || isDeletingAccount || authStatus === 'loading';
  const isDeleteAccountDisabled =
    isDeletingAccount || isAuthBusy || authStatus === 'loading';

  const isDataPreparing =
    !isTransactionsInitialized || isTransactionsLoading || isDataActionBusy;

  const isExportDisabled = isDataPreparing || transactionsError !== null;

  const isImportDisabled = isDataPreparing || isImportUnsupported;

  const shouldShowTransactionsError =
    transactionsError !== null && transactionsError !== importError;

  const dataStatusMessage = !isTransactionsInitialized
    ? 'Preparing your local transaction history for import and export…'
    : isTransactionsLoading
      ? 'Refreshing your local transaction history for import and export…'
      : transactionsError
        ? isImportUnsupported
          ? 'Your local transaction history could not be fully prepared on this platform.'
          : 'Your local transaction history could not be fully prepared. Import can still restore a Money Leak CSV backup.'
        : 'Import restores a Money Leak CSV backup and skips duplicates or invalid rows.';

  const lastBackupText =
    lastSuccessfulBackupAt === null
      ? null
      : formatLastBackup(lastSuccessfulBackupAt);

  const lastSyncText =
    lastSuccessfulSyncAt === null
      ? null
      : formatLastSync({
          source: lastSuccessfulSyncSource,
          timestamp: lastSuccessfulSyncAt,
        });
  const visibleSyncResult = syncResult ?? persistedSyncResult;

  useTransactionsRefresh({
    isInitialized: isTransactionsInitialized,
    loadTransactions,
  });

  useEffect(() => {
    let isMounted = true;

    void (async () => {
      try {
        const [storedReminderEnabled, permissionStatus] = await Promise.all([
          getReminderEnabled(),
          getReminderPermissionStatus(),
        ]);

        if (!isMounted) return;

        setIsReminderEnabled(
          permissionStatus === 'unsupported' ? false : storedReminderEnabled,
        );
        setReminderPermissionStatus(permissionStatus);
      } catch (error) {
        console.error('Failed to load reminder settings', error);

        if (!isMounted) return;

        setIsReminderEnabled(false);
        setReminderError("Couldn't load reminder settings. Try again.");
      } finally {
        if (isMounted) {
          setIsReminderLoading(false);
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!featureFlags.backupEnabled) return;

    let isMounted = true;

    void (async () => {
      try {
        const timestamp = await getLastSuccessfulBackupAt();

        if (!isMounted) return;

        setLastSuccessfulBackupAtState(timestamp);
      } catch {
        if (!isMounted) return;

        setLastSuccessfulBackupAtState(null);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!shouldShowSync) {
      setLastSuccessfulSyncAtState(null);
      setLastSuccessfulSyncSourceState(null);
      setPersistedSyncResult(null);

      return;
    }

    let isMounted = true;

    void (async () => {
      try {
        const metadata = await getSyncMetadata();

        if (!isMounted) return;

        setLastSuccessfulSyncAtState(
          getSafeSyncTimestamp(metadata.lastSyncSummary?.completedAt) ??
            getSafeSyncTimestamp(metadata.lastSuccessfulSyncAt),
        );
        setLastSuccessfulSyncSourceState(
          getSafeSyncSource(metadata.lastSuccessfulSyncSource),
        );
        setPersistedSyncResult(
          createSyncUiResultFromSummary(metadata.lastSyncSummary),
        );
      } catch {
        if (!isMounted) return;

        setLastSuccessfulSyncAtState(null);
        setLastSuccessfulSyncSourceState(null);
        setPersistedSyncResult(null);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [shouldShowSync]);

  useEffect(() => {
    if (!shouldCheckAppleAuthAvailability) {
      setIsAppleAuthAvailable(false);

      return;
    }

    let isMounted = true;

    void (async () => {
      const isAvailable = await appleAuthAdapter.isAvailable();

      if (!isMounted) return;

      setIsAppleAuthAvailable(isAvailable);
    })().catch(() => {
      if (!isMounted) return;

      setIsAppleAuthAvailable(false);
    });

    return () => {
      isMounted = false;
    };
  }, [shouldCheckAppleAuthAvailability]);

  async function handleReminderToggle(nextEnabled: boolean) {
    if (isReminderDisabled) return;

    const previousEnabled = isReminderEnabled;

    setIsReminderBusy(true);
    setReminderError(null);
    setIsReminderEnabled(nextEnabled);

    try {
      if (nextEnabled) {
        const permissionStatus = await requestReminderPermissions();

        setReminderPermissionStatus(permissionStatus);

        if (permissionStatus !== 'granted') {
          await cancelDailyCheckInReminder();
          await setReminderEnabled(false);
          setIsReminderEnabled(false);
          setReminderError(getReminderPermissionError(permissionStatus));

          return;
        }

        await scheduleDailyCheckInReminder();
        await setReminderEnabled(true);
        setIsReminderEnabled(true);

        return;
      }

      await cancelDailyCheckInReminder();
      await setReminderEnabled(false);
      setIsReminderEnabled(false);
    } catch (error) {
      console.error('Failed to update reminder preference', error);
      setIsReminderEnabled(previousEnabled);
      setReminderError(
        nextEnabled
          ? "Couldn't turn on the daily reminder. Try again."
          : "Couldn't turn off the daily reminder. Try again.",
      );
    } finally {
      setIsReminderBusy(false);
    }
  }

  async function handleExportPress() {
    if (isExportDisabled) return;

    setIsExporting(true);
    setExportError(null);

    try {
      await exportTransactionsCsv(transactions);
    } catch (error) {
      console.error('Failed to export transactions CSV', error);
      setExportError(
        error instanceof Error
          ? error.message
          : "Couldn't export transactions. Try again.",
      );
    } finally {
      setIsExporting(false);
    }
  }

  async function handleGoogleSignInPress() {
    if (isGoogleAuthDisabled || !isGoogleAuthAvailable) return;

    setIsAuthBusy(true);
    setAccountError(null);
    clearAuthError();

    try {
      const session = await googleAuthAdapter.signIn();

      if (!session) return;

      await setAuthSession(session);
    } catch (error) {
      console.error('Failed to sign in with Google', error);
      setAccountError(getGoogleAuthSafeErrorMessage(error));
    } finally {
      setIsAuthBusy(false);
    }
  }

  async function handleAppleSignInPress() {
    if (isAppleAuthDisabled || !shouldShowAppleAuth) return;

    setIsAuthBusy(true);
    setAccountError(null);
    clearAuthError();

    try {
      const session = await appleAuthAdapter.signIn();

      if (!session) return;

      await setAuthSession(session);
    } catch (error) {
      setAccountError(getAppleAuthSafeErrorMessage(error));
    } finally {
      setIsAuthBusy(false);
    }
  }

  async function handleBackupPress() {
    if (isBackupDisabled) return;

    setIsBackingUp(true);
    setBackupError(null);
    setBackupResult(null);

    try {
      const result = await manualBackupService.runBackup({
        auth: {
          status: authStatus,
          userId: authUser?.id,
        },
      });

      if (result.status !== 'succeeded') {
        setBackupError("Couldn't create backup. Try again.");

        return;
      }

      const completedAt = Date.now();

      try {
        await setLastSuccessfulBackupAt(completedAt);
        setLastSuccessfulBackupAtState(completedAt);
      } catch {
        setLastSuccessfulBackupAtState(null);
      }

      setBackupResult({
        uploadedTransactionsCount: result.uploadedTransactionsCount,
        uploadedCategoriesCount: result.uploadedCategoriesCount,
      });
    } catch {
      setBackupError("Couldn't create backup. Try again.");
    } finally {
      setIsBackingUp(false);
    }
  }

  async function confirmRestoreIfLocalDataExists() {
    const hasLocalData = await manualRestoreService.hasLocalData();

    if (!hasLocalData) return true;

    return new Promise<boolean>((resolve) => {
      Alert.alert(
        'Restore from backup?',
        'This will merge your cloud backup into this device. Existing local data will not be deleted.',
        [
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => {
              resolve(false);
            },
          },
          {
            text: 'Restore',
            onPress: () => {
              resolve(true);
            },
          },
        ],
      );
    });
  }

  async function handleRestorePress() {
    if (isRestoreDisabled) return;

    setRestoreError(null);
    setRestoreResult(null);
    setIsRestoreEmpty(false);

    let shouldRestore = false;

    try {
      shouldRestore = await confirmRestoreIfLocalDataExists();
    } catch {
      setRestoreError("Couldn't restore backup. Try again.");

      return;
    }

    if (!shouldRestore) return;

    setIsRestoring(true);

    try {
      const result = await manualRestoreService.runRestore({
        auth: {
          status: authStatus,
          userId: authUser?.id,
        },
      });

      if (result.status === 'empty') {
        setIsRestoreEmpty(true);

        return;
      }

      if (result.status !== 'succeeded') {
        setRestoreError("Couldn't restore backup. Try again.");

        return;
      }

      setRestoreResult({
        restoredTransactionsCount: result.restoredTransactionsCount,
        restoredCategoriesCount: result.restoredCategoriesCount,
      });

      await Promise.all([loadTransactions(), loadCategories()]);
    } catch {
      setRestoreError("Couldn't restore backup. Try again.");
    } finally {
      setIsRestoring(false);
    }
  }

  async function handleSyncPress() {
    if (isSyncInFlightRef.current) return;
    if (isSyncDisabled) return;

    isSyncInFlightRef.current = true;
    setIsSyncing(true);
    setSyncError(null);
    setSyncResult(null);
    setPersistedSyncResult(null);

    try {
      const result = await manualSyncService.runIncrementalSync({
        auth: {
          status: authStatus,
          userId: authUser?.id,
        },
        source: 'manual',
      });

      if (result.status !== 'succeeded') {
        setSyncError("Couldn't sync. Try again.");

        return;
      }

      setSyncResult(createSyncUiResult(result));
      setPersistedSyncResult(null);

      await Promise.all([loadTransactions(), loadCategories()]);

      try {
        const metadata = await getSyncMetadata();

        setLastSuccessfulSyncAtState(
          getSafeSyncTimestamp(metadata.lastSyncSummary?.completedAt) ??
            getSafeSyncTimestamp(metadata.lastSuccessfulSyncAt) ??
            result.lastSuccessfulSyncAt,
        );
        setLastSuccessfulSyncSourceState(
          getSafeSyncSource(metadata.lastSuccessfulSyncSource),
        );
        setPersistedSyncResult(
          createSyncUiResultFromSummary(metadata.lastSyncSummary),
        );
      } catch {
        setLastSuccessfulSyncAtState(result.lastSuccessfulSyncAt);
        setLastSuccessfulSyncSourceState('manual');
      }
    } catch {
      setSyncError("Couldn't sync. Try again.");
    } finally {
      isSyncInFlightRef.current = false;
      setIsSyncing(false);
    }
  }

  async function handleSignOutPress() {
    if (isSignOutDisabled) return;

    setIsAuthBusy(true);
    setAccountError(null);
    clearAuthError();

    try {
      await signOut();
    } catch (error) {
      console.error('Failed to sign out', error);
      setAccountError('Could not sign out. Try again.');
    } finally {
      setIsAuthBusy(false);
    }
  }

  function handleDeleteAccountPress() {
    if (isDeleteAccountDisabled || !isAuthenticated) return;

    Alert.alert(
      'Delete account data?',
      'This will delete your cloud account data and cloud backup from Money Leak. Local transactions and categories on this device will stay here.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete Account',
          style: 'destructive',
          onPress: () => {
            void handleConfirmedDeleteAccount();
          },
        },
      ],
    );
  }

  async function handleConfirmedDeleteAccount() {
    if (isDeleteAccountDisabled || !isAuthenticated) return;

    setIsDeletingAccount(true);
    setDeleteAccountError(null);
    setAccountError(null);
    clearAuthError();

    try {
      const result = await deleteAccountService.runDeleteAccount({
        auth: {
          status: authStatus,
          hasAuthenticatedUser: authUser !== null,
        },
      });

      if (result.status !== 'succeeded') {
        setDeleteAccountError("Couldn't delete account. Try again.");

        return;
      }

      await signOut();
    } catch {
      console.error('Failed to delete account data');
      setDeleteAccountError("Couldn't delete account. Try again.");
    } finally {
      setIsDeletingAccount(false);
    }
  }

  async function handleImportPress() {
    if (isImportDisabled) return;

    setIsImporting(true);
    setImportResult(null);
    setImportError(null);

    try {
      const selection = await pickTransactionsCsvImport();

      if (selection.status === 'cancelled') return;

      const { transactions: importedTransactions, skippedCount } = selection;

      let importedCount = 0;

      clearTransactionsError();

      if (importedTransactions.length > 0) {
        importedCount = await importTransactions(importedTransactions);

        const storeError = useTransactionsStore.getState().error;

        if (storeError) {
          setImportResult(null);
          setImportError(storeError);

          return;
        }
      }

      setImportResult({
        importedCount,
        skippedCount:
          skippedCount + (importedTransactions.length - importedCount),
      });

      setImportError(null);
    } catch (error) {
      console.error('Failed to import transactions CSV', error);
      setImportResult(null);

      setImportError(
        error instanceof Error
          ? error.message
          : "Couldn't import CSV. Try again.",
      );
    } finally {
      setIsImporting(false);
    }
  }

  async function handleOpenExternalLink({
    emptyMessage,
    url,
  }: {
    emptyMessage: string;
    url: string;
  }) {
    const trimmedUrl = url.trim();

    if (trimmedUrl.length === 0) {
      setExternalLinkError(emptyMessage);

      return;
    }

    setExternalLinkError(null);

    try {
      await Linking.openURL(trimmedUrl);
    } catch {
      console.error('Failed to open external link');
      setExternalLinkError("Couldn't open this link right now.");
    }
  }

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Settings</Text>

          <Text style={styles.subtitle}>
            Manage the daily reminder that nudges you to log the day before it
            blurs.
          </Text>
        </View>

        <View
          style={[
            styles.sectionCard,
            isReminderUnsupported ? styles.sectionCardDisabled : null,
          ]}
        >
          <View style={styles.sectionHeader}>
            <View style={styles.sectionCopy}>
              <Text style={styles.sectionTitle}>Daily check-in reminder</Text>

              <Text style={styles.sectionBody}>
                This reminder fires every day at 21:00 local device time.
              </Text>
            </View>

            <Switch
              accessibilityLabel="Enable the daily check-in reminder"
              disabled={isReminderDisabled}
              onValueChange={(nextEnabled) => {
                void handleReminderToggle(nextEnabled);
              }}
              value={isReminderUnsupported ? false : isReminderEnabled}
            />
          </View>

          {isReminderLoading ? (
            <Text style={styles.metaText}>Checking reminder support…</Text>
          ) : isReminderUnsupported ? (
            <Text style={styles.infoText}>
              Daily reminders are not available on this platform.
            </Text>
          ) : (
            <Text style={styles.metaText}>21:00 daily, on this device.</Text>
          )}

          {reminderError ? (
            <Text style={styles.errorText}>{reminderError}</Text>
          ) : null}
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionCopy}>
            <Text style={styles.sectionTitle}>Account</Text>

            <Text style={styles.sectionBody}>
              {isAuthenticated
                ? `Signed in as ${getAccountDisplayName(authUser)}. Local expense data stays on this device.`
                : 'Using local guest mode on this device.'}
            </Text>
          </View>

          {isAuthenticated ? (
            <Pressable
              accessibilityRole="button"
              disabled={isSignOutDisabled}
              onPress={() => {
                void handleSignOutPress();
              }}
              style={[
                styles.dataButton,
                styles.supportButton,
                isSignOutDisabled ? styles.dataButtonDisabled : null,
              ]}
            >
              <Text style={[styles.dataButtonText, styles.supportButtonText]}>
                {isAuthBusy ? 'Signing Out...' : 'Sign Out'}
              </Text>
            </Pressable>
          ) : isGoogleAuthAvailable || shouldShowAppleAuth ? (
            <View style={styles.authActions}>
              {isGoogleAuthAvailable ? (
                <Pressable
                  accessibilityRole="button"
                  disabled={isGoogleAuthDisabled}
                  onPress={() => {
                    void handleGoogleSignInPress();
                  }}
                  style={[
                    styles.dataButton,
                    styles.googleButton,
                    isGoogleAuthDisabled ? styles.dataButtonDisabled : null,
                  ]}
                >
                  <Text
                    style={[styles.dataButtonText, styles.googleButtonText]}
                  >
                    {isAuthBusy ? 'Opening Google...' : 'Continue with Google'}
                  </Text>
                </Pressable>
              ) : null}

              {shouldShowAppleAuth ? (
                <AppleAuthentication.AppleAuthenticationButton
                  accessibilityLabel="Continue with Apple"
                  buttonStyle={
                    AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
                  }
                  buttonType={
                    AppleAuthentication.AppleAuthenticationButtonType.CONTINUE
                  }
                  cornerRadius={12}
                  onPress={() => {
                    void handleAppleSignInPress();
                  }}
                  pointerEvents={isAppleAuthDisabled ? 'none' : 'auto'}
                  style={[
                    styles.appleButton,
                    isAppleAuthDisabled ? styles.dataButtonDisabled : null,
                  ]}
                />
              ) : null}
            </View>
          ) : null}

          {accountError ? (
            <Text style={styles.errorText}>{accountError}</Text>
          ) : null}

          {authError ? (
            <Text style={styles.errorText}>{authError.message}</Text>
          ) : null}
        </View>

        {isAuthenticated ? (
          <View style={styles.sectionCard}>
            <View style={styles.sectionCopy}>
              <Text style={styles.sectionTitle}>Privacy</Text>

              <Text style={styles.sectionBody}>
                Delete cloud account data and backups for this account. Local
                transactions and categories on this device will stay here.
              </Text>
            </View>

            <Pressable
              accessibilityRole="button"
              disabled={isDeleteAccountDisabled}
              onPress={handleDeleteAccountPress}
              style={[
                styles.dataButton,
                styles.destructiveButton,
                isDeleteAccountDisabled ? styles.dataButtonDisabled : null,
              ]}
            >
              <Text
                style={[styles.dataButtonText, styles.destructiveButtonText]}
              >
                {isDeletingAccount ? 'Deleting account...' : 'Delete Account'}
              </Text>
            </Pressable>

            {deleteAccountError ? (
              <Text style={styles.errorText}>{deleteAccountError}</Text>
            ) : null}
          </View>
        ) : null}

        {shouldShowSync ? (
          <View style={styles.sectionCard}>
            <View style={styles.sectionCopy}>
              <Text style={styles.sectionTitle}>Sync</Text>

              <Text style={styles.sectionBody}>Auto sync: On</Text>

              <Text style={styles.metaText}>
                Runs when you return to the app. Local tracking still works
                offline.
              </Text>
            </View>

            <Pressable
              accessibilityRole="button"
              disabled={isSyncDisabled}
              onPress={() => {
                void handleSyncPress();
              }}
              style={[
                styles.dataButton,
                styles.exportButton,
                isSyncDisabled ? styles.dataButtonDisabled : null,
              ]}
            >
              <Text style={[styles.dataButtonText, styles.exportButtonText]}>
                {isSyncing ? 'Syncing...' : 'Sync now'}
              </Text>
            </Pressable>

            {lastSyncText ? (
              <Text style={styles.metaText}>{lastSyncText}</Text>
            ) : null}

            {visibleSyncResult ? (
              <Text style={styles.infoText}>
                {formatSyncResult(visibleSyncResult)}
              </Text>
            ) : null}

            {syncError ? (
              <Text style={styles.errorText}>{syncError}</Text>
            ) : null}
          </View>
        ) : null}

        <View style={styles.sectionCard}>
          <View style={styles.sectionCopy}>
            <Text style={styles.sectionTitle}>Categories</Text>

            <Text style={styles.sectionBody}>
              Add or rename the spending buckets shown in transaction forms.
            </Text>
          </View>

          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/categories' as Href)}
            style={[styles.dataButton, styles.supportButton]}
          >
            <Text style={[styles.dataButtonText, styles.supportButtonText]}>
              Manage Categories
            </Text>
          </Pressable>
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionCopy}>
            <Text style={styles.sectionTitle}>Data</Text>

            <Text style={styles.sectionBody}>
              Import a Money Leak CSV backup or export every transaction saved
              on this device.
            </Text>
          </View>

          <View style={styles.dataActions}>
            <Pressable
              accessibilityRole="button"
              disabled={isImportDisabled}
              onPress={() => {
                void handleImportPress();
              }}
              style={[
                styles.dataButton,
                styles.dataActionButton,
                styles.importButton,
                isImportDisabled ? styles.dataButtonDisabled : null,
              ]}
            >
              <Text style={[styles.dataButtonText, styles.importButtonText]}>
                {isImporting ? 'Importing...' : 'Import CSV'}
              </Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              disabled={isExportDisabled}
              onPress={() => {
                void handleExportPress();
              }}
              style={[
                styles.dataButton,
                styles.dataActionButton,
                styles.exportButton,
                isExportDisabled ? styles.dataButtonDisabled : null,
              ]}
            >
              <Text style={[styles.dataButtonText, styles.exportButtonText]}>
                {isExporting ? 'Exporting...' : 'Export CSV'}
              </Text>
            </Pressable>
          </View>

          <Text style={styles.metaText}>{dataStatusMessage}</Text>

          {isImportUnsupported ? (
            <Text style={styles.metaText}>
              {IMPORT_TRANSACTIONS_UNSUPPORTED_ERROR_MESSAGE}
            </Text>
          ) : (
            <Text style={styles.metaText}>
              This stays on-device and opens the native share sheet with a CSV
              copy.
            </Text>
          )}

          {importResult ? (
            <Text style={styles.infoText}>
              {formatImportResult(importResult)}
            </Text>
          ) : null}

          {shouldShowTransactionsError ? (
            <Text style={styles.errorText}>{transactionsError}</Text>
          ) : null}

          {importError ? (
            <Text style={styles.errorText}>{importError}</Text>
          ) : null}

          {exportError ? (
            <Text style={styles.errorText}>{exportError}</Text>
          ) : null}
        </View>

        {shouldShowBackup ? (
          <View style={styles.sectionCard}>
            <View style={styles.sectionCopy}>
              <Text style={styles.sectionTitle}>Backup</Text>

              <Text style={styles.sectionBody}>
                Save a remote copy of the transactions and categories currently
                on this device.
              </Text>
            </View>

            <Pressable
              accessibilityRole="button"
              disabled={isBackupDisabled}
              onPress={() => {
                void handleBackupPress();
              }}
              style={[
                styles.dataButton,
                styles.exportButton,
                isBackupDisabled ? styles.dataButtonDisabled : null,
              ]}
            >
              <Text style={[styles.dataButtonText, styles.exportButtonText]}>
                {isBackingUp ? 'Creating backup...' : 'Create backup now'}
              </Text>
            </Pressable>

            {lastBackupText ? (
              <Text style={styles.metaText}>{lastBackupText}</Text>
            ) : null}

            {backupResult ? (
              <Text style={styles.infoText}>
                {formatBackupResult(backupResult)}
              </Text>
            ) : null}

            {backupError ? (
              <Text style={styles.errorText}>{backupError}</Text>
            ) : null}
          </View>
        ) : null}

        {shouldShowRestore ? (
          <View style={styles.sectionCard}>
            <View style={styles.sectionCopy}>
              <Text style={styles.sectionTitle}>Restore</Text>

              <Text style={styles.sectionBody}>
                Merge the cloud backup for this account into this device.
                Existing local data will not be deleted.
              </Text>
            </View>

            <Pressable
              accessibilityRole="button"
              disabled={isRestoreDisabled}
              onPress={() => {
                void handleRestorePress();
              }}
              style={[
                styles.dataButton,
                styles.exportButton,
                isRestoreDisabled ? styles.dataButtonDisabled : null,
              ]}
            >
              <Text style={[styles.dataButtonText, styles.exportButtonText]}>
                {isRestoring ? 'Restoring backup...' : 'Restore from backup'}
              </Text>
            </Pressable>

            {restoreResult ? (
              <Text style={styles.infoText}>
                {formatRestoreResult(restoreResult)}
              </Text>
            ) : null}

            {isRestoreEmpty ? (
              <Text style={styles.infoText}>
                No backup found for this account.
              </Text>
            ) : null}

            {restoreError ? (
              <Text style={styles.errorText}>{restoreError}</Text>
            ) : null}
          </View>
        ) : null}

        <View style={styles.sectionCard}>
          <View style={styles.sectionCopy}>
            <Text style={styles.sectionTitle}>Privacy & Support</Text>

            <Text style={styles.sectionBody}>
              Review the privacy policy or get in touch if the app behaves
              unexpectedly.
            </Text>
          </View>

          <View style={styles.supportActions}>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                void handleOpenExternalLink({
                  emptyMessage: 'Privacy policy is not available right now.',
                  url: APP_LINKS.privacyPolicyUrl,
                });
              }}
              style={[styles.dataButton, styles.supportButton]}
            >
              <Text style={[styles.dataButtonText, styles.supportButtonText]}>
                Privacy Policy
              </Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              onPress={() => {
                void handleOpenExternalLink({
                  emptyMessage: 'Support contact is not available right now.',
                  url: APP_LINKS.supportUrl,
                });
              }}
              style={[styles.dataButton, styles.supportButton]}
            >
              <Text style={[styles.dataButtonText, styles.supportButtonText]}>
                Support
              </Text>
            </Pressable>
          </View>

          {externalLinkError ? (
            <Text style={styles.errorText}>{externalLinkError}</Text>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f7f7f5',
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 136,
    gap: 24,
  },
  header: {
    gap: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: '#4b5563',
  },
  sectionCard: {
    gap: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#ffffff',
    padding: 20,
  },
  sectionCardDisabled: {
    backgroundColor: '#f9fafb',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  sectionCopy: {
    flex: 1,
    gap: 6,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  sectionBody: {
    fontSize: 14,
    lineHeight: 20,
    color: '#4b5563',
  },
  metaText: {
    fontSize: 13,
    lineHeight: 18,
    color: '#6b7280',
  },
  infoText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#4b5563',
  },
  dataActions: {
    flexDirection: 'row',
    gap: 12,
  },
  authActions: {
    gap: 12,
  },
  supportActions: {
    gap: 12,
  },
  dataButton: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingVertical: 14,
  },
  dataActionButton: {
    flex: 1,
  },
  dataButtonDisabled: {
    opacity: 0.6,
  },
  importButton: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#ffffff',
  },
  exportButton: {
    backgroundColor: '#111827',
  },
  destructiveButton: {
    backgroundColor: '#b91c1c',
  },
  dataButtonText: {
    fontSize: 15,
    fontWeight: '700',
  },
  importButtonText: {
    color: '#111827',
  },
  supportButton: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#ffffff',
  },
  googleButton: {
    borderWidth: 1,
    borderColor: '#111827',
    backgroundColor: '#111827',
  },
  appleButton: {
    width: '100%',
    height: 48,
  },
  supportButtonText: {
    color: '#111827',
  },
  googleButtonText: {
    color: '#ffffff',
  },
  exportButtonText: {
    color: '#ffffff',
  },
  destructiveButtonText: {
    color: '#ffffff',
  },
  errorText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#b91c1c',
  },
});
