import { Tabs } from 'expo-router';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#111827',
        tabBarInactiveTintColor: '#6b7280',
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
        tabBarStyle: {
          borderTopWidth: 0,
          height: 64,
          backgroundColor: '#ffffff',
          elevation: 0,
          paddingBottom: 6,
          paddingTop: 4,
          shadowOpacity: 0,
        },
        tabBarItemStyle: {
          justifyContent: 'center',
          paddingVertical: 0,
        },
        tabBarIconStyle: {
          marginTop: 0,
        },
        sceneStyle: {
          backgroundColor: '#f7f7f5',
        },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="analytics" options={{ title: 'Analytics' }} />
      <Tabs.Screen name="shame-card" options={{ title: 'Shame Card' }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
    </Tabs>
  );
}
