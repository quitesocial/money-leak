import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  cancelDailyCheckInReminder,
  getReminderPermissionStatus,
  requestReminderPermissions,
  scheduleDailyCheckInReminder,
  type ReminderPermissionStatus,
} from '@/lib/reminder-notifications';
import { getReminderEnabled, setReminderEnabled } from '@/lib/reminder-storage';

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

export function SettingsScreen() {
  const [isReminderEnabled, setIsReminderEnabled] = useState(false);
  const [isReminderLoading, setIsReminderLoading] = useState(true);
  const [isReminderBusy, setIsReminderBusy] = useState(false);
  const [reminderError, setReminderError] = useState<string | null>(null);
  
  const [reminderPermissionStatus, setReminderPermissionStatus] =
    useState<ReminderPermissionStatus>('undetermined');

  const isReminderUnsupported = reminderPermissionStatus === 'unsupported';
  
  const isReminderDisabled =
    isReminderLoading || isReminderBusy || isReminderUnsupported;

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
  errorText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#b91c1c',
  },
});
