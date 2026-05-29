import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';

type BalanceRefreshMode = 'always' | 'when-uninitialized';

type UseBalanceRefreshOptions = {
  isInitialized: boolean;
  loadBalance: () => Promise<void>;
  loadOnMount?: BalanceRefreshMode;
};

export function useBalanceRefresh({
  isInitialized,
  loadBalance,
  loadOnMount = 'when-uninitialized',
}: UseBalanceRefreshOptions) {
  const didRunMountLoadRef = useRef(false);
  const skipNextFocusRefreshRef = useRef(true);

  useEffect(() => {
    if (didRunMountLoadRef.current) return;

    if (loadOnMount === 'when-uninitialized' && isInitialized) return;

    didRunMountLoadRef.current = true;

    void loadBalance();
  }, [isInitialized, loadBalance, loadOnMount]);

  useFocusEffect(
    useCallback(() => {
      if (!isInitialized) return;

      if (skipNextFocusRefreshRef.current) {
        skipNextFocusRefreshRef.current = false;

        return;
      }

      void loadBalance();
    }, [isInitialized, loadBalance]),
  );
}
