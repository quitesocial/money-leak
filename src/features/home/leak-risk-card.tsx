import { StyleSheet, Text, View } from 'react-native';

import { calculateLeakRisk } from '@/features/home/calculate-leak-risk';
import { formatLabel } from '@/lib/display-formatters';
import type { Transaction } from '@/types/transaction';

type LeakRiskCardProps = {
  transactions: Transaction[];
};

type DetailRowProps = {
  label: string;
  value: string;
};

function DetailRow({ label, value }: DetailRowProps) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

function getCardCopy(
  riskLevel: ReturnType<typeof calculateLeakRisk>['riskLevel'],
) {
  switch (riskLevel) {
    case 'low':
      return {
        stateTitle: 'Low risk',
        body: 'No strong leak pattern for today yet.',
      };
    case 'medium':
      return {
        stateTitle: 'Medium risk',
        body: "You've leaked on this weekday before.",
      };
    case 'high':
      return {
        stateTitle: 'High risk',
        body: 'This weekday is a repeat leak pattern.',
      };
    default:
      return {
        stateTitle: 'Not enough leak history yet.',
        body: 'Log a few more leaks to see your risky patterns.',
      };
  }
}

export function LeakRiskCard({ transactions }: LeakRiskCardProps) {
  const summary = calculateLeakRisk(transactions);
  const copy = getCardCopy(summary.riskLevel);
  const showHighRiskDetails = summary.riskLevel === 'high';
  
  const mediumRiskWindowCopy =
    summary.riskLevel === 'medium' && summary.suggestedWindow
      ? `Most risky window: ${summary.suggestedWindow}`
      : null;

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Leak risk today</Text>
      <Text style={styles.stateTitle}>{copy.stateTitle}</Text>
      <Text style={styles.body}>{copy.body}</Text>

      {mediumRiskWindowCopy ? (
        <Text style={styles.supportingCopy}>{mediumRiskWindowCopy}</Text>
      ) : null}

      {showHighRiskDetails ? (
        <View style={styles.details}>
          {summary.topCategory ? (
            <DetailRow
              label="Top category"
              value={formatLabel(summary.topCategory)}
            />
          ) : null}

          {summary.topReason ? (
            <DetailRow
              label="Top reason"
              value={formatLabel(summary.topReason)}
            />
          ) : null}

          {summary.suggestedWindow ? (
            <DetailRow label="Risk window" value={summary.suggestedWindow} />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: '#fed7aa',
    borderRadius: 16,
    backgroundColor: '#fffaf3',
    padding: 16,
    gap: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  stateTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#9a3412',
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    color: '#4b5563',
  },
  supportingCopy: {
    fontSize: 14,
    lineHeight: 20,
    color: '#6b7280',
  },
  details: {
    gap: 10,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  detailLabel: {
    flex: 1,
    fontSize: 14,
    color: '#6b7280',
  },
  detailValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
});
