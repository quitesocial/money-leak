import { Platform } from 'react-native';

import type {
  Transaction,
  TransactionInput,
  TransactionRestoreInput,
  TransactionTombstoneRestoreInput,
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
  restoreTransactionTombstones: (
    tombstones: TransactionTombstoneRestoreInput[],
  ) => Promise<number>;
  updateTransaction: (transaction: TransactionInput) => Promise<void>;
  getTransactions: () => Promise<Transaction[]>;
  getTransactionsForBackup: () => Promise<Transaction[]>;
  deleteTransaction: (id: string) => Promise<void>;
};

const transactionsModule: TransactionsModule =
  Platform.OS === 'web' ? webTransactions : nativeTransactions;

export const {
  initDatabase,
  createTransaction,
  importTransactions,
  restoreTransactions,
  restoreTransactionTombstones,
  updateTransaction,
  getTransactions,
  getTransactionsForBackup,
  deleteTransaction,
} = transactionsModule;
