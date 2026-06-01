import { useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AddBalanceScreen } from '@/features/add-balance/add-balance-screen';
import { useBalanceStore } from '@/store/balance-store';
import type { BalanceEntryInput } from '@/types/balance';

type StateScreenProps = {
  actionLabel: string;
  message: string;
  onActionPress: () => void;
  title: string;
};

function getBalanceEntryId(value: string | string[] | undefined) {
  if (typeof value !== 'string') return null;

  const trimmedValue = value.trim();

  return trimmedValue ? trimmedValue : null;
}

function StateScreen({
  actionLabel,
  message,
  onActionPress,
  title,
}: StateScreenProps) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.stateContent}>
        <View style={styles.centeredState}>
          <Text style={styles.stateTitle}>{title}</Text>
          <Text style={styles.stateMessage}>{message}</Text>

          <Pressable onPress={onActionPress} style={styles.primaryAction}>
            <Text style={styles.primaryActionText}>{actionLabel}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

export function EditBalanceScreen() {
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  const balanceEntryId = getBalanceEntryId(id);
  const router = useRouter();

  const balanceEntries = useBalanceStore((state) => state.balanceEntries);
  const isInitialized = useBalanceStore((state) => state.isInitialized);
  const loadBalance = useBalanceStore((state) => state.loadBalance);
  const updateBalanceEntry = useBalanceStore(
    (state) => state.updateBalanceEntry,
  );

  useEffect(() => {
    if (!balanceEntryId || isInitialized) return;

    void loadBalance();
  }, [balanceEntryId, isInitialized, loadBalance]);

  const balanceEntry = balanceEntryId
    ? balanceEntries.find((entry) => entry.id === balanceEntryId)
    : null;

  async function handleSubmit(entry: BalanceEntryInput) {
    await updateBalanceEntry(entry);
  }

  if (!balanceEntryId) {
    return (
      <StateScreen
        actionLabel="Go Home"
        message="This balance link is invalid or the addition no longer exists."
        onActionPress={() => router.replace('/(tabs)')}
        title="Balance addition not found"
      />
    );
  }

  if (!isInitialized) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centeredState}>
          <Text style={styles.stateTitle}>Loading balance addition</Text>

          <Text style={styles.stateMessage}>
            Pulling the latest saved details before you edit.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!balanceEntry) {
    return (
      <StateScreen
        actionLabel="Go Home"
        message="This balance addition may have been deleted, or the link points to an entry that does not exist."
        onActionPress={() => router.replace('/(tabs)')}
        title="Balance addition not found"
      />
    );
  }

  return (
    <AddBalanceScreen
      initialEntry={balanceEntry}
      onSubmit={handleSubmit}
      submitLabel="Save Changes"
      title="Edit Balance"
    />
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f7f7f5',
  },
  stateContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  centeredState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  stateTitle: {
    color: '#111827',
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
  },
  stateMessage: {
    color: '#4b5563',
    fontSize: 16,
    lineHeight: 22,
    textAlign: 'center',
  },
  primaryAction: {
    borderRadius: 999,
    backgroundColor: '#111827',
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  primaryActionText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
});
