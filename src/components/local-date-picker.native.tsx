import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { useEffect, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

export type LocalDatePickerMode = 'date' | 'month' | 'range' | 'year';

const MONTH_LABELS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

const WEEKDAY_LABELS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
const monthYearFormatter = new Intl.DateTimeFormat('en', {
  month: 'long',
  year: 'numeric',
});
const shortDateFormatter = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

type LocalDatePickerProps = {
  mode?: LocalDatePickerMode;
  rangeEnd?: Date;
  visible: boolean;
  value: Date;
  onCancel: () => void;
  onConfirm: (date: Date) => void;
  onConfirmRange?: (startDate: Date, endDate: Date) => void;
};

type RangeEdge = 'end' | 'start';

function getPickerTitle(mode: LocalDatePickerMode) {
  if (mode === 'month') return 'Choose month';
  if (mode === 'year') return 'Choose year';
  if (mode === 'range') return 'Choose dates';

  return 'Choose date';
}

function getStartOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function getStartOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, months: number) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

function isSameLocalDay(firstDate: Date, secondDate: Date) {
  return (
    firstDate.getFullYear() === secondDate.getFullYear() &&
    firstDate.getMonth() === secondDate.getMonth() &&
    firstDate.getDate() === secondDate.getDate()
  );
}

function isWithinLocalRange(date: Date, startDate: Date, endDate: Date) {
  const time = getStartOfDay(date).getTime();
  const start = getStartOfDay(startDate).getTime();
  const end = getStartOfDay(endDate).getTime();

  return time >= start && time <= end;
}

function normalizeRange(startDate: Date, endDate: Date) {
  const start = getStartOfDay(startDate);
  const end = getStartOfDay(endDate);

  return start.getTime() <= end.getTime()
    ? { end, start }
    : { end: start, start: end };
}

function getCalendarWeeks(monthDate: Date) {
  const firstDayOfMonth = getStartOfMonth(monthDate);
  const firstWeekdayIndex = (firstDayOfMonth.getDay() + 6) % 7;
  const daysInMonth = new Date(
    monthDate.getFullYear(),
    monthDate.getMonth() + 1,
    0,
  ).getDate();
  const cells: (Date | null)[] = [];

  for (let index = 0; index < firstWeekdayIndex; index += 1) {
    cells.push(null);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(new Date(monthDate.getFullYear(), monthDate.getMonth(), day));
  }

  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  const weeks: (Date | null)[][] = [];

  for (let index = 0; index < cells.length; index += 7) {
    weeks.push(cells.slice(index, index + 7));
  }

  return weeks;
}

function normalizeConfirmDate(date: Date, mode: LocalDatePickerMode) {
  if (mode === 'year') return new Date(date.getFullYear(), 0, 1);
  if (mode === 'month') return new Date(date.getFullYear(), date.getMonth(), 1);

  return date;
}

function getYearGrid(selectedYear: number) {
  const startYear = selectedYear - 5;

  return Array.from({ length: 12 }, (_, index) => startYear + index);
}

export function LocalDatePicker({
  mode = 'date',
  rangeEnd,
  visible,
  value,
  onCancel,
  onConfirm,
  onConfirmRange,
}: LocalDatePickerProps) {
  const [draftDate, setDraftDate] = useState(value);
  const [draftRangeStart, setDraftRangeStart] = useState(getStartOfDay(value));
  const [draftRangeEnd, setDraftRangeEnd] = useState(
    getStartOfDay(rangeEnd ?? value),
  );
  const [activeRangeEdge, setActiveRangeEdge] = useState<RangeEdge>('start');
  const [visibleMonth, setVisibleMonth] = useState(getStartOfMonth(value));

  useEffect(() => {
    if (!visible) return;

    setDraftDate(value);
    setDraftRangeStart(getStartOfDay(value));
    setDraftRangeEnd(getStartOfDay(rangeEnd ?? value));
    setActiveRangeEdge('start');
    setVisibleMonth(getStartOfMonth(value));
  }, [rangeEnd, value, visible]);

  function handleChange(
    event: DateTimePickerEvent,
    selectedDate?: Date | undefined,
  ) {
    if (Platform.OS === 'android') {
      if (event.type === 'set' && selectedDate) {
        onConfirm(selectedDate);
      } else if (event.type === 'dismissed') {
        onCancel();
      }

      return;
    }

    if (selectedDate) {
      setDraftDate(selectedDate);
    }
  }

  function handleConfirm() {
    if (mode === 'range') {
      const { end, start } = normalizeRange(draftRangeStart, draftRangeEnd);

      if (onConfirmRange) {
        onConfirmRange(start, end);
      } else {
        onConfirm(start);
      }

      return;
    }

    onConfirm(normalizeConfirmDate(draftDate, mode));
  }

  function handleRangeDayPress(date: Date) {
    const selectedDate = getStartOfDay(date);

    if (activeRangeEdge === 'start') {
      setDraftRangeStart(selectedDate);

      if (selectedDate.getTime() > draftRangeEnd.getTime()) {
        setDraftRangeEnd(selectedDate);
      }

      setActiveRangeEdge('end');

      return;
    }

    setDraftRangeEnd(selectedDate);

    if (selectedDate.getTime() < draftRangeStart.getTime()) {
      setDraftRangeStart(selectedDate);
    }

    setActiveRangeEdge('start');
  }

  function handleMonthPress(monthIndex: number) {
    setDraftDate(new Date(draftDate.getFullYear(), monthIndex, 1));
  }

  function handleYearPress(year: number) {
    setDraftDate(
      new Date(year, mode === 'month' ? draftDate.getMonth() : 0, 1),
    );
  }

  function handleYearStep(delta: number) {
    setDraftDate(
      new Date(
        draftDate.getFullYear() + delta,
        mode === 'month' ? draftDate.getMonth() : 0,
        1,
      ),
    );
  }

  if (!visible) return null;

  if (Platform.OS === 'android' && mode === 'date') {
    return (
      <DateTimePicker
        value={value}
        mode="date"
        display="default"
        onChange={handleChange}
      />
    );
  }

  return (
    <Modal
      animationType="fade"
      transparent
      visible={visible}
      onRequestClose={onCancel}
    >
      <View style={styles.overlay}>
        <View style={styles.dialog}>
          <Text style={styles.title}>{getPickerTitle(mode)}</Text>

          {mode === 'date' ? (
            <DateTimePicker
              value={draftDate}
              mode="date"
              display="inline"
              onChange={handleChange}
            />
          ) : mode === 'range' ? (
            <View style={styles.rangeSelector}>
              <View style={styles.rangeFields}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: activeRangeEdge === 'start' }}
                  onPress={() => setActiveRangeEdge('start')}
                  style={[
                    styles.rangeField,
                    activeRangeEdge === 'start'
                      ? styles.rangeFieldActive
                      : null,
                  ]}
                >
                  <Text style={styles.rangeFieldLabel}>From</Text>
                  <Text style={styles.rangeFieldValue}>
                    {shortDateFormatter.format(draftRangeStart)}
                  </Text>
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: activeRangeEdge === 'end' }}
                  onPress={() => setActiveRangeEdge('end')}
                  style={[
                    styles.rangeField,
                    activeRangeEdge === 'end' ? styles.rangeFieldActive : null,
                  ]}
                >
                  <Text style={styles.rangeFieldLabel}>To</Text>
                  <Text style={styles.rangeFieldValue}>
                    {shortDateFormatter.format(draftRangeEnd)}
                  </Text>
                </Pressable>
              </View>

              <View style={styles.selectorHeader}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setVisibleMonth((date) => addMonths(date, -1))}
                  style={styles.selectorHeaderButton}
                >
                  <Text style={styles.selectorHeaderButtonText}>{'<'}</Text>
                </Pressable>

                <Text style={styles.selectorHeaderTitle}>
                  {monthYearFormatter.format(visibleMonth)}
                </Text>

                <Pressable
                  accessibilityRole="button"
                  onPress={() => setVisibleMonth((date) => addMonths(date, 1))}
                  style={styles.selectorHeaderButton}
                >
                  <Text style={styles.selectorHeaderButtonText}>{'>'}</Text>
                </Pressable>
              </View>

              <View style={styles.calendarWeekdays}>
                {WEEKDAY_LABELS.map((weekday) => (
                  <Text key={weekday} style={styles.calendarWeekday}>
                    {weekday}
                  </Text>
                ))}
              </View>

              <View style={styles.calendarGrid}>
                {getCalendarWeeks(visibleMonth).map((week, weekIndex) => (
                  <View key={`week-${weekIndex}`} style={styles.calendarWeek}>
                    {week.map((date, dayIndex) => {
                      if (!date) {
                        return (
                          <View
                            key={`empty-${weekIndex}-${dayIndex}`}
                            style={styles.calendarDay}
                          />
                        );
                      }

                      const { end, start } = normalizeRange(
                        draftRangeStart,
                        draftRangeEnd,
                      );
                      const isRangeStart = isSameLocalDay(date, start);
                      const isRangeEnd = isSameLocalDay(date, end);
                      const isRangeSelected = isRangeStart || isRangeEnd;
                      const isInRange =
                        !isRangeSelected &&
                        isWithinLocalRange(date, start, end);

                      return (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityState={{ selected: isRangeSelected }}
                          key={date.toISOString()}
                          onPress={() => handleRangeDayPress(date)}
                          style={[
                            styles.calendarDay,
                            isInRange ? styles.calendarDayInRange : null,
                            isRangeSelected ? styles.calendarDaySelected : null,
                          ]}
                        >
                          <Text
                            style={[
                              styles.calendarDayText,
                              isRangeSelected
                                ? styles.calendarDayTextSelected
                                : null,
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
          ) : (
            <View style={styles.selector}>
              <View style={styles.selectorHeader}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => handleYearStep(mode === 'month' ? -1 : -12)}
                  style={styles.selectorHeaderButton}
                >
                  <Text style={styles.selectorHeaderButtonText}>{'<'}</Text>
                </Pressable>

                <Text style={styles.selectorHeaderTitle}>
                  {mode === 'month'
                    ? draftDate.getFullYear()
                    : `${getYearGrid(draftDate.getFullYear())[0]} - ${
                        getYearGrid(draftDate.getFullYear())[11]
                      }`}
                </Text>

                <Pressable
                  accessibilityRole="button"
                  onPress={() => handleYearStep(mode === 'month' ? 1 : 12)}
                  style={styles.selectorHeaderButton}
                >
                  <Text style={styles.selectorHeaderButtonText}>{'>'}</Text>
                </Pressable>
              </View>

              <View style={styles.selectorGrid}>
                {(mode === 'month'
                  ? MONTH_LABELS.map((label, index) => ({
                      label,
                      value: index,
                    }))
                  : getYearGrid(draftDate.getFullYear()).map((year) => ({
                      label: year.toString(),
                      value: year,
                    }))
                ).map((option) => {
                  const isSelected =
                    mode === 'month'
                      ? option.value === draftDate.getMonth()
                      : option.value === draftDate.getFullYear();

                  return (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{ selected: isSelected }}
                      key={`${mode}-${option.value}`}
                      onPress={() => {
                        if (mode === 'month') {
                          handleMonthPress(option.value);
                        } else {
                          handleYearPress(option.value);
                        }
                      }}
                      style={[
                        styles.selectorOption,
                        isSelected ? styles.selectorOptionSelected : null,
                      ]}
                    >
                      <Text
                        style={[
                          styles.selectorOptionText,
                          isSelected ? styles.selectorOptionTextSelected : null,
                        ]}
                      >
                        {option.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}

          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              onPress={onCancel}
              style={[styles.actionButton, styles.secondaryButton]}
            >
              <Text style={styles.secondaryButtonText}>Cancel</Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              onPress={handleConfirm}
              style={[styles.actionButton, styles.primaryButton]}
            >
              <Text style={styles.primaryButtonText}>Done</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: 'rgba(17, 24, 39, 0.36)',
  },
  dialog: {
    width: '100%',
    maxWidth: 380,
    gap: 14,
    borderRadius: 8,
    backgroundColor: '#ffffff',
    padding: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  rangeSelector: {
    gap: 16,
  },
  rangeFields: {
    flexDirection: 'row',
    gap: 10,
  },
  rangeField: {
    flex: 1,
    gap: 4,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 14,
    backgroundColor: '#f9fafb',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  rangeFieldActive: {
    borderColor: '#0088ff',
    backgroundColor: '#edf7ff',
  },
  rangeFieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16,
    color: '#6b7280',
  },
  rangeFieldValue: {
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20,
    color: '#111827',
  },
  selector: {
    gap: 16,
  },
  selectorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  selectorHeaderButton: {
    minWidth: 42,
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 21,
    backgroundColor: '#f3f4f6',
  },
  selectorHeaderButtonText: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0088ff',
  },
  selectorHeaderTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 25,
    textAlign: 'center',
    color: '#111827',
  },
  selectorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  selectorOption: {
    width: '30%',
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 23,
    backgroundColor: '#f3f4f6',
  },
  selectorOptionSelected: {
    backgroundColor: '#0088ff',
  },
  selectorOptionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  selectorOptionTextSelected: {
    color: '#ffffff',
  },
  calendarWeekdays: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  calendarWeekday: {
    width: 42,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16,
    textAlign: 'center',
    color: '#8a8a8f',
  },
  calendarGrid: {
    gap: 6,
  },
  calendarWeek: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  calendarDay: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 21,
  },
  calendarDayInRange: {
    backgroundColor: '#e5f3ff',
  },
  calendarDaySelected: {
    backgroundColor: '#0088ff',
  },
  calendarDayText: {
    fontSize: 18,
    lineHeight: 24,
    color: '#111827',
  },
  calendarDayTextSelected: {
    fontWeight: '700',
    color: '#ffffff',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  actionButton: {
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  secondaryButton: {
    backgroundColor: '#f3f4f6',
  },
  primaryButton: {
    backgroundColor: '#111827',
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#374151',
  },
  primaryButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
});
