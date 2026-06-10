import { describe, expect, it } from '@jest/globals';

import {
  formatEuro,
  formatMoneyAmount,
  getCurrencySymbol,
} from '@/lib/display-formatters';
import {
  SETTINGS_CURRENCY_OPTIONS,
  type SettingsCurrency,
} from '@/lib/settings-preferences';

describe('display formatters', () => {
  it('formats every settings currency with its display symbol', () => {
    const expectedValues = {
      Euro: '12.50 €',
      'United States dollar': '12.50 $',
      'Canadian dollar': '12.50 C$',
      'Australian dollar': '12.50 A$',
      'Russian ruble': '12.50 ₽',
      'Indian rupee': '12.50 ₹',
      'Chinese yuan': '12.50 CN¥',
      'Pound sterling': '12.50 £',
      'Japanese yen': '12.50 ¥',
    } satisfies Record<SettingsCurrency, string>;

    for (const currency of SETTINGS_CURRENCY_OPTIONS) {
      expect(formatMoneyAmount({ amount: 12.5, currency })).toBe(
        expectedValues[currency],
      );
    }
  });

  it('keeps Euro as the default and preserves the legacy Euro wrapper', () => {
    expect(formatMoneyAmount({ amount: 12.5 })).toBe('12.50 €');
    expect(formatEuro(12.5)).toBe('12.50€');
    expect(getCurrencySymbol()).toBe('€');
  });

  it('formats signed positive and negative labels from absolute amounts', () => {
    expect(
      formatMoneyAmount({
        amount: -20,
        currency: 'Euro',
      }),
    ).toBe('-20.00 €');
    expect(
      formatMoneyAmount({
        amount: -100,
        currency: 'United States dollar',
        sign: '+',
      }),
    ).toBe('+100.00 $');
    expect(
      formatMoneyAmount({
        amount: 20,
        currency: 'Pound sterling',
        sign: '-',
      }),
    ).toBe('-20.00 £');
  });

  it('formats grouped amount labels for ledger-style rows', () => {
    expect(
      formatMoneyAmount({
        amount: 1234567.89,
        currency: 'Canadian dollar',
        sign: '+',
        useGrouping: true,
      }),
    ).toBe('+1 234 567.89 C$');
  });

  it('falls back to zero for invalid and non-finite values', () => {
    expect(
      formatMoneyAmount({
        amount: Number.NaN,
        currency: 'Australian dollar',
      }),
    ).toBe('0.00 A$');
    expect(
      formatMoneyAmount({
        amount: Number.POSITIVE_INFINITY,
        currency: 'Chinese yuan',
        sign: '-',
      }),
    ).toBe('-0.00 CN¥');
  });
});
