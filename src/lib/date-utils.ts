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
