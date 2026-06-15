import { describe, expect, it, jest } from '@jest/globals';

import { createDeleteAccountHandler } from '../handler';

const SUPABASE_URL = 'https://project-ref.supabase.co';
const SERVICE_ROLE_KEY = 'test-service-role-key';
const VERIFIED_USER_ID = 'verified-user-id';
const ATTACKER_USER_ID = 'attacker-user-id';
const USER_ACCESS_TOKEN = 'test-user-access-token';
const RAW_BACKEND_ERROR =
  'raw backend failure test-user-access-token test-service-role-key provider_token refresh_token localOwnerId deviceId';

type FetchCall = {
  init?: RequestInit;
  url: string;
};

type MockFetchOptions = {
  authDeleteStatus?: number;
  authUserBody?: Record<string, unknown>;
  authUserStatus?: number;
  failingTable?:
    | 'profiles'
    | 'remote_balance_entries'
    | 'remote_balance_types'
    | 'remote_categories'
    | 'remote_settings'
    | 'remote_transactions';
};

function createRequest({
  authorization = `Bearer ${USER_ACCESS_TOKEN}`,
  body,
  method = 'POST',
}: {
  authorization?: string;
  body?: unknown;
  method?: string;
} = {}) {
  return new Request('https://functions.example/delete-account', {
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: {
      authorization,
      'content-type': 'application/json',
    },
    method,
  });
}

function createMockFetch({
  authDeleteStatus = 200,
  authUserBody = { id: VERIFIED_USER_ID },
  authUserStatus = 200,
  failingTable,
}: MockFetchOptions = {}) {
  const calls: FetchCall[] = [];

  const fetchImpl = jest.fn(async (input: string | URL, init?: RequestInit) => {
    const url = String(input);

    calls.push({ init, url });

    if (url === `${SUPABASE_URL}/auth/v1/user`) {
      return new Response(JSON.stringify(authUserBody), {
        status: authUserStatus,
      });
    }

    if (url.includes('/rest/v1/')) {
      const status =
        failingTable && url.includes(`/rest/v1/${failingTable}?`) ? 500 : 204;

      return new Response(status === 500 ? RAW_BACKEND_ERROR : null, {
        status,
      });
    }

    if (url.includes('/auth/v1/admin/users/')) {
      return new Response(authDeleteStatus === 500 ? RAW_BACKEND_ERROR : null, {
        status: authDeleteStatus,
      });
    }

    return new Response(RAW_BACKEND_ERROR, { status: 500 });
  });

  return {
    calls,
    fetchImpl,
  };
}

async function readJson(response: Response) {
  return (await response.json()) as unknown;
}

function createHandler(fetchImpl: typeof fetch) {
  return createDeleteAccountHandler({
    env: {
      MONEY_LEAK_SERVICE_ROLE_KEY: SERVICE_ROLE_KEY,
      SUPABASE_URL,
    },
    fetchImpl,
  });
}

describe('delete-account Edge Function handler', () => {
  it('returns a safe failure when authorization is missing', async () => {
    const { fetchImpl } = createMockFetch();
    const handler = createHandler(fetchImpl as never);

    const response = await handler(createRequest({ authorization: '' }));

    expect(response.status).toBe(401);
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(await readJson(response)).toEqual({
      status: 'failed',
      error: {
        code: 'unauthorized',
        message: 'Account could not be deleted.',
      },
    });
  });

  it('returns a safe failure when the JWT cannot be verified', async () => {
    const { fetchImpl } = createMockFetch({ authUserStatus: 401 });
    const handler = createHandler(fetchImpl as never);

    const response = await handler(createRequest());
    const body = JSON.stringify(await readJson(response));

    expect(response.status).toBe(401);
    expect(body).toContain('unauthorized');
    expect(body).not.toContain(USER_ACCESS_TOKEN);
    expect(body).not.toContain(SERVICE_ROLE_KEY);
    expect(body).not.toContain(RAW_BACKEND_ERROR);
  });

  it('ignores body user ids and deletes data for the verified JWT user', async () => {
    const { calls, fetchImpl } = createMockFetch();
    const handler = createHandler(fetchImpl as never);

    const response = await handler(
      createRequest({
        body: {
          userId: ATTACKER_USER_ID,
        },
      }),
    );

    expect(response.status).toBe(200);
    expect(JSON.stringify(await readJson(response))).toBe(
      JSON.stringify({ status: 'deleted' }),
    );

    const calledUrls = calls.map((call) => call.url);

    expect(calledUrls).toContain(
      `${SUPABASE_URL}/rest/v1/remote_balance_entries?user_id=eq.${VERIFIED_USER_ID}`,
    );
    expect(calledUrls).toContain(
      `${SUPABASE_URL}/rest/v1/remote_balance_types?user_id=eq.${VERIFIED_USER_ID}`,
    );
    expect(calledUrls).toContain(
      `${SUPABASE_URL}/rest/v1/remote_transactions?user_id=eq.${VERIFIED_USER_ID}`,
    );
    expect(calledUrls).toContain(
      `${SUPABASE_URL}/rest/v1/remote_settings?user_id=eq.${VERIFIED_USER_ID}`,
    );
    expect(calledUrls).toContain(
      `${SUPABASE_URL}/rest/v1/remote_categories?user_id=eq.${VERIFIED_USER_ID}`,
    );
    expect(calledUrls).toContain(
      `${SUPABASE_URL}/rest/v1/profiles?id=eq.${VERIFIED_USER_ID}`,
    );
    expect(calledUrls).toContain(
      `${SUPABASE_URL}/auth/v1/admin/users/${VERIFIED_USER_ID}`,
    );
    expect(JSON.stringify(calledUrls)).not.toContain(ATTACKER_USER_ID);
  });

  it('does not delete the Auth user when app-owned row deletion fails', async () => {
    const { calls, fetchImpl } = createMockFetch({
      failingTable: 'remote_categories',
    });
    const handler = createHandler(fetchImpl as never);

    const response = await handler(createRequest());
    const body = JSON.stringify(await readJson(response));

    expect(response.status).toBe(500);
    expect(body).toContain('delete_failed');
    expect(body).not.toContain(RAW_BACKEND_ERROR);
    expect(
      calls.some((call) => call.url.includes('/auth/v1/admin/users/')),
    ).toBe(false);
  });

  it('treats an already-missing Auth user as safely deleted', async () => {
    const { fetchImpl } = createMockFetch({ authDeleteStatus: 404 });
    const handler = createHandler(fetchImpl as never);

    const response = await handler(createRequest());

    expect(response.status).toBe(200);
    expect(await readJson(response)).toEqual({ status: 'deleted' });
  });

  it('returns only safe JSON when backend deletion returns raw errors', async () => {
    const { fetchImpl } = createMockFetch({ authDeleteStatus: 500 });
    const handler = createHandler(fetchImpl as never);

    const response = await handler(createRequest());
    const body = JSON.stringify(await readJson(response));

    expect(response.status).toBe(500);
    expect(body).toContain('delete_failed');
    expect(body).not.toContain(RAW_BACKEND_ERROR);
    expect(body).not.toContain(USER_ACCESS_TOKEN);
    expect(body).not.toContain(SERVICE_ROLE_KEY);
    expect(body).not.toContain('provider_token');
    expect(body).not.toContain('localOwnerId');
    expect(body).not.toContain('deviceId');
  });
});
