import { create } from 'zustand';

import {
  createTransaction,
  deleteTransaction,
  getTransactions,
  importTransactions as persistTransactionsImport,
  updateTransaction as persistTransactionUpdate,
} from '@/db/transactions';
import type { Transaction } from '@/types/transaction';

type TransactionsStore = {
  transactions: Transaction[];
  isLoading: boolean;
  isInitialized: boolean;
  error: string | null;
  loadTransactions: () => Promise<void>;
  addTransaction: (transaction: Transaction) => Promise<void>;
  importTransactions: (transactions: Transaction[]) => Promise<number>;
  updateTransaction: (transaction: Transaction) => Promise<void>;
  removeTransaction: (id: string) => Promise<void>;
  clearError: () => void;
};

function getErrorMessage(error: unknown, fallbackMessage: string) {
  if (error instanceof Error && error.message) return error.message;

  return fallbackMessage;
}

export const useTransactionsStore = create<TransactionsStore>((set) => ({
  transactions: [],
  isLoading: false,
  isInitialized: false,
  error: null,

  loadTransactions: async () => {
    set({ isLoading: true, error: null });

    try {
      const transactions = await getTransactions();

      set({
        transactions,
        isLoading: false,
        isInitialized: true,
        error: null,
      });
    } catch (error) {
      set({
        isLoading: false,
        isInitialized: true,
        error: getErrorMessage(error, 'Failed to load transactions.'),
      });
    }
  },

  addTransaction: async (transaction) => {
    set({ isLoading: true, error: null });

    try {
      await createTransaction(transaction);

      const transactions = await getTransactions();

      set({
        transactions,
        isLoading: false,
        isInitialized: true,
        error: null,
      });
    } catch (error) {
      set({
        isLoading: false,
        error: getErrorMessage(error, 'Failed to add transaction.'),
      });
    }
  },

  importTransactions: async (transactions) => {
    set({ isLoading: true, error: null });

    try {
      const importedCount = await persistTransactionsImport(transactions);
      const nextTransactions = await getTransactions();

      set({
        transactions: nextTransactions,
        isLoading: false,
        isInitialized: true,
        error: null,
      });

      return importedCount;
    } catch (error) {
      set({
        isLoading: false,
        error: getErrorMessage(error, 'Failed to import transactions.'),
      });

      return 0;
    }
  },

  updateTransaction: async (transaction) => {
    set({ isLoading: true, error: null });

    try {
      await persistTransactionUpdate(transaction);

      const transactions = await getTransactions();

      set({
        transactions,
        isLoading: false,
        isInitialized: true,
        error: null,
      });
    } catch (error) {
      set({
        isLoading: false,
        error: getErrorMessage(error, 'Failed to update transaction.'),
      });
    }
  },

  removeTransaction: async (id) => {
    set({ isLoading: true, error: null });

    try {
      await deleteTransaction(id);

      const transactions = await getTransactions();

      set({
        transactions,
        isLoading: false,
        isInitialized: true,
        error: null,
      });
    } catch (error) {
      set({
        isLoading: false,
        error: getErrorMessage(error, 'Failed to remove transaction.'),
      });
    }
  },

  clearError: () => {
    set({ error: null });
  },
}));
