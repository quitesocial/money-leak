import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  PERIOD_SCOPE_OPTIONS,
  getPeriodLabel,
  type PeriodScope,
} from '@/lib/period-scope';

type PeriodSelectorProps = {
  selectedPeriod: PeriodScope;
  onSelectPeriod: (period: PeriodScope) => void;
  label?: string;
};

export function PeriodSelector({
  selectedPeriod,
  onSelectPeriod,
  label,
}: PeriodSelectorProps) {
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
              onPress={() => onSelectPeriod(period)}
              style={[styles.chip, isSelected ? styles.chipSelected : null]}
            >
              <Text
                style={[
                  styles.chipText,
                  isSelected ? styles.chipTextSelected : null,
                ]}
              >
                {getPeriodLabel(period)}
              </Text>
            </Pressable>
          );
        })}
      </View>
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
