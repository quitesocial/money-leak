import { useEffect, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { exportTransactionsCsv } from '@/features/export/export-transactions-csv';
import {
  IMPORT_TRANSACTIONS_UNSUPPORTED_ERROR_MESSAGE,
  pickTransactionsCsvImport,
} from '@/features/export/import-transactions-csv';
import {
  cancelDailyCheckInReminder,
  getReminderPermissionStatus,
  requestReminderPermissions,
  scheduleDailyCheckInReminder,
  type ReminderPermissionStatus,
} from '@/lib/reminder-notifications';
import { getReminderEnabled, setReminderEnabled } from '@/lib/reminder-storage';
import { useTransactionsRefresh } from '@/lib/use-transactions-refresh';
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
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [reminderError, setReminderError] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  const [reminderPermissionStatus, setReminderPermissionStatus] =
    useState<ReminderPermissionStatus>('undetermined');

  const isReminderUnsupported = reminderPermissionStatus === 'unsupported';
  const isImportUnsupported = Platform.OS === 'web';

  const isReminderDisabled =
    isReminderLoading || isReminderBusy || isReminderUnsupported;

  const isDataActionBusy = isExporting || isImporting;

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

  return (
    <SafeAreaView style={styles.safeArea}>
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
    paddingBottom: 32,
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
  dataButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingVertical: 14,
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
  exportButtonText: {
    color: '#ffffff',
  },
  errorText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#b91c1c',
  },
});
