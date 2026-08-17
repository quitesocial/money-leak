import type { BalanceEntryInput } from '@/types/balance';
import type { TransactionInput } from '@/types/transaction';

export type AppStoreScreenshotFixture = {
  transactions: TransactionInput[];
  balanceEntries: BalanceEntryInput[];
};

function getStartOfLocalDay(referenceDate: Date) {
  return new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate(),
    0,
    0,
    0,
    0,
  );
}

function createLocalTimestamp({
  date,
  hour,
  minute,
}: {
  date: Date;
  hour: number;
  minute: number;
}) {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    hour,
    minute,
    0,
    0,
  ).getTime();
}

function formatDateStamp(referenceDate: Date) {
  const year = referenceDate.getFullYear();
  const month = String(referenceDate.getMonth() + 1).padStart(2, '0');
  const day = String(referenceDate.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

export function createAppStoreScreenshotFixture({
  referenceDate = new Date(),
}: {
  referenceDate?: Date;
} = {}): AppStoreScreenshotFixture {
  const today = getStartOfLocalDay(referenceDate);
  const dateStamp = formatDateStamp(today);

  return {
    transactions: [
      {
        id: `app-store-${dateStamp}-shopping-leak`,
        amount: 10,
        category: 'shopping',
        isLeak: true,
        leakReason: 'impulse',
        note: null,
        createdAt: createLocalTimestamp({
          date: today,
          hour: 15,
          minute: 45,
        }),
      },
      {
        id: `app-store-${dateStamp}-food-normal`,
        amount: 4.56,
        category: 'food',
        isLeak: false,
        leakReason: null,
        note: null,
        createdAt: createLocalTimestamp({
          date: today,
          hour: 12,
          minute: 33,
        }),
      },
    ],
    balanceEntries: [
      {
        id: `app-store-${dateStamp}-salary`,
        amount: 1249.12,
        typeId: 'salary',
        createdAt: createLocalTimestamp({
          date: today,
          hour: 14,
          minute: 45,
        }),
      },
    ],
  };
}
