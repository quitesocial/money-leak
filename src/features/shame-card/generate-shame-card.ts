import type { AnalyticsResult } from '@/features/analytics/calculate-analytics';

export type ShameCardTone = 'soft' | 'harsh' | 'unfiltered';

export type ShameCardContent = {
  title: string;
  totalLeaksLine: string;
  topCategoryLine: string | null;
  peakTimeLine: string | null;
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

function sanitizeNumber(value: number) {
  return Number.isFinite(value) ? value : 0;
}

function formatCurrency(value: number) {
  return `${sanitizeNumber(value).toFixed(2)}€`;
}

function formatPercentage(value: number) {
  return `${Math.round(sanitizeNumber(value))}%`;
}

function formatHour(hour: number) {
  const safeHour = sanitizeNumber(hour);

  if (safeHour < 0 || safeHour > 23) return null;

  return `${Math.trunc(safeHour).toString().padStart(2, '0')}:00`;
}

function formatLabel(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatLeakCount(value: number) {
  const count = Math.max(0, Math.trunc(sanitizeNumber(value)));

  return `${count} leak${count === 1 ? '' : 's'}`;
}

function generateTopCategoryLine(analytics: AnalyticsResult) {
  if (!analytics.topLeakCategory) return null;

  return `Top leak category: ${formatLabel(
    analytics.topLeakCategory.category,
  )} (${formatCurrency(
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

  return {
    title: copy.title,
    totalLeaksLine: `Total leaks: ${formatCurrency(
      analytics.totalLeaks,
    )} (${formatPercentage(analytics.leakPercentage)} of spending)`,
    topCategoryLine: generateTopCategoryLine(analytics),
    peakTimeLine: generatePeakTimeLine(analytics),
    verdict: copy.verdict,
  };
}
