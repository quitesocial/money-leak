import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTransactionsStore } from '@/store/transactions-store';

const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
});

function formatLabel(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
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
  
  const loadTransactions = useTransactionsStore(
    (state) => state.loadTransactions,
  );
  
  const skipNextFocusRefreshRef = useRef(true);

  useEffect(() => {
    void loadTransactions();
  }, [loadTransactions]);

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

  if (!isInitialized) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centeredState}>
          <Text style={styles.stateTitle}>Loading transactions...</Text>
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

  if (transactions.length === 0) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.stateContent}>
          <View style={styles.centeredState}>
            <Text style={styles.stateTitle}>No transactions yet</Text>
            
            <Text style={styles.stateMessage}>
              Add your first expense to start spotting leaks.
            </Text>
            
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
              Your latest transactions, including the leaks worth noticing.
            </Text>
          </View>

          <AddTransactionAction />
        </View>

        {isLoading ? (
          <Text style={styles.refreshingText}>Refreshing transactions...</Text>
        ) : null}

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.transactionList}>
          {transactions.map((transaction) => {
            const isLeak = transaction.isLeak;

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
                      {transaction.amount.toFixed(2)}
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
                  {dateTimeFormatter.format(transaction.createdAt)}
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
              </View>
            );
          })}
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
});
