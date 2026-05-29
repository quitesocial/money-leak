import { Platform } from 'react-native';

import type {
  BalanceEntry,
  BalanceEntryInput,
  BalanceEntryRestoreInput,
  BalanceEntryTombstoneRestoreInput,
  BalanceType,
  BalanceTypeInput,
  BalanceTypeTombstoneRestoreInput,
} from '@/types/balance';

import * as nativeBalance from './balance.native';
import * as webBalance from './balance.web';

type BalanceModule = {
  initDatabase: () => Promise<void>;
  getBalanceEntries: () => Promise<BalanceEntry[]>;
  getBalanceEntriesForBackup: () => Promise<BalanceEntry[]>;
  createBalanceEntry: (entry: BalanceEntryInput) => Promise<void>;
  restoreBalanceEntries: (
    entries: BalanceEntryRestoreInput[],
  ) => Promise<number>;
  restoreBalanceEntryTombstones: (
    tombstones: BalanceEntryTombstoneRestoreInput[],
  ) => Promise<number>;
  getBalanceTypes: () => Promise<BalanceType[]>;
  getBalanceTypesForBackup: () => Promise<BalanceType[]>;
  createBalanceType: (balanceType: BalanceTypeInput) => Promise<void>;
  restoreBalanceTypes: (balanceTypes: BalanceTypeInput[]) => Promise<number>;
  restoreBalanceTypeTombstones: (
    tombstones: BalanceTypeTombstoneRestoreInput[],
  ) => Promise<number>;
  applyBalanceSyncChanges: (input: {
    entryUpserts: BalanceEntryRestoreInput[];
    entryTombstones: BalanceEntryTombstoneRestoreInput[];
    typeUpserts: BalanceTypeInput[];
    typeTombstones: BalanceTypeTombstoneRestoreInput[];
  }) => Promise<{
    upsertedBalanceTypesCount: number;
    deletedBalanceTypesCount: number;
    upsertedBalanceEntriesCount: number;
    deletedBalanceEntriesCount: number;
  }>;
};

const balanceModule: BalanceModule =
  Platform.OS === 'web' ? webBalance : nativeBalance;

export const {
  initDatabase,
  getBalanceEntries,
  getBalanceEntriesForBackup,
  createBalanceEntry,
  restoreBalanceEntries,
  restoreBalanceEntryTombstones,
  getBalanceTypes,
  getBalanceTypesForBackup,
  createBalanceType,
  restoreBalanceTypes,
  restoreBalanceTypeTombstones,
  applyBalanceSyncChanges,
} = balanceModule;
