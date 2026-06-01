import type {
  BalanceEntry,
  BalanceEntryInput,
  BalanceEntryRestoreInput,
  BalanceEntryTombstoneRestoreInput,
  BalanceType,
  BalanceTypeInput,
  BalanceTypeTombstoneRestoreInput,
} from '@/types/balance';

const NATIVE_ONLY_ERROR_MESSAGE =
  'SQLite balance persistence is only available on native platforms in this build.';

export async function initDatabase() {}

export async function getBalanceEntries(): Promise<BalanceEntry[]> {
  throw new Error(NATIVE_ONLY_ERROR_MESSAGE);
}

export async function getBalanceEntriesForBackup(): Promise<BalanceEntry[]> {
  throw new Error(NATIVE_ONLY_ERROR_MESSAGE);
}

export async function createBalanceEntry(_entry: BalanceEntryInput) {
  throw new Error(NATIVE_ONLY_ERROR_MESSAGE);
}

export async function updateBalanceEntry(_entry: BalanceEntryInput) {
  throw new Error(NATIVE_ONLY_ERROR_MESSAGE);
}

export async function deleteBalanceEntry(_id: string) {
  throw new Error(NATIVE_ONLY_ERROR_MESSAGE);
}

export async function restoreBalanceEntries(
  _entries: BalanceEntryRestoreInput[],
): Promise<number> {
  throw new Error(NATIVE_ONLY_ERROR_MESSAGE);
}

export async function restoreBalanceEntryTombstones(
  _tombstones: BalanceEntryTombstoneRestoreInput[],
): Promise<number> {
  throw new Error(NATIVE_ONLY_ERROR_MESSAGE);
}

export async function getBalanceTypes(): Promise<BalanceType[]> {
  throw new Error(NATIVE_ONLY_ERROR_MESSAGE);
}

export async function getBalanceTypesForBackup(): Promise<BalanceType[]> {
  throw new Error(NATIVE_ONLY_ERROR_MESSAGE);
}

export async function createBalanceType(_balanceType: BalanceTypeInput) {
  throw new Error(NATIVE_ONLY_ERROR_MESSAGE);
}

export async function restoreBalanceTypes(
  _balanceTypes: BalanceTypeInput[],
): Promise<number> {
  throw new Error(NATIVE_ONLY_ERROR_MESSAGE);
}

export async function restoreBalanceTypeTombstones(
  _tombstones: BalanceTypeTombstoneRestoreInput[],
): Promise<number> {
  throw new Error(NATIVE_ONLY_ERROR_MESSAGE);
}

export async function applyBalanceSyncChanges(_input: {
  entryUpserts: BalanceEntryRestoreInput[];
  entryTombstones: BalanceEntryTombstoneRestoreInput[];
  typeUpserts: BalanceTypeInput[];
  typeTombstones: BalanceTypeTombstoneRestoreInput[];
}): Promise<{
  upsertedBalanceTypesCount: number;
  deletedBalanceTypesCount: number;
  upsertedBalanceEntriesCount: number;
  deletedBalanceEntriesCount: number;
}> {
  throw new Error(NATIVE_ONLY_ERROR_MESSAGE);
}
