import type {
  BalanceEntry,
  BalanceEntryInput,
  BalanceType,
  BalanceTypeInput,
} from '@/types/balance';

const NATIVE_ONLY_ERROR_MESSAGE =
  'SQLite balance persistence is only available on native platforms in this build.';

export async function initDatabase() {}

export async function getBalanceEntries(): Promise<BalanceEntry[]> {
  throw new Error(NATIVE_ONLY_ERROR_MESSAGE);
}

export async function createBalanceEntry(_entry: BalanceEntryInput) {
  throw new Error(NATIVE_ONLY_ERROR_MESSAGE);
}

export async function getBalanceTypes(): Promise<BalanceType[]> {
  throw new Error(NATIVE_ONLY_ERROR_MESSAGE);
}

export async function createBalanceType(_balanceType: BalanceTypeInput) {
  throw new Error(NATIVE_ONLY_ERROR_MESSAGE);
}
