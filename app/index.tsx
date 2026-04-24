import { Redirect, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getHasCompletedOnboarding } from '@/lib/onboarding-storage';

type BootstrapRoute = Href | null;

export default function IndexRoute() {
  const [bootstrapRoute, setBootstrapRoute] = useState<BootstrapRoute>(null);

  useEffect(() => {
    let isMounted = true;

    void (async () => {
      try {
        const hasCompletedOnboarding = await getHasCompletedOnboarding();

        if (!isMounted) return;

        setBootstrapRoute(
          hasCompletedOnboarding ? '/(tabs)' : ('/onboarding' as Href),
        );
      } catch (error) {
        console.error('Failed to read onboarding completion', error);

        if (!isMounted) return;

        setBootstrapRoute('/onboarding' as Href);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  if (bootstrapRoute) {
    return <Redirect href={bootstrapRoute} withAnchor />;
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.centeredState}>
        <Text style={styles.stateTitle}>Opening Money Leak</Text>
        
        <Text style={styles.stateMessage}>
          Checking whether to show first-run guidance.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f7f7f5',
  },
  centeredState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 12,
  },
  stateTitle: {
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    color: '#111827',
  },
  stateMessage: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    color: '#4b5563',
  },
});
