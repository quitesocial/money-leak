import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';

import {
  DEFAULT_SETTINGS_CURRENCY,
  getSettingsCurrency,
  type SettingsCurrency,
} from '@/lib/settings-preferences';

const listeners = new Set<(currency: SettingsCurrency) => void>();

async function readSettingsCurrency() {
  try {
    return await getSettingsCurrency();
  } catch {
    return DEFAULT_SETTINGS_CURRENCY;
  }
}

export function notifySettingsCurrencyChanged(currency: SettingsCurrency) {
  listeners.forEach((listener) => {
    listener(currency);
  });
}

export function useSettingsCurrency() {
  const [currency, setCurrency] = useState<SettingsCurrency>(
    DEFAULT_SETTINGS_CURRENCY,
  );

  const refreshCurrency = useCallback(() => {
    let isActive = true;

    void readSettingsCurrency().then((nextCurrency) => {
      if (isActive) setCurrency(nextCurrency);
    });

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => refreshCurrency(), [refreshCurrency]);
  useFocusEffect(refreshCurrency);
  useEffect(() => {
    listeners.add(setCurrency);

    return () => {
      listeners.delete(setCurrency);
    };
  }, []);

  return currency;
}
