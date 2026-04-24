import { Link } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { calculateTransactionsSummary } from '@/features/home/calculate-transactions-summary';
import {
  formatEuro,
  formatLabel,
  formatPercentage,
} from '@/lib/display-formatters';
import { useTransactionsRefresh } from '@/lib/use-transactions-refresh';
import { useTransactionsStore } from '@/store/transactions-store';

const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
});

function formatTransactionDate(value: number) {
  if (!Number.isFinite(value)) return 'Unknown date';

  const date = new Date(value);

  if (!Number.isFinite(date.getTime())) return 'Unknown date';

  return dateTimeFormatter.format(date);
}

function AddTransactionAction() {
  return (
    <Link href="/(tabs)/add-transaction" asChild>
      <Pressable style={styles.primaryAction}>
        <Text style={styles.primaryActionText}>Add Transaction</Text>
      </Pressable>
    </Link>
  );
}

export function HomeScreen() {
  const transactions = useTransactionsStore((state) => state.transactions);
  const isLoading = useTransactionsStore((state) => state.isLoading);
  const isInitialized = useTransactionsStore((state) => state.isInitialized);
  const error = useTransactionsStore((state) => state.error);
  const summary = calculateTransactionsSummary(transactions);
  const hasTransactions = transactions.length > 0;

  const [deletingTransactionId, setDeletingTransactionId] = useState<
    string | null
  >(null);

  const loadTransactions = useTransactionsStore(
    (state) => state.loadTransactions,
  );
  const removeTransaction = useTransactionsStore(
    (state) => state.removeTransaction,
  );

  useTransactionsRefresh({
    isInitialized,
    loadTransactions,
    loadOnMount: 'always',
  });

  const handleDeleteTransaction = useCallback(
    (id: string) => {
      if (isLoading || deletingTransactionId) return;

      Alert.alert(
        'Delete transaction?',
        'This will permanently remove this expense from your leak history.',
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () => {
              setDeletingTransactionId(id);

              void removeTransaction(id).finally(() => {
                setDeletingTransactionId(null);
              });
            },
          },
        ],
      );
    },
    [deletingTransactionId, isLoading, removeTransaction],
  );

  if (!isInitialized) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centeredState}>
          <Text style={styles.stateTitle}>Loading transactions</Text>

          <Text style={styles.stateMessage}>
            Getting your latest expenses ready.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error && transactions.length === 0) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.stateContent}>
          <View style={styles.centeredState}>
            <Text style={styles.stateTitle}>
              Couldn&apos;t load transactions
            </Text>

            <Text style={styles.stateMessage}>{error}</Text>
            <AddTransactionAction />
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text style={styles.title}>Home</Text>

            <Text style={styles.subtitle}>
              Your latest expenses, including the leaks worth noticing.
            </Text>
          </View>

          <AddTransactionAction />
        </View>

        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Total spent</Text>

            <Text style={styles.summaryValue}>
              {formatEuro(summary.totalSpent)}
            </Text>
          </View>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Total leaks</Text>

            <Text style={styles.summaryValue}>
              {formatEuro(summary.totalLeaks)}
            </Text>
          </View>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Leak percentage</Text>

            <Text style={styles.summaryValue}>
              {formatPercentage(summary.leakPercentage)}
            </Text>
          </View>
        </View>

        {isLoading ? (
          <Text style={styles.refreshingText}>Refreshing transactions...</Text>
        ) : null}

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {hasTransactions ? (
          <View style={styles.transactionList}>
            {transactions.map((transaction) => {
              const isLeak = transaction.isLeak;

              const isDeletingThisTransaction =
                deletingTransactionId === transaction.id;

              const isDeleteDisabled =
                isLoading || deletingTransactionId !== null;

              return (
                <View
                  key={transaction.id}
                  style={[
                    styles.transactionCard,
                    isLeak
                      ? styles.transactionCardLeak
                      : styles.transactionCardNormal,
                  ]}
                >
                  <View style={styles.transactionHeader}>
                    <View style={styles.transactionSummary}>
                      <Text style={styles.amountText}>
                        {formatEuro(transaction.amount)}
                      </Text>

                      <Text style={styles.categoryText}>
                        {formatLabel(transaction.category)}
                      </Text>
                    </View>

                    <View
                      style={[
                        styles.typeBadge,
                        isLeak ? styles.typeBadgeLeak : styles.typeBadgeNormal,
                      ]}
                    >
                      <Text
                        style={[
                          styles.typeBadgeText,
                          isLeak
                            ? styles.typeBadgeTextLeak
                            : styles.typeBadgeTextNormal,
                        ]}
                      >
                        {isLeak ? 'Leak' : 'Normal'}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.timestampText}>
                    {formatTransactionDate(transaction.createdAt)}
                  </Text>

                  {isLeak && transaction.leakReason ? (
                    <Text style={styles.detailText}>
                      Leak reason: {formatLabel(transaction.leakReason)}
                    </Text>
                  ) : null}

                  {transaction.note ? (
                    <Text style={styles.detailText}>
                      Note: {transaction.note}
                    </Text>
                  ) : null}

                  <View style={styles.actionRow}>
                    <Pressable
                      accessibilityRole="button"
                      disabled={isDeleteDisabled}
                      onPress={() => handleDeleteTransaction(transaction.id)}
                      style={[
                        styles.deleteButton,
                        isDeleteDisabled ? styles.deleteButtonDisabled : null,
                      ]}
                    >
                      <Text style={styles.deleteButtonText}>
                        {isDeletingThisTransaction ? 'Deleting...' : 'Delete'}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.stateTitle}>No transactions yet</Text>

            <Text style={styles.stateMessage}>
              Add your first expense and mark the ones that felt avoidable.
            </Text>

            <AddTransactionAction />
          </View>
        )}
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
    gap: 16,
  },
  headerCopy: {
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
  primaryAction: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: '#111827',
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  primaryActionText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
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
  transactionList: {
    gap: 16,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingVertical: 24,
  },
  transactionCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 10,
  },
  transactionCardNormal: {
    borderColor: '#e5e7eb',
    backgroundColor: '#ffffff',
  },
  transactionCardLeak: {
    borderColor: '#fca5a5',
    backgroundColor: '#fff1f2',
  },
  transactionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  transactionSummary: {
    flex: 1,
    gap: 4,
  },
  amountText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
  },
  categoryText: {
    fontSize: 15,
    color: '#4b5563',
  },
  typeBadge: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  typeBadgeNormal: {
    backgroundColor: '#f3f4f6',
  },
  typeBadgeLeak: {
    backgroundColor: '#fee2e2',
  },
  typeBadgeText: {
    fontSize: 13,
    fontWeight: '700',
  },
  typeBadgeTextNormal: {
    color: '#374151',
  },
  typeBadgeTextLeak: {
    color: '#b91c1c',
  },
  timestampText: {
    fontSize: 13,
    color: '#6b7280',
  },
  detailText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#374151',
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  deleteButton: {
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 999,
    backgroundColor: '#ffffff',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  deleteButtonDisabled: {
    opacity: 0.5,
  },
  deleteButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#b91c1c',
  },
});
