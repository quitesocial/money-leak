import type { SFSymbol } from 'expo-symbols';

import type { DefaultTransactionCategory } from '@/types/transaction';

export const CATEGORY_ICON_NAMES = [
  'food',
  'transport',
  'alcohol',
  'shopping',
  'subscriptions',
  'other',
  'sun',
  'star',
  'heart',
  'book',
  'camera',
  'graduation',
  'beach',
  'tag',
  'paint',
  'party',
  'gift',
  'printer',
  'home',
  'building',
  'travel',
  'camp',
  'nature',
  'celebration',
  'health',
  'baby',
  'toys',
  'shoes',
  'movies',
  'snacks',
  'games',
  'coffee',
  'dining',
  'car',
  'fuel',
  'bike',
] as const;

export type CategoryIconName = (typeof CATEGORY_ICON_NAMES)[number];

export type CategoryIconDefinition = {
  fallbackSymbol: string;
  label: string;
  name: CategoryIconName;
  symbolName: SFSymbol;
};

export const CATEGORY_ICON_FALLBACK_NAME: CategoryIconName = 'tag';

export const DEFAULT_CATEGORY_ICON_NAMES: Record<
  DefaultTransactionCategory,
  CategoryIconName
> = {
  food: 'food',
  transport: 'transport',
  alcohol: 'alcohol',
  shopping: 'shopping',
  subscriptions: 'subscriptions',
  other: 'other',
};

export const CATEGORY_ICONS: readonly CategoryIconDefinition[] = [
  {
    name: 'food',
    label: 'Food',
    symbolName: 'takeoutbag.and.cup.and.straw',
    fallbackSymbol: 'F',
  },
  {
    name: 'transport',
    label: 'Transport',
    symbolName: 'bus',
    fallbackSymbol: 'T',
  },
  {
    name: 'alcohol',
    label: 'Alcohol',
    symbolName: 'wineglass',
    fallbackSymbol: 'A',
  },
  {
    name: 'shopping',
    label: 'Shopping',
    symbolName: 'cart',
    fallbackSymbol: 'S',
  },
  {
    name: 'subscriptions',
    label: 'Subscriptions',
    symbolName: 'rectangle.stack',
    fallbackSymbol: 'Sub',
  },
  {
    name: 'other',
    label: 'Other',
    symbolName: 'bag',
    fallbackSymbol: 'O',
  },
  {
    name: 'sun',
    label: 'Sun',
    symbolName: 'sun.max',
    fallbackSymbol: '*',
  },
  {
    name: 'star',
    label: 'Star',
    symbolName: 'star',
    fallbackSymbol: '*',
  },
  {
    name: 'heart',
    label: 'Heart',
    symbolName: 'heart',
    fallbackSymbol: '<3',
  },
  {
    name: 'book',
    label: 'Book',
    symbolName: 'book',
    fallbackSymbol: 'B',
  },
  {
    name: 'camera',
    label: 'Camera',
    symbolName: 'camera',
    fallbackSymbol: 'Cam',
  },
  {
    name: 'graduation',
    label: 'Graduation',
    symbolName: 'graduationcap',
    fallbackSymbol: 'G',
  },
  {
    name: 'beach',
    label: 'Beach',
    symbolName: 'beach.umbrella',
    fallbackSymbol: 'Be',
  },
  {
    name: 'tag',
    label: 'Tag',
    symbolName: 'tag',
    fallbackSymbol: '#',
  },
  {
    name: 'paint',
    label: 'Paint',
    symbolName: 'paintbrush',
    fallbackSymbol: 'P',
  },
  {
    name: 'party',
    label: 'Party',
    symbolName: 'party.popper',
    fallbackSymbol: '!',
  },
  {
    name: 'gift',
    label: 'Gift',
    symbolName: 'gift',
    fallbackSymbol: 'G',
  },
  {
    name: 'printer',
    label: 'Printer',
    symbolName: 'printer',
    fallbackSymbol: 'Pr',
  },
  {
    name: 'home',
    label: 'Home',
    symbolName: 'house',
    fallbackSymbol: 'H',
  },
  {
    name: 'building',
    label: 'Building',
    symbolName: 'building.2',
    fallbackSymbol: 'B',
  },
  {
    name: 'travel',
    label: 'Travel',
    symbolName: 'airplane',
    fallbackSymbol: 'T',
  },
  {
    name: 'camp',
    label: 'Camp',
    symbolName: 'tent',
    fallbackSymbol: 'C',
  },
  {
    name: 'nature',
    label: 'Nature',
    symbolName: 'tree',
    fallbackSymbol: 'N',
  },
  {
    name: 'celebration',
    label: 'Celebration',
    symbolName: 'birthday.cake',
    fallbackSymbol: 'C',
  },
  {
    name: 'health',
    label: 'Health',
    symbolName: 'pills',
    fallbackSymbol: 'Rx',
  },
  {
    name: 'baby',
    label: 'Baby',
    symbolName: 'stroller',
    fallbackSymbol: 'Ba',
  },
  {
    name: 'toys',
    label: 'Toys',
    symbolName: 'teddybear',
    fallbackSymbol: 'Toy',
  },
  {
    name: 'shoes',
    label: 'Shoes',
    symbolName: 'shoeprints.fill',
    fallbackSymbol: 'Sh',
  },
  {
    name: 'movies',
    label: 'Movies',
    symbolName: 'movieclapper',
    fallbackSymbol: 'M',
  },
  {
    name: 'snacks',
    label: 'Snacks',
    symbolName: 'popcorn',
    fallbackSymbol: 'S',
  },
  {
    name: 'games',
    label: 'Games',
    symbolName: 'gamecontroller',
    fallbackSymbol: 'G',
  },
  {
    name: 'coffee',
    label: 'Coffee',
    symbolName: 'cup.and.saucer',
    fallbackSymbol: 'C',
  },
  {
    name: 'dining',
    label: 'Dining',
    symbolName: 'fork.knife',
    fallbackSymbol: 'D',
  },
  {
    name: 'car',
    label: 'Car',
    symbolName: 'car',
    fallbackSymbol: 'Car',
  },
  {
    name: 'fuel',
    label: 'Fuel',
    symbolName: 'fuelpump',
    fallbackSymbol: 'Gas',
  },
  {
    name: 'bike',
    label: 'Bike',
    symbolName: 'bicycle',
    fallbackSymbol: 'Bike',
  },
];

export const CATEGORY_ICON_PICKER_NAMES: readonly CategoryIconName[] = [
  'sun',
  'star',
  'heart',
  'book',
  'camera',
  'graduation',
  'beach',
  'tag',
  'paint',
  'party',
  'gift',
  'printer',
  'home',
  'building',
  'travel',
  'camp',
  'nature',
  'celebration',
  'health',
  'baby',
  'toys',
  'shoes',
  'movies',
  'snacks',
  'games',
  'coffee',
  'dining',
  'car',
  'fuel',
  'bike',
];

const categoryIconsByName = new Map(
  CATEGORY_ICONS.map((icon) => [icon.name, icon]),
);

export const CATEGORY_ICON_PICKER_ICONS = CATEGORY_ICON_PICKER_NAMES.map(
  (iconName) => getCategoryIcon(iconName),
);

export function isCategoryIconName(value: unknown): value is CategoryIconName {
  return (
    typeof value === 'string' &&
    categoryIconsByName.has(value as CategoryIconName)
  );
}

export function getCategoryIcon(iconName: unknown) {
  return (
    (typeof iconName === 'string'
      ? categoryIconsByName.get(iconName as CategoryIconName)
      : undefined) ?? categoryIconsByName.get(CATEGORY_ICON_FALLBACK_NAME)!
  );
}

export function normalizeCategoryIconName(iconName: unknown): CategoryIconName {
  return getCategoryIcon(iconName).name;
}

export function getDefaultCategoryIconName(categoryId: string) {
  return (
    DEFAULT_CATEGORY_ICON_NAMES[categoryId as DefaultTransactionCategory] ??
    CATEGORY_ICON_FALLBACK_NAME
  );
}

export function resolveCategoryIconName({
  categoryId,
  iconName,
  isDefault,
}: {
  categoryId: string;
  iconName: unknown;
  isDefault: boolean;
}) {
  if (isCategoryIconName(iconName)) return iconName;

  if (isDefault) return getDefaultCategoryIconName(categoryId);

  return CATEGORY_ICON_FALLBACK_NAME;
}
