import { SymbolView, type SFSymbol } from 'expo-symbols';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import { LedgerTransactionRow } from '@/components/ledger-transaction-row';
import { t } from '@/lib/i18n/i18n';
import type { SupportedLanguage } from '@/lib/i18n/languages';
import {
  clampSwipeTranslation,
  createHorizontalSwipePanResponder,
} from '@/lib/swipe-actions';
import type { Category } from '@/types/category';
import type { Transaction } from '@/types/transaction';

const SWIPE_ACTION_WIDTH = 88;

function clampSwipeProgress(value: number) {
  return Math.max(-1, Math.min(1, value));
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

type SwipeableTransactionRowProps = {
  amountLabel: string;
  categories: Category[];
  isDeleting: boolean;
  isDisabled: boolean;
  isOpen: boolean;
  language: SupportedLanguage;
  onDelete: (id: string) => void;
  onEdit: (id: string) => void;
  onSwipeClose: (id: string) => void;
  onSwipeInteractionStart: (id: string) => void;
  onSwipeOpen: (id: string) => void;
  testID: string;
  transaction: Transaction;
};

export function SwipeableTransactionRow({
  amountLabel,
  categories,
  isDeleting,
  isDisabled,
  isOpen,
  language,
  onDelete,
  onEdit,
  onSwipeClose,
  onSwipeInteractionStart,
  onSwipeOpen,
  testID,
  transaction,
}: SwipeableTransactionRowProps) {
  const swipeProgress = useRef(new Animated.Value(0)).current;
  const isHorizontallyLockedRef = useRef(false);
  const [rowWidth, setRowWidth] = useState(360);
  const actionRevealWidth = Math.min(SWIPE_ACTION_WIDTH, Math.max(rowWidth, 1));

  const animateTo = useCallback(
    (toValue: number) => {
      Animated.spring(swipeProgress, {
        toValue,
        damping: 22,
        mass: 0.72,
        stiffness: 260,
        useNativeDriver: false,
      }).start();
    },
    [swipeProgress],
  );

  const closeActions = useCallback(() => {
    animateTo(0);
    onSwipeClose(transaction.id);
  }, [animateTo, onSwipeClose, transaction.id]);

  const revealDelete = useCallback(() => {
    onSwipeOpen(transaction.id);
    animateTo(1);
  }, [animateTo, onSwipeOpen, transaction.id]);

  const revealEdit = useCallback(() => {
    onSwipeOpen(transaction.id);
    animateTo(-1);
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
          swipeProgress.stopAnimation();
        },
        onMove: (dx) => {
          swipeProgress.setValue(
            clampSwipeProgress(
              clampSwipeTranslation(dx, actionRevealWidth) / actionRevealWidth,
            ),
          );
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
      actionRevealWidth,
      transaction.id,
      swipeProgress,
    ],
  );

  useEffect(() => {
    if (isDisabled) closeActions();
  }, [closeActions, isDisabled]);

  useEffect(() => {
    if (isOpen) return;

    animateTo(0);
  }, [animateTo, isOpen]);

  const leftActionWidth = swipeProgress.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: [0, 0, actionRevealWidth],
  });
  const rightActionWidth = swipeProgress.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: [actionRevealWidth, 0, 0],
  });
  const contentWidth = swipeProgress.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: [
      rowWidth - actionRevealWidth,
      rowWidth,
      rowWidth - actionRevealWidth,
    ],
  });
  const cardBackgroundColor = swipeProgress.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: ['#ffffff', '#f7f7f5', '#ffffff'],
  });
  const leftActionOpacity = swipeProgress.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: [0, 0, 1],
  });
  const rightActionOpacity = swipeProgress.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: [1, 0, 0],
  });

  return (
    <View
      onLayout={(event) => {
        setRowWidth(event.nativeEvent.layout.width);
      }}
      style={styles.swipeContainer}
    >
      <Animated.View
        style={[
          styles.swipeActionSlot,
          { opacity: leftActionOpacity, width: leftActionWidth },
        ]}
      >
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
      </Animated.View>

      <LedgerTransactionRow
        amountLabel={amountLabel}
        categories={categories}
        deletingLabel={isDeleting ? t(language, 'home.deleting') : null}
        gestureHandlers={panResponder.panHandlers}
        language={language}
        onTouchStart={handleTouchStart}
        style={{
          backgroundColor: cardBackgroundColor,
          borderRadius: 24,
          overflow: 'hidden',
          width: contentWidth,
        }}
        testID={testID}
        transaction={transaction}
      />

      <Animated.View
        style={[
          styles.swipeActionSlot,
          styles.swipeActionSlotTrailing,
          { opacity: rightActionOpacity, width: rightActionWidth },
        ]}
      >
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
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  swipeContainer: {
    minHeight: 74,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    borderRadius: 0,
  },
  swipeActionSlot: {
    minHeight: 74,
    alignItems: 'flex-start',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  swipeActionSlotTrailing: {
    alignItems: 'flex-end',
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
});
