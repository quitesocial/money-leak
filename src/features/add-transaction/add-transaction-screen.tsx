import { SymbolView, type SFSymbol } from 'expo-symbols';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LocalDatePicker } from '@/components/local-date-picker';
import {
  normalizeCategoryName,
  validateCategoryName,
} from '@/lib/category-utils';
import { formatLabel } from '@/lib/display-formatters';
import { useCategoriesRefresh } from '@/lib/use-categories-refresh';
import { useCategoriesStore } from '@/store/categories-store';
import { useTransactionsStore } from '@/store/transactions-store';
import type { Category } from '@/types/category';
import {
  LEAK_REASONS,
  type LeakReason,
  type TransactionCategory,
  type TransactionInput,
} from '@/types/transaction';

type WizardStep = 'details' | 'leakReason' | 'category' | 'addCategory';
type TransactionType = 'normal' | 'leak';

type AmountParseResult =
  | {
      amount: number;
      error: null;
    }
  | {
      amount: null;
      error: string;
    };

type HeaderProps = {
  title: string;
  onBackPress: () => void;
};

type SymbolIconProps = {
  color: string;
  fallbackLabel: string;
  name: SFSymbol;
  size?: number;
};

type ChipProps = {
  label: string;
  isSelected: boolean;
  onPress: () => void;
  fallbackSymbol?: string;
  symbolName?: SFSymbol;
};

type PrimaryActionProps = {
  label: string;
  isDisabled?: boolean;
  onPress: () => void;
};

type CategoryStepProps = {
  activeCategories: Category[];
  amount: number;
  categoriesError: string | null;
  date: Date;
  isReady: boolean;
  leakReason: LeakReason | null;
  onAddCategoryPress: () => void;
  onCategoryPress: (categoryId: TransactionCategory) => void;
  selectedCategory: TransactionCategory | null;
  transactionType: TransactionType;
  validationError: string | null;
};

const AMOUNT_INPUT_FOCUS_DELAY_MS = 250;
const NAME_INPUT_FOCUS_DELAY_MS = 250;
const TITLE_FONT_FAMILY = Platform.select({
  ios: 'NewYork',
  default: 'serif',
});
const TITLE_FONT_WEIGHT = Platform.select({
  ios: '700' as const,
  default: '800' as const,
});

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

const amountFormatter = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
});

const leakReasonSet = new Set<string>(LEAK_REASONS);

function generateTransactionId() {
  const uuid = globalThis.crypto?.randomUUID?.();

  if (uuid) return uuid;

  return `transaction-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function parseAmountText(amountText: string): AmountParseResult {
  const trimmedAmount = amountText.trim();

  if (!trimmedAmount) {
    return {
      amount: null,
      error: 'Enter an amount.',
    };
  }

  if (!/^\d+([.,]\d+)?$/.test(trimmedAmount)) {
    return {
      amount: null,
      error: 'Use a number like 12.50.',
    };
  }

  const amount = Number(trimmedAmount.replace(',', '.'));

  if (!Number.isFinite(amount)) {
    return {
      amount: null,
      error: 'Use a number like 12.50.',
    };
  }

  if (amount <= 0) {
    return {
      amount: null,
      error: 'Amount must be greater than 0.',
    };
  }

  return {
    amount,
    error: null,
  };
}

function formatDateLabel(date: Date) {
  return dateFormatter.format(date);
}

function formatAmountLabel(amount: number) {
  return amountFormatter.format(amount);
}

function isSupportedLeakReason(value: LeakReason | null) {
  return Boolean(value && leakReasonSet.has(value));
}

function SymbolIcon({
  color,
  fallbackLabel,
  name,
  size = 17,
}: SymbolIconProps) {
  return (
    <SymbolView
      fallback={
        <Text style={[styles.symbolFallback, { color, fontSize: size }]}>
          {fallbackLabel}
        </Text>
      }
      name={name}
      resizeMode="scaleAspectFit"
      size={size}
      tintColor={color}
      type="monochrome"
      weight="semibold"
    />
  );
}

function Header({ title, onBackPress }: HeaderProps) {
  return (
    <View style={styles.header}>
      <Pressable
        accessibilityLabel="Go back"
        accessibilityRole="button"
        onPress={onBackPress}
        style={styles.headerBackButton}
      >
        <SymbolIcon
          color="#100f10"
          fallbackLabel="<"
          name="arrow.left"
          size={22}
        />
      </Pressable>

      <Text style={styles.title}>{title}</Text>
    </View>
  );
}

function Chip({
  label,
  isSelected,
  onPress,
  fallbackSymbol,
  symbolName,
}: ChipProps) {
  const contentColor = isSelected ? '#ffffff' : '#100f10';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected }}
      onPress={onPress}
      style={[styles.chip, isSelected ? styles.chipSelected : null]}
    >
      {symbolName && fallbackSymbol ? (
        <SymbolIcon
          color={contentColor}
          fallbackLabel={fallbackSymbol}
          name={symbolName}
          size={16}
        />
      ) : null}

      <Text
        style={[styles.chipText, isSelected ? styles.chipTextSelected : null]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function PrimaryAction({
  label,
  isDisabled = false,
  onPress,
}: PrimaryActionProps) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={isDisabled}
      onPress={onPress}
      style={[styles.primaryAction, isDisabled ? styles.actionDisabled : null]}
    >
      <Text style={styles.primaryActionText}>{label}</Text>
    </Pressable>
  );
}

function FieldLabel({ children }: { children: string }) {
  return <Text style={styles.label}>{children}</Text>;
}

function ErrorText({ children }: { children: string }) {
  return <Text style={styles.errorText}>{children}</Text>;
}

function CompactSummary({
  amount,
  date,
  leakReason,
  transactionType,
}: {
  amount: number;
  date: Date;
  leakReason: LeakReason | null;
  transactionType: TransactionType;
}) {
  const typeCopy =
    transactionType === 'leak' && leakReason
      ? `Leak / ${formatLabel(leakReason)}`
      : 'Normal';

  return (
    <View style={styles.summary}>
      <Text style={styles.summaryAmount}>{formatAmountLabel(amount)}</Text>
      <Text style={styles.summaryDate}>{formatDateLabel(date)}</Text>
      <Text style={styles.summaryType}>{typeCopy}</Text>
    </View>
  );
}

function CategoryStep({
  activeCategories,
  amount,
  categoriesError,
  date,
  isReady,
  leakReason,
  onAddCategoryPress,
  onCategoryPress,
  selectedCategory,
  transactionType,
  validationError,
}: CategoryStepProps) {
  return (
    <>
      <CompactSummary
        amount={amount}
        date={date}
        leakReason={leakReason}
        transactionType={transactionType}
      />

      <View style={styles.categoryPanel}>
        <View style={styles.sectionHeader}>
          <FieldLabel>Category</FieldLabel>

          <Pressable
            accessibilityRole="button"
            onPress={onAddCategoryPress}
            style={styles.addCategoryLink}
          >
            <SymbolIcon
              color="#0088ff"
              fallbackLabel="+"
              name="plus"
              size={16}
            />
            <Text style={styles.addCategoryLinkText}>Add</Text>
          </Pressable>
        </View>

        <View style={styles.chipList}>
          {activeCategories.map((category) => {
            const isSelected = selectedCategory === category.id;

            return (
              <Chip
                key={category.id}
                isSelected={isSelected}
                label={category.name}
                onPress={() => onCategoryPress(category.id)}
              />
            );
          })}
        </View>

        {!isReady ? (
          <Text style={styles.metaText}>Loading categories...</Text>
        ) : null}

        {isReady && activeCategories.length === 0 ? (
          <Text style={styles.metaText}>Add a category before saving.</Text>
        ) : null}

        {validationError ? <ErrorText>{validationError}</ErrorText> : null}
        {categoriesError ? <ErrorText>{categoriesError}</ErrorText> : null}
      </View>
    </>
  );
}

function getCategoryByNormalizedName({
  categories,
  name,
}: {
  categories: Category[];
  name: string;
}) {
  const normalizedName = normalizeCategoryName(name).toLocaleLowerCase();

  return categories.find((category) => {
    return (
      normalizeCategoryName(category.name).toLocaleLowerCase() ===
      normalizedName
    );
  });
}

export function AddTransactionScreen() {
  const router = useRouter();
  const amountInputRef = useRef<TextInput>(null);
  const categoryNameInputRef = useRef<TextInput>(null);

  const addTransaction = useTransactionsStore((state) => state.addTransaction);
  const clearTransactionError = useTransactionsStore(
    (state) => state.clearError,
  );
  const isTransactionLoading = useTransactionsStore((state) => state.isLoading);
  const transactionError = useTransactionsStore((state) => state.error);

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
  const addCategory = useCategoriesStore((state) => state.addCategory);
  const clearCategoriesError = useCategoriesStore((state) => state.clearError);

  const [step, setStep] = useState<WizardStep>('details');
  const [amountText, setAmountText] = useState('');
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [transactionType, setTransactionType] =
    useState<TransactionType | null>(null);
  const [selectedLeakReason, setSelectedLeakReason] =
    useState<LeakReason | null>(null);
  const [selectedCategory, setSelectedCategory] =
    useState<TransactionCategory | null>(null);
  const [isDatePickerVisible, setIsDatePickerVisible] = useState(false);
  const [categoryName, setCategoryName] = useState('');
  const [amountError, setAmountError] = useState<string | null>(null);
  const [typeError, setTypeError] = useState<string | null>(null);
  const [leakReasonError, setLeakReasonError] = useState<string | null>(null);
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [addCategoryNameError, setAddCategoryNameError] = useState<
    string | null
  >(null);

  useCategoriesRefresh({
    isInitialized: isCategoriesInitialized,
    loadCategories,
  });

  useEffect(() => {
    clearTransactionError();
    clearCategoriesError();
  }, [clearCategoriesError, clearTransactionError]);

  useEffect(() => {
    if (step !== 'details') return;

    const focusTimer = setTimeout(() => {
      try {
        amountInputRef.current?.focus();
      } catch {
        // Unsupported focus runtimes should not block Add Transaction.
      }
    }, AMOUNT_INPUT_FOCUS_DELAY_MS);

    return () => {
      clearTimeout(focusTimer);
    };
  }, [step]);

  useEffect(() => {
    if (step !== 'addCategory') return;

    const focusTimer = setTimeout(() => {
      try {
        categoryNameInputRef.current?.focus();
      } catch {
        // Unsupported focus runtimes should not block Add Category.
      }
    }, NAME_INPUT_FOCUS_DELAY_MS);

    return () => {
      clearTimeout(focusTimer);
    };
  }, [step]);

  useEffect(() => {
    if (!isCategoriesInitialized || !selectedCategory) return;

    const isSelectedCategoryActive = activeCategories.some(
      (category) => category.id === selectedCategory,
    );

    if (!isSelectedCategoryActive) {
      setSelectedCategory(null);
    }
  }, [activeCategories, isCategoriesInitialized, selectedCategory]);

  function exitAddTransaction() {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)');
    }
  }

  function handleHeaderBackPress() {
    if (step === 'addCategory') {
      setStep('category');
      setCategoryName('');
      setAddCategoryNameError(null);
      clearCategoriesError();

      return;
    }

    exitAddTransaction();
  }

  function validateAmountForNextStep() {
    const result = parseAmountText(amountText);
    setAmountError(result.error);

    return result;
  }

  function goToStepForType(nextTransactionType: TransactionType) {
    setTransactionType(nextTransactionType);
    setTypeError(null);

    if (nextTransactionType === 'normal') {
      setSelectedLeakReason(null);
      setLeakReasonError(null);
    }

    const amountResult = validateAmountForNextStep();

    if (amountResult.error) return;

    setStep(nextTransactionType === 'leak' ? 'leakReason' : 'category');
  }

  function handleDetailsNextPress() {
    const amountResult = validateAmountForNextStep();
    const nextTypeError = transactionType ? null : 'Choose Normal or Leak.';

    setTypeError(nextTypeError);

    if (amountResult.error || nextTypeError || !transactionType) return;

    setStep(transactionType === 'leak' ? 'leakReason' : 'category');
  }

  function handleNormalPress() {
    goToStepForType('normal');
  }

  function handleLeakPress() {
    goToStepForType('leak');
  }

  function handleReasonNextPress() {
    if (!isSupportedLeakReason(selectedLeakReason)) {
      setLeakReasonError('Choose why this felt like a leak.');

      return;
    }

    setLeakReasonError(null);
    setStep('category');
  }

  function handleCategoryBackPress() {
    setCategoryError(null);

    if (transactionType === 'leak') {
      setStep('leakReason');
    } else {
      setStep('details');
    }
  }

  function handleCategoryPress(categoryId: TransactionCategory) {
    setSelectedCategory(categoryId);
    setCategoryError(null);
  }

  async function handleSaveTransaction() {
    if (
      isTransactionLoading ||
      isCategoriesLoading ||
      !isCategoriesInitialized
    ) {
      return;
    }

    clearTransactionError();

    const amountResult = parseAmountText(amountText);

    if (amountResult.error) {
      setAmountError(amountResult.error);
      setStep('details');

      return;
    }

    const amount = amountResult.amount;

    if (amount === null) return;

    if (!transactionType) {
      setTypeError('Choose Normal or Leak.');
      setStep('details');

      return;
    }

    if (
      transactionType === 'leak' &&
      !isSupportedLeakReason(selectedLeakReason)
    ) {
      setLeakReasonError('Choose why this felt like a leak.');
      setStep('leakReason');

      return;
    }

    const validCategoryIds = new Set(
      activeCategories.map((category) => category.id),
    );

    if (!selectedCategory || !validCategoryIds.has(selectedCategory)) {
      setCategoryError('Choose a category.');

      return;
    }

    const transaction: TransactionInput = {
      id: generateTransactionId(),
      amount,
      category: selectedCategory,
      isLeak: transactionType === 'leak',
      leakReason: transactionType === 'leak' ? selectedLeakReason : null,
      note: null,
      createdAt: selectedDate.getTime(),
    };

    await addTransaction(transaction);

    if (!useTransactionsStore.getState().error) {
      exitAddTransaction();
    }
  }

  function handleStartAddCategory() {
    clearCategoriesError();
    setCategoryName('');
    setAddCategoryNameError(null);
    setStep('addCategory');
  }

  async function handleSaveCategory() {
    if (isCategoriesLoading) return;

    clearCategoriesError();

    const validationError = validateCategoryName({
      name: categoryName,
      categories,
    });

    setAddCategoryNameError(validationError);

    if (validationError) return;

    const normalizedName = normalizeCategoryName(categoryName);

    await addCategory(categoryName);

    if (!useCategoriesStore.getState().error) {
      const createdCategory = getCategoryByNormalizedName({
        categories: useCategoriesStore.getState().activeCategories,
        name: normalizedName,
      });

      if (createdCategory) {
        setSelectedCategory(createdCategory.id);
        setCategoryError(null);
      }

      setCategoryName('');
      setAddCategoryNameError(null);
      setStep('category');
    }
  }

  const amountResult = parseAmountText(amountText);
  const summaryAmount = amountResult.amount ?? 0;
  const selectedType = transactionType ?? 'normal';
  const isSaveDisabled =
    isTransactionLoading || isCategoriesLoading || !isCategoriesInitialized;
  const footerContent =
    step === 'details' ? (
      <PrimaryAction label="Next" onPress={handleDetailsNextPress} />
    ) : step === 'leakReason' ? (
      <PrimaryAction label="Next" onPress={handleReasonNextPress} />
    ) : step === 'category' && transactionType ? (
      <View style={styles.bottomActions}>
        <Pressable
          accessibilityLabel="Previous step"
          accessibilityRole="button"
          onPress={handleCategoryBackPress}
          style={styles.secondaryIconAction}
        >
          <SymbolIcon
            color="#100f10"
            fallbackLabel="<"
            name="arrow.left"
            size={19}
          />
        </Pressable>

        <View style={styles.primaryActionFlex}>
          <PrimaryAction
            isDisabled={isSaveDisabled}
            label={isTransactionLoading ? 'Saving...' : 'Save Transaction'}
            onPress={() => {
              void handleSaveTransaction();
            }}
          />
        </View>
      </View>
    ) : step === 'addCategory' ? (
      <PrimaryAction
        isDisabled={isCategoriesLoading}
        label={isCategoriesLoading ? 'Saving...' : 'Save Category'}
        onPress={() => {
          void handleSaveCategory();
        }}
      />
    ) : null;

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.safeArea}
      >
        <View style={styles.screen}>
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            style={styles.scrollArea}
          >
            <Header
              onBackPress={handleHeaderBackPress}
              title={
                step === 'addCategory' ? 'Add Category' : 'Add Transaction'
              }
            />

            {step === 'details' ? (
              <>
                <View style={styles.formGroup}>
                  <View style={styles.field}>
                    <FieldLabel>Amount</FieldLabel>

                    <View
                      style={[
                        styles.amountInputFrame,
                        amountError ? styles.inputFrameError : null,
                      ]}
                    >
                      <TextInput
                        ref={amountInputRef}
                        autoCapitalize="none"
                        autoCorrect={false}
                        inputMode="decimal"
                        keyboardType="decimal-pad"
                        onChangeText={(value) => {
                          setAmountText(value);
                          setAmountError(null);
                        }}
                        placeholder="0.00"
                        style={styles.amountInput}
                        value={amountText}
                      />

                      <Text style={styles.currencySuffix}>€</Text>
                    </View>

                    {amountError ? <ErrorText>{amountError}</ErrorText> : null}
                  </View>

                  <View style={styles.field}>
                    <FieldLabel>Date</FieldLabel>

                    <Pressable
                      accessibilityRole="button"
                      onPress={() => setIsDatePickerVisible(true)}
                      style={styles.dateButton}
                    >
                      <SymbolIcon
                        color="#100f10"
                        fallbackLabel="[]"
                        name="calendar"
                        size={17}
                      />
                      <Text style={styles.dateButtonText}>
                        {formatDateLabel(selectedDate)}
                      </Text>
                    </Pressable>
                  </View>

                  <View style={styles.field}>
                    <FieldLabel>Type</FieldLabel>

                    <View style={styles.chipList}>
                      <Chip
                        fallbackSymbol="N"
                        isSelected={transactionType === 'normal'}
                        label="Normal"
                        onPress={handleNormalPress}
                        symbolName="hand.thumbsup"
                      />

                      <Chip
                        fallbackSymbol="L"
                        isSelected={transactionType === 'leak'}
                        label="Leak"
                        onPress={handleLeakPress}
                        symbolName="drop.halffull"
                      />
                    </View>

                    {typeError ? <ErrorText>{typeError}</ErrorText> : null}
                  </View>
                </View>

                {transactionError ? (
                  <ErrorText>{transactionError}</ErrorText>
                ) : null}
              </>
            ) : null}

            {step === 'leakReason' ? (
              <>
                <View style={styles.formGroup}>
                  <View style={styles.field}>
                    <FieldLabel>Amount</FieldLabel>
                    <View style={styles.readonlyPill}>
                      <Text style={styles.readonlyAmount}>
                        {formatAmountLabel(summaryAmount)}
                      </Text>
                      <Text style={styles.currencySuffix}>€</Text>
                    </View>
                  </View>

                  <View style={styles.field}>
                    <FieldLabel>Date</FieldLabel>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => setIsDatePickerVisible(true)}
                      style={styles.dateButton}
                    >
                      <SymbolIcon
                        color="#100f10"
                        fallbackLabel="[]"
                        name="calendar"
                        size={17}
                      />
                      <Text style={styles.dateButtonText}>
                        {formatDateLabel(selectedDate)}
                      </Text>
                    </Pressable>
                  </View>

                  <View style={styles.field}>
                    <FieldLabel>Type</FieldLabel>
                    <View style={styles.chipList}>
                      <Chip
                        fallbackSymbol="N"
                        isSelected={transactionType === 'normal'}
                        label="Normal"
                        onPress={handleNormalPress}
                        symbolName="hand.thumbsup"
                      />

                      <Chip
                        fallbackSymbol="L"
                        isSelected={transactionType === 'leak'}
                        label="Leak"
                        onPress={() => setTransactionType('leak')}
                        symbolName="drop.halffull"
                      />
                    </View>
                  </View>

                  <View style={styles.field}>
                    <FieldLabel>Reason</FieldLabel>

                    <View style={styles.chipList}>
                      {LEAK_REASONS.map((reason) => (
                        <Chip
                          key={reason}
                          isSelected={selectedLeakReason === reason}
                          label={formatLabel(reason)}
                          onPress={() => {
                            setSelectedLeakReason(reason);
                            setLeakReasonError(null);
                          }}
                        />
                      ))}
                    </View>

                    {leakReasonError ? (
                      <ErrorText>{leakReasonError}</ErrorText>
                    ) : null}
                  </View>
                </View>
              </>
            ) : null}

            {step === 'category' && transactionType ? (
              <CategoryStep
                activeCategories={activeCategories}
                amount={summaryAmount}
                categoriesError={categoriesError}
                date={selectedDate}
                isReady={isCategoriesInitialized}
                leakReason={selectedLeakReason}
                onAddCategoryPress={handleStartAddCategory}
                onCategoryPress={handleCategoryPress}
                selectedCategory={selectedCategory}
                transactionType={selectedType}
                validationError={categoryError}
              />
            ) : null}

            {step === 'addCategory' ? (
              <View style={styles.formGroup}>
                <View style={styles.field}>
                  <FieldLabel>Name</FieldLabel>

                  <TextInput
                    ref={categoryNameInputRef}
                    autoCapitalize="words"
                    autoCorrect={false}
                    onChangeText={(value) => {
                      setCategoryName(value);
                      setAddCategoryNameError(null);
                    }}
                    onSubmitEditing={() => {
                      void handleSaveCategory();
                    }}
                    placeholder="Travel"
                    returnKeyType="done"
                    style={[
                      styles.nameInput,
                      addCategoryNameError ? styles.inputFrameError : null,
                    ]}
                    value={categoryName}
                  />

                  {addCategoryNameError ? (
                    <ErrorText>{addCategoryNameError}</ErrorText>
                  ) : null}

                  {categoriesError ? (
                    <ErrorText>{categoriesError}</ErrorText>
                  ) : null}
                </View>
              </View>
            ) : null}
          </ScrollView>

          {footerContent ? (
            <View style={styles.footer}>{footerContent}</View>
          ) : null}
        </View>

        <LocalDatePicker
          onCancel={() => setIsDatePickerVisible(false)}
          onConfirm={(date) => {
            setSelectedDate(date);
            setIsDatePickerVisible(false);
          }}
          value={selectedDate}
          visible={isDatePickerVisible}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f7f7f5',
  },
  screen: {
    flex: 1,
    backgroundColor: '#f7f7f5',
  },
  scrollArea: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 21,
    paddingTop: 24,
    paddingBottom: 16,
    gap: 48,
  },
  footer: {
    paddingHorizontal: 21,
    paddingTop: 12,
    paddingBottom: 24,
    backgroundColor: '#f7f7f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerBackButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
    backgroundColor: '#ffffff',
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 4,
  },
  title: {
    flex: 1,
    color: '#000000',
    fontFamily: TITLE_FONT_FAMILY,
    fontSize: 36,
    fontWeight: TITLE_FONT_WEIGHT,
    ...Platform.select({
      ios: {
        textShadowColor: '#000000',
        textShadowOffset: {
          width: 0.25,
          height: 0,
        },
        textShadowRadius: 0,
      },
      default: {},
    }),
  },
  formGroup: {
    gap: 16,
  },
  field: {
    gap: 8,
  },
  label: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '600',
  },
  amountInputFrame: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 10,
    borderWidth: 3,
    borderColor: '#100f10',
    borderRadius: 999,
    paddingHorizontal: 16,
    backgroundColor: '#f7f7f5',
  },
  amountInput: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 9,
    color: '#000000',
    fontSize: 24,
    fontWeight: '600',
    textAlign: 'right',
  },
  inputFrameError: {
    borderColor: '#dc2626',
  },
  currencySuffix: {
    color: '#6f6f6f',
    fontSize: 24,
  },
  dateButton: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: '#100f10',
    borderRadius: 999,
    paddingHorizontal: 16,
    backgroundColor: '#f7f7f5',
  },
  dateButtonText: {
    color: '#000000',
    fontSize: 16,
  },
  chipList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    minHeight: 43,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderWidth: 1,
    borderColor: '#100f10',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#f7f7f5',
  },
  chipSelected: {
    backgroundColor: '#100f10',
  },
  chipText: {
    color: '#100f10',
    fontSize: 16,
    fontWeight: '600',
  },
  chipTextSelected: {
    color: '#ffffff',
  },
  primaryAction: {
    minHeight: 50,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    backgroundColor: '#100f10',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  primaryActionText: {
    color: '#ffffff',
    fontSize: 17,
  },
  primaryActionFlex: {
    flex: 1,
  },
  actionDisabled: {
    opacity: 0.5,
  },
  readonlyPill: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 10,
    borderWidth: 1,
    borderColor: '#100f10',
    borderRadius: 999,
    paddingHorizontal: 16,
    backgroundColor: '#f7f7f5',
  },
  readonlyAmount: {
    color: '#000000',
    fontSize: 24,
    fontWeight: '600',
  },
  summary: {
    gap: 4,
  },
  summaryAmount: {
    color: '#000000',
    fontFamily: TITLE_FONT_FAMILY,
    fontSize: 32,
    fontWeight: TITLE_FONT_WEIGHT,
  },
  summaryDate: {
    color: 'rgba(60, 60, 67, 0.6)',
    fontSize: 14,
    fontWeight: '500',
  },
  summaryType: {
    color: 'rgba(60, 60, 67, 0.8)',
    fontSize: 14,
    fontWeight: '500',
  },
  categoryPanel: {
    gap: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  addCategoryLink: {
    minHeight: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderRadius: 40,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  addCategoryLinkText: {
    color: '#0088ff',
    fontSize: 15,
  },
  bottomActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  secondaryIconAction: {
    width: 50,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#100f10',
    borderRadius: 25,
  },
  nameInput: {
    minHeight: 50,
    borderWidth: 3,
    borderColor: '#100f10',
    borderRadius: 999,
    paddingHorizontal: 16,
    color: '#000000',
    fontSize: 16,
  },
  errorText: {
    color: '#dc2626',
    fontSize: 13,
    lineHeight: 18,
  },
  metaText: {
    color: '#6f6f6f',
    fontSize: 13,
    lineHeight: 18,
  },
  symbolFallback: {
    fontWeight: '700',
    lineHeight: 20,
  },
});
