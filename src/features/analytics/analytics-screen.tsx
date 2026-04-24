import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { calculateAlternativeReality } from '@/features/alternative-reality/calculate-alternative-reality';
import { calculateAnalytics } from '@/features/analytics/calculate-analytics';
import { PeriodSelector } from '@/components/period-selector';
import {
  formatEuro,
  formatHour,
  formatLabel,
  formatPercentage,
} from '@/lib/display-formatters';
import { filterTransactionsByPeriod, getPeriodLabel } from '@/lib/period-scope';
import { useTransactionsRefresh } from '@/lib/use-transactions-refresh';
import { usePeriodScopeStore } from '@/store/period-scope-store';
import { useTransactionsStore } from '@/store/transactions-store';

type MetricCardProps = {
  label: string;
  value: string;
  detail?: string;
};

function formatPeakHour(hour: number) {
  return formatHour(hour) ?? 'Not enough leak data yet';
}

function MetricCard({ label, value, detail }: MetricCardProps) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
      {detail ? <Text style={styles.metricDetail}>{detail}</Text> : null}
    </View>
  );
}

export function AnalyticsScreen() {
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

  useTransactionsRefresh({ isInitialized, loadTransactions });

  const analytics = calculateAnalytics(filteredTransactions);
  const alternativeReality = calculateAlternativeReality(analytics.totalLeaks);
  const hasTransactions = filteredTransactions.length > 0;
  const hasAnyTransactions = transactions.length > 0;
  const hasLeaks = analytics.totalLeaks > 0;

  if (!isInitialized) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centeredState}>
          <Text style={styles.stateTitle}>Loading analytics</Text>

          <Text style={styles.stateMessage}>
            Checking your current leak patterns.
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
            <Text style={styles.stateTitle}>Couldn&apos;t load analytics</Text>
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
          <Text style={styles.title}>Analytics</Text>

          <Text style={styles.subtitle}>
            Simple signals about where your money leaks are showing up.
          </Text>
        </View>

        <PeriodSelector
          label="Period"
          selectedPeriod={selectedPeriod}
          onSelectPeriod={setSelectedPeriod}
        />

        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Total spent</Text>

            <Text style={styles.summaryValue}>
              {formatEuro(analytics.totalSpent)}
            </Text>
          </View>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Total leaks</Text>

            <Text style={styles.summaryValue}>
              {formatEuro(analytics.totalLeaks)}
            </Text>
          </View>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Leak percentage</Text>

            <Text style={styles.summaryValue}>
              {formatPercentage(analytics.leakPercentage)}
            </Text>
          </View>
        </View>

        {isLoading ? (
          <Text style={styles.refreshingText}>Refreshing analytics...</Text>
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
                ? `You have saved expenses, but none fall in ${selectedPeriodLabel.toLowerCase()}. Switch periods or add a new expense to see more here.`
                : 'Add an expense first. Leak patterns will show up once there is something real to compare.'}
            </Text>
          </View>
        ) : null}

        {hasTransactions && !hasLeaks ? (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>No leaks yet</Text>

            <Text style={styles.sectionMessage}>
              {selectedPeriod === 'all_time'
                ? 'You have expenses, but none are marked as leaks yet. Once you add one, this screen will show the strongest patterns.'
                : `You have expenses in ${selectedPeriodLabel.toLowerCase()}, but none are marked as leaks yet. Once you add one, this screen will show the strongest patterns.`}
            </Text>
          </View>
        ) : null}

        {hasLeaks ? (
          <>
            <View style={styles.metricsGrid}>
              <MetricCard
                label="Top leak category"
                value={
                  analytics.topLeakCategory
                    ? formatLabel(analytics.topLeakCategory.category)
                    : 'Not enough leak data yet'
                }
                detail={
                  analytics.topLeakCategory
                    ? `${formatEuro(
                        analytics.topLeakCategory.totalLeaks,
                      )} across ${analytics.topLeakCategory.count} leak${
                        analytics.topLeakCategory.count === 1 ? '' : 's'
                      }`
                    : undefined
                }
              />

              <MetricCard
                label="Top leak reason"
                value={
                  analytics.topLeakReason
                    ? formatLabel(analytics.topLeakReason.leakReason)
                    : 'Not enough leak data yet'
                }
                detail={
                  analytics.topLeakReason
                    ? `${analytics.topLeakReason.count} leak${
                        analytics.topLeakReason.count === 1 ? '' : 's'
                      }`
                    : undefined
                }
              />

              <MetricCard
                label="Peak leak weekday"
                value={
                  analytics.peakLeakWeekday
                    ? analytics.peakLeakWeekday.weekday
                    : 'Not enough leak data yet'
                }
                detail={
                  analytics.peakLeakWeekday
                    ? `${analytics.peakLeakWeekday.count} leak${
                        analytics.peakLeakWeekday.count === 1 ? '' : 's'
                      }`
                    : undefined
                }
              />

              <MetricCard
                label="Peak leak hour"
                value={
                  analytics.peakLeakHour
                    ? formatPeakHour(analytics.peakLeakHour.hour)
                    : 'Not enough leak data yet'
                }
                detail={
                  analytics.peakLeakHour
                    ? `${analytics.peakLeakHour.count} leak${
                        analytics.peakLeakHour.count === 1 ? '' : 's'
                      }`
                    : undefined
                }
              />
            </View>

            {alternativeReality.items.length > 0 ? (
              <View style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>Alternative reality</Text>

                <View style={styles.alternativeRealityList}>
                  {alternativeReality.items.map((item) => (
                    <View key={item.id} style={styles.alternativeRealityItem}>
                      <Text style={styles.alternativeRealityText}>
                        {`${item.count} ${item.label}`}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Insights</Text>

              {analytics.insights.length > 0 ? (
                <View style={styles.insightsList}>
                  {analytics.insights.map((insight) => (
                    <Text key={insight} style={styles.insightText}>
                      {insight}
                    </Text>
                  ))}
                </View>
              ) : (
                <Text style={styles.sectionMessage}>
                  Add a few more leaks to make the patterns clearer.
                </Text>
              )}
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
  summaryCard: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 16,
    backgroundColor: '#ffffff',
    padding: 16,
    gap: 14,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  summaryLabel: {
    flex: 1,
    fontSize: 15,
    color: '#4b5563',
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
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
  metricsGrid: {
    gap: 12,
  },
  metricCard: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 16,
    backgroundColor: '#ffffff',
    padding: 16,
    gap: 8,
  },
  metricLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  metricValue: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
  },
  metricDetail: {
    fontSize: 14,
    lineHeight: 20,
    color: '#4b5563',
  },
  alternativeRealityList: {
    gap: 10,
  },
  alternativeRealityItem: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    backgroundColor: '#ffffff',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  alternativeRealityText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  insightsList: {
    gap: 8,
  },
  insightText: {
    fontSize: 15,
    lineHeight: 22,
    color: '#374151',
  },
});
