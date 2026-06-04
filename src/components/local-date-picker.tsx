import { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

export type LocalDatePickerMode = 'date' | 'month' | 'range' | 'year';

type LocalDatePickerProps = {
  mode?: LocalDatePickerMode;
  rangeEnd?: Date;
  visible: boolean;
  value: Date;
  onCancel: () => void;
  onConfirm: (date: Date) => void;
  onConfirmRange?: (startDate: Date, endDate: Date) => void;
};

function formatDateInputValue(date: Date, mode: LocalDatePickerMode) {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');

  if (mode === 'year') return year.toString();
  if (mode === 'month') return `${year}-${month}`;
  if (mode === 'range') return `${year}-${month}-${day}`;

  return `${year}-${month}-${day}`;
}

function getInputPlaceholder(mode: LocalDatePickerMode) {
  if (mode === 'year') return 'YYYY';
  if (mode === 'month') return 'YYYY-MM';

  return 'YYYY-MM-DD';
}

function getPickerTitle(mode: LocalDatePickerMode) {
  if (mode === 'year') return 'Choose year';
  if (mode === 'month') return 'Choose month';
  if (mode === 'range') return 'Choose dates';

  return 'Choose date';
}

function parseDateInputValue(value: string, mode: LocalDatePickerMode) {
  const normalizedValue = value.trim();

  if (mode === 'year') {
    const match = /^(\d{4})$/.exec(normalizedValue);

    if (!match) return null;

    const year = Number(match[1]);
    const date = new Date(year, 0, 1);

    return date.getFullYear() === year ? date : null;
  }

  if (mode === 'month') {
    const match = /^(\d{4})-(\d{2})$/.exec(normalizedValue);

    if (!match) return null;

    const year = Number(match[1]);
    const month = Number(match[2]);
    const date = new Date(year, month - 1, 1);

    if (date.getFullYear() !== year || date.getMonth() !== month - 1) {
      return null;
    }

    return date;
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(normalizedValue);

  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
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
  const [dateText, setDateText] = useState(formatDateInputValue(value, mode));
  const [rangeEndText, setRangeEndText] = useState(
    formatDateInputValue(rangeEnd ?? value, 'date'),
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;

    setDateText(formatDateInputValue(value, mode));
    setRangeEndText(formatDateInputValue(rangeEnd ?? value, 'date'));
    setError(null);
  }, [mode, rangeEnd, value, visible]);

  function handleConfirm() {
    if (mode === 'range') {
      const startDate = parseDateInputValue(dateText, 'date');
      const endDate = parseDateInputValue(rangeEndText, 'date');

      if (!startDate || !endDate) {
        setError('Enter dates as YYYY-MM-DD.');

        return;
      }

      const normalizedStart =
        startDate.getTime() <= endDate.getTime() ? startDate : endDate;
      const normalizedEnd =
        startDate.getTime() <= endDate.getTime() ? endDate : startDate;

      if (onConfirmRange) {
        onConfirmRange(normalizedStart, normalizedEnd);
      } else {
        onConfirm(normalizedStart);
      }

      return;
    }

    const selectedDate = parseDateInputValue(dateText, mode);

    if (!selectedDate) {
      setError(`Enter a date as ${getInputPlaceholder(mode)}.`);

      return;
    }

    onConfirm(selectedDate);
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

          {mode === 'range' ? (
            <View style={styles.rangeInputs}>
              <View style={styles.rangeInputGroup}>
                <Text style={styles.inputLabel}>From</Text>

                <TextInput
                  value={dateText}
                  onChangeText={(nextValue) => {
                    setDateText(nextValue);

                    if (error) {
                      setError(null);
                    }
                  }}
                  placeholder="YYYY-MM-DD"
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={[styles.input, error ? styles.inputError : null]}
                />
              </View>

              <View style={styles.rangeInputGroup}>
                <Text style={styles.inputLabel}>To</Text>

                <TextInput
                  value={rangeEndText}
                  onChangeText={(nextValue) => {
                    setRangeEndText(nextValue);

                    if (error) {
                      setError(null);
                    }
                  }}
                  placeholder="YYYY-MM-DD"
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={[styles.input, error ? styles.inputError : null]}
                />
              </View>
            </View>
          ) : (
            <TextInput
              value={dateText}
              onChangeText={(nextValue) => {
                setDateText(nextValue);

                if (error) {
                  setError(null);
                }
              }}
              placeholder={getInputPlaceholder(mode)}
              autoCapitalize="none"
              autoCorrect={false}
              style={[styles.input, error ? styles.inputError : null]}
            />
          )}

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

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
    maxWidth: 360,
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
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#111827',
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
    color: '#374151',
  },
  inputError: {
    borderColor: '#dc2626',
  },
  rangeInputs: {
    gap: 12,
  },
  rangeInputGroup: {
    gap: 6,
  },
  errorText: {
    fontSize: 13,
    lineHeight: 18,
    color: '#dc2626',
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
