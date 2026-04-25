import type { Transaction } from '@/types/transaction';

export type LoggingStreakSummary = {
  currentStreakDays: number;
  hasLoggedToday: boolean;
  lastLoggedAt: number | null;
};

function getValidDate(value: number) {
  if (!Number.isFinite(value)) return null;

  const date = new Date(value);

  if (!Number.isFinite(date.getTime())) return null;

  return date;
}

function getReferenceDate(now?: Date) {
  if (now && Number.isFinite(now.getTime())) {
    return new Date(now.getTime());
  }

  return new Date();
}

function getStartOfDay(referenceDate: Date) {
  const startOfDay = new Date(referenceDate);

  startOfDay.setHours(0, 0, 0, 0);

  return startOfDay;
}

function addDays(referenceDate: Date, days: number) {
  const nextDate = new Date(referenceDate);

  nextDate.setDate(nextDate.getDate() + days);
  nextDate.setHours(0, 0, 0, 0);

  return nextDate;
}

export function calculateLoggingStreak(
  transactions: Transaction[],
  now?: Date,
): LoggingStreakSummary {
  let lastLoggedAt: number | null = null;
  
  const loggedDays = new Set<number>();

  for (const transaction of transactions) {
    const transactionDate = getValidDate(transaction.createdAt);

    if (!transactionDate) continue;

    const transactionTime = transactionDate.getTime();

    if (lastLoggedAt === null || transactionTime > lastLoggedAt) {
      lastLoggedAt = transactionTime;
    }

    loggedDays.add(getStartOfDay(transactionDate).getTime());
  }

  const referenceDate = getReferenceDate(now);
  const startOfToday = getStartOfDay(referenceDate);
  const hasLoggedToday = loggedDays.has(startOfToday.getTime());

  let streakAnchor: Date | null = null;

  if (hasLoggedToday) {
    streakAnchor = startOfToday;
  } else {
    const startOfYesterday = addDays(startOfToday, -1);

    if (loggedDays.has(startOfYesterday.getTime())) {
      streakAnchor = startOfYesterday;
    }
  }

  if (!streakAnchor) {
    return {
      currentStreakDays: 0,
      hasLoggedToday: false,
      lastLoggedAt,
    };
  }

  let currentStreakDays = 0;
  let currentDay = streakAnchor;

  while (loggedDays.has(currentDay.getTime())) {
    currentStreakDays += 1;
    currentDay = addDays(currentDay, -1);
  }

  return {
    currentStreakDays,
    hasLoggedToday,
    lastLoggedAt,
  };
}
