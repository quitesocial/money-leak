import { useEffect, useState } from 'react';
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
  getGoogleAuthSafeErrorMessage,
  googleAuthAdapter,
} from '@/lib/auth/google-auth-adapter';
import {
  cancelDailyCheckInReminder,
  getReminderPermissionStatus,
  requestReminderPermissions,
  scheduleDailyCheckInReminder,
  type ReminderPermissionStatus,
} from '@/lib/reminder-notifications';
import { APP_LINKS } from '@/lib/app-links';
import { featureFlags } from '@/lib/feature-flags';
import { getReminderEnabled, setReminderEnabled } from '@/lib/reminder-storage';
import { useTransactionsRefresh } from '@/lib/use-transactions-refresh';
import { useAuthStore } from '@/store/auth-store';
import { useTransactionsStore } from '@/store/transactions-store';

type ImportResult = {
  importedCount: number;
  skippedCount: number;
};

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

function formatCountLabel(count: number, singularLabel: string) {
  return `${count} ${singularLabel}${count === 1 ? '' : 's'}`;
}

function formatImportResult({ importedCount, skippedCount }: ImportResult) {
  return `Imported ${formatCountLabel(importedCount, 'transaction')}. Skipped ${formatCountLabel(skippedCount, 'row')}.`;
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
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [reminderError, setReminderError] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  const [reminderPermissionStatus, setReminderPermissionStatus] =
    useState<ReminderPermissionStatus>('undetermined');

  const isReminderUnsupported = reminderPermissionStatus === 'unsupported';
  const isImportUnsupported = Platform.OS === 'web';
  const isAuthenticated = authStatus === 'authenticated' && authUser !== null;
  const isGoogleAuthAvailable =
    featureFlags.googleAuthEnabled && googleAuthAdapter.isEnabled;

  const isReminderDisabled =
    isReminderLoading || isReminderBusy || isReminderUnsupported;

  const isDataActionBusy = isExporting || isImporting;
  const isGoogleAuthDisabled = isAuthBusy || authStatus === 'loading';
  const isSignOutDisabled = isAuthBusy || authStatus === 'loading';

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
    url,
    emptyMessage,
  }: {
    url: string;
    emptyMessage: string;
  }) {
    const trimmedUrl = url.trim();

    if (trimmedUrl.length === 0) {
      Alert.alert(emptyMessage);

      return;
    }

    try {
      await Linking.openURL(trimmedUrl);
    } catch (error) {
      console.error('Failed to open external link', error);
      Alert.alert("Couldn't open this link right now.");
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
                ? `Signed in as ${authUser.email ?? authUser.displayName ?? 'Google account'}. Local expense data stays on this device.`
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
          ) : isGoogleAuthAvailable ? (
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
              <Text style={[styles.dataButtonText, styles.googleButtonText]}>
                {isAuthBusy ? 'Opening Google...' : 'Continue with Google'}
              </Text>
            </Pressable>
          ) : null}

          {accountError ? (
            <Text style={styles.errorText}>{accountError}</Text>
          ) : null}

          {authError ? (
            <Text style={styles.errorText}>{authError.message}</Text>
          ) : null}
        </View>

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

        <View style={styles.sectionCard}>
          <View style={styles.sectionCopy}>
            <Text style={styles.sectionTitle}>Support & Legal</Text>

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
                  url: APP_LINKS.PRIVACY_POLICY,
                  emptyMessage: 'Privacy policy is not available yet.',
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
                  url: APP_LINKS.SUPPORT_EMAIL,
                  emptyMessage: 'Support contact is not configured.',
                });
              }}
              style={[styles.dataButton, styles.supportButton]}
            >
              <Text style={[styles.dataButtonText, styles.supportButtonText]}>
                Contact Support
              </Text>
            </Pressable>
          </View>
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
  supportButtonText: {
    color: '#111827',
  },
  googleButtonText: {
    color: '#ffffff',
  },
  exportButtonText: {
    color: '#ffffff',
  },
  errorText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#b91c1c',
  },
});
