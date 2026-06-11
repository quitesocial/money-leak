import { useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AddBalanceScreen } from '@/features/add-balance/add-balance-screen';
import { t } from '@/lib/i18n/i18n';
import { useSettingsLanguage } from '@/lib/use-settings-language';
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
  const language = useSettingsLanguage();

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
        actionLabel={t(language, 'common.goHome')}
        message={t(language, 'balance.invalidLink')}
        onActionPress={() => router.replace('/(tabs)')}
        title={t(language, 'balance.notFoundTitle')}
      />
    );
  }

  if (!isInitialized) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centeredState}>
          <Text style={styles.stateTitle}>
            {t(language, 'balance.loadingEditTitle')}
          </Text>

          <Text style={styles.stateMessage}>
            {t(language, 'balance.loadingEditMessage')}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!balanceEntry) {
    return (
      <StateScreen
        actionLabel={t(language, 'common.goHome')}
        message={t(language, 'balance.missingEditMessage')}
        onActionPress={() => router.replace('/(tabs)')}
        title={t(language, 'balance.notFoundTitle')}
      />
    );
  }

  return (
    <AddBalanceScreen
      initialEntry={balanceEntry}
      onSubmit={handleSubmit}
      submitLabel={t(language, 'balance.saveChanges')}
      title={t(language, 'balance.editTitle')}
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
