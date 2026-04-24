import { calculateAlternativeReality } from '@/features/alternative-reality/calculate-alternative-reality';
import type { AnalyticsResult } from '@/features/analytics/calculate-analytics';
import {
  formatEuro,
  formatHour,
  formatLabel,
  formatPercentage,
  sanitizeNumber,
} from '@/lib/display-formatters';

export type ShameCardTone = 'soft' | 'harsh' | 'unfiltered';

export type ShameCardContent = {
  title: string;
  totalLeaksLine: string;
  topCategoryLine: string | null;
  peakTimeLine: string | null;
  alternativeRealityLine: string | null;
  verdict: string;
};

const toneCopy: Record<
  ShameCardTone,
  Pick<ShameCardContent, 'title' | 'verdict'>
> = {
  soft: {
    title: 'Money Leak Check',
    verdict: 'Not terrible. But there is still money quietly disappearing.',
  },
  harsh: {
    title: 'Your Leak Report',
    verdict: "You're not poor. You're just very consistent at wasting money.",
  },
  unfiltered: {
    title: 'Financial Damage Report',
    verdict: 'This is not budgeting. This is evidence.',
  },
};

function formatLeakCount(value: number) {
  const count = Math.max(0, Math.trunc(sanitizeNumber(value)));

  return `${count} leak${count === 1 ? '' : 's'}`;
}

function generateTopCategoryLine(analytics: AnalyticsResult) {
  if (!analytics.topLeakCategory) return null;

  return `Top leak category: ${formatLabel(
    analytics.topLeakCategory.category,
  )} (${formatEuro(
    analytics.topLeakCategory.totalLeaks,
  )} across ${formatLeakCount(analytics.topLeakCategory.count)})`;
}

function generatePeakTimeLine(analytics: AnalyticsResult) {
  if (!analytics.peakLeakHour) return null;

  const peakHour = formatHour(analytics.peakLeakHour.hour);

  if (!peakHour) return null;

  return `Peak leak time: ${peakHour} (${formatLeakCount(
    analytics.peakLeakHour.count,
  )})`;
}

export function generateShameCardContent(
  analytics: AnalyticsResult,
  tone: ShameCardTone,
): ShameCardContent {
  const copy = toneCopy[tone];
  const alternativeReality = calculateAlternativeReality(analytics.totalLeaks);
  const primaryAlternative = alternativeReality.primaryItem;

  return {
    title: copy.title,
    totalLeaksLine: `Total leaks: ${formatEuro(
      analytics.totalLeaks,
    )} (${formatPercentage(analytics.leakPercentage)} of spending)`,
    topCategoryLine: generateTopCategoryLine(analytics),
    peakTimeLine: generatePeakTimeLine(analytics),
    alternativeRealityLine: primaryAlternative
      ? `Alternative reality: that was ${primaryAlternative.count} ${primaryAlternative.label}.`
      : null,
    verdict: copy.verdict,
  };
}
