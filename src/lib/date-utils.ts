export function getValidDate(value: number | Date | null | undefined) {
  if (value === null || value === undefined) return null;

  const date =
    value instanceof Date ? new Date(value.getTime()) : new Date(value);

  if (!Number.isFinite(date.getTime())) return null;

  return date;
}

export function getReferenceDate(now?: number | Date) {
  return getValidDate(now ?? Date.now()) ?? new Date();
}

export function getStartOfDay(referenceDate: Date) {
  const startOfDay = new Date(referenceDate);

  startOfDay.setHours(0, 0, 0, 0);

  return startOfDay;
}

export function addDays(referenceDate: Date, days: number) {
  const nextDate = new Date(referenceDate);

  nextDate.setDate(nextDate.getDate() + days);
  nextDate.setHours(0, 0, 0, 0);

  return nextDate;
}
