import { useEffect, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { useTransactionsStore } from '@/store/transactions-store';
import {
  TRANSACTION_CATEGORIES,
  type Transaction,
  type TransactionCategory,
} from '@/types/transaction';

type ValidationErrors = {
  amount: string | null;
  category: string | null;
};

const transactionCategorySet = new Set<string>(TRANSACTION_CATEGORIES);

function validateTransactionForm(
  amountText: string,
  selectedCategory: TransactionCategory | null,
) {
  const errors: ValidationErrors = {
    amount: null,
    category: null,
  };

  const trimmedAmount = amountText.trim();
  
  let parsedAmount: number | null = null;

  if (!trimmedAmount) {
    errors.amount = 'Amount is required.';
  } else {
    const amount = Number(trimmedAmount);

    if (!Number.isFinite(amount)) {
      errors.amount = 'Amount must be a valid number.';
    } else if (amount <= 0) {
      errors.amount = 'Amount must be greater than 0.';
    } else {
      parsedAmount = amount;
    }
  }

  if (!selectedCategory || !transactionCategorySet.has(selectedCategory)) {
    errors.category = 'Select a category.';
  }

  return { errors, parsedAmount };
}

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

  const [amountText, setAmountText] = useState('');
  const [selectedCategory, setSelectedCategory] =
    useState<TransactionCategory | null>(null);
  const [amountError, setAmountError] = useState<string | null>(null);
  const [categoryError, setCategoryError] = useState<string | null>(null);

  useEffect(() => {
    clearError();
  }, [clearError]);

  function handleAmountChange(value: string) {
    setAmountText(value);

    if (amountError) {
      setAmountError(null);
    }
  }

  function handleCategoryPress(category: TransactionCategory) {
    setSelectedCategory(category);

    if (categoryError) {
      setCategoryError(null);
    }
  }

  async function handleSubmit() {
    if (isLoading) return;

    clearError();

    const { errors, parsedAmount } = validateTransactionForm(
      amountText,
      selectedCategory,
    );

    setAmountError(errors.amount);
    setCategoryError(errors.category);

    if (errors.amount || errors.category || parsedAmount === null) return;

    const category = selectedCategory;

    if (!category || !transactionCategorySet.has(category)) return;

    const transaction: Transaction = {
      id: generateTransactionId(),
      amount: parsedAmount,
      category,
      isLeak: false,
      leakReason: null,
      note: null,
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
            Save a normal expense with an amount and category.
          </Text>
        </View>

        <View style={styles.form}>
          <View style={styles.field}>
            <Text style={styles.label}>Amount</Text>
            
            <TextInput
              value={amountText}
              onChangeText={handleAmountChange}
              placeholder="0.00"
              keyboardType="decimal-pad"
              autoCapitalize="none"
              autoCorrect={false}
              style={[styles.input, amountError ? styles.inputError : null]}
            />
            
            {amountError ? (
              <Text style={styles.fieldError}>{amountError}</Text>
            ) : null}
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Category</Text>
            
            <View style={styles.categoryList}>
              {TRANSACTION_CATEGORIES.map((category) => {
                const isSelected = selectedCategory === category;

                return (
                  <Pressable
                    key={category}
                    onPress={() => handleCategoryPress(category)}
                    style={[
                      styles.categoryChip,
                      isSelected ? styles.categoryChipSelected : null,
                    ]}
                  >
                    <Text
                      style={[
                        styles.categoryChipText,
                        isSelected ? styles.categoryChipTextSelected : null,
                      ]}
                    >
                      {category}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            
            {categoryError ? (
              <Text style={styles.fieldError}>{categoryError}</Text>
            ) : null}
          </View>

          {storeError ? (
            <View style={styles.storeErrorBox}>
              <Text style={styles.storeErrorText}>{storeError}</Text>
            </View>
          ) : null}

          <Pressable
            onPress={handleSubmit}
            disabled={isLoading}
            style={[
              styles.submitButton,
              isLoading ? styles.submitButtonDisabled : null,
            ]}
          >
            <Text style={styles.submitButtonText}>
              {isLoading ? 'Saving...' : 'Save Transaction'}
            </Text>
          </Pressable>
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
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 32,
  },
  header: {
    gap: 8,
    marginBottom: 32,
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
  form: {
    gap: 24,
  },
  field: {
    gap: 10,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 18,
    color: '#111827',
  },
  inputError: {
    borderColor: '#dc2626',
  },
  categoryList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  categoryChip: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 999,
    backgroundColor: '#ffffff',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  categoryChipSelected: {
    borderColor: '#111827',
    backgroundColor: '#111827',
  },
  categoryChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    textTransform: 'capitalize',
  },
  categoryChipTextSelected: {
    color: '#ffffff',
  },
  fieldError: {
    fontSize: 13,
    color: '#dc2626',
  },
  storeErrorBox: {
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 12,
    backgroundColor: '#fef2f2',
    padding: 14,
  },
  storeErrorText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#b91c1c',
  },
  submitButton: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: '#111827',
    paddingVertical: 16,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
});
