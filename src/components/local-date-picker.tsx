import { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

type LocalDatePickerProps = {
  visible: boolean;
  value: Date;
  onCancel: () => void;
  onConfirm: (date: Date) => void;
};

function formatDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function parseDateInputValue(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());

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
  visible,
  value,
  onCancel,
  onConfirm,
}: LocalDatePickerProps) {
  const [dateText, setDateText] = useState(formatDateInputValue(value));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;

    setDateText(formatDateInputValue(value));
    setError(null);
  }, [value, visible]);

  function handleConfirm() {
    const selectedDate = parseDateInputValue(dateText);

    if (!selectedDate) {
      setError('Enter a date as YYYY-MM-DD.');

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
          <Text style={styles.title}>Choose date</Text>

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
  inputError: {
    borderColor: '#dc2626',
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
