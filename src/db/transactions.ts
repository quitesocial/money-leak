import { Platform } from 'react-native';

import type { Transaction } from '@/types/transaction';

import * as nativeTransactions from './transactions.native';
import * as webTransactions from './transactions.web';

type TransactionsModule = {
  initDatabase: () => Promise<void>;
  createTransaction: (transaction: Transaction) => Promise<void>;
  getTransactions: () => Promise<Transaction[]>;
  deleteTransaction: (id: string) => Promise<void>;
};

const transactionsModule: TransactionsModule =
  Platform.OS === 'web' ? webTransactions : nativeTransactions;

export const {
  initDatabase,
  createTransaction,
  getTransactions,
  deleteTransaction,
} = transactionsModule;
