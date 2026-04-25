import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { calculateDailyReviewSummary } from '@/features/home/calculate-daily-review-summary';
import {
  formatEuro,
  formatLabel,
  formatPercentage,
} from '@/lib/display-formatters';
import type { Transaction } from '@/types/transaction';

type DailyReviewCardProps = {
  transactions: Transaction[];
};

type SummaryRowProps = {
  label: string;
  value: string;
};

function SummaryRow({ label, value }: SummaryRowProps) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

export function DailyReviewCard({ transactions }: DailyReviewCardProps) {
  const summary = calculateDailyReviewSummary({ transactions });
  const hasTransactionsToday = summary.transactionCount > 0;
  const hasLeaksToday = summary.topLeakCategory !== null;

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Today check-in</Text>

      <View style={styles.summaryCard}>
        <SummaryRow
          label="Total today"
          value={formatEuro(summary.totalSpent)}
        />

        <SummaryRow
          label="Leaks today"
          value={formatEuro(summary.totalLeaks)}
        />

        <SummaryRow
          label="Leak %"
          value={formatPercentage(summary.leakPercentage)}
        />

        {summary.topLeakCategory ? (
          <SummaryRow
            label="Top leak category"
            value={formatLabel(summary.topLeakCategory.category)}
          />
        ) : null}
      </View>

      {!hasTransactionsToday ? (
        <View style={styles.footer}>
          <Text style={styles.message}>No expenses logged today yet.</Text>

          <Link href="/(tabs)/add-transaction" asChild>
            <Pressable style={styles.actionButton}>
              <Text style={styles.actionButtonText}>
                Add today&apos;s first expense
              </Text>
            </Pressable>
          </Link>
        </View>
      ) : (
        <View style={styles.footer}>
          <Text style={styles.message}>
            {hasLeaksToday
              ? "Review today's leaks"
              : 'No leaks today. Clean day so far.'}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  summaryCard: {
    borderWidth: 1,
    borderColor: '#fde68a',
    borderRadius: 16,
    backgroundColor: '#fffdf5',
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
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  footer: {
    gap: 12,
  },
  message: {
    fontSize: 15,
    lineHeight: 22,
    color: '#4b5563',
  },
  actionButton: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: '#111827',
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  actionButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
  },
});
