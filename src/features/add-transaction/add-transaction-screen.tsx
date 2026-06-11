import { SymbolView, type SFSymbol } from 'expo-symbols';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
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

import { CategoryIconPicker } from '@/components/category-icon-picker';
import { LocalDatePicker } from '@/components/local-date-picker';
import { parseAmountText } from '@/lib/amount-input';
import {
  CATEGORY_ICON_FALLBACK_NAME,
  getCategoryIcon,
  type CategoryIconDefinition,
  type CategoryIconName,
} from '@/lib/category-icons';
import {
  normalizeCategoryName,
  validateCategoryName,
} from '@/lib/category-utils';
import { getCurrencySymbol } from '@/lib/display-formatters';
import {
  formatLanguageDate,
  getDefaultCategoryName,
  getLeakReasonLabel,
  t,
} from '@/lib/i18n/i18n';
import type { SupportedLanguage } from '@/lib/i18n/languages';
import { useCategoriesRefresh } from '@/lib/use-categories-refresh';
import { useSettingsCurrency } from '@/lib/use-settings-currency';
import { useSettingsLanguage } from '@/lib/use-settings-language';
import { useCategoriesStore } from '@/store/categories-store';
import { useTransactionsStore } from '@/store/transactions-store';
import type { Category } from '@/types/category';
import {
  LEAK_REASONS,
  type LeakReason,
  type TransactionCategory,
  type TransactionInput,
} from '@/types/transaction';

type ScreenMode = 'transaction' | 'addCategory';
type ScrollTarget = 'reason' | 'category';
type TransactionType = 'normal' | 'leak';

type HeaderProps = {
  onBackPress: () => void;
  title: string;
};

type SymbolIconProps = {
  color: string;
  fallbackLabel: string;
  name: SFSymbol;
  size?: number;
  testID?: string;
};

type ChipProps = {
  fallbackSymbol?: string;
  isSelected: boolean;
  label: string;
  onPress: () => void;
  symbolName?: SFSymbol;
};

type CategoryChipProps = {
  category: Category;
  isSelected: boolean;
  language: SupportedLanguage;
  onPress: () => void;
};

type PrimaryActionProps = {
  isDisabled?: boolean;
  label: string;
  onPress: () => void;
};

const AMOUNT_INPUT_FOCUS_DELAY_MS = 250;
const NAME_INPUT_FOCUS_DELAY_MS = 250;
const SCROLL_ALIGNMENT_OFFSET = 12;
const TITLE_FONT_FAMILY = Platform.select({
  ios: 'NewYork',
  default: 'serif',
});
const TITLE_FONT_WEIGHT = Platform.select({
  ios: '700' as const,
  default: '800' as const,
});

const leakReasonSet = new Set<string>(LEAK_REASONS);

function generateTransactionId() {
  const uuid = globalThis.crypto?.randomUUID?.();

  if (uuid) return uuid;

  return `transaction-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function formatDateLabel(date: Date, language: SupportedLanguage) {
  return formatLanguageDate(language, date, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function isSupportedLeakReason(value: LeakReason | null) {
  return Boolean(value && leakReasonSet.has(value));
}

function SymbolIcon({
  color,
  fallbackLabel,
  name,
  size = 17,
  testID,
}: SymbolIconProps) {
  return (
    <SymbolView
      fallback={
        <Text
          style={[styles.symbolFallback, { color, fontSize: size }]}
          testID={testID}
        >
          {fallbackLabel}
        </Text>
      }
      name={name}
      resizeMode="scaleAspectFit"
      size={size}
      testID={testID}
      tintColor={color}
      type="monochrome"
      weight="semibold"
    />
  );
}

function Header({ onBackPress, title }: HeaderProps) {
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
  fallbackSymbol,
  isSelected,
  label,
  onPress,
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

      <Text style={[styles.chipText, { color: contentColor }]}>{label}</Text>
    </Pressable>
  );
}

function CategoryIconGlyph({
  color,
  icon,
  size = 18,
  testID,
}: {
  color: string;
  icon: CategoryIconDefinition;
  size?: number;
  testID?: string;
}) {
  return (
    <SymbolIcon
      color={color}
      fallbackLabel={icon.fallbackSymbol}
      name={icon.symbolName}
      size={size}
      testID={testID}
    />
  );
}

function CategoryChip({
  category,
  isSelected,
  language,
  onPress,
}: CategoryChipProps) {
  const contentColor = isSelected ? '#ffffff' : '#100f10';
  const icon = getCategoryIcon(category.iconName);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected }}
      onPress={onPress}
      style={[styles.chip, isSelected ? styles.chipSelected : null]}
      testID={`category-chip-${category.id}`}
    >
      <CategoryIconGlyph
        color={contentColor}
        icon={icon}
        size={17}
        testID={`category-icon-${category.id}`}
      />

      <Text style={[styles.chipText, { color: contentColor }]}>
        {category.isDefault
          ? (getDefaultCategoryName(language, category.id) ?? category.name)
          : category.name}
      </Text>
    </Pressable>
  );
}

function PrimaryAction({
  isDisabled = false,
  label,
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
  const currency = useSettingsCurrency();
  const language = useSettingsLanguage();
  const amountInputRef = useRef<TextInput>(null);
  const categoryNameInputRef = useRef<TextInput>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const sectionOffsetsRef = useRef<Record<ScrollTarget, number | null>>({
    reason: null,
    category: null,
  });

  const addTransaction = useTransactionsStore((state) => state.addTransaction);
  const clearTransactionError = useTransactionsStore(
    (state) => state.clearError,
  );
  const isTransactionLoading = useTransactionsStore((state) => state.isLoading);
  const transactionError = useTransactionsStore((state) => state.error);

  const {
    categories,
    activeCategories,
    isLoading: isCategoriesLoading,
    isInitialized: isCategoriesInitialized,
    error: categoriesError,
    loadCategories,
    addCategory,
    clearError: clearCategoriesError,
  } = useCategoriesStore();

  const [screenMode, setScreenMode] = useState<ScreenMode>('transaction');
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
  const [selectedCategoryIconName, setSelectedCategoryIconName] =
    useState<CategoryIconName | null>(null);
  const [isCategoryIconPickerExpanded, setIsCategoryIconPickerExpanded] =
    useState(false);
  const [amountError, setAmountError] = useState<string | null>(null);
  const [typeError, setTypeError] = useState<string | null>(null);
  const [leakReasonError, setLeakReasonError] = useState<string | null>(null);
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [pendingScrollTarget, setPendingScrollTarget] =
    useState<ScrollTarget | null>(null);
  const [addCategoryNameError, setAddCategoryNameError] = useState<
    string | null
  >(null);

  const visibleCategories = useMemo(
    () => activeCategories.filter((category) => !category.isArchived),
    [activeCategories],
  );
  const shouldShowReason = transactionType === 'leak';
  const shouldShowCategory =
    transactionType === 'normal' ||
    (transactionType === 'leak' && isSupportedLeakReason(selectedLeakReason));

  useCategoriesRefresh({
    isInitialized: isCategoriesInitialized,
    loadCategories,
  });

  useEffect(() => {
    clearTransactionError();
    clearCategoriesError();
  }, [clearCategoriesError, clearTransactionError]);

  useEffect(() => {
    if (screenMode !== 'transaction') return;

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
  }, [screenMode]);

  useEffect(() => {
    if (screenMode !== 'addCategory') return;

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
  }, [screenMode]);

  useEffect(() => {
    if (!isCategoriesInitialized || !selectedCategory) return;

    const isSelectedCategoryActive = visibleCategories.some(
      (category) => category.id === selectedCategory,
    );

    if (!isSelectedCategoryActive) {
      setSelectedCategory(null);
    }
  }, [isCategoriesInitialized, selectedCategory, visibleCategories]);

  useEffect(() => {
    if (!pendingScrollTarget) return;

    const scrollTimer = setTimeout(() => {
      scrollToSection(pendingScrollTarget);
    }, 0);

    return () => {
      clearTimeout(scrollTimer);
    };
  }, [pendingScrollTarget, shouldShowCategory, shouldShowReason]);

  function scrollToSection(target: ScrollTarget) {
    const sectionOffset = sectionOffsetsRef.current[target];

    if (sectionOffset === null) return;

    scrollViewRef.current?.scrollTo({
      y: Math.max(sectionOffset - SCROLL_ALIGNMENT_OFFSET, 0),
      animated: true,
    });

    setPendingScrollTarget(null);
  }

  function exitAddTransaction() {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)');
    }
  }

  function resetAddCategoryState() {
    setCategoryName('');
    setSelectedCategoryIconName(null);
    setIsCategoryIconPickerExpanded(false);
    setAddCategoryNameError(null);
  }

  function handleHeaderBackPress() {
    if (screenMode === 'addCategory') {
      setScreenMode('transaction');
      resetAddCategoryState();
      clearCategoriesError();

      return;
    }

    exitAddTransaction();
  }

  function handleTransactionTypePress(nextTransactionType: TransactionType) {
    setTransactionType(nextTransactionType);
    setTypeError(null);

    if (nextTransactionType === 'normal') {
      setSelectedLeakReason(null);
      setLeakReasonError(null);
      setPendingScrollTarget('category');

      return;
    }

    setPendingScrollTarget('reason');
  }

  function handleCategoryPress(categoryId: TransactionCategory) {
    setSelectedCategory(categoryId);
    setCategoryError(null);
  }

  function handleLeakReasonPress(reason: LeakReason) {
    setSelectedLeakReason(reason);
    setLeakReasonError(null);
    setPendingScrollTarget('category');
  }

  function validateTransactionForm() {
    const amountResult = parseAmountText(amountText, language);
    const nextTypeError = transactionType
      ? null
      : t(language, 'form.chooseType');
    const nextLeakReasonError =
      transactionType === 'leak' && !isSupportedLeakReason(selectedLeakReason)
        ? t(language, 'form.chooseLeakReason')
        : null;
    const validCategoryIds = new Set(
      visibleCategories.map((category) => category.id),
    );
    const nextCategoryError =
      !shouldShowCategory ||
      (selectedCategory && validCategoryIds.has(selectedCategory))
        ? null
        : t(language, 'form.chooseCategory');

    setAmountError(amountResult.error);
    setTypeError(nextTypeError);
    setLeakReasonError(nextLeakReasonError);
    setCategoryError(nextCategoryError);

    if (
      amountResult.error ||
      nextTypeError ||
      nextLeakReasonError ||
      nextCategoryError
    ) {
      return null;
    }

    return amountResult.amount;
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

    const amount = validateTransactionForm();

    if (amount === null) return;

    const transaction: TransactionInput = {
      id: generateTransactionId(),
      amount,
      category: selectedCategory as TransactionCategory,
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
    resetAddCategoryState();
    setScreenMode('addCategory');
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

    await addCategory({
      name: categoryName,
      iconName: selectedCategoryIconName ?? CATEGORY_ICON_FALLBACK_NAME,
    });

    if (!useCategoriesStore.getState().error) {
      const createdCategory = getCategoryByNormalizedName({
        categories: useCategoriesStore.getState().activeCategories,
        name: normalizedName,
      });

      if (createdCategory) {
        setSelectedCategory(createdCategory.id);
        setCategoryError(null);
      }

      resetAddCategoryState();
      setScreenMode('transaction');
    }
  }

  const isSaveDisabled =
    isTransactionLoading || isCategoriesLoading || !isCategoriesInitialized;

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.safeArea}
      >
        <View style={styles.screen}>
          <ScrollView
            ref={scrollViewRef}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            style={styles.scrollArea}
          >
            <Header
              onBackPress={handleHeaderBackPress}
              title={
                screenMode === 'addCategory'
                  ? t(language, 'transaction.addCategoryTitle')
                  : t(language, 'transaction.addTitle')
              }
            />

            {screenMode === 'transaction' ? (
              <View style={styles.contentColumn}>
                <View style={styles.formGroup}>
                  <View style={styles.field}>
                    <FieldLabel>{t(language, 'form.amount')}</FieldLabel>

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
                        autoFocus
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

                      <Text style={styles.currencySuffix}>
                        {getCurrencySymbol(currency)}
                      </Text>
                    </View>

                    {amountError ? <ErrorText>{amountError}</ErrorText> : null}
                  </View>

                  <View style={styles.field}>
                    <FieldLabel>{t(language, 'common.date')}</FieldLabel>

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
                        {formatDateLabel(selectedDate, language)}
                      </Text>
                    </Pressable>
                  </View>

                  <View style={styles.field}>
                    <FieldLabel>{t(language, 'common.type')}</FieldLabel>

                    <View style={styles.chipList}>
                      <Chip
                        fallbackSymbol="N"
                        isSelected={transactionType === 'normal'}
                        label={t(language, 'common.normal')}
                        onPress={() => handleTransactionTypePress('normal')}
                        symbolName="hand.thumbsup"
                      />

                      <Chip
                        fallbackSymbol="L"
                        isSelected={transactionType === 'leak'}
                        label={t(language, 'home.leak')}
                        onPress={() => handleTransactionTypePress('leak')}
                        symbolName="drop.halffull"
                      />
                    </View>

                    {typeError ? <ErrorText>{typeError}</ErrorText> : null}
                  </View>

                  {shouldShowReason ? (
                    <View
                      onLayout={(event) => {
                        sectionOffsetsRef.current.reason =
                          event.nativeEvent.layout.y;

                        if (pendingScrollTarget === 'reason') {
                          scrollToSection('reason');
                        }
                      }}
                      style={styles.field}
                    >
                      <FieldLabel>{t(language, 'common.reason')}</FieldLabel>

                      <View style={styles.chipList}>
                        {LEAK_REASONS.map((reason) => (
                          <Chip
                            key={reason}
                            isSelected={selectedLeakReason === reason}
                            label={getLeakReasonLabel(language, reason)}
                            onPress={() => handleLeakReasonPress(reason)}
                          />
                        ))}
                      </View>

                      {leakReasonError ? (
                        <ErrorText>{leakReasonError}</ErrorText>
                      ) : null}
                    </View>
                  ) : null}
                </View>

                {shouldShowCategory ? (
                  <View
                    onLayout={(event) => {
                      sectionOffsetsRef.current.category =
                        event.nativeEvent.layout.y;

                      if (pendingScrollTarget === 'category') {
                        scrollToSection('category');
                      }
                    }}
                    style={styles.categoryPanel}
                  >
                    <View style={styles.sectionHeader}>
                      <FieldLabel>{t(language, 'common.category')}</FieldLabel>

                      <Pressable
                        accessibilityRole="button"
                        onPress={handleStartAddCategory}
                        style={styles.addCategoryLink}
                      >
                        <SymbolIcon
                          color="#0088ff"
                          fallbackLabel="+"
                          name="plus"
                          size={16}
                        />
                        <Text style={styles.addCategoryLinkText}>
                          {t(language, 'common.add')}
                        </Text>
                      </Pressable>
                    </View>

                    <View style={styles.chipList}>
                      {visibleCategories.map((category) => {
                        const isSelected = selectedCategory === category.id;

                        return (
                          <CategoryChip
                            category={category}
                            key={category.id}
                            isSelected={isSelected}
                            language={language}
                            onPress={() => handleCategoryPress(category.id)}
                          />
                        );
                      })}
                    </View>

                    {!isCategoriesInitialized ? (
                      <Text style={styles.metaText}>
                        {t(language, 'form.loadingCategories')}
                      </Text>
                    ) : null}

                    {isCategoriesInitialized &&
                    visibleCategories.length === 0 ? (
                      <Text style={styles.metaText}>
                        {t(language, 'transaction.addCategoryBeforeSaving')}
                      </Text>
                    ) : null}

                    {categoryError ? (
                      <ErrorText>{categoryError}</ErrorText>
                    ) : null}
                    {categoriesError ? (
                      <ErrorText>{categoriesError}</ErrorText>
                    ) : null}
                  </View>
                ) : null}

                {transactionError ? (
                  <ErrorText>{transactionError}</ErrorText>
                ) : null}
              </View>
            ) : null}

            {screenMode === 'addCategory' ? (
              <View style={styles.contentColumn}>
                <View style={styles.formGroup}>
                  <View style={styles.field}>
                    <FieldLabel>{t(language, 'common.name')}</FieldLabel>

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
                      placeholder={t(
                        language,
                        'transaction.categoryNamePlaceholder',
                      )}
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

                  <View style={styles.field}>
                    <Text style={styles.label}>
                      {t(language, 'transaction.iconOptional')}
                    </Text>

                    <CategoryIconPicker
                      isExpanded={isCategoryIconPickerExpanded}
                      onExpand={() => setIsCategoryIconPickerExpanded(true)}
                      onIconPress={setSelectedCategoryIconName}
                      selectedIconName={selectedCategoryIconName}
                    />
                  </View>
                </View>
              </View>
            ) : null}
          </ScrollView>

          <View style={styles.footer}>
            <View style={styles.footerColumn}>
              {screenMode === 'addCategory' ? (
                <PrimaryAction
                  isDisabled={isCategoriesLoading}
                  label={
                    isCategoriesLoading
                      ? t(language, 'common.saving')
                      : t(language, 'transaction.saveCategory')
                  }
                  onPress={() => {
                    void handleSaveCategory();
                  }}
                />
              ) : (
                <PrimaryAction
                  isDisabled={isSaveDisabled}
                  label={t(language, 'transaction.save')}
                  onPress={() => {
                    void handleSaveTransaction();
                  }}
                />
              )}
            </View>
          </View>
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
    alignItems: 'center',
    gap: 48,
    paddingHorizontal: 21,
    paddingTop: 24,
    paddingBottom: 16,
  },
  contentColumn: {
    width: '100%',
    maxWidth: 360,
    gap: 24,
  },
  footer: {
    alignItems: 'center',
    paddingHorizontal: 21,
    paddingTop: 12,
    paddingBottom: 24,
    backgroundColor: '#f7f7f5',
  },
  footerColumn: {
    width: '100%',
    maxWidth: 360,
  },
  header: {
    width: '100%',
    maxWidth: 360,
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
    borderWidth: 1,
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
    fontSize: 16,
    fontWeight: '600',
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
  actionDisabled: {
    opacity: 0.5,
  },
  nameInput: {
    minHeight: 50,
    borderWidth: 1,
    borderColor: '#100f10',
    borderRadius: 999,
    paddingHorizontal: 16,
    color: '#000000',
    fontSize: 16,
  },
  optionalLabel: {
    color: '#6f6f6f',
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
