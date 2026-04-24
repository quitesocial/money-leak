export function sanitizeNumber(value: number) {
  return Number.isFinite(value) ? value : 0;
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
