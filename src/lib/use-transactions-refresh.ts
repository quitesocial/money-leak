import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';

type TransactionsRefreshMode = 'always' | 'when-uninitialized';

type UseTransactionsRefreshOptions = {
  isInitialized: boolean;
  loadTransactions: () => Promise<void>;
  loadOnMount?: TransactionsRefreshMode;
};

export function useTransactionsRefresh({
  isInitialized,
  loadTransactions,
  loadOnMount = 'when-uninitialized',
}: UseTransactionsRefreshOptions) {
  const didRunMountLoadRef = useRef(false);
  const skipNextFocusRefreshRef = useRef(true);

  useEffect(() => {
    if (didRunMountLoadRef.current) return;
    
    if (loadOnMount === 'when-uninitialized' && isInitialized) return;

    didRunMountLoadRef.current = true;

    void loadTransactions();
  }, [isInitialized, loadOnMount, loadTransactions]);

  useFocusEffect(
    useCallback(() => {
      if (!isInitialized) return;

      if (skipNextFocusRefreshRef.current) {
        skipNextFocusRefreshRef.current = false;

        return;
      }

      void loadTransactions();
    }, [isInitialized, loadTransactions]),
  );
}
