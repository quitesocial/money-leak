import '@/lib/reminder-notifications';

import { StatusBar } from 'expo-status-bar';
import { Stack } from 'expo-router';
import { useEffect } from 'react';

import { initDatabase } from '@/db/transactions';

export default function RootLayout() {
  useEffect(() => {
    void initDatabase().catch((error) => {
      console.error('Failed to initialize SQLite database', error);
    });
  }, []);

  return (
    <>
      <StatusBar style="dark" />
      <Stack>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />

        <Stack.Screen
          name="transaction/[id]/edit"
          options={{ title: 'Edit Transaction' }}
        />
      </Stack>
    </>
  );
}
