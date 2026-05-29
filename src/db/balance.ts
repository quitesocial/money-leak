import { Platform } from 'react-native';

import type {
  BalanceEntry,
  BalanceEntryInput,
  BalanceType,
  BalanceTypeInput,
} from '@/types/balance';

import * as nativeBalance from './balance.native';
import * as webBalance from './balance.web';

type BalanceModule = {
  initDatabase: () => Promise<void>;
  getBalanceEntries: () => Promise<BalanceEntry[]>;
  createBalanceEntry: (entry: BalanceEntryInput) => Promise<void>;
  getBalanceTypes: () => Promise<BalanceType[]>;
  createBalanceType: (balanceType: BalanceTypeInput) => Promise<void>;
};

const balanceModule: BalanceModule =
  Platform.OS === 'web' ? webBalance : nativeBalance;

export const {
  initDatabase,
  getBalanceEntries,
  createBalanceEntry,
  getBalanceTypes,
  createBalanceType,
} = balanceModule;
