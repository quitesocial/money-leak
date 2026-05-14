import { Link, useRouter, type Href } from 'expo-router';
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
import { calculateDailyReviewSummary } from '@/features/home/calculate-daily-review-summary';
import { getCategoryDisplayName } from '@/lib/category-display';
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
import { useCategoriesRefresh } from '@/lib/use-categories-refresh';
import { useTransactionsRefresh } from '@/lib/use-transactions-refresh';
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
const SWIPE_ACTION_WIDTH = 86;
const SWIPE_ACTION_THRESHOLD = 44;

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

function AddTransactionAction() {
  return (
    <Link href="/add-transaction" asChild>
      <Pressable accessibilityRole="button" style={styles.primaryAction}>
        <Text style={styles.primaryActionText}>Add Transaction</Text>
      </Pressable>
    </Link>
  );
}

type SummaryRowProps = {
  label: string;
  value: string;
};

function SummaryRow({ label, value }: SummaryRowProps) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

type SwipeActionIconProps = {
  fallbackLabel: string;
  name: SFSymbol;
};

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
  onDelete: (id: string) => void;
  onEdit: (id: string) => void;
  transaction: Transaction;
};

function HistoryTransactionItem({
  categories,
  isDeleting,
  isDisabled,
  onDelete,
  onEdit,
  transaction,
}: HistoryTransactionItemProps) {
  const translateX = useRef(new Animated.Value(0)).current;

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
  }, [animateTo]);

  const revealDelete = useCallback(() => {
    animateTo(SWIPE_ACTION_WIDTH);
  }, [animateTo]);

  const revealEdit = useCallback(() => {
    animateTo(-SWIPE_ACTION_WIDTH);
  }, [animateTo]);

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

          return (
            Math.abs(gestureState.dx) > 8 &&
            Math.abs(gestureState.dx) > Math.abs(gestureState.dy)
          );
        },
        onPanResponderGrant: () => {
          translateX.stopAnimation();
        },
        onPanResponderMove: (_event, gestureState) => {
          if (isDisabled) return;

          const nextTranslateX = Math.max(
            -SWIPE_ACTION_WIDTH,
            Math.min(SWIPE_ACTION_WIDTH, gestureState.dx),
          );

          translateX.setValue(nextTranslateX);
        },
        onPanResponderRelease: (_event, gestureState) => {
          if (
            gestureState.dx > SWIPE_ACTION_THRESHOLD ||
            gestureState.vx > 0.65
          ) {
            revealDelete();

            return;
          }

          if (
            gestureState.dx < -SWIPE_ACTION_THRESHOLD ||
            gestureState.vx < -0.65
          ) {
            revealEdit();

            return;
          }

          closeActions();
        },
        onPanResponderTerminate: closeActions,
      }),
    [closeActions, isDisabled, revealDelete, revealEdit, translateX],
  );

  useEffect(() => {
    if (isDisabled) closeActions();
  }, [closeActions, isDisabled]);

  const isLeak = transaction.isLeak;

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

  useCategoriesRefresh({
    isInitialized: areCategoriesInitialized,
    loadCategories,
  });

  useEffect(() => {
    if (HOME_PERIOD_OPTIONS.includes(selectedPeriod)) return;

    setSelectedPeriod('today');
  }, [selectedPeriod, setSelectedPeriod]);

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
            <AddTransactionAction />
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.pageTitle}>Home</Text>

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

          <AddTransactionAction />
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
                    key={transaction.id}
                    onDelete={handleDeleteTransaction}
                    onEdit={handleEditTransaction}
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
  primaryAction: {
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    backgroundColor: '#111111',
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  primaryActionText: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '600',
    color: '#ffffff',
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
