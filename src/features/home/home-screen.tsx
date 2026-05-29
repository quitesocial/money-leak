import { useRouter, type Href } from 'expo-router';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  PanResponder,
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
import { calculateDailyReviewSummary } from '@/features/home/calculate-daily-review-summary';
import {
  getCategoryDisplayIconName,
  getCategoryDisplayName,
} from '@/lib/category-display';
import {
  getCategoryIcon,
  type CategoryIconDefinition,
} from '@/lib/category-icons';
import { getValidDate } from '@/lib/date-utils';
import {
  formatEuro,
  formatLabel,
  formatPercentage,
} from '@/lib/display-formatters';
import {
  filterTransactionsByPeriod,
  getPeriodLabel,
  type PeriodScope,
} from '@/lib/period-scope';
import { useBalanceRefresh } from '@/lib/use-balance-refresh';
import { useCategoriesRefresh } from '@/lib/use-categories-refresh';
import { useTransactionsRefresh } from '@/lib/use-transactions-refresh';
import { useBalanceStore } from '@/store/balance-store';
import { useCategoriesStore } from '@/store/categories-store';
import { usePeriodScopeStore } from '@/store/period-scope-store';
import { useTransactionsStore } from '@/store/transactions-store';
import type { Category } from '@/types/category';
import type { Transaction } from '@/types/transaction';

const TITLE_FONT_FAMILY = Platform.select({
  ios: 'NewYork',
  default: 'serif',
});

const TITLE_FONT_WEIGHT = Platform.select({
  ios: '700' as const,
  default: '800' as const,
});

const HOME_PERIOD_OPTIONS: PeriodScope[] = ['today', 'yesterday', 'this_week'];
const SWIPE_ACTION_WIDTH = 88;
const HORIZONTAL_ACTIVATION_DISTANCE = 10;
const VERTICAL_SCROLL_DISTANCE = 8;
const HORIZONTAL_INTENT_RATIO = 0.75;
const SWIPE_OPEN_THRESHOLD = 44;
const SWIPE_VELOCITY_THRESHOLD = 0.35;

const timeFormatter = new Intl.DateTimeFormat(undefined, {
  hour: '2-digit',
  minute: '2-digit',
});

const shortDateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

function isSameLocalDay(firstDate: Date, secondDate: Date) {
  return (
    firstDate.getFullYear() === secondDate.getFullYear() &&
    firstDate.getMonth() === secondDate.getMonth() &&
    firstDate.getDate() === secondDate.getDate()
  );
}

function formatTransactionTimestamp(value: number) {
  const date = getValidDate(value);

  if (!date) return 'Unknown date';

  if (isSameLocalDay(date, new Date())) return timeFormatter.format(date);

  return shortDateTimeFormatter.format(date);
}

function clampSwipeTranslation(value: number) {
  return Math.max(-SWIPE_ACTION_WIDTH, Math.min(SWIPE_ACTION_WIDTH, value));
}

function hasHorizontalSwipeIntent({ dx, dy }: { dx: number; dy: number }) {
  const absoluteDx = Math.abs(dx);
  const absoluteDy = Math.abs(dy);

  if (
    absoluteDx < HORIZONTAL_ACTIVATION_DISTANCE &&
    absoluteDy < VERTICAL_SCROLL_DISTANCE
  ) {
    return false;
  }

  if (absoluteDy >= VERTICAL_SCROLL_DISTANCE && absoluteDy > absoluteDx) {
    return false;
  }

  return (
    absoluteDx >= HORIZONTAL_ACTIVATION_DISTANCE &&
    absoluteDy <= absoluteDx * HORIZONTAL_INTENT_RATIO
  );
}

type SummaryRowProps = {
  label: string;
  value: string;
};

type BalanceActionButtonProps = {
  label: string;
  onPress: () => void;
  symbolFallback: string;
  symbolName: SFSymbol;
  variant: 'outlined' | 'filled';
};

function SummaryRow({ label, value }: SummaryRowProps) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

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
};

function HistoryTransactionItem({
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
      PanResponder.create({
        onMoveShouldSetPanResponder: (_event, gestureState) => {
          if (isDisabled) return false;

          const shouldLockSwipe = hasHorizontalSwipeIntent(gestureState);
          isHorizontallyLockedRef.current = shouldLockSwipe;

          return shouldLockSwipe;
        },
        onMoveShouldSetPanResponderCapture: (_event, gestureState) => {
          if (isDisabled) return false;

          const shouldLockSwipe = hasHorizontalSwipeIntent(gestureState);
          isHorizontallyLockedRef.current = shouldLockSwipe;

          return shouldLockSwipe;
        },
        onPanResponderGrant: () => {
          onSwipeInteractionStart(transaction.id);
          translateX.stopAnimation();
        },
        onPanResponderMove: (_event, gestureState) => {
          if (isDisabled || !isHorizontallyLockedRef.current) return;

          translateX.setValue(clampSwipeTranslation(gestureState.dx));
        },
        onPanResponderRelease: (_event, gestureState) => {
          const wasHorizontallyLocked = isHorizontallyLockedRef.current;
          isHorizontallyLockedRef.current = false;

          if (!wasHorizontallyLocked) {
            closeActions();

            return;
          }

          if (
            gestureState.dx > SWIPE_OPEN_THRESHOLD ||
            gestureState.vx > SWIPE_VELOCITY_THRESHOLD
          ) {
            revealDelete();

            return;
          }

          if (
            gestureState.dx < -SWIPE_OPEN_THRESHOLD ||
            gestureState.vx < -SWIPE_VELOCITY_THRESHOLD
          ) {
            revealEdit();

            return;
          }

          closeActions();
        },
        onPanResponderTerminationRequest: () =>
          !isHorizontallyLockedRef.current,
        onPanResponderTerminate: () => {
          isHorizontallyLockedRef.current = false;
          closeActions();
        },
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

  const cardBackgroundColor = translateX.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: ['#ffffff', '#f7f7f5', '#ffffff'],
  });

  return (
    <View style={styles.swipeContainer}>
      <View style={styles.swipeActionLayer}>
        <Pressable
          accessibilityLabel="Delete transaction"
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
          accessibilityLabel="Edit transaction"
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
      >
        <View style={styles.transactionMainRow}>
          <View style={styles.transactionInfoRow}>
            <TransactionCategoryIcon
              icon={categoryIcon}
              transactionId={transaction.id}
            />

            <View style={styles.transactionCopy}>
              <View style={styles.categoryRow}>
                <Text style={styles.categoryText}>
                  {getCategoryDisplayName(transaction.category, categories)}
                </Text>

                <View
                  style={[
                    styles.typeBadge,
                    isLeak ? styles.typeBadgeLeak : styles.typeBadgeNormal,
                  ]}
                >
                  <Text
                    style={[
                      styles.typeBadgeText,
                      isLeak
                        ? styles.typeBadgeTextLeak
                        : styles.typeBadgeTextNormal,
                    ]}
                  >
                    {isLeak ? 'Leak' : 'Normal'}
                  </Text>
                </View>
              </View>

              <Text style={styles.timestampText}>
                {formatTransactionTimestamp(transaction.createdAt)}
              </Text>
            </View>
          </View>

          <Text style={styles.amountText}>
            {formatEuro(transaction.amount)}
          </Text>
        </View>

        {isLeak && transaction.leakReason ? (
          <Text style={styles.detailText}>
            {formatLabel(transaction.leakReason)}
          </Text>
        ) : null}

        {transaction.note ? (
          <Text style={styles.noteText}>{transaction.note}</Text>
        ) : null}

        {isDeleting ? (
          <Text style={styles.deletingText}>Deleting...</Text>
        ) : null}
      </Animated.View>
    </View>
  );
}

export function HomeScreen() {
  const router = useRouter();
  const transactions = useTransactionsStore((state) => state.transactions);
  const isLoading = useTransactionsStore((state) => state.isLoading);
  const isInitialized = useTransactionsStore((state) => state.isInitialized);
  const error = useTransactionsStore((state) => state.error);
  const balanceEntries = useBalanceStore((state) => state.balanceEntries);
  const isBalanceInitialized = useBalanceStore((state) => state.isInitialized);
  const loadBalance = useBalanceStore((state) => state.loadBalance);
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

  const currentBalance = calculateCurrentBalance({
    balanceEntries,
    transactions,
  });
  const todaySummary = calculateDailyReviewSummary({ transactions });
  const hasTransactions = filteredTransactions.length > 0;
  const hasAnyTransactions = transactions.length > 0;
  const hasTodayTransactions = todaySummary.transactionCount > 0;

  const selectedPeriodLabel = getPeriodLabel(
    homeSelectedPeriod,
    selectedCustomDateStart,
  );

  const [deletingTransactionId, setDeletingTransactionId] = useState<
    string | null
  >(null);

  const [openSwipeTransactionId, setOpenSwipeTransactionId] = useState<
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
    if (!isLoading && deletingTransactionId === null) return;

    setOpenSwipeTransactionId(null);
  }, [deletingTransactionId, isLoading]);

  const handleSwipeInteractionStart = useCallback((id: string) => {
    setOpenSwipeTransactionId((currentId) =>
      currentId === id ? currentId : null,
    );
  }, []);

  const handleSwipeOpen = useCallback((id: string) => {
    setOpenSwipeTransactionId(id);
  }, []);

  const handleSwipeClose = useCallback((id: string) => {
    setOpenSwipeTransactionId((currentId) =>
      currentId === id ? null : currentId,
    );
  }, []);

  const handleDeleteTransaction = useCallback(
    (id: string) => {
      if (isLoading || deletingTransactionId) return;

      Alert.alert(
        'Delete transaction?',
        'This will permanently remove this expense from your leak history.',
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Delete',
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
    [deletingTransactionId, isLoading, removeTransaction],
  );

  const handleEditTransaction = useCallback(
    (id: string) => {
      if (deletingTransactionId !== null) return;

      router.push(`/transaction/${id}/edit` as Href);
    },
    [deletingTransactionId, router],
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
          <Text style={styles.stateTitle}>Loading transactions</Text>

          <Text style={styles.stateMessage}>
            Getting your latest expenses ready.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error && !hasAnyTransactions) {
    return (
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.stateContent}>
          <View style={styles.centeredState}>
            <Text style={styles.stateTitle}>
              {"Couldn't load transactions"}
            </Text>

            <Text style={styles.stateMessage}>{error}</Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.pageTitle}>Home</Text>

        <View style={styles.balanceHero}>
          <Text style={styles.balanceAmount}>{formatEuro(currentBalance)}</Text>

          <View style={styles.balanceActions}>
            <BalanceActionButton
              label="Add"
              onPress={handleAddBalancePress}
              symbolFallback="↙"
              symbolName="arrow.down.left"
              variant="outlined"
            />

            <BalanceActionButton
              label="Spend"
              onPress={handleSpendPress}
              symbolFallback="↗"
              symbolName="arrow.up.right"
              variant="filled"
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Today summary</Text>

          <View style={styles.summaryRows}>
            <SummaryRow
              label="Total"
              value={formatEuro(todaySummary.totalSpent)}
            />

            <SummaryRow
              label="Leak"
              value={formatEuro(todaySummary.totalLeaks)}
            />

            <SummaryRow
              label="Leak %"
              value={formatPercentage(todaySummary.leakPercentage)}
            />
          </View>

          <Text style={styles.summaryMessage}>
            {hasTodayTransactions
              ? todaySummary.totalLeaks > 0
                ? "Today's leaks are worth noticing."
                : 'No leaks logged today.'
              : 'No expenses logged today yet.'}
          </Text>
        </View>

        <View style={styles.section}>
          <View style={styles.historyHeader}>
            <Text style={styles.sectionTitle}>History</Text>

            <Pressable
              accessibilityRole="button"
              onPress={handleMorePress}
              style={styles.moreButton}
            >
              <Text style={styles.moreButtonText}>More</Text>

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

          <PeriodSelector
            periods={HOME_PERIOD_OPTIONS}
            selectedPeriod={homeSelectedPeriod}
            selectedCustomDateStart={selectedCustomDateStart}
            onSelectPeriod={setSelectedPeriod}
            onSelectCustomDate={setSelectedCustomDate}
          />

          {isLoading ? (
            <Text style={styles.refreshingText}>
              Refreshing transactions...
            </Text>
          ) : null}

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {hasTransactions ? (
            <View style={styles.transactionList}>
              {filteredTransactions.map((transaction) => {
                const isDeletingThisTransaction =
                  deletingTransactionId === transaction.id;

                const isTransactionActionDisabled =
                  isLoading || deletingTransactionId !== null;

                return (
                  <HistoryTransactionItem
                    categories={categories}
                    isDeleting={isDeletingThisTransaction}
                    isDisabled={isTransactionActionDisabled}
                    isOpen={openSwipeTransactionId === transaction.id}
                    key={transaction.id}
                    onDelete={handleDeleteTransaction}
                    onEdit={handleEditTransaction}
                    onSwipeClose={handleSwipeClose}
                    onSwipeInteractionStart={handleSwipeInteractionStart}
                    onSwipeOpen={handleSwipeOpen}
                    transaction={transaction}
                  />
                );
              })}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>
                {hasAnyTransactions
                  ? `No transactions for ${selectedPeriodLabel}`
                  : 'No transactions yet'}
              </Text>

              <Text style={styles.emptyMessage}>
                {hasAnyTransactions
                  ? `You have saved expenses, but none fall in ${selectedPeriodLabel.toLowerCase()}.`
                  : 'Add your first expense and mark the ones that felt avoidable.'}
              </Text>
            </View>
          )}
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
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 156,
    gap: 36,
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
    fontFamily: TITLE_FONT_FAMILY,
    fontSize: 36,
    lineHeight: 44,
    fontWeight: TITLE_FONT_WEIGHT,
    color: '#0f0f0f',
  },
  balanceHero: {
    gap: 48,
  },
  balanceAmount: {
    fontSize: 40,
    lineHeight: 48,
    fontWeight: '600',
    textAlign: 'center',
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
    gap: 2,
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
    gap: 18,
  },
  sectionTitle: {
    fontFamily: TITLE_FONT_FAMILY,
    fontSize: 26,
    lineHeight: 32,
    fontWeight: TITLE_FONT_WEIGHT,
    color: '#0f0f0f',
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
    fontWeight: '500',
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
  summaryRows: {
    gap: 22,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  summaryLabel: {
    flex: 1,
    fontSize: 16,
    lineHeight: 20,
    color: '#111111',
  },
  summaryValue: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '800',
    color: '#050505',
  },
  summaryMessage: {
    fontSize: 14,
    lineHeight: 20,
    color: '#5d5d5d',
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
    gap: 14,
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
    overflow: 'hidden',
    borderRadius: 8,
  },
  swipeActionLayer: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
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
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 12,
    gap: 8,
  },
  transactionCardNormal: {
    backgroundColor: '#f7f7f5',
  },
  transactionCardLeak: {
    backgroundColor: '#f7f7f5',
  },
  transactionMainRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
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
  transactionCopy: {
    flex: 1,
    minWidth: 0,
    gap: 5,
  },
  categoryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  categoryText: {
    flexShrink: 1,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '800',
    color: '#111111',
  },
  amountText: {
    flexShrink: 0,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '800',
    textAlign: 'right',
    color: '#050505',
  },
  typeBadge: {
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  typeBadgeNormal: {
    backgroundColor: '#e9e9e4',
  },
  typeBadgeLeak: {
    backgroundColor: '#ffe1e1',
  },
  typeBadgeText: {
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '800',
  },
  typeBadgeTextNormal: {
    color: '#363633',
  },
  typeBadgeTextLeak: {
    color: '#bd1f1f',
  },
  timestampText: {
    fontSize: 15,
    lineHeight: 20,
    color: '#111111',
  },
  detailText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#2d2d2a',
  },
  noteText: {
    fontSize: 14,
    lineHeight: 20,
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
