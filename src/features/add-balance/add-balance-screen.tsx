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
  normalizeBalanceTypeName,
  validateBalanceTypeName,
} from '@/lib/balance-utils';
import { useBalanceRefresh } from '@/lib/use-balance-refresh';
import { useBalanceStore } from '@/store/balance-store';
import type {
  BalanceEntry,
  BalanceEntryInput,
  BalanceType,
} from '@/types/balance';

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
  onBackPress: () => void;
  title: string;
};

type SymbolIconProps = {
  color: string;
  fallbackLabel: string;
  name: SFSymbol;
  size?: number;
};

type TypeChipProps = {
  isSelected: boolean;
  onPress: () => void;
  type: BalanceType;
};

type PrimaryActionProps = {
  isDisabled?: boolean;
  label: string;
  onPress: () => void;
};

export type AddBalanceScreenProps = {
  initialEntry?: BalanceEntry | null;
  submitLabel?: string;
  title?: string;
  onSubmit?: (entry: BalanceEntryInput) => Promise<void>;
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

function generateBalanceEntryId() {
  const uuid = globalThis.crypto?.randomUUID?.();

  if (uuid) return uuid;

  return `balance-entry-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;
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
      error: 'Use a number like 100.00.',
    };
  }

  const amount = Number(trimmedAmount.replace(',', '.'));

  if (!Number.isFinite(amount)) {
    return {
      amount: null,
      error: 'Use a number like 100.00.',
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

function formatInitialAmount(entry: BalanceEntry | null | undefined) {
  if (!entry) return '';

  return String(entry.amount);
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

function FieldLabel({ children }: { children: string }) {
  return <Text style={styles.label}>{children}</Text>;
}

function ErrorText({ children }: { children: string }) {
  return <Text style={styles.errorText}>{children}</Text>;
}

function TypeChip({ isSelected, onPress, type }: TypeChipProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected }}
      onPress={onPress}
      style={[styles.chip, isSelected ? styles.chipSelected : null]}
      testID={`balance-type-chip-${type.id}`}
    >
      <Text
        style={[styles.chipText, isSelected ? styles.chipTextSelected : null]}
      >
        {type.name}
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

function getBalanceTypeByNormalizedName({
  balanceTypes,
  name,
}: {
  balanceTypes: BalanceType[];
  name: string;
}) {
  const normalizedName = normalizeBalanceTypeName(name).toLocaleLowerCase();

  return balanceTypes.find((balanceType) => {
    return (
      normalizeBalanceTypeName(balanceType.name).toLocaleLowerCase() ===
      normalizedName
    );
  });
}

export function AddBalanceScreen({
  initialEntry = null,
  onSubmit,
  submitLabel = 'Save Balance',
  title = 'Add Balance',
}: AddBalanceScreenProps) {
  const router = useRouter();
  const amountInputRef = useRef<TextInput>(null);
  const typeNameInputRef = useRef<TextInput>(null);

  const addBalanceEntry = useBalanceStore((state) => state.addBalanceEntry);
  const addBalanceType = useBalanceStore((state) => state.addBalanceType);
  const activeBalanceTypes = useBalanceStore(
    (state) => state.activeBalanceTypes,
  );
  const balanceTypes = useBalanceStore((state) => state.balanceTypes);
  const balanceError = useBalanceStore((state) => state.error);
  const clearBalanceError = useBalanceStore((state) => state.clearError);
  const isBalanceInitialized = useBalanceStore((state) => state.isInitialized);
  const isBalanceLoading = useBalanceStore((state) => state.isLoading);
  const loadBalance = useBalanceStore((state) => state.loadBalance);

  const [amountText, setAmountText] = useState(() =>
    formatInitialAmount(initialEntry),
  );
  const [selectedDate, setSelectedDate] = useState(
    () => new Date(initialEntry?.createdAt ?? Date.now()),
  );
  const [selectedTypeId, setSelectedTypeId] = useState<string | null>(
    initialEntry?.typeId ?? null,
  );
  const [isDatePickerVisible, setIsDatePickerVisible] = useState(false);
  const [isAddingType, setIsAddingType] = useState(false);
  const [typeName, setTypeName] = useState('');
  const [amountError, setAmountError] = useState<string | null>(null);
  const [typeError, setTypeError] = useState<string | null>(null);
  const [typeNameError, setTypeNameError] = useState<string | null>(null);

  useBalanceRefresh({
    isInitialized: isBalanceInitialized,
    loadBalance,
  });

  useEffect(() => {
    clearBalanceError();
  }, [clearBalanceError]);

  useEffect(() => {
    const focusTimer = setTimeout(() => {
      try {
        amountInputRef.current?.focus();
      } catch {
        // Unsupported focus runtimes should not block Add Balance.
      }
    }, AMOUNT_INPUT_FOCUS_DELAY_MS);

    return () => {
      clearTimeout(focusTimer);
    };
  }, []);

  useEffect(() => {
    if (!isAddingType) return;

    const focusTimer = setTimeout(() => {
      try {
        typeNameInputRef.current?.focus();
      } catch {
        // Unsupported focus runtimes should not block Add Type.
      }
    }, NAME_INPUT_FOCUS_DELAY_MS);

    return () => {
      clearTimeout(focusTimer);
    };
  }, [isAddingType]);

  useEffect(() => {
    if (!isBalanceInitialized || !selectedTypeId) return;

    const isSelectedTypeActive = activeBalanceTypes.some(
      (balanceType) => balanceType.id === selectedTypeId,
    );

    if (!isSelectedTypeActive) setSelectedTypeId(null);
  }, [activeBalanceTypes, isBalanceInitialized, selectedTypeId]);

  function exitAddBalance() {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)');
    }
  }

  function handleHeaderBackPress() {
    if (isAddingType) {
      setIsAddingType(false);
      setTypeName('');
      setTypeNameError(null);
      clearBalanceError();

      return;
    }

    exitAddBalance();
  }

  function handleTypePress(typeId: string) {
    setSelectedTypeId(typeId);
    setTypeError(null);
  }

  function handleStartAddType() {
    clearBalanceError();
    setIsAddingType(true);
    setTypeName('');
    setTypeNameError(null);
  }

  async function handleSaveType() {
    if (isBalanceLoading) return;

    clearBalanceError();

    const validationError = validateBalanceTypeName({
      balanceTypes,
      name: typeName,
    });

    setTypeNameError(validationError);

    if (validationError) return;

    const normalizedName = normalizeBalanceTypeName(typeName);

    await addBalanceType({ name: normalizedName });

    if (!useBalanceStore.getState().error) {
      const createdType = getBalanceTypeByNormalizedName({
        balanceTypes: useBalanceStore.getState().activeBalanceTypes,
        name: normalizedName,
      });

      if (createdType) {
        setSelectedTypeId(createdType.id);
        setTypeError(null);
      }

      setIsAddingType(false);
      setTypeName('');
      setTypeNameError(null);
    }
  }

  async function handleSaveBalance() {
    if (isBalanceLoading || !isBalanceInitialized) return;

    clearBalanceError();

    const amountResult = parseAmountText(amountText);
    setAmountError(amountResult.error);

    const validTypeIds = new Set(
      activeBalanceTypes.map((balanceType) => balanceType.id),
    );
    const validSelectedTypeId =
      selectedTypeId && validTypeIds.has(selectedTypeId)
        ? selectedTypeId
        : null;
    const nextTypeError = validSelectedTypeId ? null : 'Choose a type.';

    setTypeError(nextTypeError);

    if (
      amountResult.error ||
      amountResult.amount === null ||
      !validSelectedTypeId
    ) {
      return;
    }

    const entry: BalanceEntryInput = {
      id: initialEntry?.id ?? generateBalanceEntryId(),
      amount: amountResult.amount,
      typeId: validSelectedTypeId,
      createdAt: selectedDate.getTime(),
    };

    await (onSubmit ?? addBalanceEntry)(entry);

    if (!useBalanceStore.getState().error) {
      exitAddBalance();
    }
  }

  const isSaveDisabled = isBalanceLoading || !isBalanceInitialized;

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
              title={isAddingType ? 'Add Type' : title}
            />

            {isAddingType ? (
              <View style={styles.formGroup}>
                <View style={styles.field}>
                  <FieldLabel>Name</FieldLabel>

                  <TextInput
                    ref={typeNameInputRef}
                    autoCapitalize="words"
                    autoCorrect={false}
                    onChangeText={(value) => {
                      setTypeName(value);
                      setTypeNameError(null);
                    }}
                    onSubmitEditing={() => {
                      void handleSaveType();
                    }}
                    placeholder="Bonus"
                    returnKeyType="done"
                    style={[
                      styles.nameInput,
                      typeNameError ? styles.inputFrameError : null,
                    ]}
                    value={typeName}
                  />

                  {typeNameError ? (
                    <ErrorText>{typeNameError}</ErrorText>
                  ) : null}
                  {balanceError ? <ErrorText>{balanceError}</ErrorText> : null}
                </View>
              </View>
            ) : (
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
                    accessibilityLabel="Choose balance date"
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
                  <View style={styles.sectionHeader}>
                    <FieldLabel>Type</FieldLabel>

                    <Pressable
                      accessibilityRole="button"
                      onPress={handleStartAddType}
                      style={styles.addTypeLink}
                    >
                      <SymbolIcon
                        color="#0088ff"
                        fallbackLabel="+"
                        name="plus"
                        size={16}
                      />
                      <Text style={styles.addTypeLinkText}>Add</Text>
                    </Pressable>
                  </View>

                  <View style={styles.chipList}>
                    {activeBalanceTypes.map((balanceType) => (
                      <TypeChip
                        key={balanceType.id}
                        isSelected={selectedTypeId === balanceType.id}
                        onPress={() => handleTypePress(balanceType.id)}
                        type={balanceType}
                      />
                    ))}
                  </View>

                  {!isBalanceInitialized ? (
                    <Text style={styles.metaText}>
                      Loading balance types...
                    </Text>
                  ) : null}

                  {isBalanceInitialized && activeBalanceTypes.length === 0 ? (
                    <Text style={styles.metaText}>
                      Add a balance type before saving.
                    </Text>
                  ) : null}

                  {typeError ? <ErrorText>{typeError}</ErrorText> : null}
                </View>

                {balanceError ? <ErrorText>{balanceError}</ErrorText> : null}
              </View>
            )}
          </ScrollView>

          <View style={styles.footer}>
            {isAddingType ? (
              <PrimaryAction
                isDisabled={isBalanceLoading}
                label={isBalanceLoading ? 'Saving...' : 'Save Type'}
                onPress={() => {
                  void handleSaveType();
                }}
              />
            ) : (
              <PrimaryAction
                isDisabled={isSaveDisabled}
                label={isBalanceLoading ? 'Saving...' : submitLabel}
                onPress={() => {
                  void handleSaveBalance();
                }}
              />
            )}
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
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  addTypeLink: {
    minHeight: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderRadius: 40,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  addTypeLinkText: {
    color: '#0088ff',
    fontSize: 15,
  },
  chipList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    minHeight: 43,
    alignItems: 'center',
    justifyContent: 'center',
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
  nameInput: {
    minHeight: 50,
    borderWidth: 1,
    borderColor: '#100f10',
    borderRadius: 999,
    paddingHorizontal: 16,
    color: '#000000',
    fontSize: 16,
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
