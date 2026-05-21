import type {
  Transaction,
  TransactionInput,
  TransactionRestoreInput,
  TransactionTombstoneRestoreInput,
} from '@/types/transaction';

const NATIVE_ONLY_ERROR_MESSAGE =
  'SQLite transaction persistence is only available on native platforms in this build.';

export async function initDatabase() {}

export async function createTransaction(_transaction: TransactionInput) {
  throw new Error(NATIVE_ONLY_ERROR_MESSAGE);
}

export async function importTransactions(
  _transactions: TransactionInput[],
): Promise<number> {
  throw new Error(NATIVE_ONLY_ERROR_MESSAGE);
}

export async function restoreTransactions(
  _transactions: TransactionRestoreInput[],
): Promise<number> {
  throw new Error(NATIVE_ONLY_ERROR_MESSAGE);
}

export async function restoreTransactionTombstones(
  _tombstones: TransactionTombstoneRestoreInput[],
): Promise<number> {
  throw new Error(NATIVE_ONLY_ERROR_MESSAGE);
}

export async function applyTransactionSyncChanges(_input: {
  upserts: TransactionRestoreInput[];
  tombstones: TransactionTombstoneRestoreInput[];
}): Promise<{
  upsertedTransactionsCount: number;
  deletedTransactionsCount: number;
}> {
  throw new Error(NATIVE_ONLY_ERROR_MESSAGE);
}

export async function updateTransaction(_transaction: TransactionInput) {
  throw new Error(NATIVE_ONLY_ERROR_MESSAGE);
}

export async function getTransactions(): Promise<Transaction[]> {
  throw new Error(NATIVE_ONLY_ERROR_MESSAGE);
}

export async function getTransactionsForBackup(): Promise<Transaction[]> {
  throw new Error(NATIVE_ONLY_ERROR_MESSAGE);
}

export async function deleteTransaction(_id: string) {
  throw new Error(NATIVE_ONLY_ERROR_MESSAGE);
}
