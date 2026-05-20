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
import { featureFlags } from '@/lib/feature-flags';
import type {
  AuthError,
  AuthSession,
  AuthStatus,
  AuthUser,
} from '@/types/auth';

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

const mockExportTransactionsCsv =
  jest.fn<(_transactions: unknown[]) => Promise<void>>();

const mockPickTransactionsCsvImport =
  jest.fn<() => Promise<{ status: 'cancelled' }>>();

const mockUseTransactionsRefresh = jest.fn();
const mockGetLastSuccessfulBackupAt = jest.fn<() => Promise<number | null>>();

const mockSetLastSuccessfulBackupAt =
  jest.fn<(_timestamp: number) => Promise<void>>();

const mockGetReminderEnabled = jest.fn<() => Promise<boolean>>();
const mockSetReminderEnabled = jest.fn<(_enabled: boolean) => Promise<void>>();
const mockRunManualBackup =
  jest.fn<(_input: unknown) => Promise<MockBackupRunResult>>();

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
const mockSetAuthSession = jest.fn<(_session: AuthSession) => Promise<void>>();
const mockSignOut = jest.fn<() => Promise<void>>();
const mockClearAuthError = jest.fn();
const mockReact = React;
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

jest.mock('@/db/backup-status', () => ({
  getLastSuccessfulBackupAt: () => {
    return mockGetLastSuccessfulBackupAt();
  },
  setLastSuccessfulBackupAt: (timestamp: number) => {
    return mockSetLastSuccessfulBackupAt(timestamp);
  },
}));

jest.mock('@/lib/sync/manual-backup-service', () => ({
  manualBackupService: {
    runBackup: (input: unknown) => {
      return mockRunManualBackup(input);
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

const mockGoogleAuthAdapter = (
  jest.requireMock('@/lib/auth/google-auth-adapter') as {
    googleAuthAdapter: {
      isEnabled: boolean;
      signIn: jest.MockedFunction<() => Promise<AuthSession | null>>;
    };
  }
).googleAuthAdapter;

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

const openUrlSpy = jest.spyOn(Linking, 'openURL');
const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
const consoleErrorSpy = jest
  .spyOn(console, 'error')
  .mockImplementation(() => {});

const mutableAppLinks = APP_LINKS as {
  PRIVACY_POLICY: string;
  SUPPORT_EMAIL: string;
};

const mutableFeatureFlags = featureFlags as {
  googleAuthEnabled: boolean;
  appleAuthEnabled: boolean;
  backupEnabled: boolean;
  restoreEnabled: boolean;
  incrementalSyncEnabled: boolean;
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

  return renderer as ReactTestRenderer;
}

async function pressButton(renderer: ReactTestRenderer, label: string) {
  await act(async () => {
    findButton(renderer, label).props.onPress();
    await Promise.resolve();
    await Promise.resolve();
  });
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
  uploadedCategoriesCount = 2,
  uploadedTransactionsCount = 3,
}: {
  uploadedCategoriesCount?: number;
  uploadedTransactionsCount?: number;
} = {}): MockBackupRunResult {
  return {
    status: 'succeeded',
    uploadedTransactionsCount,
    uploadedCategoriesCount,
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

  mutableFeatureFlags.googleAuthEnabled = true;
  mutableFeatureFlags.appleAuthEnabled = false;
  mutableFeatureFlags.backupEnabled = true;
  mutableFeatureFlags.restoreEnabled = false;
  mutableFeatureFlags.incrementalSyncEnabled = false;

  mutableAppLinks.PRIVACY_POLICY =
    'https://quitesocial.notion.site/35357a24e62c804dab18c28d24a6c75a?source=copy_link';
  mutableAppLinks.SUPPORT_EMAIL = 'mailto:asrazdorskiy@gmail.com';

  mockLoadTransactions.mockResolvedValue(undefined);
  mockImportTransactions.mockResolvedValue(0);
  mockClearError.mockImplementation(() => {});
  mockExportTransactionsCsv.mockResolvedValue(undefined);
  mockPickTransactionsCsvImport.mockResolvedValue({ status: 'cancelled' });
  mockGetLastSuccessfulBackupAt.mockResolvedValue(null);
  mockSetLastSuccessfulBackupAt.mockResolvedValue(undefined);
  mockRunManualBackup.mockResolvedValue(createSucceededBackupResult());
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
  mockAuthStoreState.status = 'guest';
  mockAuthStoreState.session = null;
  mockAuthStoreState.user = null;
  mockAuthStoreState.error = null;
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

describe('SettingsScreen account section', () => {
  it('shows guest account state by default', async () => {
    const renderer = await renderSettingsScreen();

    const text = getNodeText(renderer.root);

    expect(text).toContain('Account');
    expect(text).toContain('Using local guest mode on this device.');
    expect(text).toContain('Continue with Google');
    expect(text).not.toContain('Create backup now');
    expect(text).not.toContain('googleAuthEnabled');
  });

  it('keeps guest account copy safe when auth config is unavailable', async () => {
    mockGoogleAuthAdapter.isEnabled = false;

    const renderer = await renderSettingsScreen();
    const text = getNodeText(renderer.root);

    expect(text).toContain('Using local guest mode on this device.');
    expect(text).not.toContain('Continue with Google');
    expect(text).not.toContain('Create backup now');
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

    expect(text).toContain('Signed in as test@example.com.');
    expect(text).toContain('Sign Out');
    expect(text).not.toContain('Continue with Google');
    expect(text).not.toContain('googleAuthEnabled');
    expect(text).not.toContain('auth-user-test');
    expect(text).not.toContain('localOwnerId');
    expect(text).not.toContain('deviceId');
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

  it('signs out through the auth store without touching local data stores', async () => {
    mockAuthStoreState.status = 'authenticated';
    mockAuthStoreState.session = mockAuthSession;
    mockAuthStoreState.user = mockAuthSession.user;

    const renderer = await renderSettingsScreen();

    await pressButton(renderer, 'Sign Out');

    expect(mockSignOut).toHaveBeenCalledTimes(1);
    expect(mockRunManualBackup).not.toHaveBeenCalled();
    expect(mockSetLastSuccessfulBackupAt).not.toHaveBeenCalled();
    expect(mockImportTransactions).not.toHaveBeenCalled();
    expect(mockExportTransactionsCsv).not.toHaveBeenCalled();
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
    expect(text).toContain('Create backup now');
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

    expect(text).not.toContain('Create backup now');
    expect(mockRunManualBackup).not.toHaveBeenCalled();
  });

  it('does not let guest mode trigger remote backup writes', async () => {
    const renderer = await renderSettingsScreen();
    const text = getNodeText(renderer.root);

    expect(text).toContain('Using local guest mode on this device.');
    expect(text).not.toContain('Create backup now');
    expect(mockRunManualBackup).not.toHaveBeenCalled();
  });

  it('shows loading and success states for manual backup', async () => {
    const deferred = createDeferred<MockBackupRunResult>();

    mockAuthStoreState.status = 'authenticated';
    mockAuthStoreState.session = mockAuthSession;
    mockAuthStoreState.user = mockAuthSession.user;
    mockRunManualBackup.mockReturnValueOnce(deferred.promise);

    const renderer = await renderSettingsScreen();

    await pressButton(renderer, 'Create backup now');

    expect(getNodeText(renderer.root)).toContain('Creating backup...');
    expect(mockRunManualBackup).toHaveBeenCalledWith({
      auth: {
        status: 'authenticated',
        userId: 'auth-user-test',
      },
    });

    await act(async () => {
      deferred.resolve(
        createSucceededBackupResult({
          uploadedCategoriesCount: 4,
          uploadedTransactionsCount: 2,
        }),
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    const text = getNodeText(renderer.root);

    expect(text).toContain(
      'Backup created. 2 transactions and 4 categories saved.',
    );
    expect(text).toContain('Create backup now');
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

    await pressButton(renderer, 'Create backup now');

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

    await pressButton(renderer, 'Create backup now');

    expect(getNodeText(renderer.root)).toContain(
      "Couldn't create backup. Try again.",
    );
    expect(mockSetLastSuccessfulBackupAt).not.toHaveBeenCalled();
  });
});
