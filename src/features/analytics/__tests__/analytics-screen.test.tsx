import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import * as React from 'react';
import { StyleSheet, View } from 'react-native';
import {
  act,
  create,
  type ReactTestInstance,
  type ReactTestRenderer,
} from 'react-test-renderer';

import { AnalyticsScreen } from '@/features/analytics/analytics-screen';
import type { BalanceEntry, BalanceType } from '@/types/balance';
import type { Category } from '@/types/category';
import type { Transaction } from '@/types/transaction';

const mockRouter = {
  push: jest.fn(),
};

const mockLoadBalance = jest.fn<() => Promise<void>>();
const mockLoadCategories = jest.fn<() => Promise<void>>();
const mockLoadTransactions = jest.fn<() => Promise<void>>();
const mockUseBalanceRefresh = jest.fn();
const mockUseCategoriesRefresh = jest.fn();
const mockUseTransactionsRefresh = jest.fn();
const mockReact = React;
const mockView = View;
const mockSymbolView = jest.fn(
  ({
    fallback,
    testID,
  }: {
    fallback?: React.ReactNode;
    name?: string;
    testID?: string;
  }) => mockReact.createElement(mockView, { testID }, fallback),
);
const mockLocalDatePicker = jest.fn(
  (props: { mode?: string; onCancel: () => void; visible: boolean }) => {
    const { visible } = props;

    return visible
      ? mockReact.createElement(mockView, {
          testID: 'local-date-picker',
        })
      : null;
  },
);

type MockBalanceStoreState = {
  activeBalanceTypes: BalanceType[];
  balanceEntries: BalanceEntry[];
  balanceTypes: BalanceType[];
  error: string | null;
  isInitialized: boolean;
  isLoading: boolean;
  loadBalance: () => Promise<void>;
};

type MockTransactionsStoreState = {
  error: string | null;
  isInitialized: boolean;
  isLoading: boolean;
  loadTransactions: () => Promise<void>;
  transactions: Transaction[];
};

type MockCategoriesStoreState = {
  activeCategories: Category[];
  categories: Category[];
  error: string | null;
  isInitialized: boolean;
  loadCategories: () => Promise<void>;
};

const mockBalanceStoreState: MockBalanceStoreState = {
  activeBalanceTypes: [],
  balanceEntries: [],
  balanceTypes: [],
  error: null,
  isInitialized: true,
  isLoading: false,
  loadBalance: mockLoadBalance,
};

const mockTransactionsStoreState: MockTransactionsStoreState = {
  error: null,
  isInitialized: true,
  isLoading: false,
  loadTransactions: mockLoadTransactions,
  transactions: [],
};

const mockCategoriesStoreState: MockCategoriesStoreState = {
  activeCategories: [],
  categories: [],
  error: null,
  isInitialized: true,
  loadCategories: mockLoadCategories,
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

jest.mock('expo-symbols', () => ({
  SymbolView: (props: {
    fallback?: React.ReactNode;
    name?: string;
    testID?: string;
  }) => mockSymbolView(props),
}));

jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
}));

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children, ...props }: { children?: React.ReactNode }) => {
    return mockReact.createElement(mockView, props, children);
  },
}));

jest.mock('@/components/local-date-picker', () => ({
  LocalDatePicker: (props: {
    mode?: string;
    onCancel: () => void;
    visible: boolean;
  }) => mockLocalDatePicker(props),
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

function createBalanceType(
  overrides: Partial<BalanceType> & Pick<BalanceType, 'id'>,
): BalanceType {
  return {
    id: overrides.id,
    name: overrides.name ?? overrides.id,
    createdAt: overrides.createdAt ?? 1,
    updatedAt: overrides.updatedAt ?? 1,
    isDefault: overrides.isDefault ?? false,
    isArchived: overrides.isArchived ?? false,
    sortOrder: overrides.sortOrder ?? 1,
    ownerId: overrides.ownerId ?? '',
    deletedAt: overrides.deletedAt ?? null,
    schemaVersion: overrides.schemaVersion ?? 1,
    sourceDeviceId: overrides.sourceDeviceId ?? '',
  };
}

function createBalanceEntry(
  overrides: Partial<BalanceEntry> & Pick<BalanceEntry, 'id'>,
): BalanceEntry {
  const createdAt =
    overrides.createdAt ?? new Date(2026, 3, 23, 12, 0).getTime();

  return {
    id: overrides.id,
    amount: overrides.amount ?? 100,
    typeId: overrides.typeId ?? 'salary',
    createdAt,
    ownerId: overrides.ownerId ?? '',
    updatedAt: overrides.updatedAt ?? createdAt,
    deletedAt: overrides.deletedAt ?? null,
    schemaVersion: overrides.schemaVersion ?? 1,
    sourceDeviceId: overrides.sourceDeviceId ?? '',
  };
}

function createTransaction(
  overrides: Partial<Transaction> & Pick<Transaction, 'id'>,
): Transaction {
  const createdAt =
    overrides.createdAt ?? new Date(2026, 3, 23, 12, 0).getTime();

  return {
    id: overrides.id,
    amount: overrides.amount ?? 10,
    category: overrides.category ?? 'food',
    isLeak: overrides.isLeak ?? false,
    leakReason: overrides.leakReason ?? null,
    note: overrides.note ?? null,
    createdAt,
    ownerId: overrides.ownerId ?? '',
    updatedAt: overrides.updatedAt ?? createdAt,
    deletedAt: overrides.deletedAt ?? null,
    schemaVersion: overrides.schemaVersion ?? 1,
    sourceDeviceId: overrides.sourceDeviceId ?? '',
  };
}

function createCategory(overrides: Partial<Category> & Pick<Category, 'id'>) {
  return {
    id: overrides.id,
    name: overrides.name ?? overrides.id,
    iconName: overrides.iconName ?? 'tag',
    createdAt: overrides.createdAt ?? 1,
    updatedAt: overrides.updatedAt ?? 1,
    isDefault: overrides.isDefault ?? false,
    isArchived: overrides.isArchived ?? false,
    sortOrder: overrides.sortOrder ?? 1,
    ownerId: overrides.ownerId ?? '',
    deletedAt: overrides.deletedAt ?? null,
    schemaVersion: overrides.schemaVersion ?? 1,
    sourceDeviceId: overrides.sourceDeviceId ?? '',
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

function getLatestVisibleDatePickerProps() {
  const matchingCall = [...mockLocalDatePicker.mock.calls]
    .reverse()
    .find(([props]) => props.visible);

  if (!matchingCall) {
    throw new Error('LocalDatePicker is not visible.');
  }

  return matchingCall[0];
}

function getSymbolNames() {
  return mockSymbolView.mock.calls.map(([props]) => props.name);
}

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
}

async function renderAnalyticsScreen() {
  const renderResult: { renderer: ReactTestRenderer | null } = {
    renderer: null,
  };

  await act(async () => {
    renderResult.renderer = create(React.createElement(AnalyticsScreen));
    await flushPromises();
  });

  if (!renderResult.renderer) {
    throw new Error('Analytics screen did not render.');
  }

  return renderResult.renderer;
}

async function pressByTestID(renderer: ReactTestRenderer, testID: string) {
  const node = findNodeByProp(renderer, 'testID', testID);

  await act(async () => {
    getPressHandler(node)();
    await flushPromises();
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  jest
    .spyOn(Date, 'now')
    .mockReturnValue(new Date(2026, 3, 23, 12, 0).getTime());

  mockBalanceStoreState.balanceEntries = [];
  mockBalanceStoreState.balanceTypes = [
    createBalanceType({
      id: 'salary',
      name: 'Salary',
      isDefault: true,
      sortOrder: 0,
    }),
    createBalanceType({
      id: 'investment',
      name: 'Investment',
      isDefault: true,
      sortOrder: 1,
    }),
    createBalanceType({
      id: 'regalo',
      name: 'Regalo',
      isDefault: true,
      sortOrder: 2,
    }),
  ];
  mockBalanceStoreState.activeBalanceTypes = mockBalanceStoreState.balanceTypes;
  mockBalanceStoreState.error = null;
  mockBalanceStoreState.isInitialized = true;
  mockBalanceStoreState.isLoading = false;

  mockTransactionsStoreState.transactions = [];
  mockTransactionsStoreState.error = null;
  mockTransactionsStoreState.isInitialized = true;
  mockTransactionsStoreState.isLoading = false;

  mockCategoriesStoreState.categories = [
    createCategory({
      id: 'food',
      name: 'Food',
      iconName: 'food',
      isDefault: true,
      sortOrder: 0,
    }),
    createCategory({
      id: 'shopping',
      name: 'Shopping',
      iconName: 'shopping',
      isDefault: true,
      sortOrder: 3,
    }),
  ];
  mockCategoriesStoreState.activeCategories =
    mockCategoriesStoreState.categories;
  mockCategoriesStoreState.error = null;
  mockCategoriesStoreState.isInitialized = true;
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('AnalyticsScreen', () => {
  it('renders the ML-86 title, segmented control, and default filter', async () => {
    const renderer = await renderAnalyticsScreen();
    const screenText = getNodeText(renderer.root);

    expect(screenText).toContain('Analytics & Leaks');
    expect(screenText).toContain('Today');
    expect(screenText).toContain('Week');
    expect(screenText).toContain('Month');
    expect(screenText).toContain('Custom');
    expect(screenText).toContain('All');
    expect(getLatestSymbolName('analytics-filter-icon')).toBe(
      'line.horizontal.3.decrease.circle',
    );
  });

  it('renders balance additions and transactions in a read-only ledger', async () => {
    mockBalanceStoreState.balanceEntries = [
      createBalanceEntry({
        id: 'balance-salary',
        amount: 1000,
        typeId: 'salary',
        createdAt: new Date(2026, 3, 23, 15, 45).getTime(),
      }),
    ];
    mockTransactionsStoreState.transactions = [
      createTransaction({
        id: 'txn-shopping',
        amount: 10,
        category: 'shopping',
        isLeak: true,
        leakReason: 'impulse',
        createdAt: new Date(2026, 3, 23, 10, 0).getTime(),
      }),
      createTransaction({
        id: 'txn-food',
        amount: 5,
        category: 'food',
        isLeak: false,
        leakReason: null,
        createdAt: new Date(2026, 3, 23, 9, 0).getTime(),
      }),
    ];

    const renderer = await renderAnalyticsScreen();
    const screenText = getNodeText(renderer.root);

    expect(screenText).toContain('23 April 2026');
    expect(screenText).toContain('Salary');
    expect(screenText).toContain('+1 000.00 €');
    expect(screenText).toContain('Shopping');
    expect(screenText).toContain('-10.00 €');
    expect(screenText).toContain('Leak');
    expect(screenText).toContain('Impulse');
    expect(screenText).toContain('Food');
    expect(screenText).toContain('Normal');
    expect(screenText.indexOf('Salary')).toBeLessThan(
      screenText.indexOf('Shopping'),
    );
    expect(getSymbolNames()).toEqual(
      expect.arrayContaining(['drop.halffull', 'bolt', 'hand.thumbsup']),
    );

    expect(
      StyleSheet.flatten(findTextNode(renderer, '+1 000.00 €').props.style),
    ).toMatchObject({
      color: '#2bbd50',
    });
    expect(
      StyleSheet.flatten(findTextNode(renderer, '-10.00 €').props.style),
    ).toMatchObject({
      color: '#100f10',
    });
  });

  it('filters the feed by Today, Week, and Month', async () => {
    mockTransactionsStoreState.transactions = [
      createTransaction({
        id: 'txn-today',
        amount: 10,
        createdAt: new Date(2026, 3, 23, 11, 0).getTime(),
      }),
      createTransaction({
        id: 'txn-week',
        amount: 20,
        category: 'shopping',
        createdAt: new Date(2026, 3, 20, 11, 0).getTime(),
      }),
      createTransaction({
        id: 'txn-month',
        amount: 30,
        createdAt: new Date(2026, 3, 1, 11, 0).getTime(),
      }),
    ];

    const renderer = await renderAnalyticsScreen();

    expect(getNodeText(renderer.root)).toContain('-10.00 €');
    expect(getNodeText(renderer.root)).not.toContain('-20.00 €');
    expect(getNodeText(renderer.root)).not.toContain('-30.00 €');

    await act(async () => {
      findButton(renderer, 'Week').props.onPress();
      await flushPromises();
    });

    expect(getNodeText(renderer.root)).toContain('-10.00 €');
    expect(getNodeText(renderer.root)).toContain('-20.00 €');
    expect(getNodeText(renderer.root)).not.toContain('-30.00 €');

    await act(async () => {
      findButton(renderer, 'Month').props.onPress();
      await flushPromises();
    });

    expect(getNodeText(renderer.root)).toContain('-10.00 €');
    expect(getNodeText(renderer.root)).toContain('-20.00 €');
    expect(getNodeText(renderer.root)).toContain('-30.00 €');
  });

  it('renders Custom Day, Month, Year, and Custom dates controls safely', async () => {
    const renderer = await renderAnalyticsScreen();

    await act(async () => {
      findButton(renderer, 'Custom').props.onPress();
      await flushPromises();
    });

    expect(getNodeText(renderer.root)).toContain('Choose period type');

    await pressByTestID(renderer, 'analytics-custom-type-control');
    await pressByTestID(renderer, 'analytics-custom-type-day');
    expect(getNodeText(renderer.root)).toContain('23 Apr 2026');
    await pressByTestID(renderer, 'analytics-custom-date-control');
    expect(getNodeText(renderer.root)).toContain('April 2026');
    expect(
      findNodeByProp(renderer, 'testID', 'analytics-inline-day-calendar'),
    ).toBeTruthy();
    expect(() => getLatestVisibleDatePickerProps()).toThrow(
      'LocalDatePicker is not visible.',
    );
    await pressByTestID(renderer, 'analytics-inline-day-2026-4-20');
    expect(getNodeText(renderer.root)).toContain('20 Apr 2026');
    expect(() =>
      findNodeByProp(renderer, 'testID', 'analytics-inline-day-calendar'),
    ).toThrow('Could not find node with testID.');

    await pressByTestID(renderer, 'analytics-custom-type-control');
    await pressByTestID(renderer, 'analytics-custom-type-month');
    expect(getNodeText(renderer.root)).toContain('Apr 2026');
    await pressByTestID(renderer, 'analytics-custom-date-control');
    expect(
      findNodeByProp(renderer, 'testID', 'analytics-inline-month-picker'),
    ).toBeTruthy();
    expect(() => getLatestVisibleDatePickerProps()).toThrow(
      'LocalDatePicker is not visible.',
    );
    await pressByTestID(renderer, 'analytics-inline-month-2026-6');
    expect(getNodeText(renderer.root)).toContain('Jun 2026');
    expect(() =>
      findNodeByProp(renderer, 'testID', 'analytics-inline-month-picker'),
    ).toThrow('Could not find node with testID.');

    await pressByTestID(renderer, 'analytics-custom-type-control');
    await pressByTestID(renderer, 'analytics-custom-type-year');
    expect(getNodeText(renderer.root)).toContain('2026');
    await pressByTestID(renderer, 'analytics-custom-date-control');
    expect(
      findNodeByProp(renderer, 'testID', 'analytics-inline-year-picker'),
    ).toBeTruthy();
    expect(() => getLatestVisibleDatePickerProps()).toThrow(
      'LocalDatePicker is not visible.',
    );
    await pressByTestID(renderer, 'analytics-inline-year-2024');
    expect(getNodeText(renderer.root)).toContain('2024');
    expect(() =>
      findNodeByProp(renderer, 'testID', 'analytics-inline-year-picker'),
    ).toThrow('Could not find node with testID.');

    await pressByTestID(renderer, 'analytics-custom-type-control');
    await pressByTestID(renderer, 'analytics-custom-type-custom_dates');
    expect(getNodeText(renderer.root)).toContain('23 Apr 2026 - 23 Apr 2026');
    await pressByTestID(renderer, 'analytics-custom-date-control');
    expect(
      findNodeByProp(renderer, 'testID', 'analytics-inline-range-calendar'),
    ).toBeTruthy();
    expect(() => getLatestVisibleDatePickerProps()).toThrow(
      'LocalDatePicker is not visible.',
    );
    await pressByTestID(renderer, 'analytics-inline-range-day-2026-4-20');
    expect(getNodeText(renderer.root)).toContain('20 Apr 2026 - 20 Apr 2026');
    await pressByTestID(renderer, 'analytics-inline-range-day-2026-4-26');
    expect(getNodeText(renderer.root)).toContain('20 Apr 2026 - 26 Apr 2026');
    expect(() =>
      findNodeByProp(renderer, 'testID', 'analytics-inline-range-calendar'),
    ).toThrow('Could not find node with testID.');
  });

  it('opens Filter by and applies Added, balance type, Spent, and clear filters', async () => {
    mockBalanceStoreState.balanceEntries = [
      createBalanceEntry({
        id: 'balance-salary',
        amount: 100,
        typeId: 'salary',
      }),
      createBalanceEntry({
        id: 'balance-investment',
        amount: 200,
        typeId: 'investment',
      }),
    ];
    mockTransactionsStoreState.transactions = [
      createTransaction({
        id: 'txn-food',
        amount: 10,
        category: 'food',
      }),
    ];

    const renderer = await renderAnalyticsScreen();

    await pressByTestID(renderer, 'analytics-filter-button');
    expect(getNodeText(renderer.root)).toContain('Filter by');

    await pressByTestID(renderer, 'analytics-filter-added-chip');
    await pressByTestID(renderer, 'analytics-filter-balance-type-salary');
    await pressByTestID(renderer, 'analytics-filter-apply-button');

    expect(getNodeText(renderer.root)).toContain('Added');
    expect(getNodeText(renderer.root)).toContain('Filtered by');
    expect(getNodeText(renderer.root)).toContain('Salary ×');
    expect(getNodeText(renderer.root)).toContain('+100.00 €');
    expect(getNodeText(renderer.root)).not.toContain('+200.00 €');
    expect(getNodeText(renderer.root)).not.toContain('-10.00 €');
    expect(getLatestSymbolName('analytics-filter-icon')).toBe(
      'line.horizontal.3.decrease.circle.fill',
    );

    await pressByTestID(renderer, 'analytics-clear-filter');
    expect(getNodeText(renderer.root)).toContain('All');
    expect(getNodeText(renderer.root)).toContain('+100.00 €');
    expect(getNodeText(renderer.root)).toContain('+200.00 €');
    expect(getNodeText(renderer.root)).toContain('-10.00 €');
    expect(getLatestSymbolName('analytics-filter-icon')).toBe(
      'line.horizontal.3.decrease.circle',
    );

    await pressByTestID(renderer, 'analytics-filter-button');
    await pressByTestID(renderer, 'analytics-filter-spent-chip');
    await pressByTestID(renderer, 'analytics-filter-apply-button');

    expect(getNodeText(renderer.root)).toContain('Spent');
    expect(getNodeText(renderer.root)).not.toContain('+100.00 €');
    expect(getNodeText(renderer.root)).toContain('-10.00 €');
  });

  it('applies Spent category and leak reason filters', async () => {
    mockTransactionsStoreState.transactions = [
      createTransaction({
        id: 'txn-food',
        amount: 10,
        category: 'food',
        isLeak: false,
        leakReason: null,
      }),
      createTransaction({
        id: 'txn-shopping',
        amount: 20,
        category: 'shopping',
        isLeak: true,
        leakReason: 'impulse',
      }),
    ];

    const renderer = await renderAnalyticsScreen();

    await pressByTestID(renderer, 'analytics-filter-button');
    await pressByTestID(renderer, 'analytics-filter-spent-chip');
    await pressByTestID(renderer, 'analytics-filter-kind-leak');
    await pressByTestID(renderer, 'analytics-filter-reason-impulse');
    await pressByTestID(renderer, 'analytics-filter-category-shopping');
    await pressByTestID(renderer, 'analytics-filter-apply-button');

    expect(getNodeText(renderer.root)).toContain('Spent');
    expect(getNodeText(renderer.root)).toContain('Leak / Impulse / Shopping ×');
    expect(getNodeText(renderer.root)).toContain('-20.00 €');
    expect(getNodeText(renderer.root)).not.toContain('-10.00 €');
  });

  it('renders filter and date empty states', async () => {
    mockTransactionsStoreState.transactions = [
      createTransaction({
        id: 'txn-food',
        amount: 10,
        category: 'food',
      }),
    ];

    const renderer = await renderAnalyticsScreen();

    await pressByTestID(renderer, 'analytics-filter-button');
    await pressByTestID(renderer, 'analytics-filter-added-chip');
    await pressByTestID(renderer, 'analytics-filter-balance-type-salary');
    await pressByTestID(renderer, 'analytics-filter-apply-button');

    expect(getNodeText(renderer.root)).toContain('No Transactions');
    expect(getNodeText(renderer.root)).toContain(
      'No transactions match your current filters',
    );

    mockTransactionsStoreState.transactions = [];
    mockBalanceStoreState.balanceEntries = [];

    const emptyRenderer = await renderAnalyticsScreen();

    expect(getNodeText(emptyRenderer.root)).toContain('No Transactions');
    expect(getNodeText(emptyRenderer.root)).toContain(
      'Add your transaction to see it here',
    );

    await pressByTestID(emptyRenderer, 'analytics-empty-add-transaction');

    expect(mockRouter.push).toHaveBeenCalledWith('/add-transaction');
  });
});
