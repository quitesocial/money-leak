import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { setHasCompletedOnboarding } from '@/lib/onboarding-storage';
import {
  cancelDailyCheckInReminder,
  getReminderPermissionStatus,
  requestReminderPermissions,
  scheduleDailyCheckInReminder,
  type ReminderPermissionStatus,
} from '@/lib/reminder-notifications';
import { getReminderEnabled, setReminderEnabled } from '@/lib/reminder-storage';

type OnboardingStep = {
  title: string;
  body: string;
};

const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    title: 'Find where money leaks',
    body: 'Money Leak is not about strict budgets. It is about spotting the expenses that felt pointless afterwards.',
  },
  {
    title: 'Mark the leaks',
    body: 'Add expenses quickly. If a transaction was impulsive, emotional, or just dumb, mark it as a leak.',
  },
  {
    title: 'See the pattern',
    body: 'The app shows how much you leaked, what triggered it, and what that money could have been instead.',
  },
  {
    title: 'Start simple',
    body: 'Add one real expense today. The truth gets clearer after a few days.',
  },
];

export function OnboardingScreen() {
  const router = useRouter();
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isReminderEnabled, setIsReminderEnabled] = useState(false);
  const [isReminderBusy, setIsReminderBusy] = useState(false);
  const [isReminderLoading, setIsReminderLoading] = useState(true);
  const [reminderError, setReminderError] = useState<string | null>(null);

  const [reminderPermissionStatus, setReminderPermissionStatus] =
    useState<ReminderPermissionStatus>('undetermined');

  const currentStep = ONBOARDING_STEPS[currentStepIndex];
  const isFinalStep = currentStepIndex === ONBOARDING_STEPS.length - 1;
  const isReminderUnsupported = reminderPermissionStatus === 'unsupported';
  const isActionBusy = isSaving || isReminderBusy;

  useEffect(() => {
    let isMounted = true;

    void (async () => {
      try {
        const [storedReminderEnabled, permissionStatus] = await Promise.all([
          getReminderEnabled(),
          getReminderPermissionStatus(),
        ]);

        if (!isMounted) return;

        setIsReminderEnabled(storedReminderEnabled);
        setReminderPermissionStatus(permissionStatus);
      } catch (error) {
        console.error('Failed to load reminder settings', error);

        if (!isMounted) return;

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

  async function completeOnboarding() {
    if (isActionBusy) return;

    setIsSaving(true);
    setSaveError(null);

    try {
      await setHasCompletedOnboarding();
      router.replace('/(tabs)');
    } catch (error) {
      console.error('Failed to persist onboarding completion', error);
      setSaveError("Couldn't finish setup. Try again.");
      setIsSaving(false);
    }
  }

  function handleNextStep() {
    if (isActionBusy || isFinalStep) return;

    setCurrentStepIndex((previousStepIndex) => previousStepIndex + 1);
  }

  async function handleReminderToggle(nextEnabled: boolean) {
    if (isReminderBusy || isReminderLoading || isReminderUnsupported) return;

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
          setReminderError(
            permissionStatus === 'denied'
              ? 'Notifications are off for Money Leak. Turn them on in system settings to get the daily check-in.'
              : permissionStatus === 'unsupported'
                ? "Daily reminders aren't available on this platform."
                : 'Allow notifications to get the daily check-in.',
          );

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
          <Text style={styles.eyebrow}>First run</Text>

          <Pressable
            accessibilityRole="button"
            disabled={isActionBusy}
            onPress={() => {
              void completeOnboarding();
            }}
            style={({ pressed }) => [
              styles.skipButton,
              pressed && !isActionBusy ? styles.skipButtonPressed : null,
              isActionBusy ? styles.disabledButton : null,
            ]}
          >
            <Text style={styles.skipButtonText}>Skip</Text>
          </Pressable>
        </View>

        <View style={styles.hero}>
          <Text style={styles.title}>Money Leak</Text>

          <Text style={styles.subtitle}>
            A fast way to notice the small expenses that quietly add up.
          </Text>
        </View>

        <View style={styles.progressRow}>
          <Text style={styles.progressLabel}>
            Step {currentStepIndex + 1} of {ONBOARDING_STEPS.length}
          </Text>

          <View style={styles.progressDots}>
            {ONBOARDING_STEPS.map((step, stepIndex) => (
              <View
                key={step.title}
                style={[
                  styles.progressDot,
                  stepIndex === currentStepIndex
                    ? styles.progressDotActive
                    : null,
                ]}
              />
            ))}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{currentStep.title}</Text>
          <Text style={styles.cardBody}>{currentStep.body}</Text>
        </View>

        <View style={styles.notesCard}>
          <Text style={styles.notesTitle}>What to do next</Text>

          <Text style={styles.notesBody}>
            Start with one expense you actually made. Mark it honestly if it
            felt pointless after the fact.
          </Text>
        </View>

        {isFinalStep ? (
          <View
            style={[
              styles.reminderCard,
              isReminderUnsupported ? styles.reminderCardDisabled : null,
            ]}
          >
            <View style={styles.reminderRow}>
              <View style={styles.reminderCopy}>
                <Text style={styles.reminderTitle}>
                  Daily check-in reminder
                </Text>

                <Text style={styles.reminderBody}>
                  Get a local reminder at 21:00 daily before the day blurs.
                </Text>
              </View>

              <Switch
                accessibilityLabel="Enable the daily check-in reminder"
                disabled={
                  isReminderLoading || isReminderBusy || isReminderUnsupported
                }
                onValueChange={(nextEnabled) => {
                  void handleReminderToggle(nextEnabled);
                }}
                value={isReminderUnsupported ? false : isReminderEnabled}
              />
            </View>

            {isReminderLoading ? (
              <Text style={styles.reminderMeta}>
                Checking reminder support…
              </Text>
            ) : isReminderUnsupported ? (
              <Text style={styles.reminderInfoText}>
                Daily reminders are not available on this platform.
              </Text>
            ) : (
              <Text style={styles.reminderMeta}>
                21:00 daily, on this device.
              </Text>
            )}

            {reminderError ? (
              <Text style={styles.errorText}>{reminderError}</Text>
            ) : null}
          </View>
        ) : null}

        {saveError ? <Text style={styles.errorText}>{saveError}</Text> : null}

        <Pressable
          accessibilityRole="button"
          disabled={isActionBusy}
          onPress={() => {
            if (isFinalStep) {
              void completeOnboarding();

              return;
            }

            handleNextStep();
          }}
          style={({ pressed }) => [
            styles.primaryButton,
            pressed && !isActionBusy ? styles.primaryButtonPressed : null,
            isActionBusy ? styles.disabledButton : null,
          ]}
        >
          <Text style={styles.primaryButtonText}>
            {isFinalStep ? 'Start tracking' : 'Next'}
          </Text>
        </Pressable>
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
    paddingTop: 16,
    paddingBottom: 32,
    gap: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  eyebrow: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: '#6b7280',
  },
  skipButton: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  skipButtonPressed: {
    backgroundColor: '#e5e7eb',
  },
  skipButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4b5563',
  },
  hero: {
    gap: 8,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#111827',
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 24,
    color: '#4b5563',
  },
  progressRow: {
    gap: 12,
  },
  progressLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
  progressDots: {
    flexDirection: 'row',
    gap: 8,
  },
  progressDot: {
    height: 8,
    width: 8,
    borderRadius: 999,
    backgroundColor: '#d1d5db',
  },
  progressDotActive: {
    width: 24,
    backgroundColor: '#111827',
  },
  card: {
    gap: 12,
    borderRadius: 24,
    backgroundColor: '#ffffff',
    padding: 24,
  },
  cardTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#111827',
  },
  cardBody: {
    fontSize: 16,
    lineHeight: 24,
    color: '#374151',
  },
  notesCard: {
    gap: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#fffbeb',
    padding: 20,
  },
  notesTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#92400e',
  },
  notesBody: {
    fontSize: 15,
    lineHeight: 22,
    color: '#78350f',
  },
  reminderCard: {
    gap: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#ffffff',
    padding: 20,
  },
  reminderCardDisabled: {
    backgroundColor: '#f9fafb',
  },
  reminderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  reminderCopy: {
    flex: 1,
    gap: 6,
  },
  reminderTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  reminderBody: {
    fontSize: 14,
    lineHeight: 20,
    color: '#4b5563',
  },
  reminderMeta: {
    fontSize: 13,
    lineHeight: 18,
    color: '#6b7280',
  },
  reminderInfoText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#4b5563',
  },
  errorText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#b91c1c',
  },
  primaryButton: {
    marginTop: 'auto',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: '#111827',
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  primaryButtonPressed: {
    backgroundColor: '#1f2937',
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  disabledButton: {
    opacity: 0.6,
  },
});
