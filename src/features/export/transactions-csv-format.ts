export const TRANSACTIONS_CSV_COLUMNS = [
  'id',
  'amount',
  'category',
  'isLeak',
  'leakReason',
  'note',
  'createdAt',
] as const;

export const TRANSACTIONS_CSV_HEADER = TRANSACTIONS_CSV_COLUMNS.join(',');

export function formatTransactionCreatedAt(createdAt: number) {
  return new Date(createdAt).toISOString();
}
