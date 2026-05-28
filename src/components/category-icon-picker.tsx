import { SymbolView } from 'expo-symbols';
import { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  CATEGORY_ICON_PICKER_ICONS,
  type CategoryIconDefinition,
  type CategoryIconName,
} from '@/lib/category-icons';

type CategoryIconPickerProps = {
  isExpanded: boolean;
  onExpand: () => void;
  onIconPress: (iconName: CategoryIconName) => void;
  selectedIconName: CategoryIconName | null;
  testIDPrefix?: string;
};

type CategoryIconGlyphProps = {
  color: string;
  icon: CategoryIconDefinition;
  size?: number;
};

const ICON_PICKER_ANIMATION_DURATION_MS = 220;
const ICON_PICKER_COLUMN_COUNT = 5;
const ICON_PICKER_PANEL_HEIGHT = 428;

const categoryIconPickerRows = CATEGORY_ICON_PICKER_ICONS.reduce<
  CategoryIconDefinition[][]
>((rows, icon, index) => {
  if (index % ICON_PICKER_COLUMN_COUNT === 0) rows.push([]);

  rows[rows.length - 1].push(icon);

  return rows;
}, []);

function CategoryIconGlyph({ color, icon, size = 20 }: CategoryIconGlyphProps) {
  return (
    <SymbolView
      fallback={
        <Text style={[styles.symbolFallback, { color, fontSize: size }]}>
          {icon.fallbackSymbol}
        </Text>
      }
      name={icon.symbolName}
      resizeMode="scaleAspectFit"
      size={size}
      tintColor={color}
      type="monochrome"
      weight="semibold"
    />
  );
}

export function CategoryIconPicker({
  isExpanded,
  onExpand,
  onIconPress,
  selectedIconName,
  testIDPrefix = 'category-icon',
}: CategoryIconPickerProps) {
  const revealProgress = useRef(new Animated.Value(isExpanded ? 1 : 0)).current;

  useEffect(() => {
    if (process.env.NODE_ENV === 'test') {
      revealProgress.setValue(isExpanded ? 1 : 0);

      return;
    }

    Animated.timing(revealProgress, {
      toValue: isExpanded ? 1 : 0,
      duration: ICON_PICKER_ANIMATION_DURATION_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [isExpanded, revealProgress]);

  if (!isExpanded) {
    return (
      <Pressable
        accessibilityLabel="Show category icons"
        accessibilityRole="button"
        onPress={onExpand}
        style={styles.expandButton}
        testID={`${testIDPrefix}-picker-expand`}
      >
        <SymbolView
          fallback={<Text style={styles.plusFallback}>+</Text>}
          name="plus"
          resizeMode="scaleAspectFit"
          size={24}
          tintColor="#100f10"
          type="monochrome"
          weight="regular"
        />
      </Pressable>
    );
  }

  const panelHeight = revealProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, ICON_PICKER_PANEL_HEIGHT],
  });

  return (
    <Animated.View
      style={[
        styles.panel,
        {
          height: panelHeight,
          opacity: revealProgress,
        },
      ]}
    >
      {categoryIconPickerRows.map((row, rowIndex) => (
        <View
          key={rowIndex}
          style={styles.row}
          testID={`${testIDPrefix}-picker-row-${rowIndex}`}
        >
          {row.map((icon) => {
            const isSelected = selectedIconName === icon.name;
            const iconColor = isSelected ? '#ffffff' : '#100f10';

            return (
              <Pressable
                key={icon.name}
                accessibilityLabel={`Select ${icon.label} icon`}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                onPress={() => onIconPress(icon.name)}
                style={[
                  styles.option,
                  isSelected ? styles.optionSelected : null,
                ]}
                testID={`${testIDPrefix}-option-${icon.name}`}
              >
                <CategoryIconGlyph color={iconColor} icon={icon} />
              </Pressable>
            );
          })}
        </View>
      ))}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  expandButton: {
    width: 50,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#100f10',
    borderRadius: 25,
    backgroundColor: '#f7f7f5',
  },
  panel: {
    borderWidth: 1,
    borderColor: '#100f10',
    borderRadius: 16,
    gap: 16,
    overflow: 'hidden',
    padding: 24,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  option: {
    width: 50,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#100f10',
    borderRadius: 25,
    backgroundColor: '#f7f7f5',
  },
  optionSelected: {
    backgroundColor: '#100f10',
  },
  plusFallback: {
    color: '#100f10',
    fontSize: 24,
    lineHeight: 26,
  },
  symbolFallback: {
    fontWeight: '700',
    lineHeight: 22,
  },
});
