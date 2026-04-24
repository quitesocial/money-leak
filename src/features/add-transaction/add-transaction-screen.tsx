import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import {
  TransactionForm,
  type TransactionFormSubmissionValues,
} from '@/features/transaction-form/transaction-form';
import { useTransactionsStore } from '@/store/transactions-store';
import type { Transaction } from '@/types/transaction';

function generateTransactionId() {
  const uuid = globalThis.crypto?.randomUUID?.();

  if (uuid) return uuid;

  return `transaction-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function AddTransactionScreen() {
  const router = useRouter();
  const addTransaction = useTransactionsStore((state) => state.addTransaction);
  const clearError = useTransactionsStore((state) => state.clearError);
  const isLoading = useTransactionsStore((state) => state.isLoading);
  const storeError = useTransactionsStore((state) => state.error);

  async function handleSubmit(values: TransactionFormSubmissionValues) {
    const transaction: Transaction = {
      id: generateTransactionId(),
      amount: values.amount,
      category: values.category,
      isLeak: values.isLeak,
      leakReason: values.leakReason,
      note: values.note,
      createdAt: Date.now(),
    };

    await addTransaction(transaction);

    if (!useTransactionsStore.getState().error) {
      router.replace('/(tabs)');
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={styles.title}>Add Transaction</Text>

          <Text style={styles.subtitle}>
            Save the expense, then mark it as normal or a money leak.
          </Text>
        </View>

        <TransactionForm
          initialValues={{
            amount: null,
            category: null,
            isLeak: false,
            leakReason: null,
            note: null,
          }}
          submitLabel="Save Transaction"
          isLoading={isLoading}
          error={storeError}
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
});
