import { calculateAnalytics } from '@/features/analytics/calculate-analytics';
import type { Transaction } from '@/types/transaction';

const HIGH_LEAK_PERCENTAGE_SUGGESTION =
  'For the next 24 hours, delay every non-essential purchase by 10 minutes.';

const ALCOHOL_SUGGESTION =
  'Before buying alcohol, log the expected amount first. If it still feels worth it after 10 minutes, decide consciously.';

const FRIDAY_SUGGESTION =
  'Plan Friday spending before the evening starts. Your pattern breaks before the first purchase, not after.';

const EVENING_SUGGESTION =
  'Set a simple evening rule: no impulse purchases after 20:00 without a 10-minute pause.';

const BOREDOM_SUGGESTION =
  'When boredom hits, do one free action first: walk, shower, game, message someone, or make tea.';

const FALLBACK_SUGGESTION =
  'Pick one repeat leak and block it once this week. Do not fix everything at once.';

export function generateActionSuggestion(
  transactions: Transaction[],
): string | null {
  const analytics = calculateAnalytics(transactions);
  const peakLeakHour = analytics.peakLeakHour?.hour;

  if (analytics.totalLeaks <= 0) return null;

  if (analytics.leakPercentage > 40) return HIGH_LEAK_PERCENTAGE_SUGGESTION;

  if (analytics.topLeakCategory?.category === 'alcohol') {
    return ALCOHOL_SUGGESTION;
  }

  if (analytics.peakLeakWeekday?.weekday === 'Friday') return FRIDAY_SUGGESTION;

  if (peakLeakHour !== undefined && peakLeakHour >= 20) {
    return EVENING_SUGGESTION;
  }

  if (analytics.topLeakReason?.leakReason === 'boredom') {
    return BOREDOM_SUGGESTION;
  }

  return FALLBACK_SUGGESTION;
}
