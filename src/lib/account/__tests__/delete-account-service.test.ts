import { describe, expect, it, jest } from '@jest/globals';

import {
  createDeleteAccountService,
  type DeleteAccountResult,
} from '@/lib/account/delete-account-service';
import { createSupabaseDeleteAccountAdapter } from '@/lib/account/supabase-delete-account-adapter';

type RemoteAccountTableName =
  | 'profiles'
  | 'remote_categories'
  | 'remote_transactions';

const TEST_USER_ID = 'auth-user-test';
const RAW_BACKEND_ERROR =
  'raw backend failure auth-user-test access_token refresh_token provider_token localOwnerId deviceId';

function createMockDeleteClient({
  failTable,
  throwTable,
}: {
  failTable?: RemoteAccountTableName;
  throwTable?: RemoteAccountTableName;
} = {}) {
  const deleteCalls: {
    column: string;
    tableName: RemoteAccountTableName;
    value: string;
  }[] = [];

  const eq = jest.fn(
    async (
      tableName: RemoteAccountTableName,
      column: string,
      value: string,
    ) => {
      deleteCalls.push({
        tableName,
        column,
        value,
      });

      if (tableName === throwTable) {
        throw new Error(RAW_BACKEND_ERROR);
      }

      return {
        error: tableName === failTable ? new Error(RAW_BACKEND_ERROR) : null,
      };
    },
  );

  const deleteRows = jest.fn((tableName: RemoteAccountTableName) => ({
    eq: (column: string, value: string) => eq(tableName, column, value),
  }));

  const from = jest.fn((tableName: RemoteAccountTableName) => ({
    delete: () => deleteRows(tableName),
  }));

  return {
    client: {
      from,
    },
    deleteCalls,
    deleteRows,
    eq,
    from,
  };
}

describe('Delete account service', () => {
  it('deletes remote transactions, remote categories, and profile for an authenticated user', async () => {
    const { client, deleteCalls, deleteRows, from } = createMockDeleteClient();
    const adapter = createSupabaseDeleteAccountAdapter({
      getClient: () => client as never,
    });
    const service = createDeleteAccountService({ adapter });

    await expect(
      service.runDeleteAccount({
        auth: {
          status: 'authenticated',
          userId: TEST_USER_ID,
        },
      }),
    ).resolves.toEqual({
      status: 'succeeded',
    });

    expect(from).toHaveBeenNthCalledWith(1, 'remote_transactions');
    expect(from).toHaveBeenNthCalledWith(2, 'remote_categories');
    expect(from).toHaveBeenNthCalledWith(3, 'profiles');
    expect(deleteRows).toHaveBeenCalledTimes(3);
    expect(deleteCalls).toEqual([
      {
        tableName: 'remote_transactions',
        column: 'user_id',
        value: TEST_USER_ID,
      },
      {
        tableName: 'remote_categories',
        column: 'user_id',
        value: TEST_USER_ID,
      },
      {
        tableName: 'profiles',
        column: 'id',
        value: TEST_USER_ID,
      },
    ]);
  });

  it('trims the authenticated user id before remote deletes', async () => {
    const { client, deleteCalls } = createMockDeleteClient();
    const adapter = createSupabaseDeleteAccountAdapter({
      getClient: () => client as never,
    });
    const service = createDeleteAccountService({ adapter });

    await service.runDeleteAccount({
      auth: {
        status: 'authenticated',
        userId: ` ${TEST_USER_ID} `,
      },
    });

    expect(deleteCalls.map((call) => call.value)).toEqual([
      TEST_USER_ID,
      TEST_USER_ID,
      TEST_USER_ID,
    ]);
  });

  it('skips safely in guest mode without calling the adapter', async () => {
    const deleteAccountData =
      jest.fn<(_input: { userId: string }) => Promise<DeleteAccountResult>>();
    const service = createDeleteAccountService({
      adapter: {
        deleteAccountData,
      },
    });

    await expect(
      service.runDeleteAccount({
        auth: {
          status: 'guest',
          userId: TEST_USER_ID,
        },
      }),
    ).resolves.toEqual({
      status: 'skipped',
      skippedReason: 'guest_mode',
      isRecoverable: true,
    });

    expect(deleteAccountData).not.toHaveBeenCalled();
  });

  it('skips safely when the authenticated user id is missing', async () => {
    const deleteAccountData =
      jest.fn<(_input: { userId: string }) => Promise<DeleteAccountResult>>();
    const service = createDeleteAccountService({
      adapter: {
        deleteAccountData,
      },
    });

    await expect(
      service.runDeleteAccount({
        auth: {
          status: 'authenticated',
          userId: '   ',
        },
      }),
    ).resolves.toEqual({
      status: 'skipped',
      skippedReason: 'missing_user_id',
      isRecoverable: true,
    });

    expect(deleteAccountData).not.toHaveBeenCalled();
  });

  it('returns a safe recoverable failure when the Supabase client is unavailable', async () => {
    const adapter = createSupabaseDeleteAccountAdapter({
      getClient: () => null,
    });
    const service = createDeleteAccountService({ adapter });

    const result = await service.runDeleteAccount({
      auth: {
        status: 'authenticated',
        userId: TEST_USER_ID,
      },
    });

    expect(result).toMatchObject({
      status: 'failed',
      error: {
        code: 'delete_client_unavailable',
        isRecoverable: true,
      },
    });
    expect(JSON.stringify(result)).not.toContain('Supabase');
    expect(JSON.stringify(result)).not.toContain('access_token');
  });

  it('returns a safe recoverable failure when a remote delete returns an error', async () => {
    const { client, deleteCalls } = createMockDeleteClient({
      failTable: 'remote_categories',
    });
    const adapter = createSupabaseDeleteAccountAdapter({
      getClient: () => client as never,
    });
    const service = createDeleteAccountService({ adapter });

    const result = await service.runDeleteAccount({
      auth: {
        status: 'authenticated',
        userId: TEST_USER_ID,
      },
    });

    expect(result).toMatchObject({
      status: 'failed',
      error: {
        code: 'remote_delete_failed',
        isRecoverable: true,
      },
    });
    expect(deleteCalls).toEqual([
      {
        tableName: 'remote_transactions',
        column: 'user_id',
        value: TEST_USER_ID,
      },
      {
        tableName: 'remote_categories',
        column: 'user_id',
        value: TEST_USER_ID,
      },
    ]);
    expect(JSON.stringify(result)).not.toContain(RAW_BACKEND_ERROR);
    expect(JSON.stringify(result)).not.toContain('auth-user-test');
    expect(JSON.stringify(result)).not.toContain('access_token');
  });

  it('returns a safe recoverable failure when a remote delete throws', async () => {
    const { client } = createMockDeleteClient({
      throwTable: 'remote_transactions',
    });
    const adapter = createSupabaseDeleteAccountAdapter({
      getClient: () => client as never,
    });
    const service = createDeleteAccountService({ adapter });

    const result = await service.runDeleteAccount({
      auth: {
        status: 'authenticated',
        userId: TEST_USER_ID,
      },
    });

    expect(result).toMatchObject({
      status: 'failed',
      error: {
        code: 'remote_delete_failed',
        isRecoverable: true,
      },
    });
    expect(JSON.stringify(result)).not.toContain(RAW_BACKEND_ERROR);
    expect(JSON.stringify(result)).not.toContain('refresh_token');
  });
});
