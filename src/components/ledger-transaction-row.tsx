import { SymbolView, type SFSymbol } from 'expo-symbols';
import type { ReactNode } from 'react';
import {
  Animated,
  type GestureResponderHandlers,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';

import {
  getCategoryDisplayIconName,
  getCategoryDisplayName,
} from '@/lib/category-display';
import { getCategoryIcon } from '@/lib/category-icons';
import { getValidDate } from '@/lib/date-utils';
import { formatLanguageDate, getLeakReasonLabel, t } from '@/lib/i18n/i18n';
import type { SupportedLanguage } from '@/lib/i18n/languages';
import type { Category } from '@/types/category';
import type { Transaction } from '@/types/transaction';

const NORMAL_DETAIL_ICON = 'hand.thumbsup' as SFSymbol;
const LEAK_DETAIL_ICON = 'drop.halffull' as SFSymbol;
const REASON_DETAIL_ICON = 'bolt' as SFSymbol;

function formatLedgerTime(createdAt: number, language: SupportedLanguage) {
  const date = getValidDate(createdAt);

  if (!date) return 'Unknown time';

  return formatLanguageDate(language, date, {
    hour: '2-digit',
    hour12: false,
    minute: '2-digit',
  });
}

type LedgerIconProps = {
  fallback: string;
  name: SFSymbol;
  testID: string;
};

function LedgerIcon({ fallback, name, testID }: LedgerIconProps) {
  return (
    <View style={styles.iconSlot}>
      <SymbolView
        fallback={<Text style={styles.iconFallback}>{fallback}</Text>}
        name={name}
        resizeMode="scaleAspectFit"
        size={19}
        testID={testID}
        tintColor="#100f10"
        type="monochrome"
        weight="semibold"
      />
    </View>
  );
}

type TransactionDetailIconProps = {
  fallback: string;
  name: SFSymbol;
  weight?: 'regular' | 'semibold';
};

function TransactionDetailIcon({
  fallback,
  name,
  weight = 'regular',
}: TransactionDetailIconProps) {
  return (
    <SymbolView
      fallback={<Text style={styles.detailIconFallback}>{fallback}</Text>}
      name={name}
      resizeMode="scaleAspectFit"
      size={13}
      tintColor="#100f10"
      type="monochrome"
      weight={weight}
    />
  );
}

function TransactionDetailRow({
  language,
  transaction,
}: {
  language: SupportedLanguage;
  transaction: Transaction;
}) {
  const items: ReactNode[] = [];

  if (transaction.isLeak) {
    items.push(
      <View key="leak" style={styles.detailItem}>
        <TransactionDetailIcon
          fallback="L"
          name={LEAK_DETAIL_ICON}
          weight="semibold"
        />

        <Text numberOfLines={1} style={styles.detail}>
          {t(language, 'home.leak')}
        </Text>
      </View>,
    );

    if (transaction.leakReason) {
      items.push(
        <View key="reason" style={styles.detailItem}>
          <TransactionDetailIcon fallback="R" name={REASON_DETAIL_ICON} />

          <Text numberOfLines={1} style={styles.detail}>
            {getLeakReasonLabel(language, transaction.leakReason)}
          </Text>
        </View>,
      );
    }
  } else {
    items.push(
      <View key="normal" style={styles.detailItem}>
        <TransactionDetailIcon fallback="N" name={NORMAL_DETAIL_ICON} />

        <Text numberOfLines={1} style={styles.detail}>
          {t(language, 'common.normal')}
        </Text>
      </View>,
    );
  }

  return <View style={styles.detailRow}>{items}</View>;
}

type LedgerTransactionRowProps = {
  amountLabel: string;
  categories: Category[];
  deletingLabel?: string | null;
  gestureHandlers?: GestureResponderHandlers;
  language: SupportedLanguage;
  onTouchStart?: () => void;
  style?: Animated.WithAnimatedValue<ViewStyle> | ViewStyle;
  testID: string;
  transaction: Transaction;
};

export function LedgerTransactionRow({
  amountLabel,
  categories,
  deletingLabel,
  gestureHandlers,
  language,
  onTouchStart,
  style,
  testID,
  transaction,
}: LedgerTransactionRowProps) {
  const categoryIcon = getCategoryIcon(
    getCategoryDisplayIconName(transaction.category, categories),
  );

  return (
    <Animated.View
      {...gestureHandlers}
      onTouchStart={onTouchStart}
      style={[styles.row, style]}
      testID={testID}
    >
      <View style={[styles.infoRow, styles.infoRowTop]}>
        <LedgerIcon
          fallback={categoryIcon.fallbackSymbol}
          name={categoryIcon.symbolName}
          testID={`transaction-category-icon-${transaction.id}`}
        />

        <View style={styles.copy}>
          <Text numberOfLines={1} style={styles.title}>
            {getCategoryDisplayName(transaction.category, categories, language)}
          </Text>

          <TransactionDetailRow language={language} transaction={transaction} />

          {transaction.note ? (
            <Text numberOfLines={1} style={styles.note}>
              {transaction.note}
            </Text>
          ) : null}

          <Text style={styles.time}>
            {formatLedgerTime(transaction.createdAt, language)}
          </Text>
        </View>
      </View>

      <View style={styles.trailingCopy}>
        <Text style={[styles.amount, styles.amountNegative]}>
          {amountLabel}
        </Text>

        {deletingLabel ? (
          <Text numberOfLines={1} style={styles.deletingText}>
            {deletingLabel}
          </Text>
        ) : null}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 74,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(16, 15, 16, 0.12)',
    paddingVertical: 16,
    paddingHorizontal: 8,
  },
  infoRow: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoRowTop: {
    alignItems: 'flex-start',
  },
  iconSlot: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconFallback: {
    fontSize: 12,
    fontWeight: '700',
    color: '#100f10',
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 20,
    color: '#100f10',
  },
  detailRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    gap: 4,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  detail: {
    fontSize: 13,
    lineHeight: 18,
    color: '#100f10',
  },
  detailIconFallback: {
    minWidth: 13,
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 13,
    textAlign: 'center',
    color: '#100f10',
  },
  note: {
    fontSize: 13,
    lineHeight: 18,
    color: '#100f10',
  },
  time: {
    fontSize: 13,
    lineHeight: 17,
    color: '#8a8a8f',
  },
  trailingCopy: {
    flexShrink: 0,
    maxWidth: 126,
    alignItems: 'flex-end',
    gap: 4,
  },
  amount: {
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 20,
    textAlign: 'right',
  },
  amountNegative: {
    color: '#100f10',
  },
  deletingText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
    textAlign: 'right',
    color: '#c22121',
  },
});
