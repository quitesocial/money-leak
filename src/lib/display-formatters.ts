import {
  DEFAULT_SETTINGS_CURRENCY,
  SETTINGS_CURRENCY_SYMBOLS,
  type SettingsCurrency,
} from '@/lib/settings-preferences';

export function sanitizeNumber(value: number) {
  return Number.isFinite(value) ? value : 0;
}

export function getCurrencySymbol(
  currency: SettingsCurrency = DEFAULT_SETTINGS_CURRENCY,
) {
  return SETTINGS_CURRENCY_SYMBOLS[currency];
}

function formatMoneyNumber({
  amount,
  forceAbsolute,
  useGrouping,
}: {
  amount: number;
  forceAbsolute: boolean;
  useGrouping: boolean;
}) {
  const safeAmount = sanitizeNumber(amount);
  const formattedAmount = forceAbsolute ? Math.abs(safeAmount) : safeAmount;
  const [integerPart, decimalPart] = formattedAmount.toFixed(2).split('.');

  const formattedIntegerPart = useGrouping
    ? integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
    : integerPart;

  return `${formattedIntegerPart}.${decimalPart}`;
}

export function formatMoneyAmount({
  amount,
  currency = DEFAULT_SETTINGS_CURRENCY,
  sign,
  spaceBeforeCurrency = true,
  useGrouping = false,
}: {
  amount: number;
  currency?: SettingsCurrency;
  sign?: '+' | '-';
  spaceBeforeCurrency?: boolean;
  useGrouping?: boolean;
}) {
  const currencySeparator = spaceBeforeCurrency ? ' ' : '';

  return `${sign ?? ''}${formatMoneyNumber({
    amount,
    forceAbsolute: sign !== undefined,
    useGrouping,
  })}${currencySeparator}${getCurrencySymbol(currency)}`;
}

export function formatEuro(value: number) {
  return `${sanitizeNumber(value).toFixed(2)}€`;
}

export function formatPercentage(value: number) {
  return `${Math.round(sanitizeNumber(value))}%`;
}

export function formatLabel(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function formatHour(value: number) {
  if (!Number.isFinite(value)) return null;

  const hour = value;

  if (hour < 0 || hour > 23) return null;

  return `${Math.trunc(hour).toString().padStart(2, '0')}:00`;
}
