import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { getDefaultCategoryName, getLeakReasonLabel, t } from '@/lib/i18n/i18n';
import type { SupportedLanguage } from '@/lib/i18n/languages';
import { useSettingsLanguage } from '@/lib/use-settings-language';
import { useCategoriesRefresh } from '@/lib/use-categories-refresh';
import { useCategoriesStore } from '@/store/categories-store';
import { OTHER_CATEGORY_ID } from '@/types/category';
import {
  LEAK_REASONS,
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

const leakReasonSet = new Set<string>(LEAK_REASONS);
const AMOUNT_INPUT_FOCUS_DELAY_MS = 250;

interface ValidateTransactionFormArgs {
  amountText: string;
  selectedCategory: TransactionCategory | null;
  validCategoryIds: Set<string>;
  areCategoriesReady: boolean;
  isLeak: boolean;
  selectedLeakReason: LeakReason | null;
  language: SupportedLanguage;
}

function validateTransactionForm({
  amountText,
  selectedCategory,
  validCategoryIds,
  areCategoriesReady,
  isLeak,
  selectedLeakReason,
  language,
}: ValidateTransactionFormArgs) {
  const errors: ValidationErrors = {
    amount: null,
    category: null,
    leakReason: null,
  };

  const trimmedAmount = amountText.trim();

  let parsedAmount: number | null = null;

  if (!trimmedAmount) {
    errors.amount = t(language, 'form.amountRequired');
  } else {
    const amount = Number(trimmedAmount);

    if (!Number.isFinite(amount)) {
      errors.amount = t(language, 'form.amountNumber');
    } else if (amount <= 0) {
      errors.amount = t(language, 'form.amountPositive');
    } else {
      parsedAmount = amount;
    }
  }

  if (!areCategoriesReady) {
    errors.category = t(language, 'form.categoriesLoading');
  } else if (!selectedCategory || !validCategoryIds.has(selectedCategory)) {
    errors.category = t(language, 'form.chooseCategory');
  }

  if (
    isLeak &&
    (!selectedLeakReason || !leakReasonSet.has(selectedLeakReason))
  ) {
    errors.leakReason = t(language, 'form.chooseLeakReason');
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
  const language = useSettingsLanguage();
  const amountInputRef = useRef<TextInput>(null);
  const categories = useCategoriesStore((state) => state.categories);

  const activeCategories = useCategoriesStore(
    (state) => state.activeCategories,
  );

  const isCategoriesLoading = useCategoriesStore((state) => state.isLoading);

  const isCategoriesInitialized = useCategoriesStore(
    (state) => state.isInitialized,
  );

  const categoriesError = useCategoriesStore((state) => state.error);
  const loadCategories = useCategoriesStore((state) => state.loadCategories);
  const clearCategoriesError = useCategoriesStore((state) => state.clearError);

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

  useCategoriesRefresh({
    isInitialized: isCategoriesInitialized,
    loadCategories,
  });

  useEffect(() => {
    const focusTimer = setTimeout(() => {
      try {
        amountInputRef.current?.focus();
      } catch {
        // Unsupported focus runtimes should not block form rendering.
      }
    }, AMOUNT_INPUT_FOCUS_DELAY_MS);

    return () => {
      clearTimeout(focusTimer);
    };
  }, []);

  useEffect(() => {
    clearError();
    clearCategoriesError();
  }, [clearCategoriesError, clearError]);

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

  useEffect(() => {
    if (!isCategoriesInitialized || !selectedCategory) return;

    const categoryExists = categories.some(
      (category) => category.id === selectedCategory,
    );

    if (categoryExists) return;

    const fallbackCategory = categories.find(
      (category) => category.id === OTHER_CATEGORY_ID && !category.isArchived,
    );

    if (fallbackCategory) {
      setSelectedCategory(fallbackCategory.id);
    }
  }, [categories, isCategoriesInitialized, selectedCategory]);

  const selectedCategoryRecord = selectedCategory
    ? categories.find((category) => category.id === selectedCategory)
    : null;

  const categoryOptions =
    selectedCategoryRecord?.isArchived === true
      ? [
          selectedCategoryRecord,
          ...activeCategories.filter(
            (category) => category.id !== selectedCategoryRecord.id,
          ),
        ]
      : activeCategories;

  const validCategoryIds = new Set(
    categoryOptions.map((category) => category.id),
  );

  const isSubmitDisabled =
    isLoading || isCategoriesLoading || !isCategoriesInitialized;

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
    if (isSubmitDisabled) return;

    clearError();

    const { errors, parsedAmount } = validateTransactionForm({
      amountText,
      selectedCategory,
      validCategoryIds,
      areCategoriesReady: isCategoriesInitialized,
      isLeak,
      selectedLeakReason,
      language,
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

    if (!category || !validCategoryIds.has(category)) return;

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
        <Text style={styles.label}>{t(language, 'form.amount')}</Text>

        <TextInput
          ref={amountInputRef}
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
        <Text style={styles.label}>{t(language, 'common.category')}</Text>

        <View style={styles.chipList}>
          {categoryOptions.map((category) => {
            const isSelected = selectedCategory === category.id;

            return (
              <Pressable
                key={category.id}
                onPress={() => handleCategoryPress(category.id)}
                style={[styles.chip, isSelected ? styles.chipSelected : null]}
              >
                <Text
                  style={[
                    styles.chipText,
                    isSelected ? styles.chipTextSelected : null,
                  ]}
                >
                  {category.isDefault
                    ? (getDefaultCategoryName(language, category.id) ??
                      category.name)
                    : category.name}
                  {category.isArchived
                    ? ` (${t(language, 'form.archived')})`
                    : ''}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {!isCategoriesInitialized ? (
          <Text style={styles.metaText}>
            {t(language, 'form.loadingCategories')}
          </Text>
        ) : null}

        {categoryError ? (
          <Text style={styles.fieldError}>{categoryError}</Text>
        ) : null}

        {categoriesError ? (
          <Text style={styles.fieldError}>{categoriesError}</Text>
        ) : null}
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>{t(language, 'common.type')}</Text>

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
              {t(language, 'common.normal')}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => handleLeakTypePress(true)}
            style={[styles.chip, isLeak ? styles.chipSelected : null]}
          >
            <Text
              style={[styles.chipText, isLeak ? styles.chipTextSelected : null]}
            >
              {t(language, 'home.leak')}
            </Text>
          </Pressable>
        </View>
      </View>

      {isLeak ? (
        <>
          <View style={styles.field}>
            <Text style={styles.label}>{t(language, 'common.reason')}</Text>

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
                      {getLeakReasonLabel(language, reason)}
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
            <Text style={styles.label}>{t(language, 'form.noteOptional')}</Text>

            <TextInput
              value={noteText}
              onChangeText={setNoteText}
              placeholder={t(language, 'form.notePlaceholder')}
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
        disabled={isSubmitDisabled}
        style={[
          styles.submitButton,
          isSubmitDisabled ? styles.submitButtonDisabled : null,
        ]}
      >
        <Text style={styles.submitButtonText}>
          {isLoading ? t(language, 'common.saving') : submitLabel}
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
  metaText: {
    fontSize: 13,
    lineHeight: 18,
    color: '#6b7280',
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
