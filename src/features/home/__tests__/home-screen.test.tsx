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
const mockSymbolView = jest.fn(
  ({
    fallback,
    name,
    testID,
  }: {
    fallback?: React.ReactNode;
    name?: string;
    testID?: string;
  }) => mockReact.createElement(mockView, { testID }, fallback ?? name),
);
let mockSettingsCurrency: SettingsCurrency = 'Euro';
let mockSettingsLanguage = 'English';

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
  SymbolView: (props: {
    fallback?: React.ReactNode;
    name?: string;
    testID?: string;
  }) => mockSymbolView(props),
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

jest.mock('@/lib/use-settings-language', () => ({
  useSettingsLanguage: () => mockSettingsLanguage,
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

function findStyledTextNode(renderer: ReactTestRenderer, text: string) {
  function getStyleColor(node: ReactTestInstance) {
    const flattenedStyle = StyleSheet.flatten(
      node.props.style as { color?: unknown },
    ) as { color?: unknown };

    return flattenedStyle.color;
  }

  const node = findAllNodes(renderer.root, (candidate) => {
    return getNodeText(candidate) === text && Boolean(candidate.props.style);
  }).find((candidate) => {
    return Boolean(getStyleColor(candidate));
  });

  if (!node) {
    throw new Error(`Could not find styled text node ${text}.`);
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

function getLatestSymbolName(testID: string) {
  const matchingCall = [...mockSymbolView.mock.calls]
    .reverse()
    .find(([props]) => props.testID === testID);

  return matchingCall?.[0].name;
}

function getPastDate(daysAgo: number) {
  const date = new Date();

  date.setDate(date.getDate() - daysAgo);

  return date;
}

function formatExpectedDateHeader(date: Date) {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

function countExactTextNodes(renderer: ReactTestRenderer, text: string) {
  const matchingTestIds = new Set<string>();

  for (const candidate of findAllNodes(renderer.root, (candidate) => {
    return Boolean(
      getNodeText(candidate) === text &&
      typeof candidate.props.testID === 'string' &&
      candidate.props.testID.startsWith('home-history-date-header-'),
    );
  })) {
    matchingTestIds.add(candidate.props.testID as string);
  }

  return matchingTestIds.size;
}

async function expectHistoryAmounts({
  hidden,
  visible,
}: {
  hidden: string[];
  visible: string[];
}) {
  const renderer = await renderHomeScreen();
  const screenText = getNodeText(renderer.root);

  for (const amount of visible) {
    expect(screenText).toContain(amount);
  }

  for (const amount of hidden) {
    expect(screenText).not.toContain(amount);
  }
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
  jest.useRealTimers();
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
  mockSettingsLanguage = 'English';
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
    const screenText = getNodeText(renderer.root);

    expect(screenText).toContain('Balance');
    expect(screenText).toContain('1234.56 €');
    expect(screenText).toContain('Transactions');
    expect(screenText.indexOf('Today')).toBeLessThan(
      screenText.indexOf('Transactions'),
    );
    expect(screenText).not.toContain('History');
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

  it('does not render the removed Today summary section', async () => {
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
    expect(screenText).not.toContain('Today summary');
    expect(screenText).not.toContain('Total');
    expect(screenText).not.toContain('Leak %');
    expect(screenText).not.toContain('100%');
    expect(screenText).not.toContain('100.00 €');
  });

  it('shows safe empty values without invalid numbers', async () => {
    const renderer = await renderHomeScreen();
    const screenText = getNodeText(renderer.root);

    expect(screenText).toContain('0.00 €');
    expect(screenText).not.toContain('NaN');
    expect(screenText).not.toContain('Infinity');
    expect(screenText).not.toContain('Choose date');
    expect(screenText).toContain('Today');
    expect(screenText).toContain('Yesterday');
    expect(screenText).toContain('This week');
  });

  it('renders balance additions separately and expense rows with Analytics ledger content', async () => {
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
      createTransaction({
        id: 'txn-2',
        amount: 15,
        category: 'food',
        isLeak: false,
        leakReason: null,
        note: 'Normal note',
        createdAt: now - 1,
      }),
    ];

    const renderer = await renderHomeScreen();
    const screenText = getNodeText(renderer.root);

    expect(screenText).toContain('Salary');
    expect(screenText).toContain('+100.00 €');
    expect(screenText).toContain('Food');
    expect(screenText).toContain('-20.00 €');
    expect(screenText).toContain('-15.00 €');
    expect(screenText).toContain('Leak');
    expect(screenText).toContain('Impulse');
    expect(screenText).toContain('Hidden note');
    expect(screenText).toContain('Normal');
    expect(screenText).toContain('Normal note');
    expect(screenText.indexOf('Food')).toBeLessThan(
      screenText.indexOf('Salary'),
    );
    expect(getLatestSymbolName('transaction-category-icon-txn-1')).toBe(
      'takeoutbag.and.cup.and.straw',
    );

    expect(
      StyleSheet.flatten(findTextNode(renderer, '+100.00 €').props.style),
    ).toMatchObject({
      color: '#34c759',
    });
    expect(
      StyleSheet.flatten(findStyledTextNode(renderer, '-20.00 €').props.style),
    ).toMatchObject({
      color: '#100f10',
    });
  });

  it('renders the selected currency for balance and transaction labels', async () => {
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

  it('applies the Today Transactions period filter to additions and expenses', async () => {
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

    await expectHistoryAmounts({
      visible: ['+125.00 €', '-35.00 €'],
      hidden: ['+75.00 €', '-25.00 €'],
    });
  });

  it('renders one Today date header above visible rows', async () => {
    const today = new Date();
    const todayLabel = formatExpectedDateHeader(today);

    mockPeriodScopeStoreState.selectedPeriod = 'today';
    mockTransactionsStoreState.transactions = [
      createTransaction({
        id: 'txn-today',
        amount: 35,
        createdAt: today.getTime(),
      }),
    ];

    const renderer = await renderHomeScreen();
    const screenText = getNodeText(renderer.root);

    expect(countExactTextNodes(renderer, todayLabel)).toBe(1);
    expect(screenText.indexOf('Transactions')).toBeLessThan(
      screenText.indexOf(todayLabel),
    );
    expect(screenText.indexOf(todayLabel)).toBeLessThan(
      screenText.indexOf('Food'),
    );
  });

  it('applies the Yesterday Transactions period filter to additions and expenses', async () => {
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

    await expectHistoryAmounts({
      visible: ['+75.00 €', '-25.00 €'],
      hidden: ['+125.00 €', '-35.00 €'],
    });
  });

  it('renders the Yesterday date header above visible rows', async () => {
    const today = new Date();
    const yesterday = getPastDate(1);
    const yesterdayLabel = formatExpectedDateHeader(yesterday);

    mockPeriodScopeStoreState.selectedPeriod = 'yesterday';
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

    expect(countExactTextNodes(renderer, yesterdayLabel)).toBe(1);
    expect(screenText.indexOf(yesterdayLabel)).toBeLessThan(
      screenText.indexOf('-25.00 €'),
    );
    expect(screenText).not.toContain('-35.00 €');
  });

  it('applies the This week Transactions period filter to additions and expenses', async () => {
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

    await expectHistoryAmounts({
      visible: ['+125.00 €', '-35.00 €'],
      hidden: ['+75.00 €', '-25.00 €'],
    });
  });

  it('groups This week rows by local day newest first', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 6, 15, 12));

    const today = new Date();
    const yesterday = getPastDate(1);
    const todayLabel = formatExpectedDateHeader(today);
    const yesterdayLabel = formatExpectedDateHeader(yesterday);

    mockPeriodScopeStoreState.selectedPeriod = 'this_week';
    mockBalanceStoreState.balanceEntries = [
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
    ];

    const renderer = await renderHomeScreen();
    const screenText = getNodeText(renderer.root);

    expect(countExactTextNodes(renderer, todayLabel)).toBe(1);
    expect(countExactTextNodes(renderer, yesterdayLabel)).toBe(1);
    expect(screenText.indexOf(todayLabel)).toBeLessThan(
      screenText.indexOf('-35.00 €'),
    );
    expect(screenText.indexOf('-35.00 €')).toBeLessThan(
      screenText.indexOf(yesterdayLabel),
    );
    expect(screenText.indexOf(yesterdayLabel)).toBeLessThan(
      screenText.indexOf('+75.00 €'),
    );

    jest.useRealTimers();
  });

  it('uses one date header for expenses and balance additions from the same local day', async () => {
    const today = new Date();
    const todayLabel = formatExpectedDateHeader(today);

    mockPeriodScopeStoreState.selectedPeriod = 'today';
    mockBalanceStoreState.balanceEntries = [
      createBalanceEntry({
        id: 'balance-today',
        amount: 125,
        createdAt: today.getTime(),
      }),
    ];
    mockTransactionsStoreState.transactions = [
      createTransaction({
        id: 'txn-today',
        amount: 35,
        createdAt: today.getTime() + 1,
      }),
    ];

    const renderer = await renderHomeScreen();
    const screenText = getNodeText(renderer.root);

    expect(countExactTextNodes(renderer, todayLabel)).toBe(1);
    expect(screenText.indexOf(todayLabel)).toBeLessThan(
      screenText.indexOf('-35.00 €'),
    );
    expect(screenText.indexOf(todayLabel)).toBeLessThan(
      screenText.indexOf('+125.00 €'),
    );
  });

  it('does not render an orphan date header for an empty selected period', async () => {
    const today = new Date();
    const yesterday = getPastDate(1);
    const yesterdayLabel = formatExpectedDateHeader(yesterday);

    mockPeriodScopeStoreState.selectedPeriod = 'yesterday';
    mockTransactionsStoreState.transactions = [
      createTransaction({
        id: 'txn-today',
        amount: 35,
        createdAt: today.getTime(),
      }),
    ];

    const renderer = await renderHomeScreen();
    const screenText = getNodeText(renderer.root);

    expect(screenText).toContain('No transactions for Yesterday');
    expect(screenText).not.toContain(yesterdayLabel);
    expect(
      findAllNodes(renderer.root, (candidate) => {
        return candidate.props.testID === 'transaction-history-row-txn-today';
      }),
    ).toHaveLength(0);
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
