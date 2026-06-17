import { useRouter, type Href } from 'expo-router';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PeriodSelector } from '@/components/period-selector';
import { calculateCurrentBalance } from '@/features/home/calculate-current-balance';
import {
  getCategoryDisplayIconName,
  getCategoryDisplayName,
} from '@/lib/category-display';
import {
  getCategoryIcon,
  type CategoryIconDefinition,
} from '@/lib/category-icons';
import { getValidDate } from '@/lib/date-utils';
import { formatMoneyAmount } from '@/lib/display-formatters';
import {
  formatLanguageDate,
  getDefaultBalanceTypeName,
  getLeakReasonLabel,
  t,
} from '@/lib/i18n/i18n';
import type { SupportedLanguage } from '@/lib/i18n/languages';
import {
  filterItemsByPeriod,
  filterTransactionsByPeriod,
  getPeriodLabel,
  type PeriodScope,
} from '@/lib/period-scope';
import {
  clampSwipeTranslation,
  createHorizontalSwipePanResponder,
} from '@/lib/swipe-actions';
import { useBalanceRefresh } from '@/lib/use-balance-refresh';
import { useCategoriesRefresh } from '@/lib/use-categories-refresh';
import { useSettingsCurrency } from '@/lib/use-settings-currency';
import { useSettingsLanguage } from '@/lib/use-settings-language';
import { useTransactionsRefresh } from '@/lib/use-transactions-refresh';
import { useBalanceStore } from '@/store/balance-store';
import { useCategoriesStore } from '@/store/categories-store';
import { usePeriodScopeStore } from '@/store/period-scope-store';
import { useTransactionsStore } from '@/store/transactions-store';
import type { BalanceEntry, BalanceType } from '@/types/balance';
import type { Category } from '@/types/category';
import type { Transaction } from '@/types/transaction';

const TITLE_FONT_FAMILY = Platform.select({
  ios: 'NewYork',
  default: 'serif',
});

const TITLE_FONT_WEIGHT = Platform.select({
  ios: '500' as const,
  default: '800' as const,
});

const HOME_PERIOD_OPTIONS: PeriodScope[] = ['today', 'yesterday', 'this_week'];
const SWIPE_ACTION_WIDTH = 88;
function isSameLocalDay(firstDate: Date, secondDate: Date) {
  return (
    firstDate.getFullYear() === secondDate.getFullYear() &&
    firstDate.getMonth() === secondDate.getMonth() &&
    firstDate.getDate() === secondDate.getDate()
  );
}

function formatTransactionTimestamp(
  value: number,
  language: SupportedLanguage,
) {
  const date = getValidDate(value);

  if (!date) return t(language, 'home.unknownDate');

  if (isSameLocalDay(date, new Date())) {
    return formatLanguageDate(language, date, {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  return formatLanguageDate(language, date, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getBalanceTypeDisplayName({
  balanceTypes,
  language,
  typeId,
}: {
  balanceTypes: BalanceType[];
  language: SupportedLanguage;
  typeId: string;
}) {
  const balanceType = balanceTypes.find((candidate) => candidate.id === typeId);

  if (balanceType) {
    return balanceType.isDefault
      ? (getDefaultBalanceTypeName(language, balanceType.id) ??
          balanceType.name)
      : balanceType.name;
  }

  return (
    getDefaultBalanceTypeName(language, typeId) ??
    t(language, 'balanceType.fallback')
  );
}

type BalanceActionButtonProps = {
  label: string;
  onPress: () => void;
  symbolFallback: string;
  symbolName: SFSymbol;
  variant: 'outlined' | 'filled';
};

function BalanceActionButton({
  label,
  onPress,
  symbolFallback,
  symbolName,
  variant,
}: BalanceActionButtonProps) {
  const isFilled = variant === 'filled';
  const color = isFilled ? '#ffffff' : '#100f10';

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[
        styles.balanceActionButton,
        isFilled ? styles.balanceActionButtonFilled : null,
      ]}
    >
      <SymbolView
        fallback={
          <Text style={[styles.balanceActionSymbolFallback, { color }]}>
            {symbolFallback}
          </Text>
        }
        name={symbolName}
        resizeMode="scaleAspectFit"
        size={16}
        tintColor={color}
        type="monochrome"
        weight="semibold"
      />

      <Text
        style={[
          styles.balanceActionButtonText,
          isFilled ? styles.balanceActionButtonTextFilled : null,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

type SwipeActionIconProps = {
  fallbackLabel: string;
  name: SFSymbol;
};

function TransactionCategoryIcon({
  icon,
  transactionId,
}: {
  icon: CategoryIconDefinition;
  transactionId: string;
}) {
  return (
    <View style={styles.transactionIconSlot}>
      <SymbolView
        fallback={
          <Text style={styles.transactionIconFallback}>
            {icon.fallbackSymbol}
          </Text>
        }
        name={icon.symbolName}
        resizeMode="scaleAspectFit"
        size={18}
        testID={`transaction-category-icon-${transactionId}`}
        tintColor="#111111"
        type="monochrome"
        weight="semibold"
      />
    </View>
  );
}

function SwipeActionIcon({ fallbackLabel, name }: SwipeActionIconProps) {
  return (
    <SymbolView
      fallback={<Text style={styles.swipeActionFallback}>{fallbackLabel}</Text>}
      name={name}
      resizeMode="scaleAspectFit"
      size={26}
      tintColor="#ffffff"
      type="monochrome"
      weight="semibold"
    />
  );
}

type HistoryTransactionItemProps = {
  amountLabel: string;
  categories: Category[];
  isDeleting: boolean;
  isDisabled: boolean;
  isOpen: boolean;
  onDelete: (id: string) => void;
  onEdit: (id: string) => void;
  onSwipeClose: (id: string) => void;
  onSwipeInteractionStart: (id: string) => void;
  onSwipeOpen: (id: string) => void;
  transaction: Transaction;
  language: SupportedLanguage;
};

function HistoryTransactionItem({
  amountLabel,
  categories,
  isDeleting,
  isDisabled,
  isOpen,
  onDelete,
  onEdit,
  onSwipeClose,
  onSwipeInteractionStart,
  onSwipeOpen,
  transaction,
  language,
}: HistoryTransactionItemProps) {
  const translateX = useRef(new Animated.Value(0)).current;
  const isHorizontallyLockedRef = useRef(false);

  const animateTo = useCallback(
    (toValue: number) => {
      Animated.spring(translateX, {
        toValue,
        damping: 22,
        mass: 0.72,
        stiffness: 260,
        useNativeDriver: false,
      }).start();
    },
    [translateX],
  );

  const closeActions = useCallback(() => {
    animateTo(0);
    onSwipeClose(transaction.id);
  }, [animateTo, onSwipeClose, transaction.id]);

  const revealDelete = useCallback(() => {
    onSwipeOpen(transaction.id);
    animateTo(SWIPE_ACTION_WIDTH);
  }, [animateTo, onSwipeOpen, transaction.id]);

  const revealEdit = useCallback(() => {
    onSwipeOpen(transaction.id);
    animateTo(-SWIPE_ACTION_WIDTH);
  }, [animateTo, onSwipeOpen, transaction.id]);

  const handleTouchStart = useCallback(() => {
    if (isDisabled) return;

    onSwipeInteractionStart(transaction.id);
  }, [isDisabled, onSwipeInteractionStart, transaction.id]);

  const handleDeletePress = useCallback(() => {
    if (isDisabled) return;

    closeActions();
    onDelete(transaction.id);
  }, [closeActions, isDisabled, onDelete, transaction.id]);

  const handleEditPress = useCallback(() => {
    if (isDisabled) return;

    closeActions();
    onEdit(transaction.id);
  }, [closeActions, isDisabled, onEdit, transaction.id]);

  const panResponder = useMemo(
    () =>
      createHorizontalSwipePanResponder({
        close: closeActions,
        isDisabled,
        lockRef: isHorizontallyLockedRef,
        onGrant: () => {
          onSwipeInteractionStart(transaction.id);
          translateX.stopAnimation();
        },
        onMove: (dx) => {
          translateX.setValue(clampSwipeTranslation(dx, SWIPE_ACTION_WIDTH));
        },
        revealLeading: revealDelete,
        revealTrailing: revealEdit,
      }),
    [
      closeActions,
      isDisabled,
      onSwipeInteractionStart,
      revealDelete,
      revealEdit,
      transaction.id,
      translateX,
    ],
  );

  useEffect(() => {
    if (isDisabled) closeActions();
  }, [closeActions, isDisabled]);

  useEffect(() => {
    if (isOpen) return;

    animateTo(0);
  }, [animateTo, isOpen]);

  const isLeak = transaction.isLeak;
  const categoryIcon = getCategoryIcon(
    getCategoryDisplayIconName(transaction.category, categories),
  );
  const detailLabel =
    isLeak && transaction.leakReason
      ? getLeakReasonLabel(language, transaction.leakReason)
      : transaction.note;

  const cardBackgroundColor = translateX.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: ['#ffffff', '#f7f7f5', '#ffffff'],
  });

  return (
    <View style={styles.swipeContainer}>
      <View style={styles.swipeActionLayer}>
        <Pressable
          accessibilityLabel={t(language, 'home.deleteTransactionA11y')}
          accessibilityRole="button"
          disabled={isDisabled}
          onPress={handleDeletePress}
          style={[
            styles.swipeActionCircle,
            styles.deleteSwipeAction,
            isDisabled ? styles.swipeActionDisabled : null,
          ]}
        >
          <SwipeActionIcon fallbackLabel="Del" name="trash" />
        </Pressable>

        <Pressable
          accessibilityLabel={t(language, 'home.editTransactionA11y')}
          accessibilityRole="button"
          disabled={isDisabled}
          onPress={handleEditPress}
          style={[
            styles.swipeActionCircle,
            styles.editSwipeAction,
            isDisabled ? styles.swipeActionDisabled : null,
          ]}
        >
          <SwipeActionIcon fallbackLabel="Edit" name="pencil" />
        </Pressable>
      </View>

      <Animated.View
        {...panResponder.panHandlers}
        onTouchStart={handleTouchStart}
        style={[
          styles.transactionCard,
          isLeak ? styles.transactionCardLeak : styles.transactionCardNormal,
          {
            backgroundColor: cardBackgroundColor,
            transform: [{ translateX }],
          },
        ]}
        testID={`transaction-history-row-${transaction.id}`}
      >
        <View style={styles.transactionMainRow}>
          <View style={styles.transactionInfoRow}>
            <TransactionCategoryIcon
              icon={categoryIcon}
              transactionId={transaction.id}
            />

            <View style={styles.transactionCopy}>
              <Text numberOfLines={1} style={styles.categoryText}>
                {getCategoryDisplayName(
                  transaction.category,
                  categories,
                  language,
                )}
              </Text>

              <Text style={styles.timestampText}>
                {formatTransactionTimestamp(transaction.createdAt, language)}
              </Text>

              {detailLabel ? (
                <Text numberOfLines={1} style={styles.detailText}>
                  {detailLabel}
                </Text>
              ) : null}
            </View>
          </View>

          <Text style={[styles.amountText, styles.amountTextNegative]}>
            {amountLabel}
          </Text>
        </View>

        {isDeleting ? (
          <Text style={styles.deletingText}>
            {t(language, 'home.deleting')}
          </Text>
        ) : null}
      </Animated.View>
    </View>
  );
}

function HistoryBalanceItem({
  amountLabel,
  entry,
  isDeleting,
  isDisabled,
  isOpen,
  onDelete,
  onEdit,
  onSwipeClose,
  onSwipeInteractionStart,
  onSwipeOpen,
  typeName,
  language,
}: {
  amountLabel: string;
  entry: BalanceEntry;
  isDeleting: boolean;
  isDisabled: boolean;
  isOpen: boolean;
  onDelete: (id: string) => void;
  onEdit: (id: string) => void;
  onSwipeClose: (id: string) => void;
  onSwipeInteractionStart: (id: string) => void;
  onSwipeOpen: (id: string) => void;
  typeName: string;
  language: SupportedLanguage;
}) {
  const translateX = useRef(new Animated.Value(0)).current;
  const isHorizontallyLockedRef = useRef(false);

  const animateTo = useCallback(
    (toValue: number) => {
      Animated.spring(translateX, {
        toValue,
        damping: 22,
        mass: 0.72,
        stiffness: 260,
        useNativeDriver: false,
      }).start();
    },
    [translateX],
  );

  const closeActions = useCallback(() => {
    animateTo(0);
    onSwipeClose(entry.id);
  }, [animateTo, entry.id, onSwipeClose]);

  const revealDelete = useCallback(() => {
    onSwipeOpen(entry.id);
    animateTo(SWIPE_ACTION_WIDTH);
  }, [animateTo, entry.id, onSwipeOpen]);

  const revealEdit = useCallback(() => {
    onSwipeOpen(entry.id);
    animateTo(-SWIPE_ACTION_WIDTH);
  }, [animateTo, entry.id, onSwipeOpen]);

  const handleTouchStart = useCallback(() => {
    if (isDisabled) return;

    onSwipeInteractionStart(entry.id);
  }, [entry.id, isDisabled, onSwipeInteractionStart]);

  const handleDeletePress = useCallback(() => {
    if (isDisabled) return;

    closeActions();
    onDelete(entry.id);
  }, [closeActions, entry.id, isDisabled, onDelete]);

  const handleEditPress = useCallback(() => {
    if (isDisabled) return;

    closeActions();
    onEdit(entry.id);
  }, [closeActions, entry.id, isDisabled, onEdit]);

  const panResponder = useMemo(
    () =>
      createHorizontalSwipePanResponder({
        close: closeActions,
        isDisabled,
        lockRef: isHorizontallyLockedRef,
        onGrant: () => {
          onSwipeInteractionStart(entry.id);
          translateX.stopAnimation();
        },
        onMove: (dx) => {
          translateX.setValue(clampSwipeTranslation(dx, SWIPE_ACTION_WIDTH));
        },
        revealLeading: revealDelete,
        revealTrailing: revealEdit,
      }),
    [
      closeActions,
      entry.id,
      isDisabled,
      onSwipeInteractionStart,
      revealDelete,
      revealEdit,
      translateX,
    ],
  );

  useEffect(() => {
    if (isDisabled) closeActions();
  }, [closeActions, isDisabled]);

  useEffect(() => {
    if (isOpen) return;

    animateTo(0);
  }, [animateTo, isOpen]);

  const cardBackgroundColor = translateX.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: ['#ffffff', '#f7f7f5', '#ffffff'],
  });

  return (
    <View style={styles.swipeContainer}>
      <View style={styles.swipeActionLayer}>
        <Pressable
          accessibilityLabel={t(language, 'home.deleteBalanceA11y')}
          accessibilityRole="button"
          disabled={isDisabled}
          onPress={handleDeletePress}
          style={[
            styles.swipeActionCircle,
            styles.deleteSwipeAction,
            isDisabled ? styles.swipeActionDisabled : null,
          ]}
        >
          <SwipeActionIcon fallbackLabel="Del" name="trash" />
        </Pressable>

        <Pressable
          accessibilityLabel={t(language, 'home.editBalanceA11y')}
          accessibilityRole="button"
          disabled={isDisabled}
          onPress={handleEditPress}
          style={[
            styles.swipeActionCircle,
            styles.editSwipeAction,
            isDisabled ? styles.swipeActionDisabled : null,
          ]}
        >
          <SwipeActionIcon fallbackLabel="Edit" name="pencil" />
        </Pressable>
      </View>

      <Animated.View
        {...panResponder.panHandlers}
        onTouchStart={handleTouchStart}
        style={[
          styles.transactionCard,
          styles.balanceEntryCard,
          {
            backgroundColor: cardBackgroundColor,
            transform: [{ translateX }],
          },
        ]}
        testID={`balance-history-row-${entry.id}`}
      >
        <View style={styles.transactionMainRow}>
          <View style={styles.transactionInfoRow}>
            <View style={styles.transactionIconSlot}>
              <SymbolView
                fallback={<Text style={styles.balanceIconFallback}>+</Text>}
                name="arrow.down.left"
                resizeMode="scaleAspectFit"
                size={18}
                testID={`balance-entry-icon-${entry.id}`}
                tintColor="#111111"
                type="monochrome"
                weight="semibold"
              />
            </View>

            <View style={styles.transactionCopy}>
              <Text numberOfLines={1} style={styles.categoryText}>
                {typeName}
              </Text>

              <Text style={styles.timestampText}>
                {formatTransactionTimestamp(entry.createdAt, language)}
              </Text>
            </View>
          </View>

          <Text style={[styles.amountText, styles.amountTextPositive]}>
            {amountLabel}
          </Text>
        </View>

        {isDeleting ? (
          <Text style={styles.deletingText}>
            {t(language, 'home.deleting')}
          </Text>
        ) : null}
      </Animated.View>
    </View>
  );
}

type HistoryFeedItem =
  | {
      createdAt: number;
      id: string;
      kind: 'transaction';
      transaction: Transaction;
    }
  | {
      createdAt: number;
      entry: BalanceEntry;
      id: string;
      kind: 'balance';
    };

export function HomeScreen() {
  const router = useRouter();
  const currency = useSettingsCurrency();
  const language = useSettingsLanguage();
  const transactions = useTransactionsStore((state) => state.transactions);
  const isLoading = useTransactionsStore((state) => state.isLoading);
  const isInitialized = useTransactionsStore((state) => state.isInitialized);
  const error = useTransactionsStore((state) => state.error);
  const balanceEntries = useBalanceStore((state) => state.balanceEntries);
  const balanceTypes = useBalanceStore((state) => state.balanceTypes);
  const isBalanceLoading = useBalanceStore((state) => state.isLoading);
  const isBalanceInitialized = useBalanceStore((state) => state.isInitialized);
  const loadBalance = useBalanceStore((state) => state.loadBalance);
  const removeBalanceEntry = useBalanceStore(
    (state) => state.removeBalanceEntry,
  );
  const selectedPeriod = usePeriodScopeStore((state) => state.selectedPeriod);
  const categories = useCategoriesStore((state) => state.categories);

  const areCategoriesInitialized = useCategoriesStore(
    (state) => state.isInitialized,
  );

  const selectedCustomDateStart = usePeriodScopeStore(
    (state) => state.selectedCustomDateStart,
  );

  const setSelectedPeriod = usePeriodScopeStore(
    (state) => state.setSelectedPeriod,
  );

  const setSelectedCustomDate = usePeriodScopeStore(
    (state) => state.setSelectedCustomDate,
  );

  const homeSelectedPeriod = HOME_PERIOD_OPTIONS.includes(selectedPeriod)
    ? selectedPeriod
    : 'today';

  const filteredTransactions = filterTransactionsByPeriod({
    transactions,
    period: homeSelectedPeriod,
    selectedCustomDateStart,
  });
  const filteredBalanceEntries = filterItemsByPeriod({
    items: balanceEntries,
    period: homeSelectedPeriod,
    selectedCustomDateStart,
  });

  const historyItems = useMemo<HistoryFeedItem[]>(() => {
    const transactionItems: HistoryFeedItem[] = filteredTransactions.map(
      (transaction) => ({
        createdAt: transaction.createdAt,
        id: `transaction:${transaction.id}`,
        kind: 'transaction',
        transaction,
      }),
    );

    const balanceItems: HistoryFeedItem[] = filteredBalanceEntries.map(
      (entry) => ({
        createdAt: entry.createdAt,
        entry,
        id: `balance:${entry.id}`,
        kind: 'balance',
      }),
    );

    return [...transactionItems, ...balanceItems].sort((first, second) => {
      const createdAtDiff = second.createdAt - first.createdAt;

      if (createdAtDiff !== 0) return createdAtDiff;

      return second.id.localeCompare(first.id);
    });
  }, [filteredBalanceEntries, filteredTransactions]);

  const currentBalance = calculateCurrentBalance({
    balanceEntries,
    transactions,
  });
  const hasHistoryItems = historyItems.length > 0;
  const hasAnyHistoryItems =
    transactions.length > 0 || balanceEntries.length > 0;
  const isHistoryRefreshing = isLoading || isBalanceLoading;

  const selectedPeriodLabel = getPeriodLabel(
    homeSelectedPeriod,
    selectedCustomDateStart,
    language,
  );

  const [deletingTransactionId, setDeletingTransactionId] = useState<
    string | null
  >(null);
  const [deletingBalanceEntryId, setDeletingBalanceEntryId] = useState<
    string | null
  >(null);

  const [openSwipeTransactionId, setOpenSwipeTransactionId] = useState<
    string | null
  >(null);
  const [openSwipeBalanceEntryId, setOpenSwipeBalanceEntryId] = useState<
    string | null
  >(null);

  const loadTransactions = useTransactionsStore(
    (state) => state.loadTransactions,
  );

  const loadCategories = useCategoriesStore((state) => state.loadCategories);

  const removeTransaction = useTransactionsStore(
    (state) => state.removeTransaction,
  );

  useTransactionsRefresh({
    isInitialized,
    loadTransactions,
    loadOnMount: 'always',
  });

  useBalanceRefresh({
    isInitialized: isBalanceInitialized,
    loadBalance,
    loadOnMount: 'always',
  });

  useCategoriesRefresh({
    isInitialized: areCategoriesInitialized,
    loadCategories,
  });

  useEffect(() => {
    if (HOME_PERIOD_OPTIONS.includes(selectedPeriod)) return;

    setSelectedPeriod('today');
  }, [selectedPeriod, setSelectedPeriod]);

  useEffect(() => {
    if (!openSwipeTransactionId) return;

    const isOpenTransactionVisible = filteredTransactions.some(
      (transaction) => transaction.id === openSwipeTransactionId,
    );

    if (isOpenTransactionVisible) return;

    setOpenSwipeTransactionId(null);
  }, [filteredTransactions, openSwipeTransactionId]);

  useEffect(() => {
    if (!openSwipeBalanceEntryId) return;

    const isOpenBalanceEntryVisible = filteredBalanceEntries.some(
      (entry) => entry.id === openSwipeBalanceEntryId,
    );

    if (isOpenBalanceEntryVisible) return;

    setOpenSwipeBalanceEntryId(null);
  }, [filteredBalanceEntries, openSwipeBalanceEntryId]);

  useEffect(() => {
    if (
      !isLoading &&
      !isBalanceLoading &&
      deletingTransactionId === null &&
      deletingBalanceEntryId === null
    ) {
      return;
    }

    setOpenSwipeTransactionId(null);
    setOpenSwipeBalanceEntryId(null);
  }, [
    deletingBalanceEntryId,
    deletingTransactionId,
    isBalanceLoading,
    isLoading,
  ]);

  const handleSwipeInteractionStart = useCallback((id: string) => {
    setOpenSwipeTransactionId((currentId) =>
      currentId === id ? currentId : null,
    );
    setOpenSwipeBalanceEntryId(null);
  }, []);

  const handleSwipeOpen = useCallback((id: string) => {
    setOpenSwipeTransactionId(id);
  }, []);

  const handleSwipeClose = useCallback((id: string) => {
    setOpenSwipeTransactionId((currentId) =>
      currentId === id ? null : currentId,
    );
  }, []);

  const handleBalanceSwipeInteractionStart = useCallback((id: string) => {
    setOpenSwipeBalanceEntryId((currentId) =>
      currentId === id ? currentId : null,
    );
    setOpenSwipeTransactionId(null);
  }, []);

  const handleBalanceSwipeOpen = useCallback((id: string) => {
    setOpenSwipeBalanceEntryId(id);
  }, []);

  const handleBalanceSwipeClose = useCallback((id: string) => {
    setOpenSwipeBalanceEntryId((currentId) =>
      currentId === id ? null : currentId,
    );
  }, []);

  const handleDeleteTransaction = useCallback(
    (id: string) => {
      if (
        isLoading ||
        isBalanceLoading ||
        deletingTransactionId ||
        deletingBalanceEntryId
      ) {
        return;
      }

      Alert.alert(
        t(language, 'home.deleteTransactionTitle'),
        t(language, 'home.deleteTransactionMessage'),
        [
          {
            text: t(language, 'common.cancel'),
            style: 'cancel',
          },
          {
            text: t(language, 'common.delete'),
            style: 'destructive',
            onPress: () => {
              setDeletingTransactionId(id);

              void removeTransaction(id).finally(() => {
                setDeletingTransactionId(null);
              });
            },
          },
        ],
      );
    },
    [
      deletingBalanceEntryId,
      deletingTransactionId,
      isBalanceLoading,
      isLoading,
      language,
      removeTransaction,
    ],
  );

  const handleEditTransaction = useCallback(
    (id: string) => {
      if (deletingTransactionId !== null || deletingBalanceEntryId !== null) {
        return;
      }

      router.push(`/transaction/${id}/edit` as Href);
    },
    [deletingBalanceEntryId, deletingTransactionId, router],
  );

  const handleDeleteBalanceEntry = useCallback(
    (id: string) => {
      if (
        isLoading ||
        isBalanceLoading ||
        deletingTransactionId ||
        deletingBalanceEntryId
      ) {
        return;
      }

      Alert.alert(
        t(language, 'home.deleteBalanceTitle'),
        t(language, 'home.deleteBalanceMessage'),
        [
          {
            text: t(language, 'common.cancel'),
            style: 'cancel',
          },
          {
            text: t(language, 'common.delete'),
            style: 'destructive',
            onPress: () => {
              setDeletingBalanceEntryId(id);

              void removeBalanceEntry(id).finally(() => {
                setDeletingBalanceEntryId(null);
              });
            },
          },
        ],
      );
    },
    [
      deletingBalanceEntryId,
      deletingTransactionId,
      isBalanceLoading,
      isLoading,
      language,
      removeBalanceEntry,
    ],
  );

  const handleEditBalanceEntry = useCallback(
    (id: string) => {
      if (deletingTransactionId !== null || deletingBalanceEntryId !== null) {
        return;
      }

      router.push(`/balance/${id}/edit` as Href);
    },
    [deletingBalanceEntryId, deletingTransactionId, router],
  );

  const handleMorePress = useCallback(() => {
    router.push('/analytics' as Href);
  }, [router]);

  const handleAddBalancePress = useCallback(() => {
    router.push('/add-balance' as Href);
  }, [router]);

  const handleSpendPress = useCallback(() => {
    router.push('/add-transaction' as Href);
  }, [router]);

  if (!isInitialized) {
    return (
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
        <View style={styles.centeredState}>
          <Text style={styles.stateTitle}>
            {t(language, 'home.loadingTitle')}
          </Text>

          <Text style={styles.stateMessage}>
            {t(language, 'home.loadingMessage')}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error && !hasAnyHistoryItems) {
    return (
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.stateContent}>
          <View style={styles.centeredState}>
            <Text style={styles.stateTitle}>
              {t(language, 'home.loadErrorTitle')}
            </Text>

            <Text style={styles.stateMessage}>
              {t(language, 'home.loadErrorMessage')}
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.pageTitle}>{t(language, 'home.pageTitle')}</Text>

        <View style={styles.balanceHero}>
          <View style={styles.balanceCopy}>
            <Text style={styles.sectionTitle}>
              {t(language, 'home.balance')}
            </Text>

            <Text style={styles.balanceAmount}>
              {formatMoneyAmount({ amount: currentBalance, currency })}
            </Text>
          </View>

          <View style={styles.balanceActions}>
            <BalanceActionButton
              label={t(language, 'common.add')}
              onPress={handleAddBalancePress}
              symbolFallback="↙"
              symbolName="arrow.down.left"
              variant="outlined"
            />

            <BalanceActionButton
              label={t(language, 'home.spend')}
              onPress={handleSpendPress}
              symbolFallback="↗"
              symbolName="arrow.up.right"
              variant="filled"
            />
          </View>
        </View>

        <View style={styles.section}>
          <PeriodSelector
            periods={HOME_PERIOD_OPTIONS}
            selectedPeriod={homeSelectedPeriod}
            selectedCustomDateStart={selectedCustomDateStart}
            onSelectPeriod={setSelectedPeriod}
            onSelectCustomDate={setSelectedCustomDate}
            language={language}
          />

          <View style={styles.transactionsGroup}>
            <View style={styles.historyHeader}>
              <Text style={styles.sectionTitle}>
                {t(language, 'home.transactions')}
              </Text>

              <Pressable
                accessibilityRole="button"
                onPress={handleMorePress}
                style={styles.moreButton}
              >
                <Text style={styles.moreButtonText}>
                  {t(language, 'home.more')}
                </Text>

                <SymbolView
                  fallback={<Text style={styles.moreButtonText}>{'>'}</Text>}
                  name="arrow.up.right"
                  resizeMode="scaleAspectFit"
                  size={14}
                  tintColor="#0088ff"
                  type="monochrome"
                  weight="semibold"
                />
              </Pressable>
            </View>

            {isHistoryRefreshing ? (
              <Text style={styles.refreshingText}>
                {t(language, 'home.refreshingTransactions')}
              </Text>
            ) : null}

            {error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>
                  {t(language, 'home.refreshError')}
                </Text>
              </View>
            ) : null}

            {hasHistoryItems ? (
              <View style={styles.transactionList}>
                {historyItems.map((item) => {
                  if (item.kind === 'balance') {
                    const isDeletingThisBalanceEntry =
                      deletingBalanceEntryId === item.entry.id;
                    const isBalanceActionDisabled =
                      isLoading ||
                      isBalanceLoading ||
                      deletingTransactionId !== null ||
                      deletingBalanceEntryId !== null;

                    return (
                      <HistoryBalanceItem
                        amountLabel={formatMoneyAmount({
                          amount: item.entry.amount,
                          currency,
                          sign: '+',
                        })}
                        entry={item.entry}
                        isDeleting={isDeletingThisBalanceEntry}
                        isDisabled={isBalanceActionDisabled}
                        isOpen={openSwipeBalanceEntryId === item.entry.id}
                        key={item.id}
                        onDelete={handleDeleteBalanceEntry}
                        onEdit={handleEditBalanceEntry}
                        onSwipeClose={handleBalanceSwipeClose}
                        onSwipeInteractionStart={
                          handleBalanceSwipeInteractionStart
                        }
                        onSwipeOpen={handleBalanceSwipeOpen}
                        typeName={getBalanceTypeDisplayName({
                          balanceTypes,
                          language,
                          typeId: item.entry.typeId,
                        })}
                        language={language}
                      />
                    );
                  }

                  const { transaction } = item;
                  const isDeletingThisTransaction =
                    deletingTransactionId === transaction.id;

                  const isTransactionActionDisabled =
                    isLoading ||
                    isBalanceLoading ||
                    deletingTransactionId !== null ||
                    deletingBalanceEntryId !== null;

                  return (
                    <HistoryTransactionItem
                      categories={categories}
                      amountLabel={formatMoneyAmount({
                        amount: transaction.amount,
                        currency,
                        sign: '-',
                      })}
                      isDeleting={isDeletingThisTransaction}
                      isDisabled={isTransactionActionDisabled}
                      isOpen={openSwipeTransactionId === transaction.id}
                      key={item.id}
                      onDelete={handleDeleteTransaction}
                      onEdit={handleEditTransaction}
                      onSwipeClose={handleSwipeClose}
                      onSwipeInteractionStart={handleSwipeInteractionStart}
                      onSwipeOpen={handleSwipeOpen}
                      transaction={transaction}
                      language={language}
                    />
                  );
                })}
              </View>
            ) : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>
                  {hasAnyHistoryItems
                    ? t(language, 'home.noTransactionsFor', {
                        period: selectedPeriodLabel,
                      })
                    : t(language, 'home.noTransactionsYet')}
                </Text>

                <Text style={styles.emptyMessage}>
                  {hasAnyHistoryItems
                    ? t(language, 'home.noTransactionsForMessage', {
                        period: selectedPeriodLabel.toLocaleLowerCase(),
                      })
                    : t(language, 'home.noTransactionsYetMessage')}
                </Text>
              </View>
            )}
          </View>
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
    alignItems: 'center',
    paddingHorizontal: 21,
    paddingTop: 0,
    paddingBottom: 168,
    gap: 32,
  },
  stateContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 156,
  },
  centeredState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  pageTitle: {
    width: '100%',
    maxWidth: 360,
    fontFamily: TITLE_FONT_FAMILY,
    fontSize: 36,
    lineHeight: 43,
    fontWeight: TITLE_FONT_WEIGHT,
    color: '#0f0f0f',
  },
  balanceHero: {
    width: '100%',
    maxWidth: 360,
    gap: 24,
  },
  balanceCopy: {
    width: '100%',
    alignItems: 'flex-start',
    gap: 16,
  },
  balanceAmount: {
    fontSize: 40,
    lineHeight: 48,
    fontWeight: '500',
    textAlign: 'left',
    color: '#000000',
  },
  balanceActions: {
    flexDirection: 'row',
    gap: 16,
  },
  balanceActionButton: {
    minHeight: 50,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#100f10',
    borderRadius: 999,
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  balanceActionButtonFilled: {
    backgroundColor: '#100f10',
  },
  balanceActionButtonText: {
    fontSize: 17,
    lineHeight: 22,
    color: '#100f10',
  },
  balanceActionButtonTextFilled: {
    color: '#ffffff',
  },
  balanceActionSymbolFallback: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
  },
  section: {
    width: '100%',
    maxWidth: 360,
    gap: 24,
  },
  sectionTitle: {
    fontFamily: TITLE_FONT_FAMILY,
    fontSize: 24,
    lineHeight: 31,
    fontWeight: TITLE_FONT_WEIGHT,
    color: '#0f0f0f',
  },
  transactionsGroup: {
    gap: 8,
  },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  moreButton: {
    minHeight: 32,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 2,
  },
  moreButtonText: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '400',
    color: '#0088ff',
  },
  stateTitle: {
    fontFamily: TITLE_FONT_FAMILY,
    fontSize: 24,
    fontWeight: TITLE_FONT_WEIGHT,
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
    borderRadius: 8,
    backgroundColor: '#fef2f2',
    padding: 14,
  },
  errorText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#b91c1c',
  },
  transactionList: {
    gap: 0,
  },
  emptyState: {
    gap: 8,
    paddingVertical: 18,
  },
  emptyTitle: {
    fontFamily: TITLE_FONT_FAMILY,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: TITLE_FONT_WEIGHT,
    color: '#111111',
  },
  emptyMessage: {
    fontSize: 15,
    lineHeight: 22,
    color: '#5d5d5d',
  },
  swipeContainer: {
    minHeight: 100,
    overflow: 'hidden',
    borderRadius: 24,
  },
  swipeActionLayer: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  swipeActionCircle: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 26,
  },
  swipeActionDisabled: {
    opacity: 0.5,
  },
  deleteSwipeAction: {
    backgroundColor: '#ff3b45',
  },
  editSwipeAction: {
    backgroundColor: '#34c759',
  },
  swipeActionFallback: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
    color: '#ffffff',
  },
  transactionCard: {
    minHeight: 100,
    justifyContent: 'flex-start',
    borderRadius: 24,
    paddingHorizontal: 8,
    paddingVertical: 16,
    gap: 4,
  },
  transactionCardNormal: {
    backgroundColor: '#f7f7f5',
  },
  transactionCardLeak: {
    backgroundColor: '#f7f7f5',
  },
  transactionMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  transactionInfoRow: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  transactionIconSlot: {
    width: 24,
    minHeight: 22,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 1,
  },
  transactionIconFallback: {
    color: '#111111',
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '800',
    textAlign: 'center',
  },
  balanceIconFallback: {
    color: '#111111',
    fontSize: 17,
    lineHeight: 20,
    fontWeight: '900',
    textAlign: 'center',
  },
  transactionCopy: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  categoryText: {
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '600',
    color: '#111111',
  },
  amountText: {
    flexShrink: 0,
    fontSize: 20,
    lineHeight: 25,
    fontWeight: '600',
    textAlign: 'right',
    color: '#050505',
  },
  amountTextNegative: {
    color: '#050505',
  },
  amountTextPositive: {
    color: '#34c759',
  },
  balanceEntryCard: {
    backgroundColor: '#f7f7f5',
  },
  timestampText: {
    fontSize: 16,
    lineHeight: 21,
    color: '#111111',
  },
  detailText: {
    fontSize: 13,
    lineHeight: 18,
    color: '#2d2d2a',
  },
  deletingText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
    textAlign: 'right',
    color: '#c22121',
  },
});
