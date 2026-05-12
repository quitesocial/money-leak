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

type LocalDatePickerProps = {
  visible: boolean;
  value: Date;
  onCancel: () => void;
  onConfirm: (date: Date) => void;
};

export function LocalDatePicker({
  visible,
  value,
  onCancel,
  onConfirm,
}: LocalDatePickerProps) {
  const [draftDate, setDraftDate] = useState(value);

  useEffect(() => {
    if (!visible) return;

    setDraftDate(value);
  }, [value, visible]);

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

  if (!visible) return null;

  if (Platform.OS === 'android') {
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
          <Text style={styles.title}>Choose date</Text>

          <DateTimePicker
            value={draftDate}
            mode="date"
            display="inline"
            onChange={handleChange}
          />

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
              onPress={() => onConfirm(draftDate)}
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
