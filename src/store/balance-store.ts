import { create } from 'zustand';

import {
  createBalanceEntry,
  createBalanceType,
  getBalanceEntries,
  getBalanceTypes,
} from '@/db/balance';
import {
  createBalanceTypeFromName,
  getActiveBalanceTypes,
  sortBalanceTypes,
  validateBalanceTypeName,
} from '@/lib/balance-utils';
import type {
  BalanceEntry,
  BalanceEntryInput,
  BalanceType,
} from '@/types/balance';

type BalanceStore = {
  balanceEntries: BalanceEntry[];
  balanceTypes: BalanceType[];
  activeBalanceTypes: BalanceType[];
  isLoading: boolean;
  isInitialized: boolean;
  error: string | null;
  loadBalance: () => Promise<void>;
  addBalanceEntry: (entry: BalanceEntryInput) => Promise<void>;
  addBalanceType: (input: { name: string }) => Promise<void>;
  clearError: () => void;
};

function getErrorMessage(error: unknown, fallbackMessage: string) {
  if (error instanceof Error && error.message) return error.message;

  return fallbackMessage;
}

function getBalanceTypesState(balanceTypes: BalanceType[]) {
  const sortedBalanceTypes = sortBalanceTypes(balanceTypes);

  return {
    balanceTypes: sortedBalanceTypes,
    activeBalanceTypes: getActiveBalanceTypes(sortedBalanceTypes),
  };
}

export const useBalanceStore = create<BalanceStore>((set, get) => ({
  balanceEntries: [],
  balanceTypes: [],
  activeBalanceTypes: [],
  isLoading: false,
  isInitialized: false,
  error: null,

  loadBalance: async () => {
    set({ isLoading: true, error: null });

    try {
      const [balanceEntries, balanceTypes] = await Promise.all([
        getBalanceEntries(),
        getBalanceTypes(),
      ]);

      set({
        balanceEntries,
        ...getBalanceTypesState(balanceTypes),
        isLoading: false,
        isInitialized: true,
        error: null,
      });
    } catch (error) {
      set({
        isLoading: false,
        isInitialized: true,
        error: getErrorMessage(error, 'Failed to load balance.'),
      });
    }
  },

  addBalanceEntry: async (entry) => {
    set({ isLoading: true, error: null });

    try {
      await createBalanceEntry(entry);

      const balanceEntries = await getBalanceEntries();

      set({
        balanceEntries,
        isLoading: false,
        isInitialized: true,
        error: null,
      });
    } catch (error) {
      set({
        isLoading: false,
        error: getErrorMessage(error, 'Failed to add balance.'),
      });
    }
  },

  addBalanceType: async ({ name }) => {
    set({ isLoading: true, error: null });

    try {
      const balanceTypes = get().balanceTypes;
      const validationError = validateBalanceTypeName({
        balanceTypes,
        name,
      });

      if (validationError) throw new Error(validationError);

      await createBalanceType(
        createBalanceTypeFromName({
          balanceTypes,
          name,
        }),
      );

      const nextBalanceTypes = await getBalanceTypes();

      set({
        ...getBalanceTypesState(nextBalanceTypes),
        isLoading: false,
        isInitialized: true,
        error: null,
      });
    } catch (error) {
      set({
        isLoading: false,
        error: getErrorMessage(error, 'Failed to add balance type.'),
      });
    }
  },

  clearError: () => {
    set({ error: null });
  },
}));
