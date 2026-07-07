import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import * as React from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import {
  act,
  create,
  type ReactTestInstance,
  type ReactTestRenderer,
} from 'react-test-renderer';

import { AnalyticsScreen } from '@/features/analytics/analytics-screen';
import type { SettingsCurrency } from '@/lib/settings-preferences';
import {
  findButton,
  findAllNodes,
  findByTestID,
  findNodeByProp,
  findTextNode,
  flushPromises,
  getNodeText,
} from '@/test-utils/react-test-renderer';
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
const mockUseBalanceRefresh = jest.fn();
const mockUseCategoriesRefresh = jest.fn();
const mockUseTransactionsRefresh = jest.fn();
const mockReact = React;
const mockView = View;
let mockSettingsCurrency: SettingsCurrency = 'Euro';
let mockSettingsLanguage = 'English';
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

function mockHookModule(
  exportName: string,
  hook: (...args: unknown[]) => unknown,
) {
  return {
    [exportName]: (...args: unknown[]) => hook(...args),
  };
}

function mockStoreModule<TState>(
  exportName: string,
  useStore: (selector: (state: TState) => unknown) => unknown,
) {
  return {
    [exportName]: (selector: (state: TState) => unknown) => useStore(selector),
  };
}

type MockBalanceStoreState = {
  activeBalanceTypes: BalanceType[];
  balanceEntries: BalanceEntry[];
  balanceTypes: BalanceType[];
  error: string | null;
  isInitialized: boolean;
  isLoading: boolean;
  loadBalance: () => Promise<void>;
  removeBalanceEntry: (id: string) => Promise<void>;
};

type MockTransactionsStoreState = {
  error: string | null;
  isInitialized: boolean;
  isLoading: boolean;
  loadTransactions: () => Promise<void>;
  removeTransaction: (id: string) => Promise<void>;
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
  removeBalanceEntry: mockRemoveBalanceEntry,
};

const mockTransactionsStoreState: MockTransactionsStoreState = {
  error: null,
  isInitialized: true,
  isLoading: false,
  loadTransactions: mockLoadTransactions,
  removeTransaction: mockRemoveTransaction,
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

jest.mock('@/lib/use-balance-refresh', () =>
  mockHookModule('useBalanceRefresh', (...args) =>
    mockUseBalanceRefresh(...args),
  ),
);

jest.mock('@/lib/use-categories-refresh', () =>
  mockHookModule('useCategoriesRefresh', (...args) =>
    mockUseCategoriesRefresh(...args),
  ),
);

jest.mock('@/lib/use-transactions-refresh', () =>
  mockHookModule('useTransactionsRefresh', (...args) =>
    mockUseTransactionsRefresh(...args),
  ),
);

jest.mock('@/lib/use-settings-currency', () => ({
  useSettingsCurrency: () => mockSettingsCurrency,
}));

jest.mock('@/lib/use-settings-language', () => ({
  useSettingsLanguage: () => mockSettingsLanguage,
}));

jest.mock('@/store/balance-store', () =>
  mockStoreModule<MockBalanceStoreState>('useBalanceStore', (selector) =>
    mockUseBalanceStore(selector),
  ),
);

jest.mock('@/store/transactions-store', () =>
  mockStoreModule<MockTransactionsStoreState>(
    'useTransactionsStore',
    (selector) => mockUseTransactionsStore(selector),
  ),
);

jest.mock('@/store/categories-store', () =>
  mockStoreModule<MockCategoriesStoreState>('useCategoriesStore', (selector) =>
    mockUseCategoriesStore(selector),
  ),
);

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

function getOverviewChartPaths(renderer: ReactTestRenderer) {
  return findAllNodes(renderer.root, (node) => typeof node.props.d === 'string')
    .map((node) => node.props.d as string)
    .sort();
}

function getOverviewChartCircleStrokes(renderer: ReactTestRenderer) {
  return findAllNodes(
    renderer.root,
    (node) =>
      typeof node.props.r === 'number' && typeof node.props.stroke === 'string',
  ).map((node) => node.props.stroke as string);
}

function findStyledTextInNode(node: ReactTestInstance, text: string) {
  function getStyleColor(candidate: ReactTestInstance) {
    const flattenedStyle = StyleSheet.flatten(
      candidate.props.style as { color?: unknown },
    ) as { color?: unknown };

    return flattenedStyle.color;
  }

  const textNode = findAllNodes(node, (candidate) => {
    return getNodeText(candidate) === text && Boolean(candidate.props.style);
  }).find((candidate) => Boolean(getStyleColor(candidate)));

  if (!textNode) {
    throw new Error(`Could not find styled text node ${text}.`);
  }

  return textNode;
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
  const node = findByTestID<{ onPress?: () => void }>(renderer, testID);
  const { onPress } = node.props;

  if (typeof onPress !== 'function') {
    throw new Error('Expected node to have an onPress handler.');
  }

  await act(async () => {
    onPress();
    await flushPromises();
  });
}

async function pressNode(node: ReactTestInstance) {
  const { onPress } = node.props;

  if (typeof onPress !== 'function') {
    throw new Error('Expected node to have an onPress handler.');
  }

  await act(async () => {
    onPress();
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
  mockRemoveBalanceEntry.mockResolvedValue(undefined);

  mockTransactionsStoreState.transactions = [];
  mockTransactionsStoreState.error = null;
  mockTransactionsStoreState.isInitialized = true;
  mockTransactionsStoreState.isLoading = false;
  mockRemoveTransaction.mockResolvedValue(undefined);

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
  mockSettingsCurrency = 'Euro';
  mockSettingsLanguage = 'English';
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('AnalyticsScreen', () => {
  it('renders the ML-91 title, segmented control, Overview, and Transactions', async () => {
    const renderer = await renderAnalyticsScreen();
    const screenText = getNodeText(renderer.root);

    expect(screenText).toContain('Analytics & Leaks');
    expect(screenText).toContain('Today');
    expect(screenText).toContain('Week');
    expect(screenText).toContain('Month');
    expect(screenText).toContain('Custom');
    expect(screenText).toContain('Overview');
    expect(screenText).toContain('Income');
    expect(screenText).toContain('Expenses');
    expect(screenText).toContain('Leaks');
    expect(screenText).toContain('Transactions');
    expect(getLatestSymbolName('analytics-filter-icon')).toBe(
      'line.horizontal.3.decrease.circle',
    );
  });

  it('renders balance additions and transactions in the ledger', async () => {
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
        note: 'Late-night cart',
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
    expect(screenText).toContain('Income');
    expect(screenText).toContain('Expenses');
    expect(screenText).toContain('Leaks');
    expect(screenText).toContain('+1 000.00 €');
    expect(screenText).toContain('-15.00 €');
    expect(screenText).toContain('Salary');
    expect(screenText).toContain('+1 000.00 €');
    expect(screenText).toContain('Shopping');
    expect(screenText).toContain('-10.00 €');
    expect(screenText).toContain('Leak');
    expect(screenText).toContain('Impulse');
    expect(screenText).toContain('Late-night cart');
    expect(screenText).toContain('Food');
    expect(screenText).toContain('Normal');
    expect(screenText.indexOf('Salary')).toBeLessThan(
      screenText.indexOf('Shopping'),
    );
    expect(getSymbolNames()).toEqual(
      expect.arrayContaining([
        'arrow.down.left',
        'drop.halffull',
        'bolt',
        'hand.thumbsup',
      ]),
    );
    expect(
      getLatestSymbolName('analytics-balance-entry-icon-balance-salary'),
    ).toBe('arrow.down.left');

    expect(
      StyleSheet.flatten(findTextNode(renderer, '+1 000.00 €').props.style),
    ).toMatchObject({
      color: '#2bbd50',
    });
    const shoppingRow = findByTestID(
      renderer,
      'analytics-transaction-row-txn-shopping',
    );
    const shoppingAmount = findStyledTextInNode(shoppingRow, '-10.00 €');

    expect(StyleSheet.flatten(shoppingAmount.props.style)).toMatchObject({
      color: '#100f10',
    });
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
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

    await pressNode(editAction);

    expect(mockRouter.push).toHaveBeenCalledWith(
      '/transaction/txn-shopping/edit',
    );

    await pressNode(deleteAction);

    expect(alertSpy).toHaveBeenCalledWith(
      'Delete transaction?',
      expect.any(String),
      expect.any(Array),
    );

    const alertButtons = alertSpy.mock.calls.at(-1)?.[2] as
      | { onPress?: () => void; text: string }[]
      | undefined;
    const confirmDeleteButton = alertButtons?.find((button) => {
      return button.text === 'Delete';
    });

    await act(async () => {
      confirmDeleteButton?.onPress?.();
      await flushPromises();
    });

    expect(mockRemoveTransaction).toHaveBeenCalledWith('txn-shopping');

    const balanceRow = findByTestID(
      renderer,
      'analytics-balance-row-balance-salary',
    );
    const editBalanceAction = findNodeByProp(
      renderer,
      'accessibilityLabel',
      'Edit balance addition',
    );
    const deleteBalanceAction = findNodeByProp(
      renderer,
      'accessibilityLabel',
      'Delete balance addition',
    );

    await pressNode(editBalanceAction);

    expect(mockRouter.push).toHaveBeenCalledWith(
      '/balance/balance-salary/edit',
    );

    await pressNode(deleteBalanceAction);

    expect(alertSpy).toHaveBeenCalledWith(
      'Delete balance addition?',
      expect.any(String),
      expect.any(Array),
    );

    const balanceAlertButtons = alertSpy.mock.calls.at(-1)?.[2] as
      | { onPress?: () => void; text: string }[]
      | undefined;
    const confirmBalanceDeleteButton = balanceAlertButtons?.find((button) => {
      return button.text === 'Delete';
    });

    await act(async () => {
      confirmBalanceDeleteButton?.onPress?.();
      await flushPromises();
    });

    expect(mockRemoveBalanceEntry).toHaveBeenCalledWith('balance-salary');
    expect(
      findAllNodes(
        balanceRow,
        (node) => node.props.accessibilityLabel === 'Edit transaction',
      ),
    ).toHaveLength(0);
    expect(
      findAllNodes(
        balanceRow,
        (node) => node.props.accessibilityLabel === 'Delete transaction',
      ),
    ).toHaveLength(0);
  });

  it('uses the selected currency for ledger rows and filtered rows', async () => {
    mockSettingsCurrency = 'Pound sterling';
    mockBalanceStoreState.balanceEntries = [
      createBalanceEntry({
        id: 'balance-salary',
        amount: 100,
        typeId: 'salary',
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

    expect(getNodeText(renderer.root)).toContain('+100.00 £');
    expect(getNodeText(renderer.root)).toContain('-10.00 £');

    await pressByTestID(renderer, 'analytics-filter-button');
    await pressByTestID(renderer, 'analytics-filter-added-chip');
    await pressByTestID(renderer, 'analytics-filter-apply-button');

    expect(
      getNodeText(
        findByTestID(renderer, 'analytics-balance-row-balance-salary'),
      ),
    ).toContain('+100.00 £');
    expect(() =>
      findByTestID(renderer, 'analytics-transaction-row-txn-food'),
    ).toThrow();

    await act(async () => {
      findButton(renderer, 'Week').props.onPress();
      await flushPromises();
    });

    expect(getNodeText(renderer.root)).toContain('+100.00 £');
  });

  it('disables Analytics transaction actions while deletion is pending', async () => {
    let resolveRemoveTransaction: (() => void) | null = null;
    mockRemoveTransaction.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveRemoveTransaction = resolve;
        }),
    );
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    mockTransactionsStoreState.transactions = [
      createTransaction({
        id: 'txn-food',
        amount: 10,
        category: 'food',
      }),
    ];

    const renderer = await renderAnalyticsScreen();
    await pressNode(
      findNodeByProp(renderer, 'accessibilityLabel', 'Delete transaction'),
    );

    const alertButtons = alertSpy.mock.calls.at(-1)?.[2] as
      | { onPress?: () => void; text: string }[]
      | undefined;
    const confirmDeleteButton = alertButtons?.find((button) => {
      return button.text === 'Delete';
    });

    await act(async () => {
      confirmDeleteButton?.onPress?.();
      await flushPromises();
    });

    expect(
      findNodeByProp(renderer, 'accessibilityLabel', 'Delete transaction').props
        .disabled,
    ).toBe(true);
    expect(
      findNodeByProp(renderer, 'accessibilityLabel', 'Edit transaction').props
        .disabled,
    ).toBe(true);
    expect(getNodeText(renderer.root)).toContain('Deleting...');

    await act(async () => {
      resolveRemoveTransaction?.();
      await flushPromises();
    });
  });

  it('keeps Overview period-scoped and independent from ledger filters', async () => {
    mockBalanceStoreState.balanceEntries = [
      createBalanceEntry({
        id: 'balance-salary',
        amount: 1000,
        typeId: 'salary',
      }),
    ];
    mockTransactionsStoreState.transactions = [
      createTransaction({
        id: 'txn-food',
        amount: 10,
        category: 'food',
      }),
      createTransaction({
        id: 'txn-shopping',
        amount: 20,
        category: 'shopping',
        isLeak: true,
        leakReason: 'impulse',
      }),
      createTransaction({
        id: 'txn-old',
        amount: 40,
        category: 'food',
        createdAt: new Date(2026, 3, 22, 12, 0).getTime(),
      }),
    ];

    const renderer = await renderAnalyticsScreen();
    const overviewText = getNodeText(
      findByTestID(renderer, 'analytics-overview-section'),
    );

    expect(overviewText).toContain('+1 000.00 €');
    expect(overviewText).toContain('-30.00 €');
    expect(overviewText).toContain('-20.00 €');
    expect(overviewText).not.toContain('-40.00 €');

    await pressByTestID(renderer, 'analytics-filter-button');
    await pressByTestID(renderer, 'analytics-filter-spent-chip');
    await pressByTestID(renderer, 'analytics-filter-kind-leak');
    await pressByTestID(renderer, 'analytics-filter-apply-button');

    expect(
      getNodeText(findByTestID(renderer, 'analytics-overview-section')),
    ).toContain('+1 000.00 €');
    expect(
      getNodeText(findByTestID(renderer, 'analytics-overview-section')),
    ).toContain('-30.00 €');
    expect(() =>
      findByTestID(renderer, 'analytics-transaction-row-txn-food'),
    ).toThrow();
    expect(
      getNodeText(
        findByTestID(renderer, 'analytics-transaction-row-txn-shopping'),
      ),
    ).toContain('-20.00 €');
  });

  it('rebuilds the Overview chart geometry when the selected period changes', async () => {
    mockBalanceStoreState.balanceEntries = [
      createBalanceEntry({
        id: 'balance-today',
        amount: 1000,
      }),
      createBalanceEntry({
        id: 'balance-month',
        amount: 5000,
        createdAt: new Date(2026, 3, 1, 12, 0).getTime(),
      }),
    ];
    mockTransactionsStoreState.transactions = [
      createTransaction({
        id: 'txn-today-leak',
        amount: 20,
        isLeak: true,
      }),
      createTransaction({
        id: 'txn-month-normal',
        amount: 700,
        createdAt: new Date(2026, 3, 1, 12, 0).getTime(),
      }),
    ];

    const renderer = await renderAnalyticsScreen();
    const todayPaths = getOverviewChartPaths(renderer);

    await act(async () => {
      findButton(renderer, 'Month').props.onPress();
      await flushPromises();
    });

    const monthPaths = getOverviewChartPaths(renderer);

    expect(todayPaths.length).toBeGreaterThan(0);
    expect(monthPaths.length).toBeGreaterThan(0);
    expect(monthPaths).not.toEqual(todayPaths);
  });

  it('renders a continuous Overview ring without segment gaps when only one total is present', async () => {
    mockBalanceStoreState.balanceEntries = [
      createBalanceEntry({
        id: 'balance-only-income',
        amount: 5000,
      }),
    ];

    const renderer = await renderAnalyticsScreen();

    expect(getOverviewChartPaths(renderer)).toEqual([]);
    expect(getOverviewChartCircleStrokes(renderer)).toContain('#34c759');
  });

  it('localizes Overview system labels without translating custom row values', async () => {
    mockSettingsLanguage = 'Spanish';
    mockBalanceStoreState.balanceTypes = [
      createBalanceType({
        id: 'freelance',
        name: 'Freelance',
      }),
    ];
    mockBalanceStoreState.activeBalanceTypes =
      mockBalanceStoreState.balanceTypes;
    mockBalanceStoreState.balanceEntries = [
      createBalanceEntry({
        id: 'balance-freelance',
        amount: 100,
        typeId: 'freelance',
      }),
    ];

    const renderer = await renderAnalyticsScreen();
    const screenText = getNodeText(renderer.root);

    expect(screenText).toContain('Resumen');
    expect(screenText).toContain('Ingresos');
    expect(screenText).toContain('Transacciones');
    expect(screenText).toContain('Freelance');
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
    expect(
      getNodeText(findByTestID(renderer, 'analytics-transaction-row-txn-week')),
    ).toContain('-20.00 €');
    expect(() =>
      findByTestID(renderer, 'analytics-transaction-row-txn-month'),
    ).toThrow();

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
    expect(getNodeText(renderer.root)).toContain('Salary ×');
    expect(
      getNodeText(
        findByTestID(renderer, 'analytics-balance-row-balance-salary'),
      ),
    ).toContain('+100.00 €');
    expect(() =>
      findByTestID(renderer, 'analytics-balance-row-balance-investment'),
    ).toThrow();
    expect(() =>
      findByTestID(renderer, 'analytics-transaction-row-txn-food'),
    ).toThrow();
    expect(getLatestSymbolName('analytics-filter-icon')).toBe(
      'line.horizontal.3.decrease.circle.fill',
    );

    await pressByTestID(renderer, 'analytics-clear-filter');
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
    expect(() =>
      findByTestID(renderer, 'analytics-balance-row-balance-salary'),
    ).toThrow();
    expect(
      getNodeText(findByTestID(renderer, 'analytics-transaction-row-txn-food')),
    ).toContain('-10.00 €');
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
