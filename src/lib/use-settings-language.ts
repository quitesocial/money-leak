import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';

import { DEFAULT_LANGUAGE, type SupportedLanguage } from '@/lib/i18n/languages';
import { getSettingsLanguage } from '@/lib/settings-preferences';

const listeners = new Set<(language: SupportedLanguage) => void>();

async function readSettingsLanguage() {
  try {
    return await getSettingsLanguage();
  } catch {
    return DEFAULT_LANGUAGE;
  }
}

export function notifySettingsLanguageChanged(language: SupportedLanguage) {
  listeners.forEach((listener) => {
    listener(language);
  });
}

export function useSettingsLanguage() {
  const [language, setLanguage] = useState<SupportedLanguage>(DEFAULT_LANGUAGE);

  const refreshLanguage = useCallback(() => {
    let isActive = true;

    void readSettingsLanguage().then((nextLanguage) => {
      if (isActive) setLanguage(nextLanguage);
    });

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => refreshLanguage(), [refreshLanguage]);
  useFocusEffect(refreshLanguage);
  useEffect(() => {
    listeners.add(setLanguage);

    return () => {
      listeners.delete(setLanguage);
    };
  }, []);

  return language;
}
