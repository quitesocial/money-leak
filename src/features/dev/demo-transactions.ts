import type {
  LeakReason,
  Transaction,
  TransactionCategory,
} from '@/types/transaction';

type DemoTransactionConfig = {
  slot: string;
  dayOffset: number;
  hour: number;
  minute?: number;
  amount: number;
  category: TransactionCategory;
  isLeak: boolean;
  leakReason?: LeakReason;
  note?: string | null;
};

function getReferenceDate() {
  const referenceDate = new Date(Date.now());

  if (Number.isFinite(referenceDate.getTime())) return referenceDate;

  return new Date();
}

function getStartOfDay(referenceDate: Date) {
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

function addDays({
  referenceDate,
  days,
}: {
  referenceDate: Date;
  days: number;
}) {
  const nextDate = new Date(referenceDate);

  nextDate.setDate(nextDate.getDate() + days);
  nextDate.setHours(0, 0, 0, 0);

  return nextDate;
}

function formatDateStamp(referenceDate: Date) {
  const year = referenceDate.getFullYear();
  const month = String(referenceDate.getMonth() + 1).padStart(2, '0');
  const day = String(referenceDate.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function createDemoId({ date, slot }: { date: Date; slot: string }) {
  return `demo-${formatDateStamp(date)}-${slot}`;
}

function createLocalTimestamp({
  date,
  hour,
  minute = 0,
}: {
  date: Date;
  hour: number;
  minute?: number;
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

function createTransaction({
  config,
  referenceDate,
}: {
  config: DemoTransactionConfig;
  referenceDate: Date;
}): Transaction {
  const transactionDate = addDays({
    referenceDate,
    days: config.dayOffset,
  });

  return {
    id: createDemoId({
      date: transactionDate,
      slot: config.slot,
    }),
    amount: config.amount,
    category: config.category,
    isLeak: config.isLeak,
    leakReason: config.isLeak ? (config.leakReason ?? null) : null,
    note: config.note ?? null,
    createdAt: createLocalTimestamp({
      date: transactionDate,
      hour: config.hour,
      minute: config.minute,
    }),
  };
}

export function createDemoTransactions(): Transaction[] {
  const today = getStartOfDay(getReferenceDate());

  // Keep the default This month views populated while the all-data cards
  // still have enough history to render a streak and a meaningful leak risk.
  const configs: DemoTransactionConfig[] = [
    {
      slot: 'today-breakfast',
      dayOffset: 0,
      hour: 8,
      minute: 10,
      amount: 4.8,
      category: 'food',
      isLeak: false,
      note: 'Breakfast coffee',
    },
    {
      slot: 'today-impulse',
      dayOffset: 0,
      hour: 19,
      minute: 20,
      amount: 28.5,
      category: 'shopping',
      isLeak: true,
      leakReason: 'impulse',
      note: 'Late-night scroll buy',
    },
    {
      slot: 'yesterday-commute',
      dayOffset: -1,
      hour: 9,
      minute: 5,
      amount: 12.4,
      category: 'transport',
      isLeak: false,
      note: 'Ride to the office',
    },
    {
      slot: 'two-days-ago-social',
      dayOffset: -2,
      hour: 21,
      minute: 15,
      amount: 24,
      category: 'alcohol',
      isLeak: true,
      leakReason: 'social',
      note: 'One more round',
    },
    {
      slot: 'same-weekday-stress',
      dayOffset: -7,
      hour: 16,
      minute: 40,
      amount: 11.2,
      category: 'food',
      isLeak: true,
      leakReason: 'stress',
      note: 'Stress snack stop',
    },
    {
      slot: 'same-weekday-habit',
      dayOffset: -14,
      hour: 17,
      minute: 30,
      amount: 9.99,
      category: 'subscriptions',
      isLeak: true,
      leakReason: 'habit',
      note: 'Forgotten trial',
    },
    {
      slot: 'three-days-ago-errand',
      dayOffset: -3,
      hour: 13,
      minute: 0,
      amount: 18.75,
      category: 'other',
      isLeak: false,
      note: 'Household refill',
    },
  ];

  return configs
    .map((config) =>
      createTransaction({
        config,
        referenceDate: today,
      }),
    )
    .sort((firstTransaction, secondTransaction) => {
      return secondTransaction.createdAt - firstTransaction.createdAt;
    });
}
