import { t } from '@/lib/i18n/i18n';
import type { SupportedLanguage } from '@/lib/i18n/languages';

export type AmountParseResult =
  | {
      amount: number;
      error: null;
    }
  | {
      amount: null;
      error: string;
    };

export function parseAmountText(
  amountText: string,
  language: SupportedLanguage,
): AmountParseResult {
  const trimmedAmount = amountText.trim();

  if (!trimmedAmount) {
    return {
      amount: null,
      error: t(language, 'form.amountRequired'),
    };
  }

  if (!/^\d+([.,]\d+)?$/.test(trimmedAmount)) {
    return {
      amount: null,
      error: t(language, 'form.amountNumber'),
    };
  }

  const amount = Number(trimmedAmount.replace(',', '.'));

  if (!Number.isFinite(amount)) {
    return {
      amount: null,
      error: t(language, 'form.amountNumber'),
    };
  }

  if (amount <= 0) {
    return {
      amount: null,
      error: t(language, 'form.amountPositive'),
    };
  }

  return {
    amount,
    error: null,
  };
}
