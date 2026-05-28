import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import * as React from 'react';
import { View } from 'react-native';
import {
  act,
  create,
  type ReactTestInstance,
  type ReactTestRenderer,
} from 'react-test-renderer';

import { CategoriesScreen } from '@/features/categories/categories-screen';
import type { CategoryIconName } from '@/lib/category-icons';
import type { Category } from '@/types/category';

const mockLoadCategories = jest.fn<() => Promise<void>>();
const mockAddCategory =
  jest.fn<
    (input: {
      iconName?: CategoryIconName | null;
      name: string;
    }) => Promise<void>
  >();
const mockUpdateCategory = jest.fn<
  (
    id: string,
    input: {
      iconName?: CategoryIconName | null;
      name: string;
    },
  ) => Promise<void>
>();
const mockArchiveCategory = jest.fn<(id: string) => Promise<void>>();
const mockClearError = jest.fn();
const mockUseCategoriesRefresh = jest.fn();
const mockReact = React;
const mockView = View;

type MockCategoriesStoreState = {
  categories: Category[];
  activeCategories: Category[];
  isLoading: boolean;
  isInitialized: boolean;
  error: string | null;
  loadCategories: () => Promise<void>;
  addCategory: (input: {
    iconName?: CategoryIconName | null;
    name: string;
  }) => Promise<void>;
  updateCategory: (
    id: string,
    input: {
      iconName?: CategoryIconName | null;
      name: string;
    },
  ) => Promise<void>;
  archiveCategory: (id: string) => Promise<void>;
  clearError: () => void;
};

const mockCategoriesStoreState: MockCategoriesStoreState = {
  categories: [],
  activeCategories: [],
  isLoading: false,
  isInitialized: true,
  error: null,
  loadCategories: mockLoadCategories,
  addCategory: mockAddCategory,
  updateCategory: mockUpdateCategory,
  archiveCategory: mockArchiveCategory,
  clearError: mockClearError,
};

const mockUseCategoriesStore = jest.fn(
  (selector: (state: MockCategoriesStoreState) => unknown) => {
    return selector(mockCategoriesStoreState);
  },
);

jest.mock('expo-symbols', () => ({
  SymbolView: ({ fallback }: { fallback?: React.ReactNode }) => fallback,
}));

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children, ...props }: { children?: React.ReactNode }) => {
    return mockReact.createElement(mockView, props, children);
  },
}));

jest.mock('@/lib/use-categories-refresh', () => ({
  useCategoriesRefresh: (...args: unknown[]) => {
    return mockUseCategoriesRefresh(...args);
  },
}));

jest.mock('@/store/categories-store', () => ({
  useCategoriesStore: Object.assign(
    (selector: (state: MockCategoriesStoreState) => unknown) => {
      return mockUseCategoriesStore(selector);
    },
    {
      getState: () => mockCategoriesStoreState,
    },
  ),
}));

function createCategory(overrides: Partial<Category> & Pick<Category, 'id'>) {
  return {
    id: overrides.id,
    ownerId: overrides.ownerId ?? 'local_test-owner',
    name: overrides.name ?? overrides.id,
    iconName: overrides.iconName ?? 'tag',
    createdAt: overrides.createdAt ?? 1,
    updatedAt: overrides.updatedAt ?? 1,
    isDefault: overrides.isDefault ?? false,
    isArchived: overrides.isArchived ?? false,
    deletedAt: overrides.deletedAt ?? null,
    schemaVersion: overrides.schemaVersion ?? 1,
    sourceDeviceId: overrides.sourceDeviceId ?? 'device_test-device',
    sortOrder: overrides.sortOrder ?? 1,
  };
}

function resetCategories() {
  const categories = [
    createCategory({
      id: 'coffee',
      name: 'Coffee',
      iconName: 'coffee',
      sortOrder: 0,
    }),
  ];

  mockCategoriesStoreState.categories = categories;
  mockCategoriesStoreState.activeCategories = categories;
  mockCategoriesStoreState.isLoading = false;
  mockCategoriesStoreState.isInitialized = true;
  mockCategoriesStoreState.error = null;
}

function getNodeText(node: any): string {
  if (typeof node === 'string') return node;

  return node.children
    .map((child: any) => {
      return typeof child === 'string' ? child : getNodeText(child);
    })
    .join('');
}

function findButton(renderer: ReactTestRenderer, label: string) {
  return renderer.root.find((node: ReactTestInstance) => {
    return (
      typeof node.props.onPress === 'function' &&
      getNodeText(node).includes(label)
    );
  }) as ReactTestInstance & {
    props: {
      onPress: () => void;
    };
  };
}

function findTextInput(renderer: ReactTestRenderer, placeholder: string) {
  return renderer.root.find((node: ReactTestInstance) => {
    return (
      typeof node.props.onChangeText === 'function' &&
      node.props.placeholder === placeholder
    );
  }) as ReactTestInstance & {
    props: {
      onChangeText: (value: string) => void;
    };
  };
}

function findTextInputByValue(renderer: ReactTestRenderer, value: string) {
  return renderer.root.find((node: ReactTestInstance) => {
    return (
      typeof node.props.onChangeText === 'function' &&
      node.props.value === value
    );
  }) as ReactTestInstance & {
    props: {
      onChangeText: (value: string) => void;
    };
  };
}

function findByTestID(renderer: ReactTestRenderer, testID: string) {
  return renderer.root.find((node: ReactTestInstance) => {
    return node.props.testID === testID;
  }) as ReactTestInstance & {
    props: {
      accessibilityState?: { selected?: boolean };
      onPress?: () => void;
    };
  };
}

async function renderScreen() {
  let renderer!: ReactTestRenderer;

  await act(async () => {
    renderer = create(React.createElement(CategoriesScreen));
  });

  return renderer;
}

describe('CategoriesScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetCategories();
  });

  it('adds a category with the selected icon from the settings picker', async () => {
    const renderer = await renderScreen();

    await act(async () => {
      findTextInput(renderer, 'Coffee').props.onChangeText('Travel');
    });

    await act(async () => {
      findByTestID(
        renderer,
        'settings-add-category-icon-picker-expand',
      ).props.onPress?.();
    });

    await act(async () => {
      findByTestID(
        renderer,
        'settings-add-category-icon-option-travel',
      ).props.onPress?.();
    });

    expect(
      findByTestID(renderer, 'settings-add-category-icon-option-travel').props
        .accessibilityState?.selected,
    ).toBe(true);

    await act(async () => {
      findButton(renderer, 'Add Category').props.onPress();
    });

    expect(mockAddCategory).toHaveBeenCalledWith({
      name: 'Travel',
      iconName: 'travel',
    });
  });

  it('uses the fallback icon when settings category create leaves icon optional', async () => {
    const renderer = await renderScreen();

    await act(async () => {
      findTextInput(renderer, 'Coffee').props.onChangeText('Books');
    });

    await act(async () => {
      findButton(renderer, 'Add Category').props.onPress();
    });

    expect(mockAddCategory).toHaveBeenCalledWith({
      name: 'Books',
      iconName: 'tag',
    });
  });

  it('edits a category icon through the settings picker', async () => {
    const renderer = await renderScreen();

    await act(async () => {
      findButton(renderer, 'Edit').props.onPress();
    });

    await act(async () => {
      findByTestID(
        renderer,
        'settings-edit-category-icon-picker-expand',
      ).props.onPress?.();
    });

    expect(
      findByTestID(renderer, 'settings-edit-category-icon-option-coffee').props
        .accessibilityState?.selected,
    ).toBe(true);

    await act(async () => {
      findByTestID(
        renderer,
        'settings-edit-category-icon-option-snacks',
      ).props.onPress?.();
    });

    await act(async () => {
      findTextInputByValue(renderer, 'Coffee').props.onChangeText(
        'Coffee Runs',
      );
    });

    await act(async () => {
      findButton(renderer, 'Save').props.onPress();
    });

    expect(mockUpdateCategory).toHaveBeenCalledWith('coffee', {
      name: 'Coffee Runs',
      iconName: 'snacks',
    });
  });
});
