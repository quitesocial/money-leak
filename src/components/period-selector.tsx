import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import { LocalDatePicker } from '@/components/local-date-picker';
import {
  PERIOD_SCOPE_OPTIONS,
  getPeriodLabel,
  type PeriodScope,
} from '@/lib/period-scope';

const SEGMENTED_CONTROL_PADDING = 3;

type PeriodSelectorProps = {
  selectedPeriod: PeriodScope;
  selectedCustomDateStart: number | null;
  onSelectPeriod: (period: PeriodScope) => void;
  onSelectCustomDate: (dateStart: number) => void;
  periods?: PeriodScope[];
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
  periods = PERIOD_SCOPE_OPTIONS,
  label,
}: PeriodSelectorProps) {
  const [isDatePickerVisible, setIsDatePickerVisible] = useState(false);
  const [controlWidth, setControlWidth] = useState(0);
  const selectedIndex = periods.indexOf(selectedPeriod);
  const effectiveSelectedIndex = selectedIndex >= 0 ? selectedIndex : 0;

  const animatedIndex = useRef(
    new Animated.Value(effectiveSelectedIndex),
  ).current;

  const datePickerValue = getDatePickerValue(selectedCustomDateStart);

  const segmentWidth =
    controlWidth > 0
      ? (controlWidth - SEGMENTED_CONTROL_PADDING * 2) / periods.length
      : 0;

  useEffect(() => {
    Animated.spring(animatedIndex, {
      toValue: effectiveSelectedIndex,
      damping: 22,
      mass: 0.75,
      stiffness: 260,
      useNativeDriver: false,
    }).start();
  }, [animatedIndex, effectiveSelectedIndex]);

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

      <View
        onLayout={(event) => {
          const nextWidth = event.nativeEvent.layout.width;

          setControlWidth((currentWidth) =>
            currentWidth === nextWidth ? currentWidth : nextWidth,
          );
        }}
        style={styles.segmentedControl}
      >
        {segmentWidth > 0 ? (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.activeSegment,
              {
                width: segmentWidth,
                transform: [
                  {
                    translateX: Animated.multiply(animatedIndex, segmentWidth),
                  },
                ],
              },
            ]}
          />
        ) : null}

        {periods.map((period) => {
          const isSelected = selectedPeriod === period;

          return (
            <Pressable
              key={period}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              onPress={() => handlePeriodPress(period)}
              style={styles.segment}
            >
              <Text
                ellipsizeMode="tail"
                numberOfLines={1}
                style={[
                  styles.segmentText,
                  isSelected ? styles.segmentTextSelected : null,
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
  segmentedControl: {
    flexDirection: 'row',
    borderRadius: 999,
    backgroundColor: '#e9e9e4',
    padding: SEGMENTED_CONTROL_PADDING,
  },
  activeSegment: {
    position: 'absolute',
    top: SEGMENTED_CONTROL_PADDING,
    bottom: SEGMENTED_CONTROL_PADDING,
    left: SEGMENTED_CONTROL_PADDING,
    borderRadius: 999,
    backgroundColor: '#ffffff',
  },
  segment: {
    zIndex: 1,
    flex: 1,
    minHeight: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 7,
  },
  segmentText: {
    width: '100%',
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '700',
    textAlign: 'center',
    color: '#111111',
  },
  segmentTextSelected: {
    color: '#111111',
  },
});
