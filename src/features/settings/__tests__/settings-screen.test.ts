import {
  afterAll,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import * as React from 'react';
import { Alert, Linking, View } from 'react-native';
import {
  act,
  create,
  type ReactTestInstance,
  type ReactTestRenderer,
} from 'react-test-renderer';

import { SettingsScreen } from '@/features/settings/settings-screen';
import { APP_LINKS } from '@/lib/app-links';

type MockReminderPermissionStatus =
  | 'granted'
  | 'denied'
  | 'undetermined'
  | 'unsupported';

const mockExportTransactionsCsv =
  jest.fn<(_transactions: unknown[]) => Promise<void>>();

const mockPickTransactionsCsvImport =
  jest.fn<() => Promise<{ status: 'cancelled' }>>();

const mockUseTransactionsRefresh = jest.fn();
const mockGetReminderEnabled = jest.fn<() => Promise<boolean>>();
const mockSetReminderEnabled = jest.fn<(_enabled: boolean) => Promise<void>>();

const mockGetReminderPermissionStatus =
  jest.fn<() => Promise<MockReminderPermissionStatus>>();

const mockRequestReminderPermissions =
  jest.fn<() => Promise<MockReminderPermissionStatus>>();

const mockScheduleDailyCheckInReminder = jest.fn<() => Promise<void>>();
const mockCancelDailyCheckInReminder = jest.fn<() => Promise<void>>();
const mockLoadTransactions = jest.fn<() => Promise<void>>();

const mockImportTransactions =
  jest.fn<(_transactions: unknown[]) => Promise<number>>();

const mockClearError = jest.fn();
const mockGetTransactionsStoreState = jest.fn();
const mockReact = React;
const mockView = View;

const mockTransactionsStoreState = {
  transactions: [] as unknown[],
  isLoading: false,
  isInitialized: true,
  error: null,
  loadTransactions: mockLoadTransactions,
  importTransactions: mockImportTransactions,
  clearError: mockClearError,
};

const mockUseTransactionsStore = jest.fn(
  (selector: (state: typeof mockTransactionsStoreState) => unknown) => {
    return selector(mockTransactionsStoreState);
  },
);

jest.mock('react-native-safe-area-context', () => {
  return {
    SafeAreaView: ({ children, ...props }: { children?: React.ReactNode }) => {
      return mockReact.createElement(mockView, props, children);
    },
  };
});

jest.mock('@/features/export/export-transactions-csv', () => ({
  exportTransactionsCsv: (transactions: unknown[]) => {
    return mockExportTransactionsCsv(transactions);
  },
}));

jest.mock('@/features/export/import-transactions-csv', () => ({
  IMPORT_TRANSACTIONS_UNSUPPORTED_ERROR_MESSAGE:
    'Import is only available on native platforms in this build.',
  pickTransactionsCsvImport: () => {
    return mockPickTransactionsCsvImport();
  },
}));

jest.mock('@/lib/use-transactions-refresh', () => ({
  useTransactionsRefresh: (...args: unknown[]) => {
    return mockUseTransactionsRefresh(...args);
  },
}));

jest.mock('@/lib/reminder-storage', () => ({
  getReminderEnabled: () => {
    return mockGetReminderEnabled();
  },
  setReminderEnabled: (enabled: boolean) => {
    return mockSetReminderEnabled(enabled);
  },
}));

jest.mock('@/lib/reminder-notifications', () => ({
  cancelDailyCheckInReminder: () => {
    return mockCancelDailyCheckInReminder();
  },
  getReminderPermissionStatus: () => {
    return mockGetReminderPermissionStatus();
  },
  requestReminderPermissions: () => {
    return mockRequestReminderPermissions();
  },
  scheduleDailyCheckInReminder: () => {
    return mockScheduleDailyCheckInReminder();
  },
}));

jest.mock('@/store/transactions-store', () => ({
  useTransactionsStore: Object.assign(
    (selector: (state: typeof mockTransactionsStoreState) => unknown) => {
      return mockUseTransactionsStore(selector);
    },
    {
      getState: () => mockGetTransactionsStoreState(),
    },
  ),
}));

const openUrlSpy = jest.spyOn(Linking, 'openURL');
const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
const consoleErrorSpy = jest
  .spyOn(console, 'error')
  .mockImplementation(() => {});

const mutableAppLinks = APP_LINKS as {
  PRIVACY_POLICY: string;
  SUPPORT_EMAIL: string;
};

function getNodeText(node: any): string {
  if (typeof node === 'string') return node;

  return node.children
    .map((child: any) => {
      return typeof child === 'string' ? child : getNodeText(child);
    })
    .join('');
}

function findButton(
  renderer: ReactTestRenderer,
  label: string,
): ReactTestInstance & {
  props: {
    onPress: () => void;
  };
} {
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

async function renderSettingsScreen() {
  let renderer: ReactTestRenderer | null = null;

  await act(async () => {
    renderer = create(React.createElement(SettingsScreen));
    await Promise.resolve();
  });

  if (renderer === null) {
    throw new Error('Settings screen did not render.');
  }

  return renderer;
}

async function pressButton(renderer: ReactTestRenderer, label: string) {
  await act(async () => {
    findButton(renderer, label).props.onPress();
    await Promise.resolve();
  });
}

beforeEach(() => {
  jest.clearAllMocks();

  mutableAppLinks.PRIVACY_POLICY =
    'https://quitesocial.notion.site/35357a24e62c804dab18c28d24a6c75a?source=copy_link';
  mutableAppLinks.SUPPORT_EMAIL = 'mailto:asrazdorskiy@gmail.com';

  mockLoadTransactions.mockResolvedValue(undefined);
  mockImportTransactions.mockResolvedValue(0);
  mockClearError.mockImplementation(() => {});
  mockExportTransactionsCsv.mockResolvedValue(undefined);
  mockPickTransactionsCsvImport.mockResolvedValue({ status: 'cancelled' });
  mockGetReminderEnabled.mockResolvedValue(false);
  mockSetReminderEnabled.mockResolvedValue(undefined);
  mockGetReminderPermissionStatus.mockResolvedValue('granted');
  mockRequestReminderPermissions.mockResolvedValue('granted');
  mockScheduleDailyCheckInReminder.mockResolvedValue(undefined);
  mockCancelDailyCheckInReminder.mockResolvedValue(undefined);
  mockGetTransactionsStoreState.mockReturnValue(mockTransactionsStoreState);
  openUrlSpy.mockResolvedValue(undefined);
});

afterAll(() => {
  alertSpy.mockRestore();
  consoleErrorSpy.mockRestore();
  openUrlSpy.mockRestore();
});

describe('SettingsScreen support links', () => {
  it('opens the privacy policy URL with Linking.openURL', async () => {
    const renderer = await renderSettingsScreen();

    await pressButton(renderer, 'Privacy Policy');

    expect(openUrlSpy).toHaveBeenCalledWith(mutableAppLinks.PRIVACY_POLICY);
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it('opens the support email mailto link with Linking.openURL', async () => {
    const renderer = await renderSettingsScreen();

    await pressButton(renderer, 'Contact Support');

    expect(openUrlSpy).toHaveBeenCalledWith(mutableAppLinks.SUPPORT_EMAIL);
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it('shows a safe fallback alert when Linking.openURL rejects', async () => {
    openUrlSpy.mockRejectedValueOnce(new Error('No handler'));

    const renderer = await renderSettingsScreen();

    await pressButton(renderer, 'Privacy Policy');

    expect(openUrlSpy).toHaveBeenCalledWith(mutableAppLinks.PRIVACY_POLICY);
    expect(alertSpy).toHaveBeenCalledWith("Couldn't open this link right now.");
  });

  it('shows the existing empty-link fallback alerts when links are blank', async () => {
    mutableAppLinks.PRIVACY_POLICY = '';
    mutableAppLinks.SUPPORT_EMAIL = '';

    const renderer = await renderSettingsScreen();

    await pressButton(renderer, 'Privacy Policy');
    await pressButton(renderer, 'Contact Support');

    expect(openUrlSpy).not.toHaveBeenCalled();
    expect(alertSpy).toHaveBeenNthCalledWith(
      1,
      'Privacy policy is not available yet.',
    );
    expect(alertSpy).toHaveBeenNthCalledWith(
      2,
      'Support contact is not configured.',
    );
  });
});
