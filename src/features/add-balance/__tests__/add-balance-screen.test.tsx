import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import * as React from 'react';
import { Pressable, Text, View } from 'react-native';
import {
  act,
  create,
  type ReactTestInstance,
  type ReactTestRenderer,
} from 'react-test-renderer';

import { AddBalanceScreen } from '@/features/add-balance/add-balance-screen';
import { normalizeBalanceTypeName } from '@/lib/balance-utils';
import type { BalanceEntryInput, BalanceType } from '@/types/balance';

const mockRouter = {
  back: jest.fn(),
  canGoBack: jest.fn(() => true),
  replace: jest.fn(),
};

const mockLoadBalance = jest.fn<() => Promise<void>>();
const mockAddBalanceEntry =
  jest.fn<(entry: BalanceEntryInput) => Promise<void>>();
const mockAddBalanceType =
  jest.fn<(input: { name: string }) => Promise<void>>();
const mockClearBalanceError = jest.fn();
const mockUseBalanceRefresh = jest.fn();
const mockPressable = Pressable;
const mockReact = React;
const mockSelectedTestDate = new Date(2026, 10, 12, 0, 0, 0, 0);
const mockText = Text;
const mockView = View;

type MockBalanceStoreState = {
  balanceEntries: BalanceEntryInput[];
  balanceTypes: BalanceType[];
  activeBalanceTypes: BalanceType[];
  isLoading: boolean;
  isInitialized: boolean;
  error: string | null;
  loadBalance: () => Promise<void>;
  addBalanceEntry: (entry: BalanceEntryInput) => Promise<void>;
  addBalanceType: (input: { name: string }) => Promise<void>;
  clearError: () => void;
};

const mockBalanceStoreState: MockBalanceStoreState = {
  balanceEntries: [],
  balanceTypes: [],
  activeBalanceTypes: [],
  isLoading: false,
  isInitialized: true,
  error: null,
  loadBalance: mockLoadBalance,
  addBalanceEntry: mockAddBalanceEntry,
  addBalanceType: mockAddBalanceType,
  clearError: mockClearBalanceError,
};

const mockUseBalanceStore = jest.fn(
  (selector: (state: MockBalanceStoreState) => unknown) => {
    return selector(mockBalanceStoreState);
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
  LocalDatePicker: ({
    onConfirm,
    visible,
  }: {
    onConfirm: (date: Date) => void;
    visible: boolean;
  }) => {
    if (!visible) return null;

    return mockReact.createElement(
      mockPressable,
      {
        accessibilityRole: 'button',
        onPress: () => onConfirm(mockSelectedTestDate),
        testID: 'mock-date-picker-confirm',
      },
      mockReact.createElement(mockText, null, 'Pick date'),
    );
  },
}));

jest.mock('@/lib/use-balance-refresh', () => ({
  useBalanceRefresh: (...args: unknown[]) => {
    return mockUseBalanceRefresh(...args);
  },
}));

jest.mock('@/store/balance-store', () => ({
  useBalanceStore: Object.assign(
    (selector: (state: MockBalanceStoreState) => unknown) => {
      return mockUseBalanceStore(selector);
    },
    {
      getState: () => mockBalanceStoreState,
    },
  ),
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
  };
}

function resetBalanceTypes() {
  const balanceTypes = [
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

  mockBalanceStoreState.balanceTypes = balanceTypes;
  mockBalanceStoreState.activeBalanceTypes = balanceTypes;
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

function findAccessibleButton(renderer: ReactTestRenderer, label: string) {
  return renderer.root.find((node: ReactTestInstance) => {
    return (
      typeof node.props.onPress === 'function' &&
      node.props.accessibilityLabel === label
    );
  }) as ReactTestInstance & {
    props: {
      onPress: () => void;
    };
  };
}

function findByTestID(renderer: ReactTestRenderer, testID: string) {
  return renderer.root.find((node: ReactTestInstance) => {
    return node.props.testID === testID;
  }) as ReactTestInstance & {
    props: {
      onPress: () => void;
    };
  };
}

function findSelectedTypeButton(renderer: ReactTestRenderer, label: string) {
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

async function renderAddBalanceScreen() {
  const renderResult: { renderer: ReactTestRenderer | null } = {
    renderer: null,
  };

  await act(async () => {
    renderResult.renderer = create(React.createElement(AddBalanceScreen));
    await flushPromises();
  });

  if (!renderResult.renderer) {
    throw new Error('Add Balance screen did not render.');
  }

  return renderResult.renderer;
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

  resetBalanceTypes();

  mockRouter.canGoBack.mockReturnValue(true);
  mockBalanceStoreState.balanceEntries = [];
  mockBalanceStoreState.isLoading = false;
  mockBalanceStoreState.isInitialized = true;
  mockBalanceStoreState.error = null;

  mockAddBalanceEntry.mockResolvedValue(undefined);
  mockLoadBalance.mockResolvedValue(undefined);
  mockAddBalanceType.mockImplementation(async ({ name }) => {
    const normalizedName = normalizeBalanceTypeName(name);
    const balanceType = createBalanceType({
      id: normalizedName.toLocaleLowerCase().replace(/\s+/g, '-'),
      name: normalizedName,
      sortOrder: mockBalanceStoreState.balanceTypes.length,
    });

    mockBalanceStoreState.balanceTypes = [
      ...mockBalanceStoreState.balanceTypes,
      balanceType,
    ];
    mockBalanceStoreState.activeBalanceTypes = [
      ...mockBalanceStoreState.activeBalanceTypes,
      balanceType,
    ];
  });
});

describe('AddBalanceScreen', () => {
  it('requires an amount before saving', async () => {
    const renderer = await renderAddBalanceScreen();

    await pressButton(renderer, 'Salary');
    await pressButton(renderer, 'Save Balance');

    expectText(renderer, 'Enter an amount.');
    expect(mockAddBalanceEntry).not.toHaveBeenCalled();
  });

  it('requires an amount greater than 0', async () => {
    const renderer = await renderAddBalanceScreen();

    await enterText(renderer, '0.00', '0');
    await pressButton(renderer, 'Salary');
    await pressButton(renderer, 'Save Balance');

    expectText(renderer, 'Amount must be greater than 0.');
    expect(mockAddBalanceEntry).not.toHaveBeenCalled();
  });

  it('accepts a single comma decimal amount', async () => {
    const renderer = await renderAddBalanceScreen();

    await enterText(renderer, '0.00', '100,50');
    await pressButton(renderer, 'Salary');
    await pressButton(renderer, 'Save Balance');

    expect(mockAddBalanceEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 100.5,
        typeId: 'salary',
      }),
    );
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
  });

  it('saves the selected date as createdAt', async () => {
    const renderer = await renderAddBalanceScreen();

    await pressAccessibleButton(renderer, 'Choose balance date');

    await act(async () => {
      findByTestID(renderer, 'mock-date-picker-confirm').props.onPress();
      await flushPromises();
    });

    await enterText(renderer, '0.00', '100');
    await pressButton(renderer, 'Salary');
    await pressButton(renderer, 'Save Balance');

    expect(mockAddBalanceEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        createdAt: mockSelectedTestDate.getTime(),
      }),
    );
  });

  it('requires a type before saving', async () => {
    const renderer = await renderAddBalanceScreen();

    await enterText(renderer, '0.00', '100');
    await pressButton(renderer, 'Save Balance');

    expectText(renderer, 'Choose a type.');
    expect(mockAddBalanceEntry).not.toHaveBeenCalled();
  });

  it('saves a selected default type', async () => {
    const renderer = await renderAddBalanceScreen();

    await enterText(renderer, '0.00', '150');
    await pressButton(renderer, 'Investment');
    await pressButton(renderer, 'Save Balance');

    expect(mockAddBalanceEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 150,
        typeId: 'investment',
      }),
    );
  });

  it('validates empty and duplicate custom type names', async () => {
    const renderer = await renderAddBalanceScreen();

    await pressButton(renderer, 'Add');
    await pressButton(renderer, 'Save Type');

    expectText(renderer, 'Balance type name is required.');
    expect(mockAddBalanceType).not.toHaveBeenCalled();

    await enterText(renderer, 'Bonus', ' salary ');
    await pressButton(renderer, 'Save Type');

    expectText(
      renderer,
      'An active balance type with this name already exists.',
    );
    expect(mockAddBalanceType).not.toHaveBeenCalled();
  });

  it('auto-selects a custom type and uses it for saving', async () => {
    const renderer = await renderAddBalanceScreen();

    await pressButton(renderer, 'Add');
    await enterText(renderer, 'Bonus', 'Bonus');
    await pressButton(renderer, 'Save Type');

    expect(findSelectedTypeButton(renderer, 'Bonus')).toBeTruthy();

    await enterText(renderer, '0.00', '75');
    await pressButton(renderer, 'Save Balance');

    expect(mockAddBalanceType).toHaveBeenCalledWith({ name: 'Bonus' });
    expect(mockAddBalanceEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 75,
        typeId: 'bonus',
      }),
    );
  });

  it('falls back to tabs when there is no back stack after save', async () => {
    mockRouter.canGoBack.mockReturnValue(false);

    const renderer = await renderAddBalanceScreen();

    await enterText(renderer, '0.00', '100');
    await pressButton(renderer, 'Regalo');
    await pressButton(renderer, 'Save Balance');

    expect(mockRouter.back).not.toHaveBeenCalled();
    expect(mockRouter.replace).toHaveBeenCalledWith('/(tabs)');
  });
});
