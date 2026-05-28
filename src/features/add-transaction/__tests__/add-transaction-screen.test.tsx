import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import * as React from 'react';
import { View } from 'react-native';
import {
  act,
  create,
  type ReactTestInstance,
  type ReactTestRenderer,
} from 'react-test-renderer';

import { AddTransactionScreen } from '@/features/add-transaction/add-transaction-screen';
import type { CategoryIconName } from '@/lib/category-icons';
import { normalizeCategoryName } from '@/lib/category-utils';
import type { Category } from '@/types/category';
import type { TransactionInput } from '@/types/transaction';

const mockRouter = {
  back: jest.fn(),
  canGoBack: jest.fn(() => true),
  replace: jest.fn(),
};

const mockLoadCategories = jest.fn<() => Promise<void>>();
const mockClearCategoriesError = jest.fn();
const mockAddCategory =
  jest.fn<
    (input: {
      iconName?: CategoryIconName | null;
      name: string;
    }) => Promise<void>
  >();
const mockAddTransaction =
  jest.fn<(transaction: TransactionInput) => Promise<void>>();
const mockClearTransactionError = jest.fn();
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
  clearError: () => void;
};

type MockTransactionsStoreState = {
  isLoading: boolean;
  error: string | null;
  addTransaction: (transaction: TransactionInput) => Promise<void>;
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
  clearError: mockClearCategoriesError,
};

const mockTransactionsStoreState: MockTransactionsStoreState = {
  isLoading: false,
  error: null,
  addTransaction: mockAddTransaction,
  clearError: mockClearTransactionError,
};

const mockUseCategoriesStore = jest.fn(
  (selector: (state: MockCategoriesStoreState) => unknown) => {
    return selector(mockCategoriesStoreState);
  },
);

const mockUseTransactionsStore = jest.fn(
  (selector: (state: MockTransactionsStoreState) => unknown) => {
    return selector(mockTransactionsStoreState);
  },
);

jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
}));

jest.mock('expo-symbols', () => ({
  SymbolView: ({ fallback }: { fallback?: React.ReactNode }) => fallback,
}));

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children, ...props }: { children?: React.ReactNode }) => {
    return mockReact.createElement(mockView, props, children);
  },
}));

jest.mock('@/components/local-date-picker', () => ({
  LocalDatePicker: () => null,
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

jest.mock('@/store/transactions-store', () => ({
  useTransactionsStore: Object.assign(
    (selector: (state: MockTransactionsStoreState) => unknown) => {
      return mockUseTransactionsStore(selector);
    },
    {
      getState: () => mockTransactionsStoreState,
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
      id: 'food',
      name: 'Food',
      iconName: 'food',
      isDefault: true,
      sortOrder: 0,
    }),
    createCategory({
      id: 'transport',
      name: 'Transport',
      iconName: 'transport',
      isDefault: true,
      sortOrder: 1,
    }),
    createCategory({
      id: 'archived',
      name: 'Archived',
      isArchived: true,
      sortOrder: 2,
    }),
  ];

  mockCategoriesStoreState.categories = categories;
  mockCategoriesStoreState.activeCategories = categories.filter(
    (category) => !category.isArchived,
  );
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
      accessibilityState?: { selected?: boolean };
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

function findByTestID(renderer: ReactTestRenderer, testID: string) {
  return renderer.root.find((node: ReactTestInstance) => {
    return node.props.testID === testID;
  });
}

function findAccessibleButton(renderer: ReactTestRenderer, label: string) {
  return renderer.root.find((node: ReactTestInstance) => {
    return (
      typeof node.props.onPress === 'function' &&
      node.props.accessibilityLabel === label
    );
  }) as ReactTestInstance & {
    props: {
      accessibilityState?: { selected?: boolean };
      onPress: () => void;
    };
  };
}

function findSelectedCategoryButton(
  renderer: ReactTestRenderer,
  label: string,
) {
  return renderer.root.find((node: ReactTestInstance) => {
    const accessibilityState = node.props.accessibilityState as
      | { selected?: boolean }
      | undefined;

    return (
      typeof node.props.onPress === 'function' &&
      accessibilityState?.selected === true &&
      getNodeText(node).includes(label)
    );
  });
}

function expectText(renderer: ReactTestRenderer, text: string) {
  expect(getNodeText(renderer.root)).toContain(text);
}

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
}

async function renderAddTransactionScreen() {
  let renderer: ReactTestRenderer | null = null;

  await act(async () => {
    renderer = create(React.createElement(AddTransactionScreen));
    await flushPromises();
  });

  if (!renderer) {
    throw new Error('Add Transaction screen did not render.');
  }

  return renderer;
}

async function enterText(
  renderer: ReactTestRenderer,
  placeholder: string,
  value: string,
) {
  await act(async () => {
    findTextInput(renderer, placeholder).props.onChangeText(value);
    await flushPromises();
  });
}

async function pressButton(renderer: ReactTestRenderer, label: string) {
  await act(async () => {
    findButton(renderer, label).props.onPress();
    await flushPromises();
  });
}

async function pressAccessibleButton(
  renderer: ReactTestRenderer,
  label: string,
) {
  await act(async () => {
    findAccessibleButton(renderer, label).props.onPress();
    await flushPromises();
  });
}

beforeEach(() => {
  jest.clearAllMocks();

  resetCategories();

  mockRouter.canGoBack.mockReturnValue(true);
  mockCategoriesStoreState.isLoading = false;
  mockCategoriesStoreState.isInitialized = true;
  mockCategoriesStoreState.error = null;
  mockTransactionsStoreState.isLoading = false;
  mockTransactionsStoreState.error = null;

  mockAddCategory.mockImplementation(async ({ iconName, name }) => {
    const normalizedName = normalizeCategoryName(name);
    const id = normalizedName.toLocaleLowerCase().replace(/\s+/g, '-');
    const category = createCategory({
      id,
      name: normalizedName,
      iconName: iconName ?? 'tag',
      sortOrder: mockCategoriesStoreState.categories.length,
    });

    mockCategoriesStoreState.categories = [
      ...mockCategoriesStoreState.categories,
      category,
    ];
    mockCategoriesStoreState.activeCategories = [
      ...mockCategoriesStoreState.activeCategories,
      category,
    ];
  });

  mockAddTransaction.mockResolvedValue(undefined);
  mockLoadCategories.mockResolvedValue(undefined);
});

describe('AddTransactionScreen', () => {
  it('renders category options with inline icons', async () => {
    const renderer = await renderAddTransactionScreen();

    await enterText(renderer, '0.00', '12.50');
    await pressButton(renderer, 'Normal');

    expect(findByTestID(renderer, 'category-icon-food')).toBeTruthy();
    expect(findByTestID(renderer, 'category-icon-transport')).toBeTruthy();
  });

  it('creates a normal transaction through the details and category steps', async () => {
    const renderer = await renderAddTransactionScreen();

    await enterText(renderer, '0.00', '12.50');
    await pressButton(renderer, 'Normal');
    await pressButton(renderer, 'Food');
    await pressButton(renderer, 'Save Transaction');

    expect(mockAddTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 12.5,
        category: 'food',
        isLeak: false,
        leakReason: null,
        note: null,
      }),
    );
    expect(mockAddTransaction.mock.calls[0][0]).not.toHaveProperty('iconName');
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
  });

  it('creates a leak transaction with a reason and category ID only', async () => {
    const renderer = await renderAddTransactionScreen();

    await enterText(renderer, '0.00', '9,99');
    await pressButton(renderer, 'Leak');
    await pressButton(renderer, 'Boredom');
    await pressButton(renderer, 'Next');
    await pressButton(renderer, 'Transport');
    await pressButton(renderer, 'Save Transaction');

    expect(mockAddTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 9.99,
        category: 'transport',
        isLeak: true,
        leakReason: 'boredom',
      }),
    );
    expect(mockAddTransaction.mock.calls[0][0]).not.toHaveProperty('iconName');
  });

  it('requires a leak reason before continuing from the leak reason step', async () => {
    const renderer = await renderAddTransactionScreen();

    await enterText(renderer, '0.00', '9,99');
    await pressButton(renderer, 'Leak');
    await pressButton(renderer, 'Next');

    expectText(renderer, 'Choose why this felt like a leak.');
    expect(mockAddTransaction).not.toHaveBeenCalled();
  });

  it('clears the leak reason when switching leak back to normal', async () => {
    const renderer = await renderAddTransactionScreen();

    await enterText(renderer, '0.00', '20');
    await pressButton(renderer, 'Leak');
    await pressButton(renderer, 'Boredom');
    await pressButton(renderer, 'Normal');
    await pressButton(renderer, 'Food');
    await pressButton(renderer, 'Save Transaction');

    expect(mockAddTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 20,
        category: 'food',
        isLeak: false,
        leakReason: null,
      }),
    );
  });

  it('requires a category before saving a transaction', async () => {
    const renderer = await renderAddTransactionScreen();

    await enterText(renderer, '0.00', '7');
    await pressButton(renderer, 'Normal');
    await pressButton(renderer, 'Save Transaction');

    expectText(renderer, 'Choose a category.');
    expect(mockAddTransaction).not.toHaveBeenCalled();
  });

  it('uses existing category validation in the Add Category sub-flow', async () => {
    const renderer = await renderAddTransactionScreen();

    await enterText(renderer, '0.00', '7');
    await pressButton(renderer, 'Normal');
    await pressButton(renderer, 'Add');
    await pressButton(renderer, 'Save Category');

    expectText(renderer, 'Category name is required.');
    expect(mockAddCategory).not.toHaveBeenCalled();

    await enterText(renderer, 'Travel', 'Food');
    await pressButton(renderer, 'Save Category');

    expectText(renderer, 'An active category with this name already exists.');
    expect(mockAddCategory).not.toHaveBeenCalled();
  });

  it('selects an icon, auto-selects the created category, and saves it', async () => {
    const renderer = await renderAddTransactionScreen();

    await enterText(renderer, '0.00', '15');
    await pressButton(renderer, 'Normal');
    await pressButton(renderer, 'Add');
    await enterText(renderer, 'Travel', 'Travel');
    expect(findByTestID(renderer, 'category-icon-picker-expand')).toBeTruthy();

    await pressAccessibleButton(renderer, 'Show category icons');
    expect(
      React.Children.count(
        findByTestID(renderer, 'category-icon-picker-row-0').props.children,
      ),
    ).toBe(5);
    await pressAccessibleButton(renderer, 'Select Travel icon');

    expect(
      findAccessibleButton(renderer, 'Select Travel icon').props
        .accessibilityState,
    ).toEqual({ selected: true });

    await pressButton(renderer, 'Save Category');

    expectText(renderer, 'Travel');
    expect(findByTestID(renderer, 'category-icon-travel')).toBeTruthy();
    expect(findSelectedCategoryButton(renderer, 'Travel')).toBeTruthy();

    await pressButton(renderer, 'Save Transaction');

    expect(mockAddCategory).toHaveBeenCalledWith({
      name: 'Travel',
      iconName: 'travel',
    });
    expect(mockAddTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 15,
        category: 'travel',
        isLeak: false,
      }),
    );
  });

  it('saves a new category with the fallback icon when the picker stays collapsed', async () => {
    const renderer = await renderAddTransactionScreen();

    await enterText(renderer, '0.00', '15');
    await pressButton(renderer, 'Normal');
    await pressButton(renderer, 'Add');
    await enterText(renderer, 'Travel', 'Coffee');
    await pressButton(renderer, 'Save Category');

    expect(mockAddCategory).toHaveBeenCalledWith({
      name: 'Coffee',
      iconName: 'tag',
    });
    expect(findSelectedCategoryButton(renderer, 'Coffee')).toBeTruthy();
  });

  it('renders legacy categories without iconName using the fallback icon', async () => {
    const legacyCategory = createCategory({
      id: 'legacy',
      name: 'Legacy',
      sortOrder: 3,
    }) as Partial<Category>;

    delete legacyCategory.iconName;

    mockCategoriesStoreState.categories = [
      ...mockCategoriesStoreState.categories,
      legacyCategory as Category,
    ];
    mockCategoriesStoreState.activeCategories = [
      ...mockCategoriesStoreState.activeCategories,
      legacyCategory as Category,
    ];

    const renderer = await renderAddTransactionScreen();

    await enterText(renderer, '0.00', '15');
    await pressButton(renderer, 'Normal');

    expect(findByTestID(renderer, 'category-icon-legacy')).toBeTruthy();
    expectText(renderer, 'Legacy');
  });
});
