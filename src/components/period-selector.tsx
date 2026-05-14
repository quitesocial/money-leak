import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { LocalDatePicker } from '@/components/local-date-picker';
import {
  PERIOD_SCOPE_OPTIONS,
  getPeriodLabel,
  type PeriodScope,
} from '@/lib/period-scope';

type PeriodSelectorProps = {
  selectedPeriod: PeriodScope;
  selectedCustomDateStart: number | null;
  onSelectPeriod: (period: PeriodScope) => void;
  onSelectCustomDate: (dateStart: number) => void;
  label?: string;
};

function getDatePickerValue(selectedCustomDateStart: number | null) {
  if (selectedCustomDateStart !== null) {
    const selectedDate = new Date(selectedCustomDateStart);

    if (Number.isFinite(selectedDate.getTime())) return selectedDate;
  }

  return new Date();
}

export function PeriodSelector({
  selectedPeriod,
  selectedCustomDateStart,
  onSelectPeriod,
  onSelectCustomDate,
  label,
}: PeriodSelectorProps) {
  const [isDatePickerVisible, setIsDatePickerVisible] = useState(false);
  const datePickerValue = getDatePickerValue(selectedCustomDateStart);

  function handlePeriodPress(period: PeriodScope) {
    if (period === 'custom_date') {
      setIsDatePickerVisible(true);

      return;
    }

    onSelectPeriod(period);
  }

  function handleDateConfirm(date: Date) {
    setIsDatePickerVisible(false);
    onSelectCustomDate(date.getTime());
  }

  return (
    <View style={styles.container}>
      {label ? <Text style={styles.label}>{label}</Text> : null}

      <View style={styles.chipList}>
        {PERIOD_SCOPE_OPTIONS.map((period) => {
          const isSelected = selectedPeriod === period;

          return (
            <Pressable
              key={period}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              onPress={() => handlePeriodPress(period)}
              style={[styles.chip, isSelected ? styles.chipSelected : null]}
            >
              <Text
                style={[
                  styles.chipText,
                  isSelected ? styles.chipTextSelected : null,
                ]}
              >
                {getPeriodLabel(period, selectedCustomDateStart)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <LocalDatePicker
        visible={isDatePickerVisible}
        value={datePickerValue}
        onCancel={() => setIsDatePickerVisible(false)}
        onConfirm={handleDateConfirm}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 10,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
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
});
