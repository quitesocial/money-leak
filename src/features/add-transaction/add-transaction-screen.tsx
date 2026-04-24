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

import { formatLabel } from '@/lib/display-formatters';
import { useTransactionsStore } from '@/store/transactions-store';
import {
  LEAK_REASONS,
  TRANSACTION_CATEGORIES,
  type LeakReason,
  type Transaction,
  type TransactionCategory,
} from '@/types/transaction';

type ValidationErrors = {
  amount: string | null;
  category: string | null;
  leakReason: string | null;
};

const transactionCategorySet = new Set<string>(TRANSACTION_CATEGORIES);
const leakReasonSet = new Set<string>(LEAK_REASONS);

function validateTransactionForm(
  amountText: string,
  selectedCategory: TransactionCategory | null,
  isLeak: boolean,
  selectedLeakReason: LeakReason | null,
) {
  const errors: ValidationErrors = {
    amount: null,
    category: null,
    leakReason: null,
  };

  const trimmedAmount = amountText.trim();

  let parsedAmount: number | null = null;

  if (!trimmedAmount) {
    errors.amount = 'Enter an amount.';
  } else {
    const amount = Number(trimmedAmount);

    if (!Number.isFinite(amount)) {
      errors.amount = 'Use a number like 12.50.';
    } else if (amount <= 0) {
      errors.amount = 'Amount must be greater than 0.';
    } else {
      parsedAmount = amount;
    }
  }

  if (!selectedCategory || !transactionCategorySet.has(selectedCategory)) {
    errors.category = 'Choose a category.';
  }

  if (
    isLeak &&
    (!selectedLeakReason || !leakReasonSet.has(selectedLeakReason))
  ) {
    errors.leakReason = 'Choose why this felt like a leak.';
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
  const [isLeak, setIsLeak] = useState(false);
  const [selectedLeakReason, setSelectedLeakReason] =
    useState<LeakReason | null>(null);
  const [noteText, setNoteText] = useState('');
  const [amountError, setAmountError] = useState<string | null>(null);
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [leakReasonError, setLeakReasonError] = useState<string | null>(null);

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

  function handleLeakTypePress(nextIsLeak: boolean) {
    setIsLeak(nextIsLeak);

    if (!nextIsLeak) {
      setSelectedLeakReason(null);
      setNoteText('');
      setLeakReasonError(null);
    }
  }

  function handleLeakReasonPress(reason: LeakReason) {
    setSelectedLeakReason(reason);

    if (leakReasonError) {
      setLeakReasonError(null);
    }
  }

  async function handleSubmit() {
    if (isLoading) return;

    clearError();

    const { errors, parsedAmount } = validateTransactionForm(
      amountText,
      selectedCategory,
      isLeak,
      selectedLeakReason,
    );

    setAmountError(errors.amount);
    setCategoryError(errors.category);
    setLeakReasonError(errors.leakReason);

    if (
      errors.amount ||
      errors.category ||
      errors.leakReason ||
      parsedAmount === null
    ) {
      return;
    }

    const category = selectedCategory;

    if (!category || !transactionCategorySet.has(category)) return;

    const trimmedNote = noteText.trim();

    const transaction: Transaction = {
      id: generateTransactionId(),
      amount: parsedAmount,
      category,
      isLeak,
      leakReason: isLeak ? selectedLeakReason : null,
      note: isLeak ? trimmedNote || null : null,
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

        <View style={styles.form}>
          <View style={styles.field}>
            <Text style={styles.label}>Amount</Text>

            <TextInput
              value={amountText}
              onChangeText={handleAmountChange}
              placeholder="12.50"
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
                      {formatLabel(category)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {categoryError ? (
              <Text style={styles.fieldError}>{categoryError}</Text>
            ) : null}
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Type</Text>

            <View style={styles.categoryList}>
              <Pressable
                onPress={() => handleLeakTypePress(false)}
                style={[
                  styles.categoryChip,
                  !isLeak ? styles.categoryChipSelected : null,
                ]}
              >
                <Text
                  style={[
                    styles.categoryChipText,
                    !isLeak ? styles.categoryChipTextSelected : null,
                  ]}
                >
                  Normal
                </Text>
              </Pressable>

              <Pressable
                onPress={() => handleLeakTypePress(true)}
                style={[
                  styles.categoryChip,
                  isLeak ? styles.categoryChipSelected : null,
                ]}
              >
                <Text
                  style={[
                    styles.categoryChipText,
                    isLeak ? styles.categoryChipTextSelected : null,
                  ]}
                >
                  Leak
                </Text>
              </Pressable>
            </View>
          </View>

          {isLeak ? (
            <>
              <View style={styles.field}>
                <Text style={styles.label}>Leak reason</Text>

                <View style={styles.categoryList}>
                  {LEAK_REASONS.map((reason) => {
                    const isSelected = selectedLeakReason === reason;

                    return (
                      <Pressable
                        key={reason}
                        onPress={() => handleLeakReasonPress(reason)}
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
                          {formatLabel(reason)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                {leakReasonError ? (
                  <Text style={styles.fieldError}>{leakReasonError}</Text>
                ) : null}
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Note (optional)</Text>

                <TextInput
                  value={noteText}
                  onChangeText={setNoteText}
                  placeholder="What triggered it?"
                  multiline
                  textAlignVertical="top"
                  style={[styles.input, styles.noteInput]}
                />
              </View>
            </>
          ) : null}

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
  form: {
    gap: 20,
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
  noteInput: {
    minHeight: 112,
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
  },
  categoryChipTextSelected: {
    color: '#ffffff',
  },
  fieldError: {
    fontSize: 13,
    lineHeight: 18,
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
