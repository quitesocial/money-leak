import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { calculateAnalytics } from '@/features/analytics/calculate-analytics';
import {
  generateShameCardContent,
  type ShameCardTone,
} from '@/features/shame-card/generate-shame-card';
import { useTransactionsRefresh } from '@/lib/use-transactions-refresh';
import { useTransactionsStore } from '@/store/transactions-store';

type ToneOption = {
  label: string;
  value: ShameCardTone;
};

const toneOptions: ToneOption[] = [
  { label: 'Soft', value: 'soft' },
  { label: 'Harsh', value: 'harsh' },
  { label: 'Unfiltered', value: 'unfiltered' },
];

export function ShameCardScreen() {
  const transactions = useTransactionsStore((state) => state.transactions);
  const isLoading = useTransactionsStore((state) => state.isLoading);
  const isInitialized = useTransactionsStore((state) => state.isInitialized);
  const error = useTransactionsStore((state) => state.error);

  const loadTransactions = useTransactionsStore(
    (state) => state.loadTransactions,
  );

  const [tone, setTone] = useState<ShameCardTone>('harsh');

  useTransactionsRefresh({ isInitialized, loadTransactions });

  const analytics = calculateAnalytics(transactions);
  const hasTransactions = transactions.length > 0;
  const hasLeaks = analytics.totalLeaks > 0;
  const shameCardContent = generateShameCardContent(analytics, tone);

  if (!isInitialized) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centeredState}>
          <Text style={styles.stateTitle}>Loading shame card...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error && !hasTransactions) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.stateContent}>
          <View style={styles.centeredState}>
            <Text style={styles.stateTitle}>Couldn&apos;t load shame card</Text>
            <Text style={styles.stateMessage}>{error}</Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Shame Card</Text>

          <Text style={styles.subtitle}>
            A private preview of what your leaks are saying.
          </Text>
        </View>

        {isLoading ? (
          <Text style={styles.refreshingText}>Refreshing shame card...</Text>
        ) : null}

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {!hasTransactions ? (
          <View style={styles.emptyState}>
            <Text style={styles.stateTitle}>No transactions yet</Text>

            <Text style={styles.stateMessage}>
              Add a few expenses first. The shame card only uses real
              transaction data.
            </Text>
          </View>
        ) : null}

        {hasTransactions && !hasLeaks ? (
          <View style={styles.previewCard}>
            <Text style={styles.previewTitle}>No leaks yet</Text>

            <Text style={styles.previewLine}>
              You have transactions, but none are marked as leaks. Nothing to
              shame here yet.
            </Text>
          </View>
        ) : null}

        {hasLeaks ? (
          <>
            <View style={styles.toneSection}>
              <Text style={styles.label}>Tone</Text>

              <View style={styles.toneList}>
                {toneOptions.map((option) => {
                  const isSelected = tone === option.value;

                  return (
                    <Pressable
                      key={option.value}
                      accessibilityRole="button"
                      onPress={() => setTone(option.value)}
                      style={[
                        styles.toneChip,
                        isSelected ? styles.toneChipSelected : null,
                      ]}
                    >
                      <Text
                        style={[
                          styles.toneChipText,
                          isSelected ? styles.toneChipTextSelected : null,
                        ]}
                      >
                        {option.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={styles.previewCard}>
              <Text style={styles.previewEyebrow}>Preview</Text>
              <Text style={styles.previewTitle}>{shameCardContent.title}</Text>

              <View style={styles.previewLines}>
                <Text style={styles.previewLine}>
                  {shameCardContent.totalLeaksLine}
                </Text>

                {shameCardContent.topCategoryLine ? (
                  <Text style={styles.previewLine}>
                    {shameCardContent.topCategoryLine}
                  </Text>
                ) : null}

                {shameCardContent.peakTimeLine ? (
                  <Text style={styles.previewLine}>
                    {shameCardContent.peakTimeLine}
                  </Text>
                ) : null}
              </View>

              <Text style={styles.verdict}>{shameCardContent.verdict}</Text>
            </View>
          </>
        ) : null}
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
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 32,
    gap: 20,
  },
  stateContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  centeredState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
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
  stateTitle: {
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    color: '#111827',
  },
  stateMessage: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    color: '#4b5563',
  },
  refreshingText: {
    fontSize: 14,
    color: '#6b7280',
  },
  errorBox: {
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 12,
    backgroundColor: '#fef2f2',
    padding: 14,
  },
  errorText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#b91c1c',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingVertical: 24,
  },
  toneSection: {
    gap: 10,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  toneList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  toneChip: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 999,
    backgroundColor: '#ffffff',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  toneChipSelected: {
    borderColor: '#111827',
    backgroundColor: '#111827',
  },
  toneChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  toneChipTextSelected: {
    color: '#ffffff',
  },
  previewCard: {
    borderWidth: 1,
    borderColor: '#111827',
    borderRadius: 16,
    backgroundColor: '#ffffff',
    padding: 20,
    gap: 16,
  },
  previewEyebrow: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6b7280',
    textTransform: 'uppercase',
  },
  previewTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#111827',
  },
  previewLines: {
    gap: 10,
  },
  previewLine: {
    fontSize: 16,
    lineHeight: 24,
    color: '#374151',
  },
  verdict: {
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingTop: 16,
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '700',
    color: '#111827',
  },
});
