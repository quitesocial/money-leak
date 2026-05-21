import { describe, expect, it, jest } from '@jest/globals';

import {
  createDeleteAccountService,
  type DeleteAccountResult,
} from '@/lib/account/delete-account-service';
import { createSupabaseDeleteAccountAdapter } from '@/lib/account/supabase-delete-account-adapter';

const TEST_USER_ID = 'auth-user-test';
const RAW_BACKEND_ERROR =
  'raw backend failure auth-user-test access_token refresh_token provider_token localOwnerId deviceId server-side-secret';

function createMockDeleteClient({
  failInvoke = false,
  throwInvoke = false,
}: {
  failInvoke?: boolean;
  throwInvoke?: boolean;
} = {}) {
  const invoke = jest.fn(async () => {
    if (throwInvoke) {
      throw new Error(RAW_BACKEND_ERROR);
    }

    return {
      data: failInvoke ? null : { status: 'deleted' },
      error: failInvoke ? new Error(RAW_BACKEND_ERROR) : null,
    };
  });

  return {
    client: {
      functions: {
        invoke,
      },
    },
    invoke,
  };
}

describe('Delete account service', () => {
  it('calls the delete-account Edge Function for an authenticated user', async () => {
    const { client, invoke } = createMockDeleteClient();
    const adapter = createSupabaseDeleteAccountAdapter({
      getClient: () => client as never,
    });
    const service = createDeleteAccountService({ adapter });

    await expect(
      service.runDeleteAccount({
        auth: {
          status: 'authenticated',
          hasAuthenticatedUser: true,
        },
      }),
    ).resolves.toEqual({
      status: 'succeeded',
    });

    expect(invoke).toHaveBeenCalledTimes(1);
    expect(invoke).toHaveBeenCalledWith('delete-account');
    expect(JSON.stringify(invoke.mock.calls)).not.toContain(TEST_USER_ID);
  });

  it('does not pass a raw user id or request body to the Edge Function', async () => {
    const { client, invoke } = createMockDeleteClient();
    const adapter = createSupabaseDeleteAccountAdapter({
      getClient: () => client as never,
    });
    const service = createDeleteAccountService({ adapter });

    await service.runDeleteAccount({
      auth: {
        status: 'authenticated',
        hasAuthenticatedUser: true,
      },
    });

    expect(invoke.mock.calls[0]).toEqual(['delete-account']);
  });

  it('skips safely in guest mode without calling the adapter', async () => {
    const deleteAccountData = jest.fn<() => Promise<DeleteAccountResult>>();
    const service = createDeleteAccountService({
      adapter: {
        deleteAccountData,
      },
    });

    await expect(
      service.runDeleteAccount({
        auth: {
          status: 'guest',
          hasAuthenticatedUser: true,
        },
      }),
    ).resolves.toEqual({
      status: 'skipped',
      skippedReason: 'guest_mode',
      isRecoverable: true,
    });

    expect(deleteAccountData).not.toHaveBeenCalled();
  });

  it('skips safely when the authenticated user is missing', async () => {
    const deleteAccountData = jest.fn<() => Promise<DeleteAccountResult>>();
    const service = createDeleteAccountService({
      adapter: {
        deleteAccountData,
      },
    });

    await expect(
      service.runDeleteAccount({
        auth: {
          status: 'authenticated',
          hasAuthenticatedUser: false,
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
        hasAuthenticatedUser: true,
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
    expect(JSON.stringify(result)).not.toContain('server-side-secret');
  });

  it('returns a safe recoverable failure when the Edge Function returns an error', async () => {
    const { client } = createMockDeleteClient({
      failInvoke: true,
    });
    const adapter = createSupabaseDeleteAccountAdapter({
      getClient: () => client as never,
    });
    const service = createDeleteAccountService({ adapter });

    const result = await service.runDeleteAccount({
      auth: {
        status: 'authenticated',
        hasAuthenticatedUser: true,
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
    expect(JSON.stringify(result)).not.toContain('auth-user-test');
    expect(JSON.stringify(result)).not.toContain('access_token');
  });

  it('returns a safe recoverable failure when the Edge Function call throws', async () => {
    const { client } = createMockDeleteClient({
      throwInvoke: true,
    });
    const adapter = createSupabaseDeleteAccountAdapter({
      getClient: () => client as never,
    });
    const service = createDeleteAccountService({ adapter });

    const result = await service.runDeleteAccount({
      auth: {
        status: 'authenticated',
        hasAuthenticatedUser: true,
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
    expect(JSON.stringify(result)).not.toContain('provider_token');
  });

  it('wraps unexpected adapter failures in a safe recoverable failure', async () => {
    const service = createDeleteAccountService({
      adapter: {
        deleteAccountData: async () => {
          throw new Error(RAW_BACKEND_ERROR);
        },
      },
    });

    const result = await service.runDeleteAccount({
      auth: {
        status: 'authenticated',
        hasAuthenticatedUser: true,
      },
    });

    expect(result).toMatchObject({
      status: 'failed',
      error: {
        code: 'remote_delete_failed',
        isRecoverable: true,
      },
    });
    expect(JSON.stringify(result)).not.toContain('localOwnerId');
    expect(JSON.stringify(result)).not.toContain('deviceId');
    expect(JSON.stringify(result)).not.toContain('server-side-secret');
  });
});
