import '@/lib/reminder-notifications';

import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { Stack } from 'expo-router';
import { useEffect } from 'react';

import { initDatabase } from '@/db/transactions';
import { useAuthStore } from '@/store/auth-store';

export default function RootLayout() {
  const initializeAuth = useAuthStore((state) => state.initializeAuth);

  const [areFontsLoaded, fontLoadError] = useFonts({
    NewYork: require('../assets/fonts/NewYork.ttf'),
  });

  useEffect(() => {
    void initializeAuth();
  }, [initializeAuth]);

  useEffect(() => {
    void initDatabase().catch((error) => {
      console.error('Failed to initialize SQLite database', error);
    });
  }, []);

  useEffect(() => {
    if (!fontLoadError) return;

    console.error('Failed to load New York font', fontLoadError);
  }, [fontLoadError]);

  if (!areFontsLoaded && !fontLoadError) return null;

  return (
    <>
      <StatusBar style="dark" />
      <Stack>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />

        <Stack.Screen
          name="add-transaction"
          options={{
            title: 'Add Transaction',
            headerBackButtonDisplayMode: 'generic',
            headerBackTitle: 'Back',
          }}
        />

        <Stack.Screen
          name="categories"
          options={{
            title: 'Manage Categories',
            headerBackButtonDisplayMode: 'generic',
            headerBackTitle: 'Back',
          }}
        />

        <Stack.Screen
          name="shame-card"
          options={{
            title: 'Shame Card',
            headerBackButtonDisplayMode: 'generic',
            headerBackTitle: 'Back',
          }}
        />

        <Stack.Screen
          name="transaction/[id]/edit"
          options={{ title: 'Edit Transaction' }}
        />
      </Stack>
    </>
  );
}
