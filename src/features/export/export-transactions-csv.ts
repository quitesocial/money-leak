import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

import type { Transaction } from '@/types/transaction';
import {
  formatTransactionCreatedAt,
  TRANSACTIONS_CSV_HEADER,
} from '@/features/export/transactions-csv-format';

const SHARING_UNAVAILABLE_ERROR_MESSAGE =
  'Sharing is not available on this device.';

const EXPORT_TRANSACTIONS_ERROR_MESSAGE =
  "Couldn't export transactions. Try again.";

function escapeCsvValue(value: string | number | boolean | null) {
  if (value === null) return '';

  const stringValue = String(value);

  if (!/[",\n\r]/.test(stringValue)) return stringValue;

  return `"${stringValue.replace(/"/g, '""')}"`;
}

function getExportFileName() {
  const date = new Date();
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `money-leak-transactions-${year}-${month}-${day}.csv`;
}

function getExportErrorMessage(error: unknown) {
  if (
    error instanceof Error &&
    error.message === SHARING_UNAVAILABLE_ERROR_MESSAGE
  ) {
    return error.message;
  }

  return EXPORT_TRANSACTIONS_ERROR_MESSAGE;
}

export function transactionsToCsv(transactions: Transaction[]) {
  if (!transactions.length) return TRANSACTIONS_CSV_HEADER;

  const rows = transactions.map((transaction) =>
    [
      transaction.id,
      transaction.amount,
      transaction.category,
      transaction.isLeak,
      transaction.leakReason,
      transaction.note,
      formatTransactionCreatedAt(transaction.createdAt),
    ]
      .map(escapeCsvValue)
      .join(','),
  );

  return [TRANSACTIONS_CSV_HEADER, ...rows].join('\n');
}

export async function exportTransactionsCsv(transactions: Transaction[]) {
  const isSharingAvailable = await Sharing.isAvailableAsync();

  if (!isSharingAvailable) {
    throw new Error(SHARING_UNAVAILABLE_ERROR_MESSAGE);
  }

  if (!FileSystem.cacheDirectory) {
    throw new Error(EXPORT_TRANSACTIONS_ERROR_MESSAGE);
  }

  const fileName = getExportFileName();
  const fileUri = `${FileSystem.cacheDirectory}${fileName}`;
  const csvContents = transactionsToCsv(transactions);

  try {
    await FileSystem.writeAsStringAsync(fileUri, csvContents);

    await Sharing.shareAsync(fileUri, {
      mimeType: 'text/csv',
      UTI: 'public.comma-separated-values-text',
      dialogTitle: 'Export CSV',
    });
  } catch (error) {
    throw new Error(getExportErrorMessage(error));
  }
}
