import AsyncStorage from '@react-native-async-storage/async-storage';

const REMINDER_ENABLED_STORAGE_KEY =
  'money-leak:daily-check-in-reminder-enabled';

export async function getReminderEnabled(): Promise<boolean> {
  const value = await AsyncStorage.getItem(REMINDER_ENABLED_STORAGE_KEY);

  return value === 'true';
}

export async function setReminderEnabled(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(REMINDER_ENABLED_STORAGE_KEY, String(enabled));
}
