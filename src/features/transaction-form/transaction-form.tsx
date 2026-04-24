import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { formatLabel } from '@/lib/display-formatters';
import {
  LEAK_REASONS,
  TRANSACTION_CATEGORIES,
  type LeakReason,
  type TransactionCategory,
} from '@/types/transaction';

type ValidationErrors = {
  amount: string | null;
  category: string | null;
  leakReason: string | null;
};

export type TransactionFormInitialValues = {
  amount: number | null;
  category: TransactionCategory | null;
  isLeak: boolean;
  leakReason: LeakReason | null;
  note: string | null;
};

export type TransactionFormSubmissionValues = {
  amount: number;
  category: TransactionCategory;
  isLeak: boolean;
  leakReason: LeakReason | null;
  note: string | null;
};

type TransactionFormProps = {
  initialValues: TransactionFormInitialValues;
  submitLabel: string;
  isLoading: boolean;
  error: string | null;
  clearError: () => void;
  onSubmit: (values: TransactionFormSubmissionValues) => Promise<void> | void;
};

const transactionCategorySet = new Set<string>(TRANSACTION_CATEGORIES);
const leakReasonSet = new Set<string>(LEAK_REASONS);

interface ValidateTransactionFormArgs {
  amountText: string;
  selectedCategory: TransactionCategory | null;
  isLeak: boolean;
  selectedLeakReason: LeakReason | null;
}

function validateTransactionForm({
  amountText,
  selectedCategory,
  isLeak,
  selectedLeakReason,
}: ValidateTransactionFormArgs) {
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

function getAmountText(amount: number | null) {
  if (typeof amount !== 'number' || !Number.isFinite(amount)) return '';

  return String(amount);
}

export function TransactionForm({
  initialValues,
  submitLabel,
  isLoading,
  error,
  clearError,
  onSubmit,
}: TransactionFormProps) {
  const [amountText, setAmountText] = useState(
    getAmountText(initialValues.amount),
  );

  const [selectedCategory, setSelectedCategory] =
    useState<TransactionCategory | null>(initialValues.category);

  const [isLeak, setIsLeak] = useState(initialValues.isLeak);

  const [selectedLeakReason, setSelectedLeakReason] =
    useState<LeakReason | null>(initialValues.leakReason);

  const [noteText, setNoteText] = useState(initialValues.note ?? '');
  const [amountError, setAmountError] = useState<string | null>(null);
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [leakReasonError, setLeakReasonError] = useState<string | null>(null);

  useEffect(() => {
    clearError();
  }, [clearError]);

  useEffect(() => {
    setAmountText(getAmountText(initialValues.amount));
    setSelectedCategory(initialValues.category);
    setIsLeak(initialValues.isLeak);
    setSelectedLeakReason(initialValues.leakReason);
    setNoteText(initialValues.note ?? '');
    setAmountError(null);
    setCategoryError(null);
    setLeakReasonError(null);
  }, [
    initialValues.amount,
    initialValues.category,
    initialValues.isLeak,
    initialValues.leakReason,
    initialValues.note,
  ]);

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

    const { errors, parsedAmount } = validateTransactionForm({
      amountText,
      selectedCategory,
      isLeak,
      selectedLeakReason,
    });

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

    await onSubmit({
      amount: parsedAmount,
      category,
      isLeak,
      leakReason: isLeak ? selectedLeakReason : null,
      note: isLeak ? trimmedNote || null : null,
    });
  }

  return (
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

        <View style={styles.chipList}>
          {TRANSACTION_CATEGORIES.map((category) => {
            const isSelected = selectedCategory === category;

            return (
              <Pressable
                key={category}
                onPress={() => handleCategoryPress(category)}
                style={[styles.chip, isSelected ? styles.chipSelected : null]}
              >
                <Text
                  style={[
                    styles.chipText,
                    isSelected ? styles.chipTextSelected : null,
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

        <View style={styles.chipList}>
          <Pressable
            onPress={() => handleLeakTypePress(false)}
            style={[styles.chip, !isLeak ? styles.chipSelected : null]}
          >
            <Text
              style={[
                styles.chipText,
                !isLeak ? styles.chipTextSelected : null,
              ]}
            >
              Normal
            </Text>
          </Pressable>

          <Pressable
            onPress={() => handleLeakTypePress(true)}
            style={[styles.chip, isLeak ? styles.chipSelected : null]}
          >
            <Text
              style={[styles.chipText, isLeak ? styles.chipTextSelected : null]}
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

            <View style={styles.chipList}>
              {LEAK_REASONS.map((reason) => {
                const isSelected = selectedLeakReason === reason;

                return (
                  <Pressable
                    key={reason}
                    onPress={() => handleLeakReasonPress(reason)}
                    style={[
                      styles.chip,
                      isSelected ? styles.chipSelected : null,
                    ]}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        isSelected ? styles.chipTextSelected : null,
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

      {error ? (
        <View style={styles.storeErrorBox}>
          <Text style={styles.storeErrorText}>{error}</Text>
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
          {isLoading ? 'Saving...' : submitLabel}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
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
  chipList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  chip: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 999,
    backgroundColor: '#ffffff',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  chipSelected: {
    borderColor: '#111827',
    backgroundColor: '#111827',
  },
  chipText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  chipTextSelected: {
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
