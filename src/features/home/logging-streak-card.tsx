import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { calculateLoggingStreak } from '@/features/home/calculate-logging-streak';
import type { Transaction } from '@/types/transaction';

type LoggingStreakCardProps = {
  transactions: Transaction[];
};

function getCardCopy(hasLoggedToday: boolean, currentStreakDays: number) {
  if (hasLoggedToday && currentStreakDays > 0) {
    return {
      title: `${currentStreakDays}-day streak`,
      body: 'You logged expenses today. Keep the chain alive.',
    };
  }

  if (currentStreakDays > 0) {
    return {
      title: `${currentStreakDays}-day streak at risk`,
      body: 'Log one expense today to keep it alive.',
    };
  }

  return {
    title: 'Start your streak',
    body: 'Log your first expense today.',
  };
}

export function LoggingStreakCard({ transactions }: LoggingStreakCardProps) {
  const summary = calculateLoggingStreak(transactions);

  const { title, body } = getCardCopy(
    summary.hasLoggedToday,
    summary.currentStreakDays,
  );

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>

      {!summary.hasLoggedToday ? (
        <Link href="/(tabs)/add-transaction" asChild>
          <Pressable style={styles.actionButton}>
            <Text style={styles.actionButtonText}>Log expense</Text>
          </Pressable>
        </Link>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: '#dbeafe',
    borderRadius: 16,
    backgroundColor: '#f8fbff',
    padding: 16,
    gap: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    color: '#4b5563',
  },
  actionButton: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: '#111827',
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  actionButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
  },
});
