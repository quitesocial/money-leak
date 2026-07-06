import { Tabs } from 'expo-router';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { type ComponentProps, useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { t } from '@/lib/i18n/i18n';
import type { SupportedLanguage } from '@/lib/i18n/languages';
import { useSettingsLanguage } from '@/lib/use-settings-language';

type AnimatedTabBarProps = Parameters<
  NonNullable<ComponentProps<typeof Tabs>['tabBar']>
>[0];

type TabIconProps = {
  color: string;
  fallbackSymbol: string;
  label: string;
  symbolName: SFSymbol;
  symbolSize: number;
};

type TabConfig = {
  fallbackSymbol: string;
  symbolName: SFSymbol;
  symbolSize: number;
};

const ACTIVE_COLOR = '#0088ff';
const INACTIVE_COLOR = '#1a1a1a';
const TAB_BAR_HEIGHT = 74;
const TAB_BAR_HORIZONTAL_OFFSET = 22;
const TAB_BAR_INSET = 4;

const tabConfigByRouteName: Record<string, TabConfig> = {
  index: {
    fallbackSymbol: '⌂',
    symbolName: 'house',
    symbolSize: 27,
  },
  analytics: {
    fallbackSymbol: '♢',
    symbolName: 'drop.halffull',
    symbolSize: 28,
  },
  settings: {
    fallbackSymbol: '⚙',
    symbolName: 'gearshape',
    symbolSize: 27,
  },
};

function getTabLabel(routeName: string, language: SupportedLanguage) {
  if (routeName === 'index') return t(language, 'tabs.home');
  if (routeName === 'analytics') return t(language, 'tabs.analytics');
  if (routeName === 'settings') return t(language, 'tabs.settings');

  return routeName;
}

function TabIcon({
  color,
  fallbackSymbol,
  label,
  symbolName,
  symbolSize,
}: TabIconProps) {
  return (
    <View style={styles.tabIconContent}>
      <SymbolView
        fallback={
          <Text
            style={[styles.tabIconFallback, { color, fontSize: symbolSize }]}
          >
            {fallbackSymbol}
          </Text>
        }
        name={symbolName}
        resizeMode="scaleAspectFit"
        size={symbolSize}
        tintColor={color}
        type="monochrome"
        weight="semibold"
      />

      <Text
        adjustsFontSizeToFit
        minimumFontScale={0.78}
        numberOfLines={2}
        style={[styles.tabIconLabel, { color }]}
      >
        {label}
      </Text>
    </View>
  );
}

function AnimatedTabBar({
  descriptors,
  language,
  navigation,
  state,
}: AnimatedTabBarProps & { language: SupportedLanguage }) {
  const insets = useSafeAreaInsets();
  const tabBarBottom = Math.max(insets.bottom, 16);
  const animatedIndex = useRef(new Animated.Value(state.index)).current;
  const [tabBarWidth, setTabBarWidth] = useState(0);

  const itemWidth =
    tabBarWidth > 0
      ? (tabBarWidth - TAB_BAR_INSET * 2) / state.routes.length
      : 0;

  const inputRange = state.routes.map((_, index) => index);

  const translateX = animatedIndex.interpolate({
    inputRange,
    outputRange: inputRange.map((index) => TAB_BAR_INSET + index * itemWidth),
  });

  useEffect(() => {
    Animated.spring(animatedIndex, {
      toValue: state.index,
      damping: 22,
      mass: 0.75,
      stiffness: 260,
      useNativeDriver: false,
    }).start();
  }, [animatedIndex, state.index]);

  return (
    <View
      onLayout={(event) => {
        const nextWidth = event.nativeEvent.layout.width;

        setTabBarWidth((currentWidth) =>
          currentWidth === nextWidth ? currentWidth : nextWidth,
        );
      }}
      style={[styles.tabBar, { bottom: tabBarBottom }]}
    >
      {itemWidth > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.activeTabCapsule,
            {
              width: itemWidth,
              transform: [{ translateX }],
            },
          ]}
        />
      ) : null}

      <View style={styles.tabBarItems}>
        {state.routes.map((route, index) => {
          const options = descriptors[route.key].options;
          const isFocused = state.index === index;
          const config = tabConfigByRouteName[route.name];
          const color = isFocused ? ACTIVE_COLOR : INACTIVE_COLOR;

          if (!config) return null;

          return (
            <Pressable
              key={route.key}
              accessibilityLabel={options.tabBarAccessibilityLabel}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              onLongPress={() => {
                navigation.emit({
                  type: 'tabLongPress',
                  target: route.key,
                });
              }}
              onPress={() => {
                const event = navigation.emit({
                  type: 'tabPress',
                  target: route.key,
                  canPreventDefault: true,
                });

                if (!isFocused && !event.defaultPrevented) {
                  navigation.navigate(route.name, route.params);
                }
              }}
              style={styles.tabBarItem}
              testID={options.tabBarButtonTestID}
            >
              <TabIcon
                color={color}
                fallbackSymbol={config.fallbackSymbol}
                label={getTabLabel(route.name, language)}
                symbolName={config.symbolName}
                symbolSize={config.symbolSize}
              />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function TabLayout() {
  const language = useSettingsLanguage();

  return (
    <Tabs
      tabBar={(props) => <AnimatedTabBar {...props} language={language} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: {
          backgroundColor: '#f7f7f5',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t(language, 'tabs.home'),
        }}
      />

      <Tabs.Screen
        name="analytics"
        options={{
          title: t(language, 'tabs.analyticsTitle'),
        }}
      />

      <Tabs.Screen
        name="settings"
        options={{
          title: t(language, 'tabs.settings'),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    right: TAB_BAR_HORIZONTAL_OFFSET,
    left: TAB_BAR_HORIZONTAL_OFFSET,
    height: TAB_BAR_HEIGHT,
    borderRadius: TAB_BAR_HEIGHT / 2,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.72)',
    backgroundColor: 'rgba(255, 255, 255, 0.88)',
    padding: TAB_BAR_INSET,
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 8,
  },
  activeTabCapsule: {
    position: 'absolute',
    top: TAB_BAR_INSET,
    bottom: TAB_BAR_INSET,
    left: 0,
    borderRadius: (TAB_BAR_HEIGHT - TAB_BAR_INSET * 2) / 2,
    backgroundColor: '#ededed',
  },
  tabBarItems: {
    zIndex: 1,
    flex: 1,
    flexDirection: 'row',
  },
  tabBarItem: {
    flex: 1,
    height: '100%',
  },
  tabIconContent: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 0,
  },
  tabIconFallback: {
    lineHeight: 28,
    fontWeight: '600',
    textAlign: 'center',
  },
  tabIconLabel: {
    maxWidth: '86%',
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
});
