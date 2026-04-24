import { useRef, useState } from 'react';
import * as Sharing from 'expo-sharing';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ViewShot from 'react-native-view-shot';

import { calculateAnalytics } from '@/features/analytics/calculate-analytics';
import { PeriodSelector } from '@/components/period-selector';
import {
  generateShameCardContent,
  type ShameCardTone,
} from '@/features/shame-card/generate-shame-card';
import { filterTransactionsByPeriod, getPeriodLabel } from '@/lib/period-scope';
import { useTransactionsRefresh } from '@/lib/use-transactions-refresh';
import { usePeriodScopeStore } from '@/store/period-scope-store';
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

function normalizeFileUri(uri: string) {
  if (uri.startsWith('file://')) return uri;

  return `file://${uri}`;
}

export function ShameCardScreen() {
  const transactions = useTransactionsStore((state) => state.transactions);
  const isLoading = useTransactionsStore((state) => state.isLoading);
  const isInitialized = useTransactionsStore((state) => state.isInitialized);
  const error = useTransactionsStore((state) => state.error);
  const selectedPeriod = usePeriodScopeStore((state) => state.selectedPeriod);

  const setSelectedPeriod = usePeriodScopeStore(
    (state) => state.setSelectedPeriod,
  );

  const filteredTransactions = filterTransactionsByPeriod({
    transactions,
    period: selectedPeriod,
  });

  const selectedPeriodLabel = getPeriodLabel(selectedPeriod);

  const loadTransactions = useTransactionsStore(
    (state) => state.loadTransactions,
  );

  const [tone, setTone] = useState<ShameCardTone>('harsh');
  const [isSharing, setIsSharing] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const shameCardRef = useRef<ViewShot>(null);
  const shareInFlightRef = useRef(false);

  useTransactionsRefresh({ isInitialized, loadTransactions });

  const analytics = calculateAnalytics(filteredTransactions);
  const hasTransactions = filteredTransactions.length > 0;
  const hasAnyTransactions = transactions.length > 0;
  const hasLeaks = analytics.totalLeaks > 0;

  const canShareShameCard =
    isInitialized && !isLoading && !error && hasTransactions && hasLeaks;

  const shameCardContent = generateShameCardContent(analytics, tone);

  async function handleSharePress() {
    if (shareInFlightRef.current || !canShareShameCard) return;

    const cardRef = shameCardRef.current;

    if (!cardRef?.capture) {
      setShareError('Could not share the shame card. Try again.');

      return;
    }

    shareInFlightRef.current = true;
    setIsSharing(true);
    setShareError(null);

    try {
      const isAvailable = await Sharing.isAvailableAsync();

      if (!isAvailable) {
        setShareError('Sharing is not available on this device.');

        return;
      }

      const imageUri = await cardRef.capture();

      await Sharing.shareAsync(normalizeFileUri(imageUri), {
        mimeType: 'image/png',
        UTI: 'public.png',
        dialogTitle: 'Share Shame Card',
      });
    } catch {
      setShareError('Could not share the shame card. Try again.');
    } finally {
      shareInFlightRef.current = false;
      setIsSharing(false);
    }
  }

  if (!isInitialized) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centeredState}>
          <Text style={styles.stateTitle}>Loading shame card</Text>

          <Text style={styles.stateMessage}>
            Building the preview from your latest leaks.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error && !hasAnyTransactions) {
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

        <PeriodSelector
          label="Period"
          selectedPeriod={selectedPeriod}
          onSelectPeriod={setSelectedPeriod}
        />

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
            <Text style={styles.stateTitle}>
              {hasAnyTransactions
                ? `No transactions for ${selectedPeriodLabel}`
                : 'No transactions yet'}
            </Text>

            <Text style={styles.stateMessage}>
              {hasAnyTransactions
                ? `You have saved expenses, but none fall in ${selectedPeriodLabel.toLowerCase()}. Switch periods or add a new expense to generate a card here.`
                : 'Add a few expenses first. The shame card only uses real data from this device.'}
            </Text>
          </View>
        ) : null}

        {hasTransactions && !hasLeaks ? (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>No leaks yet</Text>

            <Text style={styles.sectionMessage}>
              {selectedPeriod === 'all_time'
                ? 'You have expenses, but none are marked as leaks. Mark one as a leak to generate a shame card.'
                : `You have expenses in ${selectedPeriodLabel.toLowerCase()}, but none are marked as leaks. Mark one as a leak to generate a shame card.`}
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

            <ViewShot
              ref={shameCardRef}
              options={{
                format: 'png',
                quality: 1,
                result: 'tmpfile',
              }}
            >
              <View style={styles.previewCard}>
                <View style={styles.previewHeader}>
                  <Text style={styles.previewEyebrow}>Preview</Text>

                  <View style={styles.previewPeriodBadge}>
                    <Text style={styles.previewPeriodText}>
                      {selectedPeriodLabel}
                    </Text>
                  </View>
                </View>

                <Text style={styles.previewTitle}>
                  {shameCardContent.title}
                </Text>

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

                  {shameCardContent.alternativeRealityLine ? (
                    <Text style={styles.previewLine}>
                      {shameCardContent.alternativeRealityLine}
                    </Text>
                  ) : null}
                </View>

                <Text style={styles.verdict}>{shameCardContent.verdict}</Text>
              </View>
            </ViewShot>

            {canShareShameCard ? (
              <View style={styles.shareSection}>
                <Pressable
                  accessibilityRole="button"
                  disabled={isSharing}
                  onPress={handleSharePress}
                  style={[
                    styles.shareButton,
                    isSharing ? styles.shareButtonDisabled : null,
                  ]}
                >
                  <Text style={styles.shareButtonText}>
                    {isSharing ? 'Sharing...' : 'Share'}
                  </Text>
                </Pressable>

                {shareError ? (
                  <Text style={styles.shareErrorText}>{shareError}</Text>
                ) : null}
              </View>
            ) : null}
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
  sectionCard: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 16,
    backgroundColor: '#ffffff',
    padding: 16,
    gap: 10,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  sectionMessage: {
    fontSize: 15,
    lineHeight: 22,
    color: '#4b5563',
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
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  previewEyebrow: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6b7280',
    textTransform: 'uppercase',
  },
  previewPeriodBadge: {
    borderRadius: 999,
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  previewPeriodText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#374151',
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
  shareSection: {
    gap: 8,
  },
  shareButton: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: '#111827',
    paddingVertical: 14,
  },
  shareButtonDisabled: {
    opacity: 0.6,
  },
  shareButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
  },
  shareErrorText: {
    fontSize: 13,
    lineHeight: 18,
    color: '#dc2626',
  },
});
