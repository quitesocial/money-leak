import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import * as React from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import {
  act,
  create,
  type ReactTestInstance,
  type ReactTestRenderer,
} from 'react-test-renderer';

import { HomeScreen } from '@/features/home/home-screen';
import type { SettingsCurrency } from '@/lib/settings-preferences';
import type { BalanceEntry, BalanceType } from '@/types/balance';
import type { Category } from '@/types/category';
import type { Transaction } from '@/types/transaction';

const mockRouter = {
  push: jest.fn(),
};

const mockLoadBalance = jest.fn<() => Promise<void>>();
const mockLoadCategories = jest.fn<() => Promise<void>>();
const mockLoadTransactions = jest.fn<() => Promise<void>>();
const mockRemoveBalanceEntry = jest.fn<(_id: string) => Promise<void>>();
const mockRemoveTransaction = jest.fn<(_id: string) => Promise<void>>();
const mockSetSelectedCustomDate = jest.fn();
const mockSetSelectedPeriod = jest.fn();
const mockUseBalanceRefresh = jest.fn();
const mockUseCategoriesRefresh = jest.fn();
const mockUseTransactionsRefresh = jest.fn();
const mockReact = React;
const mockView = View;
const mockAlert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
let mockSettingsCurrency: SettingsCurrency = 'Euro';

type MockBalanceStoreState = {
  balanceEntries: BalanceEntry[];
  balanceTypes: BalanceType[];
  isLoading: boolean;
  isInitialized: boolean;
  loadBalance: () => Promise<void>;
  removeBalanceEntry: (id: string) => Promise<void>;
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
  balanceTypes: [],
  isLoading: false,
  isInitialized: true,
  loadBalance: mockLoadBalance,
  removeBalanceEntry: mockRemoveBalanceEntry,
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

jest.mock('@/lib/use-settings-currency', () => ({
  useSettingsCurrency: () => mockSettingsCurrency,
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
  const createdAt = overrides.createdAt ?? 1;

  return {
    id: overrides.id,
    ownerId: overrides.ownerId ?? 'local_test-owner',
    amount: overrides.amount ?? 100,
    typeId: overrides.typeId ?? 'salary',
    createdAt,
    updatedAt: overrides.updatedAt ?? createdAt,
    deletedAt: overrides.deletedAt ?? null,
    schemaVersion: overrides.schemaVersion ?? 1,
    sourceDeviceId: overrides.sourceDeviceId ?? 'device_test-device',
  };
}

function createBalanceType(
  overrides: Partial<BalanceType> & Pick<BalanceType, 'id'>,
): BalanceType {
  return {
    id: overrides.id,
    ownerId: overrides.ownerId ?? 'local_test-owner',
    name: overrides.name ?? overrides.id,
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

function findAllNodes(
  node: ReactTestInstance,
  predicate: (node: ReactTestInstance) => boolean,
): ReactTestInstance[] {
  const matches = predicate(node) ? [node] : [];

  for (const child of node.children) {
    if (typeof child === 'string') continue;

    matches.push(...findAllNodes(child, predicate));
  }

  return matches;
}

function findNodeByProp(
  renderer: ReactTestRenderer,
  propName: string,
  value: unknown,
) {
  const node = findAllNodes(renderer.root, (candidate) => {
    return candidate.props[propName] === value;
  })[0];

  if (!node) {
    throw new Error(`Could not find node with ${propName}.`);
  }

  return node;
}

function findTextNode(renderer: ReactTestRenderer, text: string) {
  const node = findAllNodes(renderer.root, (candidate) => {
    return getNodeText(candidate) === text;
  })[0];

  if (!node) {
    throw new Error(`Could not find text node ${text}.`);
  }

  return node;
}

function getPressHandler(node: ReactTestInstance) {
  const { onPress } = node.props;

  if (typeof onPress !== 'function') {
    throw new Error('Expected node to have an onPress handler.');
  }

  return onPress as () => void;
}

function getPastDate(daysAgo: number) {
  const date = new Date();

  date.setDate(date.getDate() - daysAgo);

  return date;
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

  mockRemoveBalanceEntry.mockResolvedValue(undefined);
  mockRemoveTransaction.mockResolvedValue(undefined);

  mockBalanceStoreState.balanceEntries = [];
  mockBalanceStoreState.balanceTypes = [
    createBalanceType({
      id: 'salary',
      name: 'Salary',
      isDefault: true,
      sortOrder: 0,
    }),
  ];
  mockBalanceStoreState.isLoading = false;
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
  mockSettingsCurrency = 'Euro';
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

    expect(getNodeText(renderer.root)).toContain('1234.56 €');
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

  it('opens Analytics from the More button', async () => {
    const renderer = await renderHomeScreen();

    await act(async () => {
      findButton(renderer, 'More').props.onPress();
      await flushPromises();
    });

    expect(mockRouter.push).toHaveBeenCalledWith('/analytics');
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

    expect(getNodeText(renderer.root)).toContain('60.00 €');
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

    expect(screenText).toContain('90.00 €');
    expect(screenText).toContain('Today summary');
    expect(screenText).toContain('10.00 €');
    expect(screenText).toContain('100%');
    expect(screenText).not.toContain('100.00 €');
  });

  it('shows safe empty values without invalid numbers', async () => {
    const renderer = await renderHomeScreen();
    const screenText = getNodeText(renderer.root);

    expect(screenText).toContain('0.00 €');
    expect(screenText).toContain('0%');
    expect(screenText).not.toContain('NaN');
    expect(screenText).not.toContain('Infinity');
    expect(screenText).not.toContain('Choose date');
  });

  it('renders balance additions with plus signs and expenses with minus signs', async () => {
    const now = new Date().getTime();

    mockBalanceStoreState.balanceEntries = [
      createBalanceEntry({
        id: 'balance-1',
        amount: 100,
        typeId: 'salary',
        createdAt: now,
      }),
    ];
    mockTransactionsStoreState.transactions = [
      createTransaction({
        id: 'txn-1',
        amount: 20,
        category: 'food',
        isLeak: true,
        leakReason: 'impulse',
        note: 'Hidden note',
        createdAt: now + 1,
      }),
    ];

    const renderer = await renderHomeScreen();
    const screenText = getNodeText(renderer.root);

    expect(screenText).toContain('Salary');
    expect(screenText).toContain('+100.00 €');
    expect(screenText).toContain('Food');
    expect(screenText).toContain('-20.00 €');
    expect(screenText).toContain('Impulse');
    expect(screenText).not.toContain('Hidden note');
    expect(screenText.indexOf('Food')).toBeLessThan(
      screenText.indexOf('Salary'),
    );

    expect(
      StyleSheet.flatten(findTextNode(renderer, '+100.00 €').props.style),
    ).toMatchObject({
      color: '#34c759',
    });
    expect(
      StyleSheet.flatten(findTextNode(renderer, '-20.00 €').props.style),
    ).toMatchObject({
      color: '#050505',
    });
  });

  it('renders the selected currency for balance and history labels', async () => {
    const now = new Date().getTime();
    mockSettingsCurrency = 'Canadian dollar';
    mockBalanceStoreState.balanceEntries = [
      createBalanceEntry({
        id: 'balance-1',
        amount: 100,
        typeId: 'salary',
        createdAt: now,
      }),
    ];
    mockTransactionsStoreState.transactions = [
      createTransaction({
        id: 'txn-1',
        amount: 20,
        category: 'food',
        createdAt: now + 1,
      }),
    ];

    const renderer = await renderHomeScreen();
    const screenText = getNodeText(renderer.root);

    expect(screenText).toContain('80.00 C$');
    expect(screenText).toContain('+100.00 C$');
    expect(screenText).toContain('-20.00 C$');
    expect(screenText).not.toContain('80.00 €');
  });

  it('applies the Today History period filter to additions and expenses', async () => {
    const today = new Date();
    const yesterday = getPastDate(1);

    mockPeriodScopeStoreState.selectedPeriod = 'today';
    mockBalanceStoreState.balanceEntries = [
      createBalanceEntry({
        id: 'balance-today',
        amount: 125,
        createdAt: today.getTime(),
      }),
      createBalanceEntry({
        id: 'balance-yesterday',
        amount: 75,
        createdAt: yesterday.getTime(),
      }),
    ];
    mockTransactionsStoreState.transactions = [
      createTransaction({
        id: 'txn-today',
        amount: 35,
        createdAt: today.getTime(),
      }),
      createTransaction({
        id: 'txn-yesterday',
        amount: 25,
        createdAt: yesterday.getTime(),
      }),
    ];

    const renderer = await renderHomeScreen();
    const screenText = getNodeText(renderer.root);

    expect(screenText).toContain('+125.00 €');
    expect(screenText).toContain('-35.00 €');
    expect(screenText).not.toContain('+75.00 €');
    expect(screenText).not.toContain('-25.00 €');
  });

  it('applies the Yesterday History period filter to additions and expenses', async () => {
    const today = new Date();
    const yesterday = getPastDate(1);

    mockPeriodScopeStoreState.selectedPeriod = 'yesterday';
    mockBalanceStoreState.balanceEntries = [
      createBalanceEntry({
        id: 'balance-yesterday',
        amount: 75,
        createdAt: yesterday.getTime(),
      }),
      createBalanceEntry({
        id: 'balance-today',
        amount: 125,
        createdAt: today.getTime(),
      }),
    ];
    mockTransactionsStoreState.transactions = [
      createTransaction({
        id: 'txn-yesterday',
        amount: 25,
        createdAt: yesterday.getTime(),
      }),
      createTransaction({
        id: 'txn-today',
        amount: 35,
        createdAt: today.getTime(),
      }),
    ];

    const renderer = await renderHomeScreen();
    const screenText = getNodeText(renderer.root);

    expect(screenText).toContain('+75.00 €');
    expect(screenText).toContain('-25.00 €');
    expect(screenText).not.toContain('+125.00 €');
    expect(screenText).not.toContain('-35.00 €');
  });

  it('applies the This week History period filter to additions and expenses', async () => {
    const today = new Date();
    const olderThanThisWeek = getPastDate(8);

    mockPeriodScopeStoreState.selectedPeriod = 'this_week';
    mockBalanceStoreState.balanceEntries = [
      createBalanceEntry({
        id: 'balance-this-week',
        amount: 125,
        createdAt: today.getTime(),
      }),
      createBalanceEntry({
        id: 'balance-old',
        amount: 75,
        createdAt: olderThanThisWeek.getTime(),
      }),
    ];
    mockTransactionsStoreState.transactions = [
      createTransaction({
        id: 'txn-this-week',
        amount: 35,
        createdAt: today.getTime(),
      }),
      createTransaction({
        id: 'txn-old',
        amount: 25,
        createdAt: olderThanThisWeek.getTime(),
      }),
    ];

    const renderer = await renderHomeScreen();
    const screenText = getNodeText(renderer.root);

    expect(screenText).toContain('+125.00 €');
    expect(screenText).toContain('-35.00 €');
    expect(screenText).not.toContain('+75.00 €');
    expect(screenText).not.toContain('-25.00 €');
  });

  it('keeps transaction edit and delete affordances testable', async () => {
    mockTransactionsStoreState.transactions = [
      createTransaction({
        id: 'txn-1',
        amount: 20,
        createdAt: new Date().getTime(),
      }),
    ];

    const renderer = await renderHomeScreen();
    const editAction = findNodeByProp(
      renderer,
      'accessibilityLabel',
      'Edit transaction',
    );
    const deleteAction = findNodeByProp(
      renderer,
      'accessibilityLabel',
      'Delete transaction',
    );

    await act(async () => {
      getPressHandler(editAction)();
      await flushPromises();
    });

    expect(mockRouter.push).toHaveBeenCalledWith('/transaction/txn-1/edit');

    await act(async () => {
      getPressHandler(deleteAction)();
      await flushPromises();
    });

    expect(mockAlert).toHaveBeenCalledWith(
      'Delete transaction?',
      expect.any(String),
      expect.any(Array),
    );
  });

  it('keeps balance addition edit and delete affordances testable', async () => {
    mockBalanceStoreState.balanceEntries = [
      createBalanceEntry({
        id: 'balance-1',
        amount: 100,
        createdAt: new Date().getTime(),
      }),
    ];

    const renderer = await renderHomeScreen();
    expect(
      findNodeByProp(renderer, 'testID', 'balance-history-row-balance-1'),
    ).toBeTruthy();

    const editAction = findNodeByProp(
      renderer,
      'accessibilityLabel',
      'Edit balance addition',
    );
    const deleteAction = findNodeByProp(
      renderer,
      'accessibilityLabel',
      'Delete balance addition',
    );

    await act(async () => {
      getPressHandler(editAction)();
      await flushPromises();
    });

    expect(mockRouter.push).toHaveBeenCalledWith('/balance/balance-1/edit');

    await act(async () => {
      getPressHandler(deleteAction)();
      await flushPromises();
    });

    expect(mockAlert).toHaveBeenCalledWith(
      'Delete balance addition?',
      expect.any(String),
      expect.any(Array),
    );

    const alertButtons = mockAlert.mock.calls.at(-1)?.[2] as
      | { onPress?: () => void; text: string }[]
      | undefined;
    const confirmDeleteButton = alertButtons?.find((button) => {
      return button.text === 'Delete';
    });

    await act(async () => {
      confirmDeleteButton?.onPress?.();
      await flushPromises();
    });

    expect(mockRemoveBalanceEntry).toHaveBeenCalledWith('balance-1');
  });

  it('uses a safe fallback type name for missing balance types', async () => {
    mockBalanceStoreState.balanceEntries = [
      createBalanceEntry({
        id: 'balance-missing-type',
        typeId: 'missing-type',
        createdAt: new Date().getTime(),
      }),
    ];

    const renderer = await renderHomeScreen();

    expect(getNodeText(renderer.root)).toContain('Balance addition');
  });

  it('does not render raw store errors on Home', async () => {
    mockTransactionsStoreState.error =
      'raw backend owner_id token deviceIds row payload';

    const renderer = await renderHomeScreen();
    const screenText = getNodeText(renderer.root);

    expect(screenText).toContain('Something went wrong while loading Home.');
    expect(screenText).not.toContain('owner_id');
    expect(screenText).not.toContain('deviceIds');
    expect(screenText).not.toContain('row payload');
  });
});
