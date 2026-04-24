import AsyncStorage from '@react-native-async-storage/async-storage';

const ONBOARDING_COMPLETED_STORAGE_KEY = 'money-leak:onboarding-completed';

export async function getHasCompletedOnboarding(): Promise<boolean> {
  const value = await AsyncStorage.getItem(ONBOARDING_COMPLETED_STORAGE_KEY);

  return value === 'true';
}

export async function setHasCompletedOnboarding(): Promise<void> {
  await AsyncStorage.setItem(ONBOARDING_COMPLETED_STORAGE_KEY, 'true');
}
