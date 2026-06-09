import {
  afterAll,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import * as React from 'react';
import { Alert, Linking, Platform, Text, View } from 'react-native';
import {
  act,
  create,
  type ReactTestInstance,
  type ReactTestRenderer,
} from 'react-test-renderer';

import { SettingsScreen } from '@/features/settings/settings-screen';
import { APP_LINKS } from '@/lib/app-links';
import { featureFlags } from '@/lib/feature-flags';
import type { CategoryIconName } from '@/lib/category-icons';
import type { SyncMetadata } from '@/lib/sync/sync-types';
import type {
  AuthError,
  AuthSession,
  AuthStatus,
  AuthUser,
} from '@/types/auth';
import type { Category } from '@/types/category';

type MockReminderPermissionStatus =
  | 'granted'
  | 'denied'
  | 'undetermined'
  | 'unsupported';

type MockBackupRunResult =
  | {
      status: 'succeeded';
      uploadedTransactionsCount: number;
      uploadedCategoriesCount: number;
      uploadedBalanceTypesCount: number;
      uploadedBalanceEntriesCount: number;
    }
  | {
      status: 'failed';
      payload: null;
      error: {
        code: string;
        isRecoverable: true;
        message: string;
      };
    }
  | {
      status: 'skipped';
      payload: null;
      skippedReason: string;
      isRecoverable: true;
    };

type MockRestoreRunResult =
  | {
      status: 'succeeded';
      restoredTransactionsCount: number;
      restoredCategoriesCount: number;
      restoredBalanceTypesCount: number;
      restoredBalanceEntriesCount: number;
    }
  | {
      status: 'empty';
      restoredTransactionsCount: 0;
      restoredCategoriesCount: 0;
      restoredBalanceTypesCount: 0;
      restoredBalanceEntriesCount: 0;
      isRecoverable: true;
    }
  | {
      status: 'failed';
      error: {
        code: string;
        isRecoverable: true;
        message: string;
      };
    }
  | {
      status: 'skipped';
      skippedReason: string;
      isRecoverable: true;
    };

type MockSyncRunResult =
  | {
      status: 'succeeded';
      lastSuccessfulSyncAt: number;
      pulledTransactionsCount: number;
      pulledCategoriesCount: number;
      pulledBalanceTypesCount: number;
      pulledBalanceEntriesCount: number;
      appliedTransactionsCount: number;
      appliedCategoriesCount: number;
      appliedBalanceTypesCount: number;
      appliedBalanceEntriesCount: number;
      pushedTransactionsCount: number;
      pushedCategoriesCount: number;
      pushedBalanceTypesCount: number;
      pushedBalanceEntriesCount: number;
      ignoredTransactionTombstonesCount: number;
      ignoredCategoryTombstonesCount: number;
      ignoredBalanceTypeTombstonesCount: number;
      ignoredBalanceEntryTombstonesCount: number;
      conflictsCount: number;
    }
  | {
      status: 'failed';
      error: {
        code: string;
        isRecoverable: true;
        message: string;
      };
    }
  | {
      status: 'skipped';
      skippedReason: string;
      isRecoverable: true;
    };

type MockDeleteAccountResult =
  | {
      status: 'succeeded';
    }
  | {
      status: 'failed';
      error: {
        code: string;
        isRecoverable: true;
        message: string;
      };
    }
  | {
      status: 'skipped';
      skippedReason: string;
      isRecoverable: true;
    };

const mockExportTransactionsCsv =
  jest.fn<(_transactions: unknown[]) => Promise<void>>();

const mockPickTransactionsCsvImport =
  jest.fn<() => Promise<{ status: 'cancelled' }>>();

const mockUseTransactionsRefresh = jest.fn();
const mockUseCategoriesRefresh = jest.fn();
const mockUseBalanceRefresh = jest.fn();
const mockGetLastSuccessfulBackupAt = jest.fn<() => Promise<number | null>>();
const mockGetSyncMetadata = jest.fn<() => Promise<SyncMetadata>>();
const mockGetSettingsCurrency = jest.fn<() => Promise<string>>();
const mockSetSettingsCurrency = jest.fn<(_currency: string) => Promise<void>>();
const mockGetSettingsLanguage = jest.fn<() => Promise<string>>();
const mockSetSettingsLanguage = jest.fn<(_language: string) => Promise<void>>();
const mockGetForegroundSyncEnabled = jest.fn<() => Promise<boolean>>();
const mockSetForegroundSyncEnabled =
  jest.fn<(_enabled: boolean) => Promise<void>>();

const mockSetLastSuccessfulBackupAt =
  jest.fn<(_timestamp: number) => Promise<void>>();

const mockGetReminderEnabled = jest.fn<() => Promise<boolean>>();
const mockSetReminderEnabled = jest.fn<(_enabled: boolean) => Promise<void>>();
const mockRunManualBackup =
  jest.fn<(_input: unknown) => Promise<MockBackupRunResult>>();

const mockRunManualRestore =
  jest.fn<(_input: unknown) => Promise<MockRestoreRunResult>>();

const mockRunManualSync =
  jest.fn<(_input: unknown) => Promise<MockSyncRunResult>>();

const mockRunDeleteAccount =
  jest.fn<(_input: unknown) => Promise<MockDeleteAccountResult>>();

const mockHasLocalRestoreData = jest.fn<() => Promise<boolean>>();

const mockGetReminderPermissionStatus =
  jest.fn<() => Promise<MockReminderPermissionStatus>>();

const mockRequestReminderPermissions =
  jest.fn<() => Promise<MockReminderPermissionStatus>>();

const mockScheduleDailyCheckInReminder = jest.fn<() => Promise<void>>();
const mockCancelDailyCheckInReminder = jest.fn<() => Promise<void>>();
const mockLoadTransactions = jest.fn<() => Promise<void>>();
const mockLoadCategories = jest.fn<() => Promise<void>>();
const mockLoadBalance = jest.fn<() => Promise<void>>();
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

const mockImportTransactions =
  jest.fn<(_transactions: unknown[]) => Promise<number>>();

const mockClearError = jest.fn();
const mockGetTransactionsStoreState = jest.fn();
const mockSetAuthSession = jest.fn<(_session: AuthSession) => Promise<void>>();
const mockSignOut = jest.fn<() => Promise<void>>();
const mockClearAuthError = jest.fn();
const mockReact = React;
const mockText = Text;
const mockView = View;

const mockAuthSession: AuthSession = {
  provider: 'google',
  createdAt: 1760000000000,
  expiresAt: null,
  user: {
    id: 'auth-user-test',
    provider: 'google',
    email: 'test@example.com',
    displayName: 'Test User',
    photoUrl: null,
  },
};

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

const rawServiceRoleKeyValue = ['service', 'role', 'key'].join('-');
const rawServiceRoleEnvValue = ['MONEY', 'LEAK', 'SERVICE', 'ROLE', 'KEY'].join(
  '_',
);

const rawSyncUiForbiddenValues = [
  'raw backend failure',
  'https://example.supabase.co',
  'ey-public-anon-key',
  rawServiceRoleKeyValue,
  rawServiceRoleEnvValue,
  'oauth_client_secret',
  'provider_secret',
  'access_token',
  'refresh_token',
  'provider_token',
  'apple-identity-token',
  'EXPO_PUBLIC_SUPABASE_URL',
  'EXPO_PUBLIC_SUPABASE_ANON_KEY',
  'localOwnerId',
  'deviceId',
  'ownerId',
  'auth-user-test',
  'row payload',
];

const mockAuthStoreState: {
  status: AuthStatus;
  session: AuthSession | null;
  user: AuthUser | null;
  error: AuthError | null;
  isInitialized: boolean;
  setSession: (_session: AuthSession) => Promise<void>;
  signOut: () => Promise<void>;
  clearAuthError: () => void;
} = {
  status: 'guest',
  session: null,
  user: null,
  error: null,
  isInitialized: true,
  setSession: mockSetAuthSession,
  signOut: mockSignOut,
  clearAuthError: mockClearAuthError,
};

const mockTransactionsStoreState = {
  transactions: [] as unknown[],
  isLoading: false,
  isInitialized: true,
  error: null,
  loadTransactions: mockLoadTransactions,
  importTransactions: mockImportTransactions,
  clearError: mockClearError,
};

const mockCategoriesStoreState: {
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
} = {
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

const mockBalanceStoreState = {
  isInitialized: true,
  loadBalance: mockLoadBalance,
};

const mockUseTransactionsStore = jest.fn(
  (selector: (state: typeof mockTransactionsStoreState) => unknown) => {
    return selector(mockTransactionsStoreState);
  },
);

const mockUseCategoriesStore = jest.fn(
  (selector: (state: typeof mockCategoriesStoreState) => unknown) => {
    return selector(mockCategoriesStoreState);
  },
);

const mockUseBalanceStore = jest.fn(
  (selector: (state: typeof mockBalanceStoreState) => unknown) => {
    return selector(mockBalanceStoreState);
  },
);

jest.mock('react-native-safe-area-context', () => {
  return {
    SafeAreaView: ({ children, ...props }: { children?: React.ReactNode }) => {
      return mockReact.createElement(mockView, props, children);
    },
  };
});

jest.mock('expo-symbols', () => ({
  SymbolView: ({ fallback }: { fallback?: React.ReactNode }) => fallback,
}));

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

jest.mock('@/lib/use-categories-refresh', () => ({
  useCategoriesRefresh: (...args: unknown[]) => {
    return mockUseCategoriesRefresh(...args);
  },
}));

jest.mock('@/lib/use-balance-refresh', () => ({
  useBalanceRefresh: (...args: unknown[]) => {
    return mockUseBalanceRefresh(...args);
  },
}));

jest.mock('@/lib/settings-preferences', () => {
  const languageOptions = [
    'English',
    'German',
    'Francese',
    'Spanish',
    'Portugese',
    'Italian',
    'Chinese',
    'Russian',
    'Indian',
  ];
  const currencyOptions = [
    'Euro',
    'United States dollar',
    'Canadian dollar',
    'Australian dollar',
    'Russian ruble',
    'Indian rupee',
    'Chinese yuan',
    'Pound sterling',
    'Japanese yen',
  ];
  const currencyCodes: Record<string, string> = {
    Euro: 'EUR',
    'United States dollar': 'USD',
    'Canadian dollar': 'CAD',
    'Australian dollar': 'AUD',
    'Russian ruble': 'RUB',
    'Indian rupee': 'INR',
    'Chinese yuan': 'CNY',
    'Pound sterling': 'GBP',
    'Japanese yen': 'JPY',
  };

  return {
    DEFAULT_SETTINGS_CURRENCY: 'Euro',
    DEFAULT_SETTINGS_LANGUAGE: 'English',
    SETTINGS_CURRENCY_OPTIONS: currencyOptions,
    SETTINGS_LANGUAGE_OPTIONS: languageOptions,
    getCurrencyOptionLabel: (currency: string) =>
      `${currency} (${currencyCodes[currency]})`,
    getForegroundSyncEnabled: () => mockGetForegroundSyncEnabled(),
    getSettingsCurrency: () => mockGetSettingsCurrency(),
    getSettingsLanguage: () => mockGetSettingsLanguage(),
    setForegroundSyncEnabled: (enabled: boolean) =>
      mockSetForegroundSyncEnabled(enabled),
    setSettingsCurrency: (currency: string) =>
      mockSetSettingsCurrency(currency),
    setSettingsLanguage: (language: string) =>
      mockSetSettingsLanguage(language),
  };
});

jest.mock('@/db/backup-status', () => ({
  getLastSuccessfulBackupAt: () => {
    return mockGetLastSuccessfulBackupAt();
  },
  setLastSuccessfulBackupAt: (timestamp: number) => {
    return mockSetLastSuccessfulBackupAt(timestamp);
  },
}));

jest.mock('@/db/sync-status', () => ({
  getSyncMetadata: () => {
    return mockGetSyncMetadata();
  },
}));

jest.mock('@/lib/sync/manual-backup-service', () => ({
  manualBackupService: {
    runBackup: (input: unknown) => {
      return mockRunManualBackup(input);
    },
  },
}));

jest.mock('@/lib/sync/manual-restore-service', () => ({
  manualRestoreService: {
    hasLocalData: () => {
      return mockHasLocalRestoreData();
    },
    runRestore: (input: unknown) => {
      return mockRunManualRestore(input);
    },
  },
}));

jest.mock('@/lib/sync/manual-sync-service', () => ({
  manualSyncService: {
    runIncrementalSync: (input: unknown) => {
      return mockRunManualSync(input);
    },
  },
}));

jest.mock('@/lib/account/delete-account-service', () => ({
  deleteAccountService: {
    runDeleteAccount: (input: unknown) => {
      return mockRunDeleteAccount(input);
    },
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

jest.mock('@/lib/auth/google-auth-adapter', () => ({
  getGoogleAuthSafeErrorMessage: () =>
    "Couldn't continue with Google. Try again.",
  googleAuthAdapter: {
    provider: 'google',
    isEnabled: true,
    signIn: jest.fn<() => Promise<AuthSession | null>>(),
  },
}));

jest.mock('expo-apple-authentication', () => ({
  AppleAuthenticationButton: ({
    accessibilityLabel,
    onPress,
    style,
  }: {
    accessibilityLabel?: string;
    onPress: () => void;
    style?: React.ComponentProps<typeof View>['style'];
  }) => {
    return mockReact.createElement(
      mockView as React.ComponentType<any>,
      {
        accessibilityLabel,
        onPress,
        style,
      },
      mockReact.createElement(mockText, null, 'Continue with Apple'),
    );
  },
  AppleAuthenticationButtonStyle: {
    BLACK: 2,
  },
  AppleAuthenticationButtonType: {
    CONTINUE: 1,
  },
}));

jest.mock('@/lib/auth/apple-auth-adapter', () => ({
  appleAuthAdapter: {
    provider: 'apple',
    isEnabled: true,
    isAvailable: jest.fn<() => Promise<boolean>>(),
    signIn: jest.fn<() => Promise<AuthSession | null>>(),
  },
  getAppleAuthSafeErrorMessage: () =>
    "Couldn't continue with Apple. Try again.",
}));

const mockGoogleAuthAdapter = (
  jest.requireMock('@/lib/auth/google-auth-adapter') as {
    googleAuthAdapter: {
      isEnabled: boolean;
      signIn: jest.MockedFunction<() => Promise<AuthSession | null>>;
    };
  }
).googleAuthAdapter;

const mockAppleAuthAdapter = (
  jest.requireMock('@/lib/auth/apple-auth-adapter') as {
    appleAuthAdapter: {
      isEnabled: boolean;
      isAvailable: jest.MockedFunction<() => Promise<boolean>>;
      signIn: jest.MockedFunction<() => Promise<AuthSession | null>>;
    };
  }
).appleAuthAdapter;

jest.mock('@/store/auth-store', () => ({
  useAuthStore: (selector: (state: typeof mockAuthStoreState) => unknown) => {
    return selector(mockAuthStoreState);
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

jest.mock('@/store/categories-store', () => ({
  useCategoriesStore: Object.assign(
    (selector: (state: typeof mockCategoriesStoreState) => unknown) => {
      return mockUseCategoriesStore(selector);
    },
    {
      getState: () => mockCategoriesStoreState,
    },
  ),
}));

jest.mock('@/store/balance-store', () => ({
  useBalanceStore: (
    selector: (state: typeof mockBalanceStoreState) => unknown,
  ) => {
    return mockUseBalanceStore(selector);
  },
}));

const openUrlSpy = jest.spyOn(Linking, 'openURL');
const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
const consoleErrorSpy = jest
  .spyOn(console, 'error')
  .mockImplementation(() => {});

const mutableAppLinks = APP_LINKS as {
  privacyPolicyUrl: string;
  supportEmail: string;
  supportUrl: string;
};

const mutableFeatureFlags = featureFlags as {
  googleAuthEnabled: boolean;
  appleAuthEnabled: boolean;
  backupEnabled: boolean;
  restoreEnabled: boolean;
  incrementalSyncEnabled: boolean;
};

const originalPlatformOS = Platform.OS;

function setPlatformOS(os: typeof Platform.OS) {
  Object.defineProperty(Platform, 'OS', {
    configurable: true,
    get: () => os,
  });
}

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

function findByAccessibilityLabel(
  renderer: ReactTestRenderer,
  accessibilityLabel: string,
) {
  return renderer.root.find((node: ReactTestInstance) => {
    return node.props.accessibilityLabel === accessibilityLabel;
  }) as ReactTestInstance & {
    props: {
      onPress?: () => void;
      onValueChange?: (value: boolean) => void;
    };
  };
}

function findByTestID(renderer: ReactTestRenderer, testID: string) {
  return renderer.root.find((node: ReactTestInstance) => {
    return node.props.testID === testID;
  }) as ReactTestInstance & {
    props: {
      onPress?: () => void;
    };
  };
}

function findTextInputByPlaceholder(
  renderer: ReactTestRenderer,
  placeholder: string,
) {
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

async function renderSettingsScreen() {
  let renderer: ReactTestRenderer | null = null;

  await act(async () => {
    renderer = create(React.createElement(SettingsScreen));
    await Promise.resolve();
  });

  if (renderer === null) {
    throw new Error('Settings screen did not render.');
  }

  return renderer as ReactTestRenderer;
}

async function pressButton(renderer: ReactTestRenderer, label: string) {
  await act(async () => {
    findButton(renderer, label).props.onPress();
    await Promise.resolve();
    await Promise.resolve();
  });
}

function getLastAlertButtons() {
  const alertButtons = alertSpy.mock.calls.at(-1)?.[2];

  if (!Array.isArray(alertButtons)) {
    throw new Error('Confirmation buttons were not rendered.');
  }

  return alertButtons;
}

function expectNoRawSyncUiValues(text: string) {
  for (const value of rawSyncUiForbiddenValues) {
    expect(text).not.toContain(value);
  }
}

function createDeferred<T>() {
  let resolve: (value: T) => void = () => {};
  let reject: (reason?: unknown) => void = () => {};

  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return {
    promise,
    reject,
    resolve,
  };
}

function createSucceededBackupResult({
  uploadedBalanceEntriesCount = 5,
  uploadedBalanceTypesCount = 1,
  uploadedCategoriesCount = 2,
  uploadedTransactionsCount = 3,
}: {
  uploadedBalanceEntriesCount?: number;
  uploadedBalanceTypesCount?: number;
  uploadedCategoriesCount?: number;
  uploadedTransactionsCount?: number;
} = {}): MockBackupRunResult {
  return {
    status: 'succeeded',
    uploadedTransactionsCount,
    uploadedCategoriesCount,
    uploadedBalanceTypesCount,
    uploadedBalanceEntriesCount,
  };
}

function createSucceededRestoreResult({
  restoredBalanceEntriesCount = 5,
  restoredBalanceTypesCount = 1,
  restoredCategoriesCount = 2,
  restoredTransactionsCount = 3,
}: {
  restoredBalanceEntriesCount?: number;
  restoredBalanceTypesCount?: number;
  restoredCategoriesCount?: number;
  restoredTransactionsCount?: number;
} = {}): MockRestoreRunResult {
  return {
    status: 'succeeded',
    restoredTransactionsCount,
    restoredCategoriesCount,
    restoredBalanceTypesCount,
    restoredBalanceEntriesCount,
  };
}

function createSucceededSyncResult({
  appliedBalanceEntriesCount = 0,
  appliedBalanceTypesCount = 0,
  appliedCategoriesCount = 1,
  appliedTransactionsCount = 3,
  conflictsCount = 5,
  ignoredBalanceEntryTombstonesCount = 0,
  ignoredBalanceTypeTombstonesCount = 0,
  ignoredCategoryTombstonesCount = 2,
  ignoredTransactionTombstonesCount = 7,
  lastSuccessfulSyncAt = Date.parse('2026-05-20T12:00:00.000Z'),
  pulledBalanceEntriesCount = 0,
  pulledBalanceTypesCount = 0,
  pulledCategoriesCount = 1,
  pulledTransactionsCount = 2,
  pushedBalanceEntriesCount = 0,
  pushedBalanceTypesCount = 0,
  pushedCategoriesCount = 3,
  pushedTransactionsCount = 4,
}: Partial<
  Extract<MockSyncRunResult, { status: 'succeeded' }>
> = {}): MockSyncRunResult {
  return {
    status: 'succeeded',
    lastSuccessfulSyncAt,
    pulledTransactionsCount,
    pulledCategoriesCount,
    pulledBalanceTypesCount,
    pulledBalanceEntriesCount,
    appliedTransactionsCount,
    appliedCategoriesCount,
    appliedBalanceTypesCount,
    appliedBalanceEntriesCount,
    pushedTransactionsCount,
    pushedCategoriesCount,
    pushedBalanceTypesCount,
    pushedBalanceEntriesCount,
    ignoredTransactionTombstonesCount,
    ignoredCategoryTombstonesCount,
    ignoredBalanceTypeTombstonesCount,
    ignoredBalanceEntryTombstonesCount,
    conflictsCount,
  };
}

function createEmptySyncMetadata(): SyncMetadata {
  return {
    lastSuccessfulSyncAt: null,
    lastSyncErrorAt: null,
    lastSyncSummary: null,
    lastSuccessfulSyncSource: null,
  };
}

function createCorruptedSyncMetadata(): SyncMetadata {
  return {
    lastSuccessfulSyncAt: Date.parse('2026-05-19T12:00:00.000Z'),
    lastSyncErrorAt: null,
    lastSuccessfulSyncSource:
      'raw backend failure' as unknown as SyncMetadata['lastSuccessfulSyncSource'],
    lastSyncSummary: {
      completedAt: 'auth-user-test',
      cursor: Date.parse('2026-05-20T12:00:00.000Z'),
      pulledTransactionsCount: 'localOwnerId',
      pulledCategoriesCount: 1,
      appliedTransactionsCount: 1,
      appliedCategoriesCount: 1,
      pushedTransactionsCount: 1,
      pushedCategoriesCount: 1,
      ignoredTransactionTombstonesCount: 1,
      ignoredCategoryTombstonesCount: 1,
      conflictsCount: 1,
      deviceId: 'deviceId',
      ownerId: 'ownerId',
      localOwnerId: 'localOwnerId',
      serviceRoleKey: rawServiceRoleKeyValue,
      serviceRoleEnv: rawServiceRoleEnvValue,
      supabaseUrl: 'https://example.supabase.co',
      supabaseAnonKey: 'ey-public-anon-key',
      supabaseAnonEnv: 'EXPO_PUBLIC_SUPABASE_ANON_KEY',
      oauthClientSecret: 'oauth_client_secret',
      providerSecret: 'provider_secret',
      access_token: 'access_token',
      refresh_token: 'refresh_token',
      provider_token: 'provider_token',
      apple_identity_token: 'apple-identity-token',
      rawUserId: 'auth-user-test',
      rawBackendError: 'raw backend failure',
      rowPayload: 'row payload',
    } as unknown as SyncMetadata['lastSyncSummary'],
  };
}

async function flushAsyncWork() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

beforeEach(() => {
  jest.clearAllMocks();

  setPlatformOS('ios');
  mutableFeatureFlags.googleAuthEnabled = true;
  mutableFeatureFlags.appleAuthEnabled = true;
  mutableFeatureFlags.backupEnabled = true;
  mutableFeatureFlags.restoreEnabled = true;
  mutableFeatureFlags.incrementalSyncEnabled = false;

  mutableAppLinks.privacyPolicyUrl =
    'https://www.notion.so/quitesocial/35357a24e62c804dab18c28d24a6c75a?showMoveTo=true&saveParent=true';
  mutableAppLinks.supportEmail = 'asrazdorskiy@gmail.com';
  mutableAppLinks.supportUrl = 'mailto:asrazdorskiy@gmail.com';

  mockLoadTransactions.mockResolvedValue(undefined);
  mockLoadCategories.mockResolvedValue(undefined);
  mockLoadBalance.mockResolvedValue(undefined);
  mockImportTransactions.mockResolvedValue(0);
  mockClearError.mockImplementation(() => {});
  mockExportTransactionsCsv.mockResolvedValue(undefined);
  mockPickTransactionsCsvImport.mockResolvedValue({ status: 'cancelled' });
  mockGetLastSuccessfulBackupAt.mockResolvedValue(null);
  mockGetSyncMetadata.mockResolvedValue(createEmptySyncMetadata());
  mockGetSettingsCurrency.mockResolvedValue('Euro');
  mockSetSettingsCurrency.mockResolvedValue(undefined);
  mockGetSettingsLanguage.mockResolvedValue('English');
  mockSetSettingsLanguage.mockResolvedValue(undefined);
  mockGetForegroundSyncEnabled.mockResolvedValue(true);
  mockSetForegroundSyncEnabled.mockResolvedValue(undefined);
  mockSetLastSuccessfulBackupAt.mockResolvedValue(undefined);
  mockRunManualBackup.mockResolvedValue(createSucceededBackupResult());
  mockRunManualRestore.mockResolvedValue(createSucceededRestoreResult());
  mockRunManualSync.mockResolvedValue(createSucceededSyncResult());
  mockRunDeleteAccount.mockResolvedValue({ status: 'succeeded' });
  mockHasLocalRestoreData.mockResolvedValue(false);
  mockAddCategory.mockResolvedValue(undefined);
  mockUpdateCategory.mockResolvedValue(undefined);
  mockArchiveCategory.mockResolvedValue(undefined);
  mockGetReminderEnabled.mockResolvedValue(false);
  mockSetReminderEnabled.mockResolvedValue(undefined);
  mockGetReminderPermissionStatus.mockResolvedValue('granted');
  mockRequestReminderPermissions.mockResolvedValue('granted');
  mockScheduleDailyCheckInReminder.mockResolvedValue(undefined);
  mockCancelDailyCheckInReminder.mockResolvedValue(undefined);
  mockGetTransactionsStoreState.mockReturnValue(mockTransactionsStoreState);
  mockSetAuthSession.mockResolvedValue(undefined);
  mockSignOut.mockResolvedValue(undefined);
  mockClearAuthError.mockImplementation(() => {});
  mockGoogleAuthAdapter.isEnabled = true;
  mockGoogleAuthAdapter.signIn.mockResolvedValue(null);
  mockAppleAuthAdapter.isEnabled = true;
  mockAppleAuthAdapter.isAvailable.mockResolvedValue(true);
  mockAppleAuthAdapter.signIn.mockResolvedValue(null);
  mockAuthStoreState.status = 'guest';
  mockAuthStoreState.session = null;
  mockAuthStoreState.user = null;
  mockAuthStoreState.error = null;
  mockCategoriesStoreState.categories = [
    createCategory({
      id: 'food',
      name: 'Food',
      iconName: 'food',
      isDefault: true,
      sortOrder: 0,
    }),
    createCategory({
      id: 'coffee',
      name: 'Coffee',
      iconName: 'coffee',
      sortOrder: 1,
    }),
    createCategory({
      id: 'other',
      name: 'Other',
      iconName: 'other',
      isDefault: true,
      sortOrder: 2,
    }),
  ];
  mockCategoriesStoreState.activeCategories =
    mockCategoriesStoreState.categories;
  mockCategoriesStoreState.isLoading = false;
  mockCategoriesStoreState.isInitialized = true;
  mockCategoriesStoreState.error = null;
  openUrlSpy.mockResolvedValue(undefined);
});

afterAll(() => {
  setPlatformOS(originalPlatformOS);
  alertSpy.mockRestore();
  consoleErrorSpy.mockRestore();
  openUrlSpy.mockRestore();
});

describe('SettingsScreen support links', () => {
  it('renders General support rows in guest mode without a login wall', async () => {
    const renderer = await renderSettingsScreen();
    const text = getNodeText(renderer.root);

    expect(text).toContain('General');
    expect(text).toContain('Privacy policy');
    expect(text).toContain('Support');
    expect(text).toContain('Using local guest mode on this device.');
    expect(text).toContain('Delete account');
    expectNoRawSyncUiValues(text);
  });

  it('renders General support rows in authenticated mode', async () => {
    mockAuthStoreState.status = 'authenticated';
    mockAuthStoreState.session = mockAuthSession;
    mockAuthStoreState.user = mockAuthSession.user;

    const renderer = await renderSettingsScreen();
    const text = getNodeText(renderer.root);

    expect(text).toContain('General');
    expect(text).toContain('Privacy policy');
    expect(text).toContain('Support');
    expect(text).toContain('test@example.com');
    expect(text).toContain('Sign out');
    expect(text).toContain('Delete account');
    expectNoRawSyncUiValues(text);
  });

  it('opens the configured privacy policy URL with Linking.openURL', async () => {
    const renderer = await renderSettingsScreen();

    await pressButton(renderer, 'Privacy policy');

    expect(openUrlSpy).toHaveBeenCalledWith(mutableAppLinks.privacyPolicyUrl);
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it('opens the configured support mailto link with Linking.openURL', async () => {
    const renderer = await renderSettingsScreen();

    await pressButton(renderer, 'Support');

    expect(openUrlSpy).toHaveBeenCalledWith(mutableAppLinks.supportUrl);
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it('shows safe inline copy when Linking.openURL rejects', async () => {
    openUrlSpy.mockRejectedValueOnce(
      new Error(rawSyncUiForbiddenValues.join(' ')),
    );

    const renderer = await renderSettingsScreen();

    await pressButton(renderer, 'Privacy policy');

    const text = getNodeText(renderer.root);
    const loggedText = JSON.stringify(consoleErrorSpy.mock.calls);

    expect(openUrlSpy).toHaveBeenCalledWith(mutableAppLinks.privacyPolicyUrl);
    expect(text).toContain("Couldn't open this link right now.");
    expectNoRawSyncUiValues(text);
    expect(loggedText).toContain('Failed to open external link');
    for (const value of rawSyncUiForbiddenValues) {
      expect(loggedText).not.toContain(value);
    }
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it('shows safe inline copy when links are blank', async () => {
    mutableAppLinks.privacyPolicyUrl = '';
    mutableAppLinks.supportUrl = '';

    const renderer = await renderSettingsScreen();

    await pressButton(renderer, 'Privacy policy');

    expect(openUrlSpy).not.toHaveBeenCalled();
    expect(getNodeText(renderer.root)).toContain(
      'Privacy policy is not available right now.',
    );

    await pressButton(renderer, 'Support');

    expect(openUrlSpy).not.toHaveBeenCalled();
    expect(getNodeText(renderer.root)).toContain(
      'Support contact is not available right now.',
    );
    expect(alertSpy).not.toHaveBeenCalled();
  });
});

describe('SettingsScreen ML-87 preferences and categories', () => {
  it('renders the Settings title and main sections', async () => {
    const renderer = await renderSettingsScreen();
    const text = getNodeText(renderer.root);

    expect(text).toContain('Settings');
    expect(text).toContain('Account');
    expect(text).toContain('Category');
    expect(text).toContain('General');
    expect(text).toContain('Daily check-in reminder');
    expect(text).toContain('Synchronization');
    expect(text).toContain('Currency');
    expect(text).toContain('Language');
  });

  it('persists the foreground synchronization preference without syncing in guest mode', async () => {
    mutableFeatureFlags.incrementalSyncEnabled = true;

    const renderer = await renderSettingsScreen();

    await act(async () => {
      findByAccessibilityLabel(
        renderer,
        'Enable synchronization when returning to the app',
      ).props.onValueChange?.(false);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockSetForegroundSyncEnabled).toHaveBeenCalledWith(false);
    expect(mockRunManualSync).not.toHaveBeenCalled();
  });

  it('opens, stages, cancels, applies, and displays the currency preference', async () => {
    const renderer = await renderSettingsScreen();

    await pressButton(renderer, 'Currency');

    expect(getNodeText(renderer.root)).toContain('Choose Currency');

    await act(async () => {
      findByTestID(
        renderer,
        'settings-currency-option-United States dollar',
      ).props.onPress?.();
      await Promise.resolve();
    });

    await act(async () => {
      findByAccessibilityLabel(renderer, 'Close sheet').props.onPress?.();
      await Promise.resolve();
    });

    expect(getNodeText(renderer.root)).toContain('Euro');
    expect(getNodeText(renderer.root)).not.toContain('United States dollar');
    expect(mockSetSettingsCurrency).not.toHaveBeenCalled();

    await pressButton(renderer, 'Currency');

    await act(async () => {
      findByTestID(
        renderer,
        'settings-currency-option-United States dollar',
      ).props.onPress?.();
      await Promise.resolve();
    });

    await act(async () => {
      findByAccessibilityLabel(renderer, 'Apply selection').props.onPress?.();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockSetSettingsCurrency).toHaveBeenCalledWith(
      'United States dollar',
    );
    expect(getNodeText(renderer.root)).toContain('United States dollar');
  });

  it('opens, stages, cancels, applies, and displays the language preference', async () => {
    const renderer = await renderSettingsScreen();

    await pressButton(renderer, 'Language');

    expect(getNodeText(renderer.root)).toContain('Choose language');

    await act(async () => {
      findByTestID(
        renderer,
        'settings-language-option-German',
      ).props.onPress?.();
      await Promise.resolve();
    });

    await act(async () => {
      findByAccessibilityLabel(renderer, 'Close sheet').props.onPress?.();
      await Promise.resolve();
    });

    expect(getNodeText(renderer.root)).toContain('English');
    expect(getNodeText(renderer.root)).not.toContain('German');
    expect(mockSetSettingsLanguage).not.toHaveBeenCalled();

    await pressButton(renderer, 'Language');

    await act(async () => {
      findByTestID(
        renderer,
        'settings-language-option-German',
      ).props.onPress?.();
      await Promise.resolve();
    });

    await act(async () => {
      findByAccessibilityLabel(renderer, 'Apply selection').props.onPress?.();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockSetSettingsLanguage).toHaveBeenCalledWith('German');
    expect(getNodeText(renderer.root)).toContain('German');
  });

  it('renders category icons and names in Settings', async () => {
    const renderer = await renderSettingsScreen();
    const text = getNodeText(renderer.root);

    expect(text).toContain('Food');
    expect(text).toContain('Coffee');
    expect(text).toContain('Other');
    expect(findByTestID(renderer, 'settings-category-icon-food')).toBeTruthy();
    expect(
      findByTestID(renderer, 'settings-category-icon-coffee'),
    ).toBeTruthy();
  });

  it('renders category rows as shrinkable swipe foreground pills', async () => {
    const renderer = await renderSettingsScreen();
    const coffeeRow = findByTestID(renderer, 'settings-category-row-coffee');
    const styleText = JSON.stringify(coffeeRow.props.style);

    expect(coffeeRow.props.onMoveShouldSetResponder).toEqual(
      expect.any(Function),
    );
    expect(styleText).toContain('backgroundColor');
    expect(styleText).toContain('width');
    expect(styleText).not.toContain('translateX');
  });

  it('adds a category with existing validation and icon picker behavior', async () => {
    const renderer = await renderSettingsScreen();

    await pressButton(renderer, 'Add');

    await act(async () => {
      findTextInputByPlaceholder(renderer, 'Coffee').props.onChangeText(
        'Travel',
      );
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

    await pressButton(renderer, 'Save');

    expect(mockAddCategory).toHaveBeenCalledWith({
      name: 'Travel',
      iconName: 'travel',
    });
  });

  it('edits a category with existing store behavior', async () => {
    const renderer = await renderSettingsScreen();

    await act(async () => {
      findByAccessibilityLabel(
        renderer,
        'Edit Coffee category',
      ).props.onPress?.();
    });

    await act(async () => {
      findByTestID(
        renderer,
        'settings-edit-category-icon-picker-expand',
      ).props.onPress?.();
    });

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

    await pressButton(renderer, 'Save');

    expect(mockUpdateCategory).toHaveBeenCalledWith('coffee', {
      name: 'Coffee Runs',
      iconName: 'snacks',
    });
  });

  it('confirms before archiving a category through the existing store behavior', async () => {
    const renderer = await renderSettingsScreen();

    await act(async () => {
      findByAccessibilityLabel(
        renderer,
        'Delete Coffee category',
      ).props.onPress?.();
    });

    expect(alertSpy).toHaveBeenCalledWith(
      'Delete category?',
      'This hides the category from new transactions. Old transactions will still show it.',
      expect.any(Array),
    );

    const alertButtons = getLastAlertButtons();

    await act(async () => {
      alertButtons[1].onPress?.();
      await Promise.resolve();
    });

    expect(mockArchiveCategory).toHaveBeenCalledWith('coffee');
  });
});

describe('SettingsScreen account section', () => {
  it('shows guest account state by default', async () => {
    const renderer = await renderSettingsScreen();

    const text = getNodeText(renderer.root);

    expect(text).toContain('Account');
    expect(text).toContain('Using local guest mode on this device.');
    expect(text).toContain('Continue with Google');
    expect(text).toContain('Continue with Apple');
    expect(text).toContain('Create backup');
    expect(text).toContain('Restore from backup');
    expect(text).not.toContain('Delete cloud account data');
    expect(text).toContain('Delete account');
    expect(text).not.toContain('googleAuthEnabled');
  });

  it('keeps guest account copy safe when auth config is unavailable', async () => {
    mockGoogleAuthAdapter.isEnabled = false;
    mockAppleAuthAdapter.isEnabled = false;

    const renderer = await renderSettingsScreen();
    const text = getNodeText(renderer.root);

    expect(text).toContain('Using local guest mode on this device.');
    expect(text).not.toContain('Continue with Google');
    expect(text).not.toContain('Continue with Apple');
    expect(text).toContain('Create backup');
    expect(text).toContain('Restore from backup');
    expect(text).not.toContain('Delete cloud account data');
    expect(text).toContain('Delete account');
    expect(text).not.toContain('googleAuthEnabled');
    expect(text).not.toContain('hasSupabaseUrl');
    expect(text).not.toContain('hasSupabaseAnonKey');
    expect(text).not.toContain('hasRedirectScheme');
    expect(text).not.toContain('hasRedirectPath');
    expect(text).not.toContain('hasIosBundleIdentifier');
    expect(text).not.toContain('hasAndroidPackage');
    expect(text).not.toContain('isGoogleAuthConfigAvailable');
    expect(text).not.toContain('https://');
    expect(text).not.toContain('ey-public-anon-key');
    expect(text).not.toContain('access_token');
    expect(text).not.toContain('refresh_token');
    expect(text).not.toContain('provider_token');
    expect(text).not.toContain('auth/callback');
    expect(text).not.toContain('com.quitesocialorg.moneyleak');
    expect(text).not.toContain('EXPO_PUBLIC_');
    expect(text).not.toContain('ownerId');
    expect(text).not.toContain('localOwnerId');
    expect(text).not.toContain('deviceId');
  });

  it('does not show diagnostics for authenticated users', async () => {
    mockGoogleAuthAdapter.isEnabled = false;
    mockAuthStoreState.status = 'authenticated';
    mockAuthStoreState.session = mockAuthSession;
    mockAuthStoreState.user = mockAuthSession.user;

    const renderer = await renderSettingsScreen();
    const text = getNodeText(renderer.root);

    expect(text).toContain('test@example.com');
    expect(text).toContain('Sign out');
    expect(text).toContain('Privacy');
    expect(text).toContain('General');
    expect(text).toContain('Delete account');
    expect(text).not.toContain('Continue with Google');
    expect(text).not.toContain('Continue with Apple');
    expect(text).not.toContain('googleAuthEnabled');
    expect(text).not.toContain('auth-user-test');
    expect(text).not.toContain('localOwnerId');
    expect(text).not.toContain('deviceId');
  });

  it('hides login buttons for authenticated Apple users', async () => {
    const appleSession: AuthSession = {
      ...mockAuthSession,
      provider: 'apple',
      user: {
        ...mockAuthSession.user,
        provider: 'apple',
        email: null,
        displayName: null,
      },
    };

    mockAuthStoreState.status = 'authenticated';
    mockAuthStoreState.session = appleSession;
    mockAuthStoreState.user = appleSession.user;

    const renderer = await renderSettingsScreen();
    const text = getNodeText(renderer.root);

    expect(text).toContain('Apple account');
    expect(text).toContain('Sign out');
    expect(text).toContain('Delete account');
    expect(text).not.toContain('Continue with Google');
    expect(text).not.toContain('Continue with Apple');
  });

  it('persists a token-free session after Google sign-in succeeds', async () => {
    mockGoogleAuthAdapter.signIn.mockResolvedValue(mockAuthSession);

    const renderer = await renderSettingsScreen();

    await pressButton(renderer, 'Continue with Google');

    expect(mockGoogleAuthAdapter.signIn).toHaveBeenCalledTimes(1);
    expect(mockSetAuthSession).toHaveBeenCalledWith(mockAuthSession);
  });

  it('does not persist a session when Google sign-in is cancelled', async () => {
    mockGoogleAuthAdapter.signIn.mockResolvedValue(null);

    const renderer = await renderSettingsScreen();

    await pressButton(renderer, 'Continue with Google');

    expect(mockGoogleAuthAdapter.signIn).toHaveBeenCalledTimes(1);
    expect(mockSetAuthSession).not.toHaveBeenCalled();
  });

  it('shows Continue with Apple on iOS when native Apple auth is available', async () => {
    const renderer = await renderSettingsScreen();
    const text = getNodeText(renderer.root);

    expect(mockAppleAuthAdapter.isAvailable).toHaveBeenCalledTimes(1);
    expect(text).toContain('Continue with Apple');
  });

  it('hides Continue with Apple on non-iOS platforms', async () => {
    setPlatformOS('android');

    const renderer = await renderSettingsScreen();
    const text = getNodeText(renderer.root);

    expect(text).toContain('Continue with Google');
    expect(text).not.toContain('Continue with Apple');
    expect(mockAppleAuthAdapter.isAvailable).not.toHaveBeenCalled();
  });

  it('hides Continue with Apple when native availability is false', async () => {
    mockAppleAuthAdapter.isAvailable.mockResolvedValueOnce(false);

    const renderer = await renderSettingsScreen();

    expect(getNodeText(renderer.root)).not.toContain('Continue with Apple');
  });

  it('persists a token-free session after Apple sign-in succeeds', async () => {
    const appleSession: AuthSession = {
      ...mockAuthSession,
      provider: 'apple',
      user: {
        ...mockAuthSession.user,
        provider: 'apple',
        email: 'relay@privaterelay.appleid.com',
        displayName: null,
      },
    };

    mockAppleAuthAdapter.signIn.mockResolvedValue(appleSession);

    const renderer = await renderSettingsScreen();

    await pressButton(renderer, 'Continue with Apple');

    expect(mockAppleAuthAdapter.signIn).toHaveBeenCalledTimes(1);
    expect(mockSetAuthSession).toHaveBeenCalledWith(appleSession);
  });

  it('does not persist a session when Apple sign-in is cancelled', async () => {
    mockAppleAuthAdapter.signIn.mockResolvedValue(null);

    const renderer = await renderSettingsScreen();

    await pressButton(renderer, 'Continue with Apple');

    expect(mockAppleAuthAdapter.signIn).toHaveBeenCalledTimes(1);
    expect(mockSetAuthSession).not.toHaveBeenCalled();
  });

  it('shows safe Apple auth failure copy without raw values', async () => {
    mockAppleAuthAdapter.signIn.mockRejectedValueOnce(
      new Error(
        'raw provider failure apple-identity-token access_token refresh_token provider_token EXPO_PUBLIC_SUPABASE_URL localOwnerId deviceId',
      ),
    );

    const renderer = await renderSettingsScreen();

    await pressButton(renderer, 'Continue with Apple');

    const text = getNodeText(renderer.root);

    expect(text).toContain("Couldn't continue with Apple. Try again.");
    expect(text).not.toContain('raw provider failure');
    expect(text).not.toContain('apple-identity-token');
    expect(text).not.toContain('access_token');
    expect(text).not.toContain('refresh_token');
    expect(text).not.toContain('provider_token');
    expect(text).not.toContain('EXPO_PUBLIC_SUPABASE_URL');
    expect(text).not.toContain('localOwnerId');
    expect(text).not.toContain('deviceId');
  });

  it('signs out through the auth store without touching local data stores', async () => {
    mutableFeatureFlags.incrementalSyncEnabled = true;
    mockAuthStoreState.status = 'authenticated';
    mockAuthStoreState.session = mockAuthSession;
    mockAuthStoreState.user = mockAuthSession.user;

    const renderer = await renderSettingsScreen();

    await pressButton(renderer, 'Sign out');

    expect(mockSignOut).toHaveBeenCalledTimes(1);
    expect(mockRunManualBackup).not.toHaveBeenCalled();
    expect(mockRunManualRestore).not.toHaveBeenCalled();
    expect(mockRunManualSync).not.toHaveBeenCalled();
    expect(mockHasLocalRestoreData).not.toHaveBeenCalled();
    expect(mockSetLastSuccessfulBackupAt).not.toHaveBeenCalled();
    expect(mockImportTransactions).not.toHaveBeenCalled();
    expect(mockExportTransactionsCsv).not.toHaveBeenCalled();
    expect(mockRunDeleteAccount).not.toHaveBeenCalled();
  });

  it('requires confirmation before deleting cloud account data', async () => {
    mockAuthStoreState.status = 'authenticated';
    mockAuthStoreState.session = mockAuthSession;
    mockAuthStoreState.user = mockAuthSession.user;

    const renderer = await renderSettingsScreen();

    await pressButton(renderer, 'Delete account');

    expect(alertSpy).toHaveBeenCalledWith(
      'Delete account data?',
      'This will delete your cloud account data and cloud backup from Money Leak. Local transactions, categories, and balance data on this device will stay here.',
      expect.any(Array),
    );
    expect(mockRunDeleteAccount).not.toHaveBeenCalled();
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  it('does not delete cloud account data when confirmation is cancelled', async () => {
    mockAuthStoreState.status = 'authenticated';
    mockAuthStoreState.session = mockAuthSession;
    mockAuthStoreState.user = mockAuthSession.user;

    const renderer = await renderSettingsScreen();

    await pressButton(renderer, 'Delete account');

    const alertButtons = getLastAlertButtons();

    await act(async () => {
      alertButtons[0].onPress?.();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockRunDeleteAccount).not.toHaveBeenCalled();
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  it('deletes cloud account data and then signs out without touching local data actions', async () => {
    mutableFeatureFlags.incrementalSyncEnabled = true;
    mockAuthStoreState.status = 'authenticated';
    mockAuthStoreState.session = mockAuthSession;
    mockAuthStoreState.user = mockAuthSession.user;

    const renderer = await renderSettingsScreen();

    await pressButton(renderer, 'Delete account');

    const alertButtons = getLastAlertButtons();

    await act(async () => {
      alertButtons[1].onPress?.();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockRunDeleteAccount).toHaveBeenCalledWith({
      auth: {
        status: 'authenticated',
        hasAuthenticatedUser: true,
      },
    });
    expect(mockSignOut).toHaveBeenCalledTimes(1);
    expect(mockRunManualBackup).not.toHaveBeenCalled();
    expect(mockRunManualRestore).not.toHaveBeenCalled();
    expect(mockRunManualSync).not.toHaveBeenCalled();
    expect(mockHasLocalRestoreData).not.toHaveBeenCalled();
    expect(mockSetLastSuccessfulBackupAt).not.toHaveBeenCalled();
    expect(mockImportTransactions).not.toHaveBeenCalled();
    expect(mockExportTransactionsCsv).not.toHaveBeenCalled();
    expect(mockLoadTransactions).not.toHaveBeenCalled();
    expect(mockLoadCategories).not.toHaveBeenCalled();
  });

  it('shows loading state while deleting cloud account data', async () => {
    const deferred = createDeferred<MockDeleteAccountResult>();

    mockAuthStoreState.status = 'authenticated';
    mockAuthStoreState.session = mockAuthSession;
    mockAuthStoreState.user = mockAuthSession.user;
    mockRunDeleteAccount.mockReturnValueOnce(deferred.promise);

    const renderer = await renderSettingsScreen();

    await pressButton(renderer, 'Delete account');

    const alertButtons = getLastAlertButtons();

    await act(async () => {
      alertButtons[1].onPress?.();
      await Promise.resolve();
    });

    expect(getNodeText(renderer.root)).toContain('Deleting account...');
    expect(mockSignOut).not.toHaveBeenCalled();

    await act(async () => {
      deferred.resolve({ status: 'succeeded' });
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });

  it('shows generic delete account failure copy without raw backend values', async () => {
    mockAuthStoreState.status = 'authenticated';
    mockAuthStoreState.session = mockAuthSession;
    mockAuthStoreState.user = mockAuthSession.user;
    mockRunDeleteAccount.mockResolvedValueOnce({
      status: 'failed',
      error: {
        code: 'remote_delete_failed',
        isRecoverable: true,
        message:
          'raw backend failure auth-user-test localOwnerId deviceId access_token refresh_token provider_token EXPO_PUBLIC_SUPABASE_URL',
      },
    });

    const renderer = await renderSettingsScreen();

    await pressButton(renderer, 'Delete account');

    const alertButtons = getLastAlertButtons();

    await act(async () => {
      alertButtons[1].onPress?.();
      await Promise.resolve();
      await Promise.resolve();
    });

    const text = getNodeText(renderer.root);

    expect(text).toContain("Couldn't delete account. Try again.");
    expect(text).not.toContain('raw backend failure');
    expect(text).not.toContain('auth-user-test');
    expect(text).not.toContain('localOwnerId');
    expect(text).not.toContain('deviceId');
    expect(text).not.toContain('access_token');
    expect(text).not.toContain('refresh_token');
    expect(text).not.toContain('provider_token');
    expect(text).not.toContain('EXPO_PUBLIC_SUPABASE_URL');
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  it('does not log raw delete account failures when the service throws', async () => {
    mockAuthStoreState.status = 'authenticated';
    mockAuthStoreState.session = mockAuthSession;
    mockAuthStoreState.user = mockAuthSession.user;
    mockRunDeleteAccount.mockRejectedValueOnce(
      new Error(
        'raw backend failure auth-user-test localOwnerId deviceId access_token refresh_token provider_token EXPO_PUBLIC_SUPABASE_URL',
      ),
    );

    const renderer = await renderSettingsScreen();

    await pressButton(renderer, 'Delete account');

    const alertButtons = getLastAlertButtons();

    await act(async () => {
      alertButtons[1].onPress?.();
      await Promise.resolve();
      await Promise.resolve();
    });

    const text = getNodeText(renderer.root);
    const loggedText = JSON.stringify(consoleErrorSpy.mock.calls);

    expect(text).toContain("Couldn't delete account. Try again.");
    expect(loggedText).toContain('Failed to delete account data');
    expect(loggedText).not.toContain('raw backend failure');
    expect(loggedText).not.toContain('auth-user-test');
    expect(loggedText).not.toContain('localOwnerId');
    expect(loggedText).not.toContain('deviceId');
    expect(loggedText).not.toContain('access_token');
    expect(loggedText).not.toContain('refresh_token');
    expect(loggedText).not.toContain('provider_token');
    expect(loggedText).not.toContain('EXPO_PUBLIC_SUPABASE_URL');
    expect(mockSignOut).not.toHaveBeenCalled();
  });
});

describe('SettingsScreen sync section', () => {
  it('hides sync UI for guest mode even when sync is enabled', async () => {
    mutableFeatureFlags.incrementalSyncEnabled = true;

    const renderer = await renderSettingsScreen();
    const text = getNodeText(renderer.root);

    expect(text).not.toContain('Sync now');
    expect(text).toContain('Synchronization');
    expect(text).toContain('Runs when you return to the app');
    expect(mockRunManualSync).not.toHaveBeenCalled();
    expect(mockGetSyncMetadata).not.toHaveBeenCalled();
  });

  it('hides sync UI for authenticated users when sync is disabled', async () => {
    mockAuthStoreState.status = 'authenticated';
    mockAuthStoreState.session = mockAuthSession;
    mockAuthStoreState.user = mockAuthSession.user;

    const renderer = await renderSettingsScreen();
    const text = getNodeText(renderer.root);

    expect(text).not.toContain('Sync now');
    expect(text).toContain('Synchronization');
    expect(text).toContain('Runs when you return to the app');
    expect(mockRunManualSync).not.toHaveBeenCalled();
    expect(mockGetSyncMetadata).not.toHaveBeenCalled();
  });

  it('shows sync UI for authenticated users when sync is enabled', async () => {
    mutableFeatureFlags.incrementalSyncEnabled = true;
    mockAuthStoreState.status = 'authenticated';
    mockAuthStoreState.session = mockAuthSession;
    mockAuthStoreState.user = mockAuthSession.user;

    const renderer = await renderSettingsScreen();
    const text = getNodeText(renderer.root);

    expect(text).toContain('Sync');
    expect(text).toContain('Synchronization');
    expect(text).toContain('Runs when you return to the app');
    expect(text).toContain('Sync now');
    expectNoRawSyncUiValues(text);
  });

  it('runs manual sync with authenticated context', async () => {
    mutableFeatureFlags.incrementalSyncEnabled = true;
    mockAuthStoreState.status = 'authenticated';
    mockAuthStoreState.session = mockAuthSession;
    mockAuthStoreState.user = mockAuthSession.user;

    const renderer = await renderSettingsScreen();

    await pressButton(renderer, 'Sync now');

    expect(mockRunManualSync).toHaveBeenCalledWith({
      auth: {
        status: 'authenticated',
        userId: 'auth-user-test',
      },
      source: 'manual',
    });
  });

  it('shows loading state while manual sync is running', async () => {
    const deferred = createDeferred<MockSyncRunResult>();

    mutableFeatureFlags.incrementalSyncEnabled = true;
    mockAuthStoreState.status = 'authenticated';
    mockAuthStoreState.session = mockAuthSession;
    mockAuthStoreState.user = mockAuthSession.user;
    mockRunManualSync.mockReturnValueOnce(deferred.promise);

    const renderer = await renderSettingsScreen();

    await pressButton(renderer, 'Sync now');

    const button = findButton(renderer, 'Syncing...');

    expect(getNodeText(renderer.root)).toContain('Syncing...');
    expect((button.props as { disabled?: boolean }).disabled).toBe(true);

    await act(async () => {
      deferred.resolve(createSucceededSyncResult());
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(getNodeText(renderer.root)).toContain('Sync now');
  });

  it('ignores overlapping manual sync presses while a sync is already running', async () => {
    const deferred = createDeferred<MockSyncRunResult>();

    mutableFeatureFlags.incrementalSyncEnabled = true;
    mockAuthStoreState.status = 'authenticated';
    mockAuthStoreState.session = mockAuthSession;
    mockAuthStoreState.user = mockAuthSession.user;
    mockRunManualSync.mockReturnValueOnce(deferred.promise);

    const renderer = await renderSettingsScreen();
    const button = findButton(renderer, 'Sync now');

    await act(async () => {
      button.props.onPress();
      button.props.onPress();
      await Promise.resolve();
    });

    expect(mockRunManualSync).toHaveBeenCalledTimes(1);

    await act(async () => {
      deferred.resolve(createSucceededSyncResult());
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockLoadTransactions).toHaveBeenCalledTimes(1);
    expect(mockLoadCategories).toHaveBeenCalledTimes(1);
    expect(mockLoadBalance).toHaveBeenCalledTimes(1);
  });

  it('shows safe manual sync summary counts after success', async () => {
    mutableFeatureFlags.incrementalSyncEnabled = true;
    mockAuthStoreState.status = 'authenticated';
    mockAuthStoreState.session = mockAuthSession;
    mockAuthStoreState.user = mockAuthSession.user;
    mockRunManualSync.mockResolvedValueOnce(
      createSucceededSyncResult({
        appliedBalanceEntriesCount: 2,
        appliedBalanceTypesCount: 1,
        appliedCategoriesCount: 1,
        appliedTransactionsCount: 3,
        conflictsCount: 5,
        ignoredBalanceEntryTombstonesCount: 1,
        ignoredBalanceTypeTombstonesCount: 1,
        ignoredCategoryTombstonesCount: 2,
        ignoredTransactionTombstonesCount: 7,
        pulledBalanceEntriesCount: 4,
        pulledBalanceTypesCount: 2,
        pulledCategoriesCount: 1,
        pulledTransactionsCount: 2,
        pushedBalanceEntriesCount: 1,
        pushedBalanceTypesCount: 2,
        pushedCategoriesCount: 3,
        pushedTransactionsCount: 4,
      }),
    );

    const renderer = await renderSettingsScreen();

    await pressButton(renderer, 'Sync now');

    const text = getNodeText(renderer.root);

    expect(text).toContain(
      'Sync complete. Pulled 9 changes. Pushed 10 changes. Applied 7 changes. Conflicts 5. Ignored 11 changes.',
    );
    expectNoRawSyncUiValues(text);
    expect(mockLoadTransactions).toHaveBeenCalledTimes(1);
    expect(mockLoadCategories).toHaveBeenCalledTimes(1);
    expect(mockLoadBalance).toHaveBeenCalledTimes(1);
  });

  it('shows last successful sync and safe summary counts from existing metadata', async () => {
    mutableFeatureFlags.incrementalSyncEnabled = true;
    mockAuthStoreState.status = 'authenticated';
    mockAuthStoreState.session = mockAuthSession;
    mockAuthStoreState.user = mockAuthSession.user;
    mockGetSyncMetadata.mockResolvedValue({
      lastSuccessfulSyncAt: Date.parse('2026-05-19T12:00:00.000Z'),
      lastSyncErrorAt: null,
      lastSuccessfulSyncSource: 'manual',
      lastSyncSummary: {
        completedAt: Date.parse('2026-05-20T12:00:00.000Z'),
        cursor: Date.parse('2026-05-20T12:00:00.000Z'),
        pulledTransactionsCount: 2,
        pulledCategoriesCount: 1,
        pulledBalanceTypesCount: 0,
        pulledBalanceEntriesCount: 0,
        appliedTransactionsCount: 3,
        appliedCategoriesCount: 1,
        appliedBalanceTypesCount: 0,
        appliedBalanceEntriesCount: 0,
        pushedTransactionsCount: 4,
        pushedCategoriesCount: 3,
        pushedBalanceTypesCount: 0,
        pushedBalanceEntriesCount: 0,
        ignoredTransactionTombstonesCount: 7,
        ignoredCategoryTombstonesCount: 2,
        ignoredBalanceTypeTombstonesCount: 0,
        ignoredBalanceEntryTombstonesCount: 0,
        conflictsCount: 5,
      },
    });

    const renderer = await renderSettingsScreen();

    await flushAsyncWork();

    const text = getNodeText(renderer.root);

    expect(text).toContain('Last sync:');
    expect(text).toContain('- Manual');
    expect(text).toContain(
      'Sync complete. Pulled 3 changes. Pushed 7 changes. Applied 4 changes. Conflicts 5. Ignored 9 changes.',
    );
    expectNoRawSyncUiValues(text);
  });

  it('shows Auto beside last successful sync for valid foreground source metadata', async () => {
    mutableFeatureFlags.incrementalSyncEnabled = true;
    mockAuthStoreState.status = 'authenticated';
    mockAuthStoreState.session = mockAuthSession;
    mockAuthStoreState.user = mockAuthSession.user;
    mockGetSyncMetadata.mockResolvedValue({
      lastSuccessfulSyncAt: Date.parse('2026-05-20T12:00:00.000Z'),
      lastSyncErrorAt: null,
      lastSyncSummary: null,
      lastSuccessfulSyncSource: 'foreground',
    });

    const renderer = await renderSettingsScreen();

    await flushAsyncWork();

    const text = getNodeText(renderer.root);

    expect(text).toContain('Last sync:');
    expect(text).toContain('- Auto');
    expectNoRawSyncUiValues(text);
  });

  it('ignores invalid persisted sync metadata safely', async () => {
    mutableFeatureFlags.incrementalSyncEnabled = true;
    mockAuthStoreState.status = 'authenticated';
    mockAuthStoreState.session = mockAuthSession;
    mockAuthStoreState.user = mockAuthSession.user;
    mockGetSyncMetadata.mockResolvedValue(createCorruptedSyncMetadata());

    const renderer = await renderSettingsScreen();

    await flushAsyncWork();

    const text = getNodeText(renderer.root);

    expect(text).toContain('Last sync:');
    expect(text).not.toContain('- Manual');
    expect(text).not.toContain('- Auto');
    expect(text).not.toContain('Sync complete.');
    expectNoRawSyncUiValues(text);
  });

  it('shows generic sync failure copy for failed and skipped service results', async () => {
    mutableFeatureFlags.incrementalSyncEnabled = true;
    mockAuthStoreState.status = 'authenticated';
    mockAuthStoreState.session = mockAuthSession;
    mockAuthStoreState.user = mockAuthSession.user;
    mockRunManualSync.mockResolvedValueOnce({
      status: 'failed',
      error: {
        code: 'remote_read_failed',
        isRecoverable: true,
        message: `raw backend failure https://example.supabase.co ey-public-anon-key ${rawServiceRoleKeyValue} ${rawServiceRoleEnvValue} oauth_client_secret provider_secret auth-user-test localOwnerId deviceId ownerId access_token refresh_token provider_token apple-identity-token EXPO_PUBLIC_SUPABASE_URL EXPO_PUBLIC_SUPABASE_ANON_KEY row payload`,
      },
    });

    const renderer = await renderSettingsScreen();

    await pressButton(renderer, 'Sync now');

    let text = getNodeText(renderer.root);

    expect(text).toContain("Couldn't sync. Try again.");
    expectNoRawSyncUiValues(text);
    expect(text).not.toContain('Sync complete.');
    expect(mockLoadTransactions).not.toHaveBeenCalled();
    expect(mockLoadCategories).not.toHaveBeenCalled();

    mockRunManualSync.mockResolvedValueOnce({
      status: 'skipped',
      skippedReason: 'missing_session',
      isRecoverable: true,
    });

    await pressButton(renderer, 'Sync now');

    text = getNodeText(renderer.root);

    expect(text).toContain("Couldn't sync. Try again.");
    expect(text).not.toContain('missing_session');
    expectNoRawSyncUiValues(text);
    expect(text).not.toContain('Sync complete.');
    expect(mockLoadTransactions).not.toHaveBeenCalled();
    expect(mockLoadCategories).not.toHaveBeenCalled();
  });

  it('does not render raw sync diagnostics when manual sync throws', async () => {
    mutableFeatureFlags.incrementalSyncEnabled = true;
    mockAuthStoreState.status = 'authenticated';
    mockAuthStoreState.session = mockAuthSession;
    mockAuthStoreState.user = mockAuthSession.user;
    mockRunManualSync.mockRejectedValueOnce(
      new Error(
        `raw backend failure https://example.supabase.co ey-public-anon-key ${rawServiceRoleKeyValue} ${rawServiceRoleEnvValue} oauth_client_secret provider_secret access_token refresh_token provider_token apple-identity-token EXPO_PUBLIC_SUPABASE_URL EXPO_PUBLIC_SUPABASE_ANON_KEY localOwnerId deviceId ownerId auth-user-test row payload`,
      ),
    );

    const renderer = await renderSettingsScreen();

    await pressButton(renderer, 'Sync now');

    const text = getNodeText(renderer.root);

    expect(text).toContain("Couldn't sync. Try again.");
    expectNoRawSyncUiValues(text);
    expect(text).not.toContain('Sync complete.');
    expect(mockLoadTransactions).not.toHaveBeenCalled();
    expect(mockLoadCategories).not.toHaveBeenCalled();
  });
});

describe('SettingsScreen backup section', () => {
  it('renders backup UI only for authenticated users when backup is enabled', async () => {
    mockAuthStoreState.status = 'authenticated';
    mockAuthStoreState.session = mockAuthSession;
    mockAuthStoreState.user = mockAuthSession.user;

    const renderer = await renderSettingsScreen();
    const text = getNodeText(renderer.root);

    expect(text).toContain('Backup');
    expect(text).toContain('Create backup');
    expect(text).not.toContain('auth-user-test');
    expect(text).not.toContain('localOwnerId');
    expect(text).not.toContain('deviceId');
  });

  it('hides backup UI when the feature flag is disabled', async () => {
    mutableFeatureFlags.backupEnabled = false;
    mockAuthStoreState.status = 'authenticated';
    mockAuthStoreState.session = mockAuthSession;
    mockAuthStoreState.user = mockAuthSession.user;

    const renderer = await renderSettingsScreen();
    const text = getNodeText(renderer.root);

    expect(text).toContain('Create backup');
    expect(mockRunManualBackup).not.toHaveBeenCalled();
  });

  it('does not let guest mode trigger remote backup writes', async () => {
    const renderer = await renderSettingsScreen();
    const text = getNodeText(renderer.root);

    expect(text).toContain('Using local guest mode on this device.');
    expect(text).toContain('Create backup');
    expect(text).toContain('Restore from backup');
    expect(mockRunManualBackup).not.toHaveBeenCalled();
    expect(mockRunManualRestore).not.toHaveBeenCalled();
  });

  it('shows loading and success states for manual backup', async () => {
    const deferred = createDeferred<MockBackupRunResult>();

    mutableFeatureFlags.incrementalSyncEnabled = true;
    mockAuthStoreState.status = 'authenticated';
    mockAuthStoreState.session = mockAuthSession;
    mockAuthStoreState.user = mockAuthSession.user;
    mockRunManualBackup.mockReturnValueOnce(deferred.promise);

    const renderer = await renderSettingsScreen();

    await pressButton(renderer, 'Create backup');

    expect(getNodeText(renderer.root)).toContain('Creating backup...');
    expect(mockRunManualBackup).toHaveBeenCalledWith({
      auth: {
        status: 'authenticated',
        userId: 'auth-user-test',
      },
    });
    expect(mockRunManualSync).not.toHaveBeenCalled();

    await act(async () => {
      deferred.resolve(
        createSucceededBackupResult({
          uploadedBalanceEntriesCount: 6,
          uploadedBalanceTypesCount: 3,
          uploadedCategoriesCount: 4,
          uploadedTransactionsCount: 2,
        }),
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    const text = getNodeText(renderer.root);

    expect(text).toContain(
      'Backup created. 2 transactions, 4 categories, 3 balance types, and 6 balance entries saved.',
    );
    expect(text).toContain('Create backup');
    expect(mockSetLastSuccessfulBackupAt).toHaveBeenCalledWith(
      expect.any(Number),
    );
  });

  it('loads and displays the last successful backup timestamp when available', async () => {
    mockGetLastSuccessfulBackupAt.mockResolvedValueOnce(
      Date.parse('2026-05-20T12:00:00.000Z'),
    );
    mockAuthStoreState.status = 'authenticated';
    mockAuthStoreState.session = mockAuthSession;
    mockAuthStoreState.user = mockAuthSession.user;

    const renderer = await renderSettingsScreen();

    await flushAsyncWork();

    expect(getNodeText(renderer.root)).toContain('Last backup:');
  });

  it('shows generic backup failure copy without raw backend values', async () => {
    mockAuthStoreState.status = 'authenticated';
    mockAuthStoreState.session = mockAuthSession;
    mockAuthStoreState.user = mockAuthSession.user;
    mockRunManualBackup.mockRejectedValueOnce(
      new Error(
        'raw backend failure auth-user-test localOwnerId deviceId access_token refresh_token provider_token EXPO_PUBLIC_SUPABASE_URL',
      ),
    );

    const renderer = await renderSettingsScreen();

    await pressButton(renderer, 'Create backup');

    const text = getNodeText(renderer.root);

    expect(text).toContain("Couldn't create backup. Try again.");
    expect(text).not.toContain('raw backend failure');
    expect(text).not.toContain('auth-user-test');
    expect(text).not.toContain('localOwnerId');
    expect(text).not.toContain('deviceId');
    expect(text).not.toContain('access_token');
    expect(text).not.toContain('refresh_token');
    expect(text).not.toContain('provider_token');
    expect(text).not.toContain('EXPO_PUBLIC_SUPABASE_URL');
  });

  it('shows generic backup failure copy for skipped service results', async () => {
    mockAuthStoreState.status = 'authenticated';
    mockAuthStoreState.session = mockAuthSession;
    mockAuthStoreState.user = mockAuthSession.user;
    mockRunManualBackup.mockResolvedValueOnce({
      status: 'skipped',
      payload: null,
      skippedReason: 'missing_user_id',
      isRecoverable: true,
    });

    const renderer = await renderSettingsScreen();

    await pressButton(renderer, 'Create backup');

    expect(getNodeText(renderer.root)).toContain(
      "Couldn't create backup. Try again.",
    );
    expect(mockSetLastSuccessfulBackupAt).not.toHaveBeenCalled();
  });
});

describe('SettingsScreen restore section', () => {
  it('renders restore UI only for authenticated users when restore is enabled', async () => {
    mockAuthStoreState.status = 'authenticated';
    mockAuthStoreState.session = mockAuthSession;
    mockAuthStoreState.user = mockAuthSession.user;

    const renderer = await renderSettingsScreen();
    const text = getNodeText(renderer.root);

    expect(text).toContain('Restore');
    expect(text).toContain('Restore from backup');
    expect(text).not.toContain('auth-user-test');
    expect(text).not.toContain('localOwnerId');
    expect(text).not.toContain('deviceId');
  });

  it('hides restore UI when the feature flag is disabled', async () => {
    mutableFeatureFlags.restoreEnabled = false;
    mockAuthStoreState.status = 'authenticated';
    mockAuthStoreState.session = mockAuthSession;
    mockAuthStoreState.user = mockAuthSession.user;

    const renderer = await renderSettingsScreen();
    const text = getNodeText(renderer.root);

    expect(text).toContain('Restore from backup');
    expect(mockHasLocalRestoreData).not.toHaveBeenCalled();
    expect(mockRunManualRestore).not.toHaveBeenCalled();
  });

  it('does not let guest mode trigger restore', async () => {
    const renderer = await renderSettingsScreen();
    const text = getNodeText(renderer.root);

    expect(text).toContain('Using local guest mode on this device.');
    expect(text).toContain('Restore from backup');
    expect(mockHasLocalRestoreData).not.toHaveBeenCalled();
    expect(mockRunManualRestore).not.toHaveBeenCalled();
  });

  it('shows loading and success states for manual restore', async () => {
    const deferred = createDeferred<MockRestoreRunResult>();

    mutableFeatureFlags.incrementalSyncEnabled = true;
    mockAuthStoreState.status = 'authenticated';
    mockAuthStoreState.session = mockAuthSession;
    mockAuthStoreState.user = mockAuthSession.user;
    mockHasLocalRestoreData.mockResolvedValueOnce(false);
    mockRunManualRestore.mockReturnValueOnce(deferred.promise);

    const renderer = await renderSettingsScreen();

    await pressButton(renderer, 'Restore from backup');

    expect(mockHasLocalRestoreData).toHaveBeenCalledTimes(1);
    expect(getNodeText(renderer.root)).toContain('Restoring backup...');
    expect(mockRunManualRestore).toHaveBeenCalledWith({
      auth: {
        status: 'authenticated',
        userId: 'auth-user-test',
      },
    });
    expect(mockRunManualSync).not.toHaveBeenCalled();

    await act(async () => {
      deferred.resolve(
        createSucceededRestoreResult({
          restoredBalanceEntriesCount: 6,
          restoredBalanceTypesCount: 3,
          restoredCategoriesCount: 4,
          restoredTransactionsCount: 2,
        }),
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    const text = getNodeText(renderer.root);

    expect(text).toContain(
      'Backup restored. 2 transactions, 4 categories, 3 balance types, and 6 balance entries restored.',
    );
    expect(text).toContain('Restore from backup');
    expect(mockLoadTransactions).toHaveBeenCalled();
    expect(mockLoadCategories).toHaveBeenCalled();
    expect(mockLoadBalance).toHaveBeenCalled();
  });

  it('shows safe empty backup copy', async () => {
    mockAuthStoreState.status = 'authenticated';
    mockAuthStoreState.session = mockAuthSession;
    mockAuthStoreState.user = mockAuthSession.user;
    mockRunManualRestore.mockResolvedValueOnce({
      status: 'empty',
      restoredTransactionsCount: 0,
      restoredCategoriesCount: 0,
      restoredBalanceTypesCount: 0,
      restoredBalanceEntriesCount: 0,
      isRecoverable: true,
    });

    const renderer = await renderSettingsScreen();

    await pressButton(renderer, 'Restore from backup');

    expect(getNodeText(renderer.root)).toContain(
      'No backup found for this account.',
    );
    expect(mockLoadTransactions).not.toHaveBeenCalled();
    expect(mockLoadCategories).not.toHaveBeenCalled();
    expect(mockLoadBalance).not.toHaveBeenCalled();
  });

  it('shows generic restore failure copy without raw backend values', async () => {
    mockAuthStoreState.status = 'authenticated';
    mockAuthStoreState.session = mockAuthSession;
    mockAuthStoreState.user = mockAuthSession.user;
    mockRunManualRestore.mockRejectedValueOnce(
      new Error(
        'raw backend failure auth-user-test localOwnerId deviceId access_token refresh_token provider_token EXPO_PUBLIC_SUPABASE_URL',
      ),
    );

    const renderer = await renderSettingsScreen();

    await pressButton(renderer, 'Restore from backup');

    const text = getNodeText(renderer.root);

    expect(text).toContain("Couldn't restore backup. Try again.");
    expect(text).not.toContain('raw backend failure');
    expect(text).not.toContain('auth-user-test');
    expect(text).not.toContain('localOwnerId');
    expect(text).not.toContain('deviceId');
    expect(text).not.toContain('access_token');
    expect(text).not.toContain('refresh_token');
    expect(text).not.toContain('provider_token');
    expect(text).not.toContain('EXPO_PUBLIC_SUPABASE_URL');
  });

  it('shows generic restore failure copy for skipped service results', async () => {
    mockAuthStoreState.status = 'authenticated';
    mockAuthStoreState.session = mockAuthSession;
    mockAuthStoreState.user = mockAuthSession.user;
    mockRunManualRestore.mockResolvedValueOnce({
      status: 'skipped',
      skippedReason: 'missing_user_id',
      isRecoverable: true,
    });

    const renderer = await renderSettingsScreen();

    await pressButton(renderer, 'Restore from backup');

    expect(getNodeText(renderer.root)).toContain(
      "Couldn't restore backup. Try again.",
    );
    expect(mockLoadTransactions).not.toHaveBeenCalled();
    expect(mockLoadCategories).not.toHaveBeenCalled();
  });

  it('requires confirmation before restoring into non-empty local data', async () => {
    mockAuthStoreState.status = 'authenticated';
    mockAuthStoreState.session = mockAuthSession;
    mockAuthStoreState.user = mockAuthSession.user;
    mockHasLocalRestoreData.mockResolvedValueOnce(true);

    const renderer = await renderSettingsScreen();

    await pressButton(renderer, 'Restore from backup');

    expect(alertSpy).toHaveBeenCalledWith(
      'Restore from backup?',
      'This will merge your cloud backup into this device. Existing local data will not be deleted.',
      expect.any(Array),
    );
    expect(mockRunManualRestore).not.toHaveBeenCalled();

    const alertButtons = alertSpy.mock.calls.at(-1)?.[2];

    if (!Array.isArray(alertButtons)) {
      throw new Error('Restore confirmation buttons were not rendered.');
    }

    await act(async () => {
      alertButtons[1].onPress?.();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockRunManualRestore).toHaveBeenCalledTimes(1);
  });
});
