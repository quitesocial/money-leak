import { useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';

import {
  TransactionForm,
  type TransactionFormSubmissionValues,
} from '@/features/transaction-form/transaction-form';
import { useTransactionsStore } from '@/store/transactions-store';

function getTransactionId(value: string | string[] | undefined) {
  if (typeof value !== 'string') return null;

  const trimmedValue = value.trim();

  return trimmedValue ? trimmedValue : null;
}

type StateScreenProps = {
  title: string;
  message: string;
  actionLabel: string;
  onActionPress: () => void;
};

function StateScreen({
  title,
  message,
  actionLabel,
  onActionPress,
}: StateScreenProps) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.stateContent}>
        <View style={styles.centeredState}>
          <Text style={styles.stateTitle}>{title}</Text>
          <Text style={styles.stateMessage}>{message}</Text>

          <Pressable onPress={onActionPress} style={styles.primaryAction}>
            <Text style={styles.primaryActionText}>{actionLabel}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

export function EditTransactionScreen() {
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  const transactionId = getTransactionId(id);
  const router = useRouter();

  const transactions = useTransactionsStore((state) => state.transactions);
  const isLoading = useTransactionsStore((state) => state.isLoading);
  const isInitialized = useTransactionsStore((state) => state.isInitialized);
  const error = useTransactionsStore((state) => state.error);

  const loadTransactions = useTransactionsStore(
    (state) => state.loadTransactions,
  );

  const updateTransaction = useTransactionsStore(
    (state) => state.updateTransaction,
  );

  const clearError = useTransactionsStore((state) => state.clearError);

  useEffect(() => {
    if (!transactionId || isInitialized) return;

    void loadTransactions();
  }, [transactionId, isInitialized, loadTransactions]);

  const transaction = transactionId
    ? transactions.find(
        (currentTransaction) => currentTransaction.id === transactionId,
      )
    : null;

  async function handleSubmit(values: TransactionFormSubmissionValues) {
    if (!transaction) return;

    await updateTransaction({
      ...transaction,
      amount: values.amount,
      category: values.category,
      isLeak: values.isLeak,
      leakReason: values.leakReason,
      note: values.note,
    });

    if (!useTransactionsStore.getState().error) {
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/(tabs)');
      }
    }
  }

  if (!transactionId) {
    return (
      <StateScreen
        title="Transaction not found"
        message="This transaction link is invalid or the expense no longer exists."
        actionLabel="Go Home"
        onActionPress={() => router.replace('/(tabs)')}
      />
    );
  }

  if (!isInitialized) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centeredState}>
          <Text style={styles.stateTitle}>Loading transaction</Text>

          <Text style={styles.stateMessage}>
            Pulling the latest saved details before you edit.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!transaction) {
    if (error) {
      return (
        <StateScreen
          title={"Couldn't load transaction"}
          message={error}
          actionLabel="Go Home"
          onActionPress={() => router.replace('/(tabs)')}
        />
      );
    }

    return (
      <StateScreen
        title="Transaction not found"
        message="This expense may have been deleted, or the link points to a transaction that does not exist."
        actionLabel="Go Home"
        onActionPress={() => router.replace('/(tabs)')}
      />
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={styles.title}>Edit Transaction</Text>

          <Text style={styles.subtitle}>
            Update the amount, category, and leak details without changing when
            the expense originally happened.
          </Text>
        </View>

        <TransactionForm
          initialValues={{
            amount: transaction.amount,
            category: transaction.category,
            isLeak: transaction.isLeak,
            leakReason: transaction.leakReason,
            note: transaction.note,
          }}
          submitLabel="Save Changes"
          isLoading={isLoading}
          error={error}
          clearError={clearError}
          onSubmit={handleSubmit}
        />
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
    paddingTop: 24,
    paddingBottom: 32,
    gap: 24,
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
});
