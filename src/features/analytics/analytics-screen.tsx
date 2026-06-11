import { useRouter, type Href } from 'expo-router';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { useMemo, useState } from 'react';
import {
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  LocalDatePicker,
  type LocalDatePickerMode,
} from '@/components/local-date-picker';
import {
  ANALYTICS_CUSTOM_PERIOD_TYPE_OPTIONS,
  ANALYTICS_PERIOD_OPTIONS,
  buildAnalyticsLedgerItems,
  createDefaultAnalyticsFilter,
  formatAnalyticsAmount,
  formatAnalyticsCustomDateLabel,
  formatAnalyticsTime,
  getAnalyticsLocalDayTimestamp,
  groupAnalyticsLedgerItems,
  isAnalyticsFilterActive,
  normalizeAnalyticsFilter,
  type AnalyticsCustomPeriodType,
  type AnalyticsFilterOperation,
  type AnalyticsFilterState,
  type AnalyticsLedgerItem,
  type AnalyticsPeriod,
  type AnalyticsSpentKind,
} from '@/features/analytics/analytics-ledger';
import {
  getCategoryDisplayIconName,
  getCategoryDisplayName,
} from '@/lib/category-display';
import { getCategoryIcon } from '@/lib/category-icons';
import {
  formatLanguageDate,
  getDefaultBalanceTypeName,
  getDefaultCategoryName,
  getLeakReasonLabel,
  getMonthLabels,
  getShortWeekdayLabels,
  t,
} from '@/lib/i18n/i18n';
import type { SupportedLanguage } from '@/lib/i18n/languages';
import type { SettingsCurrency } from '@/lib/settings-preferences';
import { useBalanceRefresh } from '@/lib/use-balance-refresh';
import { useCategoriesRefresh } from '@/lib/use-categories-refresh';
import { useSettingsCurrency } from '@/lib/use-settings-currency';
import { useSettingsLanguage } from '@/lib/use-settings-language';
import { useTransactionsRefresh } from '@/lib/use-transactions-refresh';
import { useBalanceStore } from '@/store/balance-store';
import { useCategoriesStore } from '@/store/categories-store';
import { useTransactionsStore } from '@/store/transactions-store';
import { DEFAULT_BALANCE_TYPES, type BalanceType } from '@/types/balance';
import {
  DEFAULT_CATEGORIES,
  type Category,
  type CategoryInput,
} from '@/types/category';
import {
  LEAK_REASONS,
  type LeakReason,
  type Transaction,
} from '@/types/transaction';

const TITLE_FONT_FAMILY = Platform.select({
  ios: 'NewYork',
  default: 'serif',
});

const TITLE_FONT_WEIGHT = Platform.select({
  ios: '700' as const,
  default: '800' as const,
});

const FILTER_ICON = 'line.horizontal.3.decrease.circle' as SFSymbol;
const FILTER_ICON_FILLED = 'line.horizontal.3.decrease.circle.fill' as SFSymbol;
const CHEVRON_DOWN_ICON = 'chevron.down' as SFSymbol;
const CHEVRON_LEFT_ICON = 'chevron.left' as SFSymbol;
const CHEVRON_RIGHT_ICON = 'chevron.right' as SFSymbol;
const CALENDAR_ICON = 'calendar' as SFSymbol;
const NORMAL_DETAIL_ICON = 'hand.thumbsup' as SFSymbol;
const LEAK_DETAIL_ICON = 'drop.halffull' as SFSymbol;
const REASON_DETAIL_ICON = 'bolt' as SFSymbol;

const LEAK_REASON_ICONS: Record<
  LeakReason,
  {
    fallback: string;
    name: SFSymbol;
  }
> = {
  boredom: {
    fallback: 'B',
    name: 'minus.circle' as SFSymbol,
  },
  craving: {
    fallback: 'C',
    name: 'birthday.cake' as SFSymbol,
  },
  habit: {
    fallback: 'H',
    name: 'arrow.left.arrow.right' as SFSymbol,
  },
  impulse: {
    fallback: 'I',
    name: 'bolt' as SFSymbol,
  },
  social: {
    fallback: 'S',
    name: 'figure.2' as SFSymbol,
  },
  stress: {
    fallback: 'S',
    name: 'leaf' as SFSymbol,
  },
};

type DatePickerMode = 'range' | 'single';

type InlinePickerMode = 'day' | 'month' | 'range' | 'year';

type BalanceTypeOption = Pick<BalanceType, 'id' | 'name' | 'sortOrder'>;

type CategoryOption = Pick<
  CategoryInput,
  'iconName' | 'id' | 'isDefault' | 'name' | 'sortOrder'
>;

function getTodayTimestamp() {
  return getAnalyticsLocalDayTimestamp(Date.now()) ?? Date.now();
}

function getPeriodLabel(period: AnalyticsPeriod, language: SupportedLanguage) {
  switch (period) {
    case 'today':
      return t(language, 'analytics.period.today');
    case 'week':
      return t(language, 'analytics.period.week');
    case 'month':
      return t(language, 'analytics.period.month');
    case 'custom':
      return t(language, 'analytics.period.custom');
  }
}

function getCustomPeriodTypeLabel(
  periodType: AnalyticsCustomPeriodType,
  language: SupportedLanguage,
) {
  switch (periodType) {
    case 'day':
      return t(language, 'analytics.custom.day');
    case 'month':
      return t(language, 'analytics.custom.month');
    case 'year':
      return t(language, 'analytics.custom.year');
    case 'custom_dates':
      return t(language, 'analytics.custom.customDates');
  }
}

function getOperationLabel(
  operation: AnalyticsFilterOperation,
  language: SupportedLanguage,
) {
  switch (operation) {
    case 'added':
      return t(language, 'analytics.operation.added');
    case 'spent':
      return t(language, 'analytics.operation.spent');
    case 'all':
      return t(language, 'analytics.operation.all');
  }
}

function getBalanceTypeOptions(
  activeBalanceTypes: BalanceType[],
  language: SupportedLanguage,
) {
  const optionsById = new Map<string, BalanceTypeOption>();

  for (const balanceType of DEFAULT_BALANCE_TYPES) {
    optionsById.set(balanceType.id, {
      id: balanceType.id,
      name:
        getDefaultBalanceTypeName(language, balanceType.id) ?? balanceType.name,
      sortOrder: balanceType.sortOrder,
    });
  }

  for (const balanceType of activeBalanceTypes) {
    optionsById.set(balanceType.id, {
      id: balanceType.id,
      name: balanceType.isDefault
        ? (getDefaultBalanceTypeName(language, balanceType.id) ??
          balanceType.name)
        : balanceType.name,
      sortOrder: balanceType.sortOrder,
    });
  }

  return [...optionsById.values()].sort((firstOption, secondOption) => {
    if (firstOption.sortOrder !== secondOption.sortOrder) {
      return firstOption.sortOrder - secondOption.sortOrder;
    }

    return firstOption.name.localeCompare(secondOption.name);
  });
}

function getCategoryOptions(
  activeCategories: Category[],
  language: SupportedLanguage,
) {
  const sourceCategories: CategoryOption[] =
    activeCategories.length > 0 ? activeCategories : DEFAULT_CATEGORIES;

  return [...sourceCategories]
    .map((category) => ({
      ...category,
      name: category.isDefault
        ? (getDefaultCategoryName(language, category.id) ?? category.name)
        : category.name,
    }))
    .sort((firstCategory, secondCategory) => {
      if (firstCategory.sortOrder !== secondCategory.sortOrder) {
        return firstCategory.sortOrder - secondCategory.sortOrder;
      }

      return firstCategory.name.localeCompare(secondCategory.name);
    });
}

function getBalanceTypeDisplayName({
  balanceTypeOptions,
  balanceTypes,
  language,
  typeId,
}: {
  balanceTypeOptions: BalanceTypeOption[];
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
    balanceTypeOptions.find((option) => option.id === typeId)?.name ??
    getDefaultBalanceTypeName(language, typeId) ??
    t(language, 'balanceType.fallback')
  );
}

function getFilterLabel({
  balanceTypeOptions,
  categories,
  filter,
  language,
}: {
  balanceTypeOptions: BalanceTypeOption[];
  categories: Category[];
  filter: AnalyticsFilterState;
  language: SupportedLanguage;
}) {
  const normalizedFilter = normalizeAnalyticsFilter(filter);

  if (normalizedFilter.operation === 'all') return null;

  if (normalizedFilter.operation === 'added') {
    if (!normalizedFilter.balanceTypeId) return null;

    return (
      balanceTypeOptions.find(
        (balanceType) => balanceType.id === normalizedFilter.balanceTypeId,
      )?.name ?? t(language, 'balanceType.fallback')
    );
  }

  const labels: string[] = [];

  if (normalizedFilter.transactionKind) {
    labels.push(
      normalizedFilter.transactionKind === 'leak'
        ? t(language, 'home.leak')
        : t(language, 'common.normal'),
    );
  }

  if (normalizedFilter.leakReason) {
    labels.push(getLeakReasonLabel(language, normalizedFilter.leakReason));
  }

  if (normalizedFilter.categoryId) {
    labels.push(
      getCategoryDisplayName(normalizedFilter.categoryId, categories, language),
    );
  }

  return labels.length > 0 ? labels.join(' / ') : null;
}

function getDatePickerValue({
  customDate,
  customRangeStart,
  mode,
}: {
  customDate: number;
  customRangeStart: number;
  mode: DatePickerMode | null;
}) {
  const timestamp = mode === 'range' ? customRangeStart : customDate;
  const date = new Date(timestamp);

  if (Number.isFinite(date.getTime())) return date;

  return new Date();
}

function getDatePickerRangeEndValue(customRangeEnd: number) {
  const date = new Date(customRangeEnd);

  if (Number.isFinite(date.getTime())) return date;

  return new Date();
}

function getLocalDatePickerMode({
  customPeriodType,
  mode,
}: {
  customPeriodType: AnalyticsCustomPeriodType | null;
  mode: DatePickerMode | null;
}): LocalDatePickerMode {
  if (mode === 'range') return 'range';
  if (mode !== 'single') return 'date';
  if (customPeriodType === 'month') return 'month';
  if (customPeriodType === 'year') return 'year';

  return 'date';
}

function getValidInlineDate(value: number) {
  const date = new Date(value);

  if (Number.isFinite(date.getTime())) return date;

  return new Date();
}

function getStartOfInlineMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addInlineMonths(date: Date, months: number) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

function getInlineCalendarWeeks(visibleMonth: Date) {
  const monthStart = getStartOfInlineMonth(visibleMonth);
  const year = monthStart.getFullYear();
  const month = monthStart.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const weeks: (Date | null)[][] = [];
  let week: (Date | null)[] = Array.from(
    { length: monthStart.getDay() },
    () => null,
  );

  for (let day = 1; day <= daysInMonth; day += 1) {
    week.push(new Date(year, month, day));

    if (week.length === 7) {
      weeks.push(week);
      week = [];
    }
  }

  if (week.length > 0) {
    while (week.length < 7) {
      week.push(null);
    }

    weeks.push(week);
  }

  return weeks;
}

function isSameInlineDay(firstDate: Date, secondDate: Date) {
  return (
    firstDate.getFullYear() === secondDate.getFullYear() &&
    firstDate.getMonth() === secondDate.getMonth() &&
    firstDate.getDate() === secondDate.getDate()
  );
}

function getInlineDayTimestamp(date: Date) {
  return getAnalyticsLocalDayTimestamp(date) ?? date.getTime();
}

function getNormalizedInlineRange(
  startTimestamp: number,
  endTimestamp: number,
) {
  return {
    end: Math.max(startTimestamp, endTimestamp),
    start: Math.min(startTimestamp, endTimestamp),
  };
}

function isInlineDayInRange({
  date,
  rangeEnd,
  rangeStart,
}: {
  date: Date;
  rangeEnd: number;
  rangeStart: number;
}) {
  const dayTimestamp = getInlineDayTimestamp(date);
  const normalizedRange = getNormalizedInlineRange(rangeStart, rangeEnd);

  return (
    dayTimestamp >= normalizedRange.start && dayTimestamp <= normalizedRange.end
  );
}

function getInlineDayTestID(date: Date) {
  return `analytics-inline-day-${date.getFullYear()}-${
    date.getMonth() + 1
  }-${date.getDate()}`;
}

type InlineDayCalendarProps = {
  language: SupportedLanguage;
  month: Date;
  selectedDate: number;
  onChangeMonth: (month: Date) => void;
  onSelectDate: (date: Date) => void;
};

function InlineDayCalendar({
  language,
  month,
  selectedDate,
  onChangeMonth,
  onSelectDate,
}: InlineDayCalendarProps) {
  const selectedDateValue = getValidInlineDate(selectedDate);
  const weeks = getInlineCalendarWeeks(month);
  const weekdayLabels = getShortWeekdayLabels(language);

  return (
    <View style={styles.inlineCalendar} testID="analytics-inline-day-calendar">
      <View style={styles.inlineCalendarHeader}>
        <View style={styles.inlineCalendarMonthLabel}>
          <Text style={styles.inlineCalendarMonthText}>
            {formatLanguageDate(language, month, {
              month: 'long',
              year: 'numeric',
            })}
          </Text>

          <SymbolView
            fallback={
              <Text style={styles.inlineCalendarTitleArrow}>{'>'}</Text>
            }
            name={CHEVRON_RIGHT_ICON}
            resizeMode="scaleAspectFit"
            size={13}
            tintColor="#0088ff"
            type="monochrome"
            weight="bold"
          />
        </View>

        <View style={styles.inlineCalendarArrows}>
          <Pressable
            accessibilityLabel="Previous month"
            accessibilityRole="button"
            onPress={() => onChangeMonth(addInlineMonths(month, -1))}
            style={styles.inlineCalendarArrowButton}
            testID="analytics-inline-calendar-previous"
          >
            <SymbolView
              fallback={
                <Text style={styles.inlineCalendarArrowText}>{'<'}</Text>
              }
              name={CHEVRON_LEFT_ICON}
              resizeMode="scaleAspectFit"
              size={20}
              tintColor="#0088ff"
              type="monochrome"
              weight="bold"
            />
          </Pressable>

          <Pressable
            accessibilityLabel="Next month"
            accessibilityRole="button"
            onPress={() => onChangeMonth(addInlineMonths(month, 1))}
            style={styles.inlineCalendarArrowButton}
            testID="analytics-inline-calendar-next"
          >
            <SymbolView
              fallback={
                <Text style={styles.inlineCalendarArrowText}>{'>'}</Text>
              }
              name={CHEVRON_RIGHT_ICON}
              resizeMode="scaleAspectFit"
              size={20}
              tintColor="#0088ff"
              type="monochrome"
              weight="bold"
            />
          </Pressable>
        </View>
      </View>

      <View style={styles.inlineCalendarWeekdays}>
        {weekdayLabels.map((weekday) => (
          <Text key={weekday} style={styles.inlineCalendarWeekday}>
            {weekday}
          </Text>
        ))}
      </View>

      <View style={styles.inlineCalendarGrid}>
        {weeks.map((week, weekIndex) => (
          <View key={`week-${weekIndex}`} style={styles.inlineCalendarWeek}>
            {week.map((date, dayIndex) => {
              if (!date) {
                return (
                  <View
                    key={`empty-${weekIndex}-${dayIndex}`}
                    style={styles.inlineCalendarDay}
                  />
                );
              }

              const isSelected = isSameInlineDay(date, selectedDateValue);

              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  key={date.getTime()}
                  onPress={() => onSelectDate(date)}
                  style={[
                    styles.inlineCalendarDay,
                    isSelected ? styles.inlineCalendarDaySelected : null,
                  ]}
                  testID={getInlineDayTestID(date)}
                >
                  <Text
                    style={[
                      styles.inlineCalendarDayText,
                      isSelected ? styles.inlineCalendarDayTextSelected : null,
                    ]}
                  >
                    {date.getDate()}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}

type InlineRangeCalendarProps = {
  language: SupportedLanguage;
  month: Date;
  rangeEnd: number;
  rangeStart: number;
  onChangeMonth: (month: Date) => void;
  onSelectDate: (date: Date) => void;
};

function InlineRangeCalendar({
  language,
  month,
  rangeEnd,
  rangeStart,
  onChangeMonth,
  onSelectDate,
}: InlineRangeCalendarProps) {
  const weeks = getInlineCalendarWeeks(month);
  const weekdayLabels = getShortWeekdayLabels(language);

  return (
    <View
      style={styles.inlineCalendar}
      testID="analytics-inline-range-calendar"
    >
      <View style={styles.inlineCalendarHeader}>
        <View style={styles.inlineCalendarMonthLabel}>
          <Text style={styles.inlineCalendarMonthText}>
            {formatLanguageDate(language, month, {
              month: 'long',
              year: 'numeric',
            })}
          </Text>

          <SymbolView
            fallback={
              <Text style={styles.inlineCalendarTitleArrow}>{'>'}</Text>
            }
            name={CHEVRON_RIGHT_ICON}
            resizeMode="scaleAspectFit"
            size={13}
            tintColor="#0088ff"
            type="monochrome"
            weight="bold"
          />
        </View>

        <View style={styles.inlineCalendarArrows}>
          <Pressable
            accessibilityLabel="Previous month"
            accessibilityRole="button"
            onPress={() => onChangeMonth(addInlineMonths(month, -1))}
            style={styles.inlineCalendarArrowButton}
            testID="analytics-inline-range-calendar-previous"
          >
            <SymbolView
              fallback={
                <Text style={styles.inlineCalendarArrowText}>{'<'}</Text>
              }
              name={CHEVRON_LEFT_ICON}
              resizeMode="scaleAspectFit"
              size={20}
              tintColor="#0088ff"
              type="monochrome"
              weight="bold"
            />
          </Pressable>

          <Pressable
            accessibilityLabel="Next month"
            accessibilityRole="button"
            onPress={() => onChangeMonth(addInlineMonths(month, 1))}
            style={styles.inlineCalendarArrowButton}
            testID="analytics-inline-range-calendar-next"
          >
            <SymbolView
              fallback={
                <Text style={styles.inlineCalendarArrowText}>{'>'}</Text>
              }
              name={CHEVRON_RIGHT_ICON}
              resizeMode="scaleAspectFit"
              size={20}
              tintColor="#0088ff"
              type="monochrome"
              weight="bold"
            />
          </Pressable>
        </View>
      </View>

      <View style={styles.inlineCalendarWeekdays}>
        {weekdayLabels.map((weekday) => (
          <Text key={weekday} style={styles.inlineCalendarWeekday}>
            {weekday}
          </Text>
        ))}
      </View>

      <View style={styles.inlineCalendarGrid}>
        {weeks.map((week, weekIndex) => (
          <View key={`week-${weekIndex}`} style={styles.inlineCalendarWeek}>
            {week.map((date, dayIndex) => {
              if (!date) {
                return (
                  <View
                    key={`empty-${weekIndex}-${dayIndex}`}
                    style={styles.inlineCalendarDay}
                  />
                );
              }

              const isSelected = isInlineDayInRange({
                date,
                rangeEnd,
                rangeStart,
              });

              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  key={date.getTime()}
                  onPress={() => onSelectDate(date)}
                  style={[
                    styles.inlineCalendarDay,
                    isSelected ? styles.inlineCalendarDaySelected : null,
                  ]}
                  testID={getInlineDayTestID(date).replace(
                    'analytics-inline-day',
                    'analytics-inline-range-day',
                  )}
                >
                  <Text
                    style={[
                      styles.inlineCalendarDayText,
                      isSelected ? styles.inlineCalendarDayTextSelected : null,
                    ]}
                  >
                    {date.getDate()}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}

function getInlineYearOptions(selectedDate: number) {
  const selectedYear = getValidInlineDate(selectedDate).getFullYear();

  return Array.from({ length: 25 }, (_, index) => selectedYear - 4 + index);
}

type InlineOptionPickerProps = {
  options: {
    label: string;
    testID: string;
    value: number;
  }[];
  selectedValue: number;
  title: string;
  testID: string;
  onSelectValue: (value: number) => void;
};

function InlineOptionPicker({
  options,
  selectedValue,
  title,
  testID,
  onSelectValue,
}: InlineOptionPickerProps) {
  return (
    <View style={styles.inlineCalendar} testID={testID}>
      <View style={styles.inlineCalendarHeader}>
        <Text style={styles.inlineCalendarMonthText}>{title}</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.inlinePickerListContent}
        nestedScrollEnabled
        showsVerticalScrollIndicator={false}
        style={styles.inlinePickerList}
      >
        {options.map((option) => {
          const isSelected = selectedValue === option.value;

          return (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              key={option.value}
              onPress={() => onSelectValue(option.value)}
              style={styles.inlinePickerOption}
              testID={option.testID}
            >
              <View
                style={[
                  styles.inlinePickerOptionPill,
                  isSelected ? styles.inlinePickerOptionPillSelected : null,
                ]}
              >
                <Text
                  style={[
                    styles.inlinePickerOptionText,
                    isSelected ? styles.inlinePickerOptionTextSelected : null,
                  ]}
                >
                  {option.label}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

type AnalyticsSegmentedControlProps = {
  language: SupportedLanguage;
  onSelectPeriod: (period: AnalyticsPeriod) => void;
  selectedPeriod: AnalyticsPeriod;
};

function AnalyticsSegmentedControl({
  language,
  onSelectPeriod,
  selectedPeriod,
}: AnalyticsSegmentedControlProps) {
  return (
    <View style={styles.segmentedControl}>
      {ANALYTICS_PERIOD_OPTIONS.map((period) => {
        const isSelected = selectedPeriod === period;

        return (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
            key={period}
            onPress={() => onSelectPeriod(period)}
            style={[styles.segment, isSelected ? styles.segmentSelected : null]}
          >
            <Text
              numberOfLines={1}
              style={[
                styles.segmentText,
                isSelected ? styles.segmentTextSelected : null,
              ]}
            >
              {getPeriodLabel(period, language)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

type ChipProps = {
  icon?: {
    fallback: string;
    name: SFSymbol;
  };
  label: string;
  onPress: () => void;
  selected: boolean;
  testID?: string;
  variant?: 'compact' | 'filter';
};

function Chip({
  icon,
  label,
  onPress,
  selected,
  testID,
  variant = 'compact',
}: ChipProps) {
  const isFilterVariant = variant === 'filter';
  const tintColor = selected ? '#ffffff' : '#100f10';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[
        styles.chip,
        isFilterVariant ? styles.filterChip : null,
        selected ? styles.chipSelected : null,
      ]}
      testID={testID}
    >
      {icon ? (
        <SymbolView
          fallback={
            <Text
              style={[
                styles.filterChipIconFallback,
                selected ? styles.filterChipIconFallbackSelected : null,
              ]}
            >
              {icon.fallback}
            </Text>
          }
          name={icon.name}
          resizeMode="scaleAspectFit"
          size={16}
          tintColor={tintColor}
          type="monochrome"
          weight="semibold"
        />
      ) : null}

      <Text
        style={[
          styles.chipText,
          isFilterVariant ? styles.filterChipText : null,
          selected ? styles.chipTextSelected : null,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

type CategoryChipProps = {
  category: CategoryOption;
  onPress: () => void;
  selected: boolean;
};

function CategoryChip({ category, onPress, selected }: CategoryChipProps) {
  const icon = getCategoryIcon(category.iconName);
  const tintColor = selected ? '#ffffff' : '#100f10';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[
        styles.chip,
        styles.filterChip,
        styles.categoryChip,
        selected ? styles.chipSelected : null,
      ]}
      testID={`analytics-filter-category-${category.id}`}
    >
      <SymbolView
        fallback={
          <Text
            style={[
              styles.categoryChipIconFallback,
              selected ? styles.categoryChipIconFallbackSelected : null,
            ]}
          >
            {icon.fallbackSymbol}
          </Text>
        }
        name={icon.symbolName}
        resizeMode="scaleAspectFit"
        size={15}
        tintColor={tintColor}
        type="monochrome"
        weight="semibold"
      />

      <Text
        style={[
          styles.chipText,
          styles.filterChipText,
          selected ? styles.chipTextSelected : null,
        ]}
      >
        {category.name}
      </Text>
    </Pressable>
  );
}

type LedgerIconProps = {
  fallback: string;
  name: SFSymbol;
};

function LedgerIcon({ fallback, name }: LedgerIconProps) {
  return (
    <View style={styles.ledgerIconSlot}>
      <SymbolView
        fallback={<Text style={styles.ledgerIconFallback}>{fallback}</Text>}
        name={name}
        resizeMode="scaleAspectFit"
        size={19}
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
      fallback={<Text style={styles.ledgerDetailIconFallback}>{fallback}</Text>}
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
  if (transaction.isLeak) {
    return (
      <View style={styles.transactionDetailRow}>
        <View style={styles.transactionDetailItem}>
          <TransactionDetailIcon
            fallback="L"
            name={LEAK_DETAIL_ICON}
            weight="semibold"
          />

          <Text numberOfLines={1} style={styles.ledgerDetail}>
            {t(language, 'home.leak')}
          </Text>
        </View>

        {transaction.leakReason ? (
          <View style={styles.transactionDetailItem}>
            <TransactionDetailIcon fallback="R" name={REASON_DETAIL_ICON} />

            <Text numberOfLines={1} style={styles.ledgerDetail}>
              {getLeakReasonLabel(language, transaction.leakReason)}
            </Text>
          </View>
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.transactionDetailRow}>
      <View style={styles.transactionDetailItem}>
        <TransactionDetailIcon fallback="N" name={NORMAL_DETAIL_ICON} />

        <Text numberOfLines={1} style={styles.ledgerDetail}>
          {t(language, 'common.normal')}
        </Text>
      </View>
    </View>
  );
}

type LedgerRowProps = {
  balanceTypeOptions: BalanceTypeOption[];
  balanceTypes: BalanceType[];
  categories: Category[];
  currency: SettingsCurrency;
  item: AnalyticsLedgerItem;
  language: SupportedLanguage;
};

function LedgerRow({
  balanceTypeOptions,
  balanceTypes,
  categories,
  currency,
  item,
  language,
}: LedgerRowProps) {
  if (item.kind === 'balance') {
    return (
      <View
        style={styles.ledgerRow}
        testID={`analytics-balance-row-${item.entry.id}`}
      >
        <View style={styles.ledgerInfoRow}>
          <View style={styles.ledgerIconSlot} />

          <View style={styles.ledgerCopy}>
            <Text numberOfLines={1} style={styles.ledgerTitle}>
              {getBalanceTypeDisplayName({
                balanceTypeOptions,
                balanceTypes,
                language,
                typeId: item.entry.typeId,
              })}
            </Text>

            <Text style={styles.ledgerTime}>
              {formatAnalyticsTime(item.entry.createdAt, language)}
            </Text>
          </View>
        </View>

        <Text style={[styles.ledgerAmount, styles.ledgerAmountPositive]}>
          {formatAnalyticsAmount({
            amount: item.entry.amount,
            currency,
            sign: '+',
          })}
        </Text>
      </View>
    );
  }

  const { transaction } = item;
  const categoryIcon = getCategoryIcon(
    getCategoryDisplayIconName(transaction.category, categories),
  );

  return (
    <View
      style={styles.ledgerRow}
      testID={`analytics-transaction-row-${transaction.id}`}
    >
      <View style={[styles.ledgerInfoRow, styles.ledgerInfoRowTop]}>
        <LedgerIcon
          fallback={categoryIcon.fallbackSymbol}
          name={categoryIcon.symbolName}
        />

        <View style={styles.ledgerCopy}>
          <Text numberOfLines={1} style={styles.ledgerTitle}>
            {getCategoryDisplayName(transaction.category, categories, language)}
          </Text>

          <TransactionDetailRow language={language} transaction={transaction} />

          <Text style={styles.ledgerTime}>
            {formatAnalyticsTime(transaction.createdAt, language)}
          </Text>
        </View>
      </View>

      <Text style={[styles.ledgerAmount, styles.ledgerAmountNegative]}>
        {formatAnalyticsAmount({
          amount: transaction.amount,
          currency,
          sign: '-',
        })}
      </Text>
    </View>
  );
}

function FilterGlyph({ isActive }: { isActive: boolean }) {
  return (
    <SymbolView
      fallback={
        <Text
          style={[
            styles.filterGlyphFallback,
            isActive ? styles.filterGlyphFallbackActive : null,
          ]}
        >
          {'\u{100308}'}
        </Text>
      }
      name={isActive ? FILTER_ICON_FILLED : FILTER_ICON}
      resizeMode="scaleAspectFit"
      size={20}
      testID="analytics-filter-icon"
      tintColor="#0088ff"
      type="monochrome"
      weight="semibold"
    />
  );
}

type EmptyIllustrationProps = {
  testID?: string;
};

function EmptyIllustration({ testID }: EmptyIllustrationProps) {
  return (
    <Image
      accessibilityIgnoresInvertColors
      resizeMode="contain"
      source={require('../../../assets/images/analytics-empty.png')}
      style={styles.emptyIllustration}
      testID={testID}
    />
  );
}

type EmptyStateProps = {
  hasAnyItems: boolean;
  isFilterActive: boolean;
  language: SupportedLanguage;
  onAddTransaction: () => void;
};

function EmptyState({
  hasAnyItems,
  isFilterActive,
  language,
  onAddTransaction,
}: EmptyStateProps) {
  const emptyMessage = isFilterActive
    ? t(language, 'analytics.emptyFiltered')
    : hasAnyItems
      ? t(language, 'analytics.emptyDate')
      : t(language, 'analytics.emptyInitial');

  return (
    <View style={styles.emptyState}>
      <EmptyIllustration testID="analytics-empty-illustration" />

      <Text style={styles.emptyTitle}>
        {t(language, 'analytics.emptyTitle')}
      </Text>

      <Text style={styles.emptyMessage}>{emptyMessage}</Text>

      <Pressable
        accessibilityRole="button"
        onPress={onAddTransaction}
        style={styles.emptyActionButton}
        testID="analytics-empty-add-transaction"
      >
        <Text style={styles.emptyActionButtonText}>
          {t(language, 'analytics.addTransaction')}
        </Text>
      </Pressable>
    </View>
  );
}

type FilterModalProps = {
  balanceTypeOptions: BalanceTypeOption[];
  categoryOptions: CategoryOption[];
  draftFilter: AnalyticsFilterState;
  language: SupportedLanguage;
  onApply: () => void;
  onClose: () => void;
  onSelectBalanceType: (balanceTypeId: string) => void;
  onSelectCategory: (categoryId: string) => void;
  onSelectLeakReason: (leakReason: LeakReason) => void;
  onSelectOperation: (
    operation: Exclude<AnalyticsFilterOperation, 'all'>,
  ) => void;
  onSelectTransactionKind: (transactionKind: AnalyticsSpentKind) => void;
  visible: boolean;
};

function FilterModal({
  balanceTypeOptions,
  categoryOptions,
  draftFilter,
  language,
  onApply,
  onClose,
  onSelectBalanceType,
  onSelectCategory,
  onSelectLeakReason,
  onSelectOperation,
  onSelectTransactionKind,
  visible,
}: FilterModalProps) {
  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle="fullScreen"
      visible={visible}
    >
      <SafeAreaView
        edges={['top', 'bottom', 'left', 'right']}
        style={styles.filterSafeArea}
        testID="analytics-filter-modal"
      >
        <View style={styles.filterLayout}>
          <View style={styles.filterHeader}>
            <Pressable
              accessibilityLabel={t(language, 'analytics.filterClose')}
              accessibilityRole="button"
              onPress={onClose}
              style={styles.filterBackButton}
            >
              <SymbolView
                fallback={<Text style={styles.filterBackText}>{'<'}</Text>}
                name={CHEVRON_LEFT_ICON}
                resizeMode="scaleAspectFit"
                size={24}
                tintColor="#100f10"
                type="monochrome"
                weight="semibold"
              />
            </Pressable>

            <Text style={styles.filterTitle}>
              {t(language, 'analytics.filterTitle')}
            </Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.filterContent}>
          <View style={styles.chipRow}>
            <Chip
              label={t(language, 'analytics.operation.added')}
              onPress={() => onSelectOperation('added')}
              selected={draftFilter.operation === 'added'}
              testID="analytics-filter-added-chip"
              variant="filter"
            />

            <Chip
              label={t(language, 'analytics.operation.spent')}
              onPress={() => onSelectOperation('spent')}
              selected={draftFilter.operation === 'spent'}
              testID="analytics-filter-spent-chip"
              variant="filter"
            />
          </View>

          {draftFilter.operation === 'added' ? (
            <View style={styles.filterSection}>
              <Text style={styles.filterSectionTitle}>
                {t(language, 'common.type')}
              </Text>

              <View style={styles.chipRow}>
                {balanceTypeOptions.map((balanceType) => (
                  <Chip
                    key={balanceType.id}
                    label={balanceType.name}
                    onPress={() => onSelectBalanceType(balanceType.id)}
                    selected={draftFilter.balanceTypeId === balanceType.id}
                    testID={`analytics-filter-balance-type-${balanceType.id}`}
                    variant="filter"
                  />
                ))}
              </View>
            </View>
          ) : null}

          {draftFilter.operation === 'spent' ? (
            <>
              <View style={styles.filterSection}>
                <Text style={styles.filterSectionTitle}>
                  {t(language, 'common.type')}
                </Text>

                <View style={styles.chipRow}>
                  <Chip
                    icon={{
                      fallback: 'N',
                      name: NORMAL_DETAIL_ICON,
                    }}
                    label={t(language, 'common.normal')}
                    onPress={() => onSelectTransactionKind('normal')}
                    selected={draftFilter.transactionKind === 'normal'}
                    testID="analytics-filter-kind-normal"
                    variant="filter"
                  />

                  <Chip
                    icon={{
                      fallback: 'L',
                      name: LEAK_DETAIL_ICON,
                    }}
                    label={t(language, 'home.leak')}
                    onPress={() => onSelectTransactionKind('leak')}
                    selected={draftFilter.transactionKind === 'leak'}
                    testID="analytics-filter-kind-leak"
                    variant="filter"
                  />
                </View>
              </View>

              {draftFilter.transactionKind === 'leak' ||
              draftFilter.leakReason ? (
                <View style={styles.filterSection}>
                  <Text style={styles.filterSectionTitle}>
                    {t(language, 'common.reason')}
                  </Text>

                  <View style={styles.chipRow}>
                    {LEAK_REASONS.map((leakReason) => (
                      <Chip
                        icon={LEAK_REASON_ICONS[leakReason]}
                        key={leakReason}
                        label={getLeakReasonLabel(language, leakReason)}
                        onPress={() => onSelectLeakReason(leakReason)}
                        selected={draftFilter.leakReason === leakReason}
                        testID={`analytics-filter-reason-${leakReason}`}
                        variant="filter"
                      />
                    ))}
                  </View>
                </View>
              ) : null}

              <View style={styles.filterSection}>
                <Text style={styles.filterSectionTitle}>
                  {t(language, 'common.category')}
                </Text>

                <View style={styles.chipRow}>
                  {categoryOptions.map((category) => (
                    <CategoryChip
                      category={category}
                      key={category.id}
                      onPress={() => onSelectCategory(category.id)}
                      selected={draftFilter.categoryId === category.id}
                    />
                  ))}
                </View>
              </View>
            </>
          ) : null}
        </ScrollView>

        <View style={styles.filterFooter}>
          <Pressable
            accessibilityRole="button"
            onPress={onApply}
            style={styles.applyButton}
            testID="analytics-filter-apply-button"
          >
            <Text style={styles.applyButtonText}>
              {t(language, 'common.apply')}
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

export function AnalyticsScreen() {
  const router = useRouter();
  const currency = useSettingsCurrency();
  const language = useSettingsLanguage();
  const transactions = useTransactionsStore((state) => state.transactions);
  const isLoading = useTransactionsStore((state) => state.isLoading);
  const isInitialized = useTransactionsStore((state) => state.isInitialized);
  const error = useTransactionsStore((state) => state.error);
  const loadTransactions = useTransactionsStore(
    (state) => state.loadTransactions,
  );

  const balanceEntries = useBalanceStore((state) => state.balanceEntries);
  const balanceTypes = useBalanceStore((state) => state.balanceTypes);
  const activeBalanceTypes = useBalanceStore(
    (state) => state.activeBalanceTypes,
  );
  const isBalanceLoading = useBalanceStore((state) => state.isLoading);
  const isBalanceInitialized = useBalanceStore((state) => state.isInitialized);
  const balanceError = useBalanceStore((state) => state.error);
  const loadBalance = useBalanceStore((state) => state.loadBalance);

  const categories = useCategoriesStore((state) => state.categories);
  const activeCategories = useCategoriesStore(
    (state) => state.activeCategories,
  );
  const areCategoriesInitialized = useCategoriesStore(
    (state) => state.isInitialized,
  );
  const categoriesError = useCategoriesStore((state) => state.error);
  const loadCategories = useCategoriesStore((state) => state.loadCategories);

  const [selectedPeriod, setSelectedPeriod] =
    useState<AnalyticsPeriod>('today');
  const [customPeriodType, setCustomPeriodType] =
    useState<AnalyticsCustomPeriodType | null>(null);
  const [isCustomTypeMenuVisible, setIsCustomTypeMenuVisible] = useState(false);
  const [customDate, setCustomDate] = useState(getTodayTimestamp);
  const [customRangeStart, setCustomRangeStart] = useState(getTodayTimestamp);
  const [customRangeEnd, setCustomRangeEnd] = useState(getTodayTimestamp);
  const [datePickerMode, setDatePickerMode] = useState<DatePickerMode | null>(
    null,
  );
  const [inlinePickerMode, setInlinePickerMode] =
    useState<InlinePickerMode | null>(null);
  const [inlineCalendarMonth, setInlineCalendarMonth] = useState(() =>
    getStartOfInlineMonth(getValidInlineDate(customDate)),
  );
  const [rangeSelectionAnchor, setRangeSelectionAnchor] = useState<
    number | null
  >(null);
  const [filter, setFilter] = useState<AnalyticsFilterState>(
    createDefaultAnalyticsFilter,
  );
  const [draftFilter, setDraftFilter] = useState<AnalyticsFilterState>(
    createDefaultAnalyticsFilter,
  );
  const [isFilterVisible, setIsFilterVisible] = useState(false);

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

  const balanceTypeOptions = useMemo(
    () => getBalanceTypeOptions(activeBalanceTypes, language),
    [activeBalanceTypes, language],
  );
  const categoryOptions = useMemo(
    () => getCategoryOptions(activeCategories, language),
    [activeCategories, language],
  );

  const ledgerItems = useMemo(
    () =>
      buildAnalyticsLedgerItems({
        balanceEntries,
        customDate,
        customPeriodType,
        customRangeEnd,
        customRangeStart,
        filter,
        period: selectedPeriod,
        transactions,
      }),
    [
      balanceEntries,
      customDate,
      customPeriodType,
      customRangeEnd,
      customRangeStart,
      filter,
      selectedPeriod,
      transactions,
    ],
  );
  const ledgerGroups = useMemo(
    () => groupAnalyticsLedgerItems(ledgerItems, language),
    [ledgerItems, language],
  );
  const filterLabel = getFilterLabel({
    balanceTypeOptions,
    categories,
    filter,
    language,
  });
  const isInitialLoading =
    !isInitialized || !isBalanceInitialized || !areCategoriesInitialized;
  const hasAnyItems = transactions.length > 0 || balanceEntries.length > 0;
  const hasSafeError = Boolean(error || balanceError || categoriesError);
  const isRefreshing = isLoading || isBalanceLoading;
  const isCustomAwaitingType =
    selectedPeriod === 'custom' && customPeriodType === null;
  const shouldShowEmptyState =
    !isCustomAwaitingType && ledgerGroups.length === 0;
  const isFilterActive = isAnalyticsFilterActive(filter);
  const shouldLockScreenScroll =
    inlinePickerMode === 'month' || inlinePickerMode === 'year';

  function handleOpenFilter() {
    setDraftFilter(filter);
    setIsFilterVisible(true);
  }

  function handleAddTransaction() {
    router.push('/add-transaction' as Href);
  }

  function handleSelectPeriod(period: AnalyticsPeriod) {
    setSelectedPeriod(period);
    setDatePickerMode(null);
    setInlinePickerMode(null);
    setRangeSelectionAnchor(null);
  }

  function handleApplyFilter() {
    setFilter(normalizeAnalyticsFilter(draftFilter));
    setIsFilterVisible(false);
  }

  function handleClearFilter() {
    const nextFilter = createDefaultAnalyticsFilter();

    setFilter(nextFilter);
    setDraftFilter(nextFilter);
  }

  function handleSelectFilterOperation(
    operation: Exclude<AnalyticsFilterOperation, 'all'>,
  ) {
    setDraftFilter((currentFilter) => {
      if (currentFilter.operation === operation) {
        return createDefaultAnalyticsFilter();
      }

      return {
        ...createDefaultAnalyticsFilter(),
        operation,
      };
    });
  }

  function handleSelectBalanceType(balanceTypeId: string) {
    setDraftFilter((currentFilter) => ({
      ...currentFilter,
      balanceTypeId:
        currentFilter.balanceTypeId === balanceTypeId ? null : balanceTypeId,
      operation: 'added',
    }));
  }

  function handleSelectTransactionKind(transactionKind: AnalyticsSpentKind) {
    setDraftFilter((currentFilter) => {
      const isClearing = currentFilter.transactionKind === transactionKind;

      return {
        ...currentFilter,
        balanceTypeId: null,
        leakReason:
          isClearing || transactionKind === 'normal'
            ? null
            : currentFilter.leakReason,
        operation: 'spent',
        transactionKind: isClearing ? null : transactionKind,
      };
    });
  }

  function handleSelectCategory(categoryId: string) {
    setDraftFilter((currentFilter) => ({
      ...currentFilter,
      balanceTypeId: null,
      categoryId: currentFilter.categoryId === categoryId ? null : categoryId,
      operation: 'spent',
    }));
  }

  function handleSelectLeakReason(leakReason: LeakReason) {
    setDraftFilter((currentFilter) => ({
      ...currentFilter,
      balanceTypeId: null,
      leakReason: currentFilter.leakReason === leakReason ? null : leakReason,
      operation: 'spent',
      transactionKind:
        currentFilter.leakReason === leakReason ? 'leak' : 'leak',
    }));
  }

  function handleSelectCustomPeriodType(periodType: AnalyticsCustomPeriodType) {
    setCustomPeriodType(periodType);
    setIsCustomTypeMenuVisible(false);
    setDatePickerMode(null);
    setInlinePickerMode(null);
    setRangeSelectionAnchor(null);

    if (periodType === 'custom_dates') {
      setInlineCalendarMonth(
        getStartOfInlineMonth(getValidInlineDate(customRangeStart)),
      );
    } else {
      setInlineCalendarMonth(
        getStartOfInlineMonth(getValidInlineDate(customDate)),
      );
    }
  }

  function handleDatePress() {
    if (
      customPeriodType === 'day' ||
      customPeriodType === 'month' ||
      customPeriodType === 'year'
    ) {
      setDatePickerMode(null);
      setInlineCalendarMonth(
        getStartOfInlineMonth(getValidInlineDate(customDate)),
      );
      setInlinePickerMode((currentMode) =>
        currentMode === customPeriodType ? null : customPeriodType,
      );

      return;
    }

    if (customPeriodType === 'custom_dates') {
      setDatePickerMode(null);
      setInlineCalendarMonth(
        getStartOfInlineMonth(getValidInlineDate(customRangeStart)),
      );
      setRangeSelectionAnchor(null);
      setInlinePickerMode((currentMode) =>
        currentMode === 'range' ? null : 'range',
      );

      return;
    }

    setInlinePickerMode(null);
    setDatePickerMode('single');
  }

  function handleDateConfirm(date: Date) {
    const selectedDateStart =
      getAnalyticsLocalDayTimestamp(date) ?? date.getTime();

    if (datePickerMode === 'single') {
      setCustomDate(selectedDateStart);
      setInlineCalendarMonth(getStartOfInlineMonth(date));
      setDatePickerMode(null);
    }
  }

  function handleInlineDateConfirm(date: Date) {
    const selectedDateStart =
      getAnalyticsLocalDayTimestamp(date) ?? date.getTime();

    setCustomDate(selectedDateStart);
    setInlineCalendarMonth(getStartOfInlineMonth(date));
    setInlinePickerMode(null);
  }

  function handleInlineRangeDatePress(date: Date) {
    const selectedDateStart = getInlineDayTimestamp(date);

    if (rangeSelectionAnchor === null) {
      setRangeSelectionAnchor(selectedDateStart);
      setCustomRangeStart(selectedDateStart);
      setCustomRangeEnd(selectedDateStart);
      setInlineCalendarMonth(getStartOfInlineMonth(date));

      return;
    }

    const normalizedRange = getNormalizedInlineRange(
      rangeSelectionAnchor,
      selectedDateStart,
    );

    setCustomRangeStart(normalizedRange.start);
    setCustomRangeEnd(normalizedRange.end);
    setRangeSelectionAnchor(null);
    setInlineCalendarMonth(getStartOfInlineMonth(date));
    setInlinePickerMode(null);
  }

  function handleInlineMonthConfirm(monthIndex: number) {
    const currentDate = getValidInlineDate(customDate);
    const selectedDate = new Date(currentDate.getFullYear(), monthIndex, 1);
    const selectedDateStart =
      getAnalyticsLocalDayTimestamp(selectedDate) ?? selectedDate.getTime();

    setCustomDate(selectedDateStart);
    setInlineCalendarMonth(getStartOfInlineMonth(selectedDate));
    setInlinePickerMode(null);
  }

  function handleInlineYearConfirm(year: number) {
    const selectedDate = new Date(year, 0, 1);
    const selectedDateStart =
      getAnalyticsLocalDayTimestamp(selectedDate) ?? selectedDate.getTime();

    setCustomDate(selectedDateStart);
    setInlineCalendarMonth(getStartOfInlineMonth(selectedDate));
    setInlinePickerMode(null);
  }

  function handleDateRangeConfirm(startDate: Date, endDate: Date) {
    const selectedStart =
      getAnalyticsLocalDayTimestamp(startDate) ?? startDate.getTime();
    const selectedEnd =
      getAnalyticsLocalDayTimestamp(endDate) ?? endDate.getTime();
    const start = Math.min(selectedStart, selectedEnd);
    const end = Math.max(selectedStart, selectedEnd);

    setCustomRangeStart(start);
    setCustomRangeEnd(end);
    setDatePickerMode(null);
  }

  if (isInitialLoading) {
    return (
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
        <View style={styles.centeredState}>
          <Text style={styles.stateTitle}>
            {t(language, 'analytics.loadingTitle')}
          </Text>
          <Text style={styles.stateMessage}>
            {t(language, 'analytics.loadingMessage')}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (hasSafeError && !hasAnyItems) {
    return (
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
        <View style={styles.centeredState}>
          <Text style={styles.stateTitle}>
            {t(language, 'analytics.loadErrorTitle')}
          </Text>
          <Text style={styles.stateMessage}>
            {t(language, 'analytics.loadErrorMessage')}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.content}
        scrollEnabled={!shouldLockScreenScroll}
      >
        <View style={styles.contentColumn}>
          <Text style={styles.pageTitle}>
            {t(language, 'tabs.analyticsTitle')}
          </Text>

          <View style={styles.operationHeader}>
            <Text style={styles.operationLabel}>
              {getOperationLabel(filter.operation, language)}
            </Text>

            <Pressable
              accessibilityLabel={t(language, 'analytics.filterOpen')}
              accessibilityRole="button"
              onPress={handleOpenFilter}
              style={styles.filterButton}
              testID="analytics-filter-button"
            >
              <FilterGlyph isActive={isFilterActive} />
            </Pressable>
          </View>

          {filterLabel ? (
            <View style={styles.filteredByRow}>
              <Text style={styles.filteredByLabel}>
                {t(language, 'analytics.filteredBy')}
              </Text>

              <Pressable
                accessibilityRole="button"
                onPress={handleClearFilter}
                testID="analytics-clear-filter"
              >
                <Text style={styles.filteredByValue}>{filterLabel} ×</Text>
              </Pressable>
            </View>
          ) : null}

          <AnalyticsSegmentedControl
            language={language}
            onSelectPeriod={handleSelectPeriod}
            selectedPeriod={selectedPeriod}
          />

          {selectedPeriod === 'custom' ? (
            <View style={styles.customControls}>
              <View style={styles.customControlGroup}>
                <Text style={styles.customControlLabel}>
                  {t(language, 'common.type')}
                </Text>

                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    setDatePickerMode(null);
                    setInlinePickerMode(null);
                    setRangeSelectionAnchor(null);
                    setIsCustomTypeMenuVisible((currentValue) => !currentValue);
                  }}
                  style={styles.customControl}
                  testID="analytics-custom-type-control"
                >
                  <Text style={styles.customControlValue}>
                    {customPeriodType
                      ? getCustomPeriodTypeLabel(customPeriodType, language)
                      : t(language, 'analytics.choosePeriodType')}
                  </Text>

                  <SymbolView
                    fallback={
                      <Text style={styles.customControlIcon}>{'v'}</Text>
                    }
                    name={CHEVRON_DOWN_ICON}
                    resizeMode="scaleAspectFit"
                    size={14}
                    tintColor="#100f10"
                    type="monochrome"
                    weight="semibold"
                  />
                </Pressable>
              </View>

              {isCustomTypeMenuVisible ? (
                <View style={styles.customTypeMenu}>
                  {ANALYTICS_CUSTOM_PERIOD_TYPE_OPTIONS.map((periodType) => (
                    <Chip
                      key={periodType}
                      label={getCustomPeriodTypeLabel(periodType, language)}
                      onPress={() => handleSelectCustomPeriodType(periodType)}
                      selected={customPeriodType === periodType}
                      testID={`analytics-custom-type-${periodType}`}
                    />
                  ))}
                </View>
              ) : null}

              {customPeriodType ? (
                <View style={styles.customControlGroup}>
                  <Text style={styles.customControlLabel}>
                    {t(language, 'common.date')}
                  </Text>

                  <Pressable
                    accessibilityRole="button"
                    onPress={handleDatePress}
                    style={[
                      styles.customControl,
                      inlinePickerMode ? styles.customControlActive : null,
                    ]}
                    testID="analytics-custom-date-control"
                  >
                    <SymbolView
                      fallback={
                        <Text style={styles.customControlIcon}>Cal</Text>
                      }
                      name={CALENDAR_ICON}
                      resizeMode="scaleAspectFit"
                      size={16}
                      tintColor="#100f10"
                      type="monochrome"
                      weight="semibold"
                    />

                    <Text style={styles.customControlValue}>
                      {formatAnalyticsCustomDateLabel({
                        customDate,
                        customPeriodType,
                        customRangeEnd,
                        customRangeStart,
                        language,
                      })}
                    </Text>
                  </Pressable>

                  {customPeriodType === 'day' && inlinePickerMode === 'day' ? (
                    <InlineDayCalendar
                      language={language}
                      month={inlineCalendarMonth}
                      selectedDate={customDate}
                      onChangeMonth={setInlineCalendarMonth}
                      onSelectDate={handleInlineDateConfirm}
                    />
                  ) : null}

                  {customPeriodType === 'custom_dates' &&
                  inlinePickerMode === 'range' ? (
                    <InlineRangeCalendar
                      language={language}
                      month={inlineCalendarMonth}
                      rangeEnd={customRangeEnd}
                      rangeStart={customRangeStart}
                      onChangeMonth={setInlineCalendarMonth}
                      onSelectDate={handleInlineRangeDatePress}
                    />
                  ) : null}

                  {customPeriodType === 'month' &&
                  inlinePickerMode === 'month' ? (
                    <InlineOptionPicker
                      options={getMonthLabels(language).map(
                        (monthLabel, index) => {
                          const selectedDate = getValidInlineDate(customDate);
                          const year = selectedDate.getFullYear();

                          return {
                            label: monthLabel,
                            testID: `analytics-inline-month-${year}-${index + 1}`,
                            value: index,
                          };
                        },
                      )}
                      selectedValue={getValidInlineDate(customDate).getMonth()}
                      testID="analytics-inline-month-picker"
                      title={formatLanguageDate(
                        language,
                        getValidInlineDate(customDate),
                        { month: 'long', year: 'numeric' },
                      )}
                      onSelectValue={handleInlineMonthConfirm}
                    />
                  ) : null}

                  {customPeriodType === 'year' &&
                  inlinePickerMode === 'year' ? (
                    <InlineOptionPicker
                      options={getInlineYearOptions(customDate).map((year) => ({
                        label: year.toString(),
                        testID: `analytics-inline-year-${year}`,
                        value: year,
                      }))}
                      selectedValue={getValidInlineDate(
                        customDate,
                      ).getFullYear()}
                      testID="analytics-inline-year-picker"
                      title={getValidInlineDate(customDate)
                        .getFullYear()
                        .toString()}
                      onSelectValue={handleInlineYearConfirm}
                    />
                  ) : null}
                </View>
              ) : null}
            </View>
          ) : null}

          {isRefreshing ? (
            <Text style={styles.refreshingText}>
              {t(language, 'analytics.refreshing')}
            </Text>
          ) : null}

          {hasSafeError ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>
                {t(language, 'analytics.refreshError')}
              </Text>
            </View>
          ) : null}

          {ledgerGroups.length > 0 ? (
            <View style={styles.feed}>
              {ledgerGroups.map((group) => (
                <View key={group.dateKey} style={styles.feedGroup}>
                  <Text style={styles.dateLabel}>{group.label}</Text>

                  <View style={styles.ledgerRows}>
                    {group.items.map((item) => (
                      <LedgerRow
                        balanceTypeOptions={balanceTypeOptions}
                        balanceTypes={balanceTypes}
                        categories={categories}
                        currency={currency}
                        item={item}
                        language={language}
                        key={item.id}
                      />
                    ))}
                  </View>
                </View>
              ))}
            </View>
          ) : null}

          {shouldShowEmptyState ? (
            <EmptyState
              hasAnyItems={hasAnyItems}
              isFilterActive={isFilterActive}
              language={language}
              onAddTransaction={handleAddTransaction}
            />
          ) : null}
        </View>
      </ScrollView>

      {isFilterVisible ? (
        <FilterModal
          balanceTypeOptions={balanceTypeOptions}
          categoryOptions={categoryOptions}
          draftFilter={draftFilter}
          language={language}
          onApply={handleApplyFilter}
          onClose={() => setIsFilterVisible(false)}
          onSelectBalanceType={handleSelectBalanceType}
          onSelectCategory={handleSelectCategory}
          onSelectLeakReason={handleSelectLeakReason}
          onSelectOperation={handleSelectFilterOperation}
          onSelectTransactionKind={handleSelectTransactionKind}
          visible
        />
      ) : null}

      <LocalDatePicker
        mode={getLocalDatePickerMode({
          customPeriodType,
          mode: datePickerMode,
        })}
        rangeEnd={getDatePickerRangeEndValue(customRangeEnd)}
        visible={datePickerMode !== null}
        value={getDatePickerValue({
          customDate,
          customRangeStart,
          mode: datePickerMode,
        })}
        onCancel={() => setDatePickerMode(null)}
        onConfirm={handleDateConfirm}
        onConfirmRange={handleDateRangeConfirm}
      />
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
    paddingTop: 26,
    paddingBottom: 132,
  },
  contentColumn: {
    width: '100%',
    maxWidth: 360,
    gap: 18,
  },
  pageTitle: {
    fontFamily: TITLE_FONT_FAMILY,
    fontSize: 36,
    fontWeight: TITLE_FONT_WEIGHT,
    lineHeight: 41,
    color: '#100f10',
  },
  operationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  operationLabel: {
    flex: 1,
    fontFamily: TITLE_FONT_FAMILY,
    fontSize: 24,
    fontWeight: TITLE_FONT_WEIGHT,
    lineHeight: 30,
    color: '#100f10',
  },
  filterButton: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterGlyphFallback: {
    fontSize: 19,
    lineHeight: 22,
    color: '#0088ff',
  },
  filterGlyphFallbackActive: {
    fontWeight: '700',
  },
  filteredByRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: -8,
  },
  filteredByLabel: {
    fontSize: 15,
    lineHeight: 20,
    color: '#6b6b6f',
  },
  filteredByValue: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20,
    color: '#0088ff',
  },
  segmentedControl: {
    flexDirection: 'row',
    height: 32,
    borderRadius: 999,
    backgroundColor: 'rgba(118, 118, 128, 0.12)',
    padding: 2,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    paddingHorizontal: 8,
  },
  segmentSelected: {
    backgroundColor: '#ffffff',
  },
  segmentText: {
    width: '100%',
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
    textAlign: 'center',
    color: '#100f10',
  },
  segmentTextSelected: {
    fontWeight: '700',
  },
  customControls: {
    gap: 24,
  },
  customControlGroup: {
    width: '100%',
    gap: 8,
  },
  customControl: {
    height: 50,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: '#100f10',
    borderRadius: 999,
    backgroundColor: '#f7f7f5',
    paddingHorizontal: 16,
  },
  customControlActive: {
    borderWidth: 2,
  },
  customControlLabel: {
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 21,
    color: '#100f10',
  },
  customControlValue: {
    flex: 1,
    fontSize: 16,
    lineHeight: 21,
    color: '#100f10',
  },
  customControlIcon: {
    fontSize: 12,
    fontWeight: '700',
    color: '#100f10',
  },
  customTypeMenu: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  inlineCalendar: {
    overflow: 'hidden',
    borderRadius: 13,
    backgroundColor: 'rgba(255, 255, 255, 0.88)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 30,
    elevation: 4,
  },
  inlineCalendarHeader: {
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  inlineCalendarMonthLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  inlineCalendarMonthText: {
    fontSize: 17,
    fontWeight: '600',
    lineHeight: 22,
    color: '#100f10',
  },
  inlineCalendarTitleArrow: {
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 18,
    color: '#0088ff',
  },
  inlineCalendarArrows: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 28,
  },
  inlineCalendarArrowButton: {
    width: 20,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inlineCalendarArrowText: {
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 24,
    color: '#0088ff',
  },
  inlineCalendarWeekdays: {
    height: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  inlineCalendarWeekday: {
    width: 32,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
    textAlign: 'center',
    color: 'rgba(60, 60, 67, 0.3)',
  },
  inlineCalendarGrid: {
    gap: 7,
    paddingTop: 3,
    paddingHorizontal: 16,
    paddingBottom: 11,
  },
  inlineCalendarWeek: {
    height: 44,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  inlineCalendarDay: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
  },
  inlineCalendarDaySelected: {
    backgroundColor: 'rgba(0, 136, 255, 0.14)',
  },
  inlineCalendarDayText: {
    fontSize: 20,
    fontWeight: '400',
    lineHeight: 25,
    textAlign: 'center',
    color: '#100f10',
  },
  inlineCalendarDayTextSelected: {
    fontSize: 24,
    fontWeight: '500',
    color: '#0088ff',
  },
  inlinePickerList: {
    maxHeight: 262,
    width: '100%',
  },
  inlinePickerListContent: {
    gap: 7,
    paddingTop: 3,
    paddingHorizontal: 16,
    paddingBottom: 11,
  },
  inlinePickerOption: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inlinePickerOptionPill: {
    minHeight: 43,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    paddingHorizontal: 10,
  },
  inlinePickerOptionPillSelected: {
    backgroundColor: 'rgba(0, 136, 255, 0.14)',
  },
  inlinePickerOptionText: {
    fontSize: 20,
    fontWeight: '400',
    lineHeight: 25,
    textAlign: 'center',
    color: '#100f10',
  },
  inlinePickerOptionTextSelected: {
    fontSize: 24,
    fontWeight: '500',
    color: '#0088ff',
  },
  refreshingText: {
    fontSize: 14,
    lineHeight: 19,
    color: '#6b6b6f',
  },
  errorBox: {
    borderWidth: 1,
    borderColor: '#f0c7c7',
    borderRadius: 8,
    backgroundColor: '#fff4f4',
    padding: 12,
  },
  errorText: {
    fontSize: 14,
    lineHeight: 19,
    color: '#8a1f1f',
  },
  feed: {
    gap: 18,
  },
  feedGroup: {
    gap: 4,
  },
  dateLabel: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
    color: '#6b6b6f',
  },
  ledgerRows: {
    gap: 0,
  },
  ledgerRow: {
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
  ledgerInfoRow: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ledgerInfoRowTop: {
    alignItems: 'flex-start',
  },
  ledgerIconSlot: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ledgerIconFallback: {
    fontSize: 12,
    fontWeight: '700',
    color: '#100f10',
  },
  ledgerCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  ledgerTitle: {
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 20,
    color: '#100f10',
  },
  ledgerDetail: {
    fontSize: 13,
    lineHeight: 18,
    color: '#100f10',
  },
  ledgerDetailIconFallback: {
    minWidth: 13,
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 13,
    textAlign: 'center',
    color: '#100f10',
  },
  transactionDetailRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    gap: 4,
  },
  transactionDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  ledgerTime: {
    fontSize: 13,
    lineHeight: 17,
    color: '#8a8a8f',
  },
  ledgerAmount: {
    flexShrink: 0,
    maxWidth: 126,
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 20,
    textAlign: 'right',
  },
  ledgerAmountPositive: {
    color: '#2bbd50',
  },
  ledgerAmountNegative: {
    color: '#100f10',
  },
  emptyState: {
    alignItems: 'center',
    gap: 12,
    paddingTop: 102,
    paddingHorizontal: 0,
  },
  emptyIllustration: {
    width: 156,
    height: 156,
    marginBottom: 20,
  },
  emptyTitle: {
    fontFamily: TITLE_FONT_FAMILY,
    fontSize: 24,
    fontWeight: TITLE_FONT_WEIGHT,
    lineHeight: 30,
    textAlign: 'center',
    color: '#100f10',
  },
  emptyMessage: {
    maxWidth: 260,
    fontSize: 15,
    lineHeight: 21,
    textAlign: 'center',
    color: '#6b6b6f',
  },
  emptyActionButton: {
    width: '100%',
    minHeight: 58,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 29,
    backgroundColor: '#100f10',
    marginTop: 60,
    paddingHorizontal: 20,
  },
  emptyActionButtonText: {
    fontSize: 17,
    fontWeight: '600',
    lineHeight: 22,
    color: '#ffffff',
  },
  centeredState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 24,
  },
  stateTitle: {
    fontFamily: TITLE_FONT_FAMILY,
    fontSize: 24,
    fontWeight: TITLE_FONT_WEIGHT,
    lineHeight: 30,
    textAlign: 'center',
    color: '#100f10',
  },
  stateMessage: {
    maxWidth: 280,
    fontSize: 15,
    lineHeight: 21,
    textAlign: 'center',
    color: '#6b6b6f',
  },
  filterSafeArea: {
    flex: 1,
    backgroundColor: '#f7f7f5',
  },
  filterLayout: {
    width: '100%',
    maxWidth: 360,
    alignSelf: 'center',
    paddingTop: 62,
  },
  filterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 48,
  },
  filterBackButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.65)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 40,
    elevation: 3,
  },
  filterBackText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#100f10',
  },
  filterTitle: {
    flex: 1,
    fontFamily: TITLE_FONT_FAMILY,
    fontSize: 36,
    fontWeight: TITLE_FONT_WEIGHT,
    lineHeight: 43,
    color: '#100f10',
  },
  filterContent: {
    width: '100%',
    maxWidth: 360,
    alignSelf: 'center',
    flexGrow: 1,
    gap: 48,
    paddingTop: 48,
    paddingBottom: 120,
  },
  filterSection: {
    gap: 8,
  },
  filterSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 20,
    color: '#100f10',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderWidth: 1,
    borderColor: '#d8d8d3',
    borderRadius: 17,
    backgroundColor: '#f7f7f5',
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  filterChip: {
    minHeight: 43,
    borderColor: '#100f10',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  chipSelected: {
    borderColor: '#100f10',
    backgroundColor: '#100f10',
  },
  chipText: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 18,
    color: '#100f10',
  },
  filterChipText: {
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 21,
  },
  chipTextSelected: {
    color: '#ffffff',
  },
  filterChipIconFallback: {
    minWidth: 16,
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
    color: '#100f10',
  },
  filterChipIconFallbackSelected: {
    color: '#ffffff',
  },
  categoryChip: {
    flexDirection: 'row',
    gap: 6,
  },
  categoryChipIconFallback: {
    minWidth: 15,
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
    color: '#100f10',
  },
  categoryChipIconFallbackSelected: {
    color: '#ffffff',
  },
  filterFooter: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    left: 0,
    paddingTop: 12,
    paddingBottom: 24,
    backgroundColor: '#f7f7f5',
  },
  applyButton: {
    width: '100%',
    maxWidth: 360,
    minHeight: 50,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    backgroundColor: '#100f10',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  applyButtonText: {
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 22,
    color: '#ffffff',
  },
});
