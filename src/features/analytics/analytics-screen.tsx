import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { calculateAnalytics } from '@/features/analytics/calculate-analytics';
import { useTransactionsStore } from '@/store/transactions-store';

function sanitizeNumber(value: number) {
  return Number.isFinite(value) ? value : 0;
}

function formatCurrency(value: number) {
  return `${sanitizeNumber(value).toFixed(2)}€`;
}

function formatPercentage(value: number) {
  return `${Math.round(sanitizeNumber(value))}%`;
}

function formatHour(hour: number) {
  const safeHour = sanitizeNumber(hour);

  if (safeHour < 0 || safeHour > 23) return 'Not enough leak data yet';

  return `${Math.trunc(safeHour).toString().padStart(2, '0')}:00`;
}

function formatLabel(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

type MetricCardProps = {
  label: string;
  value: string;
  detail?: string;
};

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
  
  const loadTransactions = useTransactionsStore(
    (state) => state.loadTransactions,
  );

  const skipNextFocusRefreshRef = useRef(true);

  useEffect(() => {
    if (isInitialized) return;

    void loadTransactions();
  }, [isInitialized, loadTransactions]);

  useFocusEffect(
    useCallback(() => {
      if (!isInitialized) return;

      if (skipNextFocusRefreshRef.current) {
        skipNextFocusRefreshRef.current = false;

        return;
      }

      void loadTransactions();
    }, [isInitialized, loadTransactions]),
  );

  const analytics = calculateAnalytics(transactions);
  const hasTransactions = transactions.length > 0;
  const hasLeaks = analytics.totalLeaks > 0;

  if (!isInitialized) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centeredState}>
          <Text style={styles.stateTitle}>Loading analytics...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error && !hasTransactions) {
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

        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Total spent</Text>

            <Text style={styles.summaryValue}>
              {formatCurrency(analytics.totalSpent)}
            </Text>
          </View>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Total leaks</Text>

            <Text style={styles.summaryValue}>
              {formatCurrency(analytics.totalLeaks)}
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
            <Text style={styles.stateTitle}>No transactions yet</Text>

            <Text style={styles.stateMessage}>
              Add your first expense to start seeing leak patterns here.
            </Text>
          </View>
        ) : null}

        {hasTransactions && !hasLeaks ? (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>No leaks yet</Text>

            <Text style={styles.sectionMessage}>
              You have transactions, but none are marked as leaks. Once a leak
              is added, this screen will show your strongest patterns.
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
                    ? `${formatCurrency(
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
                    ? formatHour(analytics.peakLeakHour.hour)
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
  insightsList: {
    gap: 8,
  },
  insightText: {
    fontSize: 15,
    lineHeight: 22,
    color: '#374151',
  },
});
