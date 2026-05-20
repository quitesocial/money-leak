import { Platform } from 'react-native';

import type {
  Transaction,
  TransactionInput,
  TransactionRestoreInput,
} from '@/types/transaction';

import * as nativeTransactions from './transactions.native';
import * as webTransactions from './transactions.web';

type TransactionsModule = {
  initDatabase: () => Promise<void>;
  createTransaction: (transaction: TransactionInput) => Promise<void>;
  importTransactions: (transactions: TransactionInput[]) => Promise<number>;
  restoreTransactions: (
    transactions: TransactionRestoreInput[],
  ) => Promise<number>;
  updateTransaction: (transaction: TransactionInput) => Promise<void>;
  getTransactions: () => Promise<Transaction[]>;
  deleteTransaction: (id: string) => Promise<void>;
};

const transactionsModule: TransactionsModule =
  Platform.OS === 'web' ? webTransactions : nativeTransactions;

export const {
  initDatabase,
  createTransaction,
  importTransactions,
  restoreTransactions,
  updateTransaction,
  getTransactions,
  deleteTransaction,
} = transactionsModule;
