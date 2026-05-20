import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { ensureUserProfile } from '@/lib/supabase/supabase-profile-service';
import type { AuthSession } from '@/types/auth';

const mockGetTransactions = jest.fn();
const mockCreateTransaction = jest.fn();
const mockImportTransactions = jest.fn();
const mockUpdateTransaction = jest.fn();
const mockDeleteTransaction = jest.fn();
const mockGetCategories = jest.fn();
const mockCreateCategory = jest.fn();
const mockUpdateCategoryName = jest.fn();
const mockArchiveCategory = jest.fn();
const mockUseTransactionsStore = jest.fn();
const mockUseCategoriesStore = jest.fn();

jest.mock('@/db/transactions', () => ({
  createTransaction: (...args: unknown[]) => mockCreateTransaction(...args),
  deleteTransaction: (...args: unknown[]) => mockDeleteTransaction(...args),
  getTransactions: (...args: unknown[]) => mockGetTransactions(...args),
  importTransactions: (...args: unknown[]) => mockImportTransactions(...args),
  updateTransaction: (...args: unknown[]) => mockUpdateTransaction(...args),
}));

jest.mock('@/db/categories', () => ({
  archiveCategory: (...args: unknown[]) => mockArchiveCategory(...args),
  createCategory: (...args: unknown[]) => mockCreateCategory(...args),
  getCategories: (...args: unknown[]) => mockGetCategories(...args),
  updateCategoryName: (...args: unknown[]) => mockUpdateCategoryName(...args),
}));

jest.mock('@/store/transactions-store', () => ({
  useTransactionsStore: (...args: unknown[]) =>
    mockUseTransactionsStore(...args),
}));

jest.mock('@/store/categories-store', () => ({
  useCategoriesStore: (...args: unknown[]) => mockUseCategoriesStore(...args),
}));

type MockProfileRow = {
  id: string;
  email: string | null;
  display_name: string | null;
  avatar_url: string | null;
  provider: string | null;
  created_at: string;
  updated_at: string;
};

const TEST_SESSION: AuthSession = {
  provider: 'google',
  createdAt: 1760000000000,
  expiresAt: null,
  user: {
    id: 'auth-user-test',
    provider: 'google',
    email: 'test@example.com',
    displayName: 'Test User',
    photoUrl: 'https://example.com/avatar.png',
  },
};

const TEST_PROFILE_ROW: MockProfileRow = {
  id: 'auth-user-test',
  email: 'test@example.com',
  display_name: 'Test User',
  avatar_url: 'https://example.com/avatar.png',
  provider: 'google',
  created_at: '2026-05-20T00:00:00.000Z',
  updated_at: '2026-05-20T00:00:00.000Z',
};

function createMockProfileClient() {
  const single =
    jest.fn<
      () => Promise<{ data: MockProfileRow | null; error: Error | null }>
    >();

  const select = jest.fn((_columns: string) => ({
    single,
  }));

  const upsert = jest.fn(
    (
      _payload: unknown,
      _options: {
        onConflict: string;
      },
    ) => ({
      select,
    }),
  );

  const from = jest.fn((_tableName: string) => ({
    upsert,
  }));

  return {
    client: {
      from,
    },
    from,
    single,
    select,
    upsert,
  };
}

function expectLocalDataActionsNotCalled() {
  expect(mockGetTransactions).not.toHaveBeenCalled();
  expect(mockCreateTransaction).not.toHaveBeenCalled();
  expect(mockImportTransactions).not.toHaveBeenCalled();
  expect(mockUpdateTransaction).not.toHaveBeenCalled();
  expect(mockDeleteTransaction).not.toHaveBeenCalled();
  expect(mockGetCategories).not.toHaveBeenCalled();
  expect(mockCreateCategory).not.toHaveBeenCalled();
  expect(mockUpdateCategoryName).not.toHaveBeenCalled();
  expect(mockArchiveCategory).not.toHaveBeenCalled();
  expect(mockUseTransactionsStore).not.toHaveBeenCalled();
  expect(mockUseCategoriesStore).not.toHaveBeenCalled();
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('Supabase profile service', () => {
  it('upserts and returns a profile for an authenticated user', async () => {
    const { client, from, single, select, upsert } = createMockProfileClient();

    single.mockResolvedValue({
      data: TEST_PROFILE_ROW,
      error: null,
    });

    await expect(
      ensureUserProfile(TEST_SESSION, {
        getClient: () => client as never,
      }),
    ).resolves.toEqual({
      status: 'ensured',
      profile: {
        id: 'auth-user-test',
        email: 'test@example.com',
        displayName: 'Test User',
        avatarUrl: 'https://example.com/avatar.png',
        provider: 'google',
        createdAt: '2026-05-20T00:00:00.000Z',
        updatedAt: '2026-05-20T00:00:00.000Z',
      },
    });

    expect(from).toHaveBeenCalledWith('profiles');
    expect(upsert).toHaveBeenCalledWith(
      {
        id: 'auth-user-test',
        email: 'test@example.com',
        display_name: 'Test User',
        avatar_url: 'https://example.com/avatar.png',
        provider: 'google',
      },
      { onConflict: 'id' },
    );
    expect(select).toHaveBeenCalledWith(
      'id,email,display_name,avatar_url,provider,created_at,updated_at',
    );
    expect(single).toHaveBeenCalledTimes(1);
    expectLocalDataActionsNotCalled();
  });

  it('does not run when unauthenticated', async () => {
    const { client, from } = createMockProfileClient();

    await expect(
      ensureUserProfile(null, {
        getClient: () => client as never,
      }),
    ).resolves.toEqual({
      status: 'skipped',
      profile: null,
      skippedReason: 'unauthenticated',
    });

    expect(from).not.toHaveBeenCalled();
    expectLocalDataActionsNotCalled();
  });

  it('fails safely when the Supabase client is unavailable', async () => {
    const result = await ensureUserProfile(TEST_SESSION, {
      getClient: () => null,
    });

    expect(result).toEqual({
      status: 'failed',
      profile: null,
      error: {
        code: 'profile_client_unavailable',
        isRecoverable: true,
        message: 'Profile could not be prepared. Local mode remains available.',
      },
    });
    expectLocalDataActionsNotCalled();
  });

  it('returns a safe recoverable failure for Supabase errors', async () => {
    const { client, single } = createMockProfileClient();

    single.mockResolvedValue({
      data: null,
      error: new Error('raw backend failure with sensitive-value-redacted'),
    });

    const result = await ensureUserProfile(TEST_SESSION, {
      getClient: () => client as never,
    });

    expect(result).toMatchObject({
      status: 'failed',
      profile: null,
      error: {
        code: 'profile_ensure_failed',
        isRecoverable: true,
      },
    });
    expect(JSON.stringify(result)).not.toContain('raw backend failure');
    expect(JSON.stringify(result)).not.toContain('sensitive-value-redacted');
    expectLocalDataActionsNotCalled();
  });

  it('returns a safe recoverable failure when Supabase throws', async () => {
    const { client, single } = createMockProfileClient();

    single.mockRejectedValue(
      new Error('thrown backend failure with sensitive-value-redacted'),
    );

    const result = await ensureUserProfile(TEST_SESSION, {
      getClient: () => client as never,
    });

    expect(result).toMatchObject({
      status: 'failed',
      profile: null,
      error: {
        code: 'profile_ensure_failed',
        isRecoverable: true,
      },
    });
    expect(JSON.stringify(result)).not.toContain('thrown backend failure');
    expect(JSON.stringify(result)).not.toContain('sensitive-value-redacted');
    expectLocalDataActionsNotCalled();
  });

  it('uses the same profile id and upsert conflict target on repeated ensure', async () => {
    const { client, single, upsert } = createMockProfileClient();

    single.mockResolvedValue({
      data: TEST_PROFILE_ROW,
      error: null,
    });

    await ensureUserProfile(TEST_SESSION, {
      getClient: () => client as never,
    });
    await ensureUserProfile(TEST_SESSION, {
      getClient: () => client as never,
    });

    expect(upsert).toHaveBeenCalledTimes(2);
    expect(upsert.mock.calls[0]).toEqual(upsert.mock.calls[1]);
    expect(upsert.mock.calls[0][0]).toMatchObject({
      id: 'auth-user-test',
    });
    expect(upsert.mock.calls[0][1]).toEqual({ onConflict: 'id' });
    expectLocalDataActionsNotCalled();
  });

  it('does not persist or return extra sensitive session fields', async () => {
    const { client, single, upsert } = createMockProfileClient();
    const sensitiveValue = 'sensitive-value-redacted';

    single.mockResolvedValue({
      data: TEST_PROFILE_ROW,
      error: null,
    });

    const sessionWithExtraField = {
      ...TEST_SESSION,
      rawSensitiveCredential: sensitiveValue,
    } as unknown as AuthSession;

    const result = await ensureUserProfile(sessionWithExtraField, {
      getClient: () => client as never,
    });

    expect(JSON.stringify(upsert.mock.calls[0][0])).not.toContain(
      sensitiveValue,
    );
    expect(JSON.stringify(result)).not.toContain(sensitiveValue);
    expectLocalDataActionsNotCalled();
  });
});
