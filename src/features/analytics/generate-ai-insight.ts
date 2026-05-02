import { calculateAnalytics } from '@/features/analytics/calculate-analytics';
import type { Transaction } from '@/types/transaction';

const HIGH_LEAK_PERCENTAGE_INSIGHT =
  "You're not occasionally leaking money. This is your default behavior.";

const ALCOHOL_INSIGHT =
  "Alcohol is your main leak. This is not random — it's a pattern.";

const FRIDAY_INSIGHT =
  'Friday is your danger zone. You consistently lose control there.';

const EVENING_INSIGHT =
  'Your leaks happen in the evening. This is emotional, not practical spending.';

const BOREDOM_INSIGHT =
  "You're not spending because you need things. You're spending because you're bored.";

const FALLBACK_INSIGHT =
  'Your spending leaks are consistent. This is a habit, not a coincidence.';

export function generateAiInsight(transactions: Transaction[]): string | null {
  const analytics = calculateAnalytics(transactions);
  const peakLeakHour = analytics.peakLeakHour?.hour;

  if (analytics.totalLeaks <= 0) return null;

  if (analytics.leakPercentage > 40) return HIGH_LEAK_PERCENTAGE_INSIGHT;

  if (analytics.topLeakCategory?.category === 'alcohol') return ALCOHOL_INSIGHT;

  if (analytics.peakLeakWeekday?.weekday === 'Friday') return FRIDAY_INSIGHT;

  if (peakLeakHour !== undefined && peakLeakHour >= 20) return EVENING_INSIGHT;

  if (analytics.topLeakReason?.leakReason === 'boredom') return BOREDOM_INSIGHT;

  return FALLBACK_INSIGHT;
}
