import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import * as React from 'react';
import { View } from 'react-native';
import {
  act,
  create,
  type ReactTestInstance,
  type ReactTestRenderer,
} from 'react-test-renderer';

import { HomeScreen } from '@/features/home/home-screen';
import type { BalanceEntry } from '@/types/balance';
import type { Category } from '@/types/category';
import type { Transaction } from '@/types/transaction';

const mockRouter = {
  push: jest.fn(),
};

const mockLoadBalance = jest.fn<() => Promise<void>>();
const mockLoadCategories = jest.fn<() => Promise<void>>();
const mockLoadTransactions = jest.fn<() => Promise<void>>();
const mockRemoveTransaction = jest.fn<(_id: string) => Promise<void>>();
const mockSetSelectedCustomDate = jest.fn();
const mockSetSelectedPeriod = jest.fn();
const mockUseBalanceRefresh = jest.fn();
const mockUseCategoriesRefresh = jest.fn();
const mockUseTransactionsRefresh = jest.fn();
const mockReact = React;
const mockView = View;

type MockBalanceStoreState = {
  balanceEntries: BalanceEntry[];
  isInitialized: boolean;
  loadBalance: () => Promise<void>;
};

type MockTransactionsStoreState = {
  transactions: Transaction[];
  isLoading: boolean;
  isInitialized: boolean;
  error: string | null;
  loadTransactions: () => Promise<void>;
  removeTransaction: (id: string) => Promise<void>;
};

type MockCategoriesStoreState = {
  categories: Category[];
  isInitialized: boolean;
  loadCategories: () => Promise<void>;
};

type MockPeriodScopeStoreState = {
  selectedPeriod: 'today' | 'yesterday' | 'this_week';
  selectedCustomDateStart: number | null;
  setSelectedPeriod: (period: 'today' | 'yesterday' | 'this_week') => void;
  setSelectedCustomDate: (dateStart: number) => void;
};

const mockBalanceStoreState: MockBalanceStoreState = {
  balanceEntries: [],
  isInitialized: true,
  loadBalance: mockLoadBalance,
};

const mockTransactionsStoreState: MockTransactionsStoreState = {
  transactions: [],
  isLoading: false,
  isInitialized: true,
  error: null,
  loadTransactions: mockLoadTransactions,
  removeTransaction: mockRemoveTransaction,
};

const mockCategoriesStoreState: MockCategoriesStoreState = {
  categories: [],
  isInitialized: true,
  loadCategories: mockLoadCategories,
};

const mockPeriodScopeStoreState: MockPeriodScopeStoreState = {
  selectedPeriod: 'today',
  selectedCustomDateStart: null,
  setSelectedPeriod: mockSetSelectedPeriod,
  setSelectedCustomDate: mockSetSelectedCustomDate,
};

const mockUseBalanceStore = jest.fn(
  (selector: (state: MockBalanceStoreState) => unknown) => {
    return selector(mockBalanceStoreState);
  },
);

const mockUseTransactionsStore = jest.fn(
  (selector: (state: MockTransactionsStoreState) => unknown) => {
    return selector(mockTransactionsStoreState);
  },
);

const mockUseCategoriesStore = jest.fn(
  (selector: (state: MockCategoriesStoreState) => unknown) => {
    return selector(mockCategoriesStoreState);
  },
);

const mockUsePeriodScopeStore = jest.fn(
  (selector: (state: MockPeriodScopeStoreState) => unknown) => {
    return selector(mockPeriodScopeStoreState);
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

jest.mock('@/lib/use-balance-refresh', () => ({
  useBalanceRefresh: (...args: unknown[]) => {
    return mockUseBalanceRefresh(...args);
  },
}));

jest.mock('@/lib/use-categories-refresh', () => ({
  useCategoriesRefresh: (...args: unknown[]) => {
    return mockUseCategoriesRefresh(...args);
  },
}));

jest.mock('@/lib/use-transactions-refresh', () => ({
  useTransactionsRefresh: (...args: unknown[]) => {
    return mockUseTransactionsRefresh(...args);
  },
}));

jest.mock('@/store/balance-store', () => ({
  useBalanceStore: (selector: (state: MockBalanceStoreState) => unknown) => {
    return mockUseBalanceStore(selector);
  },
}));

jest.mock('@/store/transactions-store', () => ({
  useTransactionsStore: (
    selector: (state: MockTransactionsStoreState) => unknown,
  ) => {
    return mockUseTransactionsStore(selector);
  },
}));

jest.mock('@/store/categories-store', () => ({
  useCategoriesStore: (
    selector: (state: MockCategoriesStoreState) => unknown,
  ) => {
    return mockUseCategoriesStore(selector);
  },
}));

jest.mock('@/store/period-scope-store', () => ({
  usePeriodScopeStore: (
    selector: (state: MockPeriodScopeStoreState) => unknown,
  ) => {
    return mockUsePeriodScopeStore(selector);
  },
}));

function createBalanceEntry(
  overrides: Partial<BalanceEntry> & Pick<BalanceEntry, 'id'>,
): BalanceEntry {
  return {
    id: overrides.id,
    amount: overrides.amount ?? 100,
    typeId: overrides.typeId ?? 'salary',
    createdAt: overrides.createdAt ?? 1,
  };
}

function createTransaction(
  overrides: Partial<Transaction> & Pick<Transaction, 'id'>,
): Transaction {
  const createdAt = overrides.createdAt ?? new Date().getTime();

  return {
    id: overrides.id,
    amount: overrides.amount ?? 10,
    category: overrides.category ?? 'food',
    isLeak: overrides.isLeak ?? false,
    leakReason: overrides.leakReason ?? null,
    note: overrides.note ?? null,
    createdAt,
    ownerId: overrides.ownerId ?? 'local_test-owner',
    updatedAt: overrides.updatedAt ?? createdAt,
    deletedAt: overrides.deletedAt ?? null,
    schemaVersion: overrides.schemaVersion ?? 1,
    sourceDeviceId: overrides.sourceDeviceId ?? 'device_test-device',
  };
}

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

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
}

async function renderHomeScreen() {
  const renderResult: { renderer: ReactTestRenderer | null } = {
    renderer: null,
  };

  await act(async () => {
    renderResult.renderer = create(React.createElement(HomeScreen));
    await flushPromises();
  });

  if (!renderResult.renderer) {
    throw new Error('Home screen did not render.');
  }

  return renderResult.renderer;
}

beforeEach(() => {
  jest.clearAllMocks();

  mockBalanceStoreState.balanceEntries = [];
  mockBalanceStoreState.isInitialized = true;
  mockTransactionsStoreState.transactions = [];
  mockTransactionsStoreState.isLoading = false;
  mockTransactionsStoreState.isInitialized = true;
  mockTransactionsStoreState.error = null;
  mockCategoriesStoreState.categories = [
    createCategory({
      id: 'food',
      name: 'Food',
      iconName: 'food',
      isDefault: true,
      sortOrder: 0,
    }),
  ];
  mockCategoriesStoreState.isInitialized = true;
  mockPeriodScopeStoreState.selectedPeriod = 'today';
  mockPeriodScopeStoreState.selectedCustomDateStart = null;
});

describe('HomeScreen', () => {
  it('renders the current balance', async () => {
    mockBalanceStoreState.balanceEntries = [
      createBalanceEntry({
        id: 'balance-1',
        amount: 1234.56,
      }),
    ];

    const renderer = await renderHomeScreen();

    expect(getNodeText(renderer.root)).toContain('1234.56€');
  });

  it('opens Add Balance from the Add button', async () => {
    const renderer = await renderHomeScreen();

    await act(async () => {
      findButton(renderer, 'Add').props.onPress();
      await flushPromises();
    });

    expect(mockRouter.push).toHaveBeenCalledWith('/add-balance');
  });

  it('opens Add Transaction from the Spend button', async () => {
    const renderer = await renderHomeScreen();

    await act(async () => {
      findButton(renderer, 'Spend').props.onPress();
      await flushPromises();
    });

    expect(mockRouter.push).toHaveBeenCalledWith('/add-transaction');
  });

  it('subtracts transaction totals from the current balance', async () => {
    mockBalanceStoreState.balanceEntries = [
      createBalanceEntry({
        id: 'balance-1',
        amount: 100,
      }),
    ];
    mockTransactionsStoreState.transactions = [
      createTransaction({
        id: 'txn-1',
        amount: 40,
      }),
    ];

    const renderer = await renderHomeScreen();

    expect(getNodeText(renderer.root)).toContain('60.00€');
  });

  it('keeps Today summary based on transactions only', async () => {
    mockBalanceStoreState.balanceEntries = [
      createBalanceEntry({
        id: 'balance-1',
        amount: 100,
      }),
    ];
    mockTransactionsStoreState.transactions = [
      createTransaction({
        id: 'txn-1',
        amount: 10,
        isLeak: true,
        leakReason: 'impulse',
      }),
    ];

    const renderer = await renderHomeScreen();
    const screenText = getNodeText(renderer.root);

    expect(screenText).toContain('90.00€');
    expect(screenText).toContain('Today summary');
    expect(screenText).toContain('10.00€');
    expect(screenText).not.toContain('100.00€');
  });
});
