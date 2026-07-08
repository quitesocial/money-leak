import { describe, expect, it } from '@jest/globals';

import {
  formatHomeHistoryDateLabel,
  groupHomeHistoryItems,
} from '@/features/home/home-history-sections';

function createLocalTimestamp({
  day,
  hour,
  month,
  year,
}: {
  day: number;
  hour: number;
  month: number;
  year: number;
}) {
  return new Date(year, month - 1, day, hour, 0, 0, 0).getTime();
}

describe('home history sections', () => {
  it('formats English date headers with long month labels', () => {
    const createdAt = createLocalTimestamp({
      year: 2026,
      month: 4,
      day: 23,
      hour: 15,
    });

    expect(formatHomeHistoryDateLabel(createdAt, 'English')).toBe(
      '23 April 2026',
    );
  });

  it('groups items by local calendar day and preserves input order', () => {
    const firstDayLate = createLocalTimestamp({
      year: 2026,
      month: 4,
      day: 23,
      hour: 20,
    });
    const firstDayEarly = createLocalTimestamp({
      year: 2026,
      month: 4,
      day: 23,
      hour: 8,
    });
    const secondDay = createLocalTimestamp({
      year: 2026,
      month: 4,
      day: 22,
      hour: 14,
    });

    const sections = groupHomeHistoryItems(
      [
        { id: 'balance-1', createdAt: firstDayLate },
        { id: 'transaction-1', createdAt: firstDayEarly },
        { id: 'transaction-2', createdAt: secondDay },
      ],
      'English',
    );

    expect(sections).toHaveLength(2);
    expect(sections.map((section) => section.label)).toEqual([
      '23 April 2026',
      '22 April 2026',
    ]);
    expect(sections[0].items.map((item) => item.id)).toEqual([
      'balance-1',
      'transaction-1',
    ]);
  });

  it('skips invalid timestamps without creating orphan groups', () => {
    const createdAt = createLocalTimestamp({
      year: 2026,
      month: 4,
      day: 23,
      hour: 15,
    });

    const sections = groupHomeHistoryItems(
      [
        { id: 'invalid', createdAt: Number.NaN },
        { id: 'valid', createdAt },
      ],
      'English',
    );

    expect(sections).toHaveLength(1);
    expect(sections[0].items.map((item) => item.id)).toEqual(['valid']);
  });
});
