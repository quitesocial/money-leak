import type { Transaction } from '@/types/transaction';

const NATIVE_ONLY_ERROR_MESSAGE =
  'SQLite transaction persistence is only available on native platforms in this build.';

export async function initDatabase() {}

export async function createTransaction(_transaction: Transaction) {
  throw new Error(NATIVE_ONLY_ERROR_MESSAGE);
}

export async function getTransactions(): Promise<Transaction[]> {
  throw new Error(NATIVE_ONLY_ERROR_MESSAGE);
}

export async function deleteTransaction(_id: string) {
  throw new Error(NATIVE_ONLY_ERROR_MESSAGE);
}
