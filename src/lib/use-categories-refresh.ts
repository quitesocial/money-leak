import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';

type CategoriesRefreshMode = 'always' | 'when-uninitialized';

type UseCategoriesRefreshOptions = {
  isInitialized: boolean;
  loadCategories: () => Promise<void>;
  loadOnMount?: CategoriesRefreshMode;
};

export function useCategoriesRefresh({
  isInitialized,
  loadCategories,
  loadOnMount = 'when-uninitialized',
}: UseCategoriesRefreshOptions) {
  const didRunMountLoadRef = useRef(false);
  const skipNextFocusRefreshRef = useRef(true);

  useEffect(() => {
    if (didRunMountLoadRef.current) return;

    if (loadOnMount === 'when-uninitialized' && isInitialized) return;

    didRunMountLoadRef.current = true;

    void loadCategories();
  }, [isInitialized, loadOnMount, loadCategories]);

  useFocusEffect(
    useCallback(() => {
      if (!isInitialized) return;

      if (skipNextFocusRefreshRef.current) {
        skipNextFocusRefreshRef.current = false;

        return;
      }

      void loadCategories();
    }, [isInitialized, loadCategories]),
  );
}
