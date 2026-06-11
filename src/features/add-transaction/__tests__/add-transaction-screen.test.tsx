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
import type { SettingsCurrency } from '@/lib/settings-preferences';
import {
  enterText,
  expectNoText,
  expectText,
  findAccessibleButton,
  findByTestID,
  findSelectedButton,
  flushPromises,
  pressAccessibleButton,
  pressButton,
} from '@/test-utils/react-test-renderer';
import type { Category } from '@/types/category';
import type { TransactionInput } from '@/types/transaction';

type LocalDatePickerMockProps = {
  visible: boolean;
  value: Date;
  onCancel: () => void;
  onConfirm: (date: Date) => void;
};

type LocalDatePickerTestNode = ReactTestInstance & {
  props: {
    onConfirm: (date: Date) => void;
  };
};

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
let mockSettingsCurrency: SettingsCurrency = 'Euro';
let mockSettingsLanguage = 'English';
let mockLatestDatePickerProps: LocalDatePickerMockProps | null = null;

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
  (selector?: (state: MockCategoriesStoreState) => unknown) => {
    return selector
      ? selector(mockCategoriesStoreState)
      : mockCategoriesStoreState;
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
  LocalDatePicker: (props: LocalDatePickerMockProps) => {
    mockLatestDatePickerProps = props;

    return mockReact.createElement(
      mockView as React.ComponentType<Record<string, unknown>>,
      {
        onConfirm: props.onConfirm,
        testID: 'local-date-picker',
        value: props.value,
        visible: props.visible,
      },
    );
  },
}));

jest.mock('@/lib/use-categories-refresh', () => ({
  useCategoriesRefresh: (...args: unknown[]) => {
    return mockUseCategoriesRefresh(...args);
  },
}));

jest.mock('@/lib/use-settings-currency', () => ({
  useSettingsCurrency: () => mockSettingsCurrency,
}));

jest.mock('@/lib/use-settings-language', () => ({
  useSettingsLanguage: () => mockSettingsLanguage,
}));

jest.mock('@/store/categories-store', () => ({
  useCategoriesStore: Object.assign(
    (selector?: (state: MockCategoriesStoreState) => unknown) => {
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

function createCategory(
  overrides: Partial<Category> & Pick<Category, 'id'>,
): Category {
  return {
    ownerId: 'local_test-owner',
    name: overrides.id,
    iconName: 'tag',
    createdAt: 1,
    updatedAt: 1,
    isDefault: false,
    isArchived: false,
    deletedAt: null,
    schemaVersion: 1,
    sourceDeviceId: 'device_test-device',
    sortOrder: 1,
    ...overrides,
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

function findSelectedCategoryButton(
  renderer: ReactTestRenderer,
  label: string,
) {
  return findSelectedButton(renderer, label);
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

async function selectDate(renderer: ReactTestRenderer, date: Date) {
  if (!mockLatestDatePickerProps) {
    throw new Error('LocalDatePicker was not rendered.');
  }

  await act(async () => {
    (
      findByTestID(renderer, 'local-date-picker') as LocalDatePickerTestNode
    ).props.onConfirm(date);
    await flushPromises();
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockLatestDatePickerProps = null;
  mockSettingsCurrency = 'Euro';
  mockSettingsLanguage = 'English';

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
  it('renders the initial fields before the type-gated sections', async () => {
    const renderer = await renderAddTransactionScreen();

    expectText(renderer, 'Amount');
    expectText(renderer, 'Date');
    expectText(renderer, 'Type');
    expectText(renderer, 'Normal');
    expectText(renderer, 'Leak');
    expectNoText(renderer, 'Reason');
    expectNoText(renderer, 'Category');
    expectNoText(renderer, 'Food');
    expectNoText(renderer, 'Transport');
  });

  it('renders the selected currency suffix in the amount field', async () => {
    mockSettingsCurrency = 'Indian rupee';

    const renderer = await renderAddTransactionScreen();

    expectText(renderer, '₹');
    expectNoText(renderer, '€');
  });

  it('shows categories after Normal is selected', async () => {
    const renderer = await renderAddTransactionScreen();

    await enterText(renderer, '0.00', '12.50');
    await pressButton(renderer, 'Normal');

    expectText(renderer, 'Category');
    expectText(renderer, 'Food');
    expectText(renderer, 'Transport');
  });

  it('shows Reason after Leak and categories after a reason is selected', async () => {
    const renderer = await renderAddTransactionScreen();

    await enterText(renderer, '0.00', '9.99');
    await pressButton(renderer, 'Leak');

    expectText(renderer, 'Reason');
    expectNoText(renderer, 'Category');
    expectNoText(renderer, 'Food');

    await pressButton(renderer, 'Boredom');

    expectText(renderer, 'Category');
    expectText(renderer, 'Food');
  });

  it('renders category options with inline icons after category reveal', async () => {
    const renderer = await renderAddTransactionScreen();

    await enterText(renderer, '0.00', '12.50');
    await pressButton(renderer, 'Normal');

    expect(findByTestID(renderer, 'category-icon-food')).toBeTruthy();
    expect(findByTestID(renderer, 'category-icon-transport')).toBeTruthy();
  });

  it('creates a normal transaction from the one-page screen', async () => {
    const renderer = await renderAddTransactionScreen();

    await enterText(renderer, '0.00', '12.50');
    await pressButton(renderer, 'Normal');
    await pressButton(renderer, 'Food');
    await pressButton(renderer, 'Save');

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
    await pressButton(renderer, 'Transport');
    await pressButton(renderer, 'Save');

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

  it('requires a leak reason before saving', async () => {
    const renderer = await renderAddTransactionScreen();

    await enterText(renderer, '0.00', '9,99');
    await pressButton(renderer, 'Leak');
    await pressButton(renderer, 'Save');

    expectText(renderer, 'Choose why this felt like a leak.');
    expectNoText(renderer, 'Choose a category.');
    expect(mockAddTransaction).not.toHaveBeenCalled();
  });

  it('clears the leak reason when switching leak back to normal', async () => {
    const renderer = await renderAddTransactionScreen();

    await enterText(renderer, '0.00', '20');
    await pressButton(renderer, 'Leak');
    await pressButton(renderer, 'Boredom');
    await pressButton(renderer, 'Normal');
    await pressButton(renderer, 'Food');
    await pressButton(renderer, 'Save');

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
    await pressButton(renderer, 'Save');

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

    await pressButton(renderer, 'Save');

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

  it('saves the selected date as createdAt', async () => {
    const renderer = await renderAddTransactionScreen();
    const selectedDate = new Date(2026, 10, 12);

    await selectDate(renderer, selectedDate);
    await enterText(renderer, '0.00', '18');
    await pressButton(renderer, 'Normal');
    await pressButton(renderer, 'Food');
    await pressButton(renderer, 'Save');

    expect(mockAddTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        createdAt: selectedDate.getTime(),
      }),
    );
  });

  it('falls back to the tabs route after save when there is no back stack', async () => {
    mockRouter.canGoBack.mockReturnValue(false);

    const renderer = await renderAddTransactionScreen();

    await enterText(renderer, '0.00', '22');
    await pressButton(renderer, 'Normal');
    await pressButton(renderer, 'Food');
    await pressButton(renderer, 'Save');

    expect(mockRouter.back).not.toHaveBeenCalled();
    expect(mockRouter.replace).toHaveBeenCalledWith('/(tabs)');
  });
});
