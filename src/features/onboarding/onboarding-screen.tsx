import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { setHasCompletedOnboarding } from '@/lib/onboarding-storage';

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

  const currentStep = ONBOARDING_STEPS[currentStepIndex];
  const isFinalStep = currentStepIndex === ONBOARDING_STEPS.length - 1;

  async function completeOnboarding() {
    if (isSaving) return;

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
    if (isSaving || isFinalStep) return;

    setCurrentStepIndex((previousStepIndex) => previousStepIndex + 1);
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>First run</Text>

          <Pressable
            accessibilityRole="button"
            disabled={isSaving}
            onPress={() => {
              void completeOnboarding();
            }}
            style={({ pressed }) => [
              styles.skipButton,
              pressed && !isSaving ? styles.skipButtonPressed : null,
              isSaving ? styles.disabledButton : null,
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

        {saveError ? <Text style={styles.errorText}>{saveError}</Text> : null}

        <Pressable
          accessibilityRole="button"
          disabled={isSaving}
          onPress={() => {
            if (isFinalStep) {
              void completeOnboarding();

              return;
            }

            handleNextStep();
          }}
          style={({ pressed }) => [
            styles.primaryButton,
            pressed && !isSaving ? styles.primaryButtonPressed : null,
            isSaving ? styles.disabledButton : null,
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
