type DeleteAccountEnv = {
  MONEY_LEAK_SERVICE_ROLE_KEY?: string;
  SUPABASE_URL?: string;
};

type DeleteAccountHandlerOptions = {
  env: DeleteAccountEnv;
  fetchImpl?: typeof fetch;
};

type AuthUserResponse = {
  id?: unknown;
};

type SafeErrorCode =
  | 'delete_failed'
  | 'method_not_allowed'
  | 'server_misconfigured'
  | 'unauthorized';

type RemoteDeleteStep = {
  column: 'id' | 'user_id';
  tableName:
    | 'profiles'
    | 'remote_balance_entries'
    | 'remote_balance_types'
    | 'remote_categories'
    | 'remote_settings'
    | 'remote_transactions';
};

const DELETE_ACCOUNT_STEPS: RemoteDeleteStep[] = [
  {
    tableName: 'remote_balance_entries',
    column: 'user_id',
  },
  {
    tableName: 'remote_balance_types',
    column: 'user_id',
  },
  {
    tableName: 'remote_transactions',
    column: 'user_id',
  },
  {
    tableName: 'remote_settings',
    column: 'user_id',
  },
  {
    tableName: 'remote_categories',
    column: 'user_id',
  },
  {
    tableName: 'profiles',
    column: 'id',
  },
];

const CORS_HEADERS = {
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Origin': '*',
};

const JSON_HEADERS = {
  ...CORS_HEADERS,
  'Content-Type': 'application/json; charset=utf-8',
};

export function createDeleteAccountHandler({
  env,
  fetchImpl = fetch,
}: DeleteAccountHandlerOptions) {
  return async function handleDeleteAccountRequest(request: Request) {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: CORS_HEADERS,
        status: 204,
      });
    }

    if (request.method !== 'POST') {
      return createSafeErrorResponse(405, 'method_not_allowed');
    }

    const supabaseUrl = normalizeSupabaseUrl(env.SUPABASE_URL);
    const serviceRoleKey = env.MONEY_LEAK_SERVICE_ROLE_KEY?.trim() ?? '';

    if (!supabaseUrl || !serviceRoleKey) {
      return createSafeErrorResponse(500, 'server_misconfigured');
    }

    const accessToken = getBearerToken(request);

    if (!accessToken) {
      return createSafeErrorResponse(401, 'unauthorized');
    }

    try {
      const userId = await getAuthenticatedUserId({
        accessToken,
        fetchImpl,
        serviceRoleKey,
        supabaseUrl,
      });

      if (!userId) {
        return createSafeErrorResponse(401, 'unauthorized');
      }

      const didDeleteAppRows = await deleteAppOwnedRows({
        fetchImpl,
        serviceRoleKey,
        supabaseUrl,
        userId,
      });

      if (!didDeleteAppRows) {
        return createSafeErrorResponse(500, 'delete_failed');
      }

      const didDeleteAuthUser = await deleteAuthUser({
        fetchImpl,
        serviceRoleKey,
        supabaseUrl,
        userId,
      });

      if (!didDeleteAuthUser) {
        return createSafeErrorResponse(500, 'delete_failed');
      }

      return new Response(JSON.stringify({ status: 'deleted' }), {
        headers: JSON_HEADERS,
        status: 200,
      });
    } catch {
      return createSafeErrorResponse(500, 'delete_failed');
    }
  };
}

function normalizeSupabaseUrl(value: string | undefined) {
  const trimmedValue = value?.trim() ?? '';

  if (!trimmedValue) return null;

  return trimmedValue.replace(/\/+$/, '');
}

function getBearerToken(request: Request) {
  const authorization = request.headers.get('authorization')?.trim() ?? '';
  const [scheme, ...tokenParts] = authorization.split(/\s+/);

  if (scheme?.toLowerCase() !== 'bearer') return null;

  const token = tokenParts.join(' ').trim();

  return token.length > 0 ? token : null;
}

async function getAuthenticatedUserId({
  accessToken,
  fetchImpl,
  serviceRoleKey,
  supabaseUrl,
}: {
  accessToken: string;
  fetchImpl: typeof fetch;
  serviceRoleKey: string;
  supabaseUrl: string;
}) {
  const response = await fetchImpl(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${accessToken}`,
    },
    method: 'GET',
  });

  if (!response.ok) return null;

  const user = (await readJsonSafely(response)) as AuthUserResponse | null;
  const userId = typeof user?.id === 'string' ? user.id.trim() : '';

  return userId.length > 0 ? userId : null;
}

async function deleteAppOwnedRows({
  fetchImpl,
  serviceRoleKey,
  supabaseUrl,
  userId,
}: {
  fetchImpl: typeof fetch;
  serviceRoleKey: string;
  supabaseUrl: string;
  userId: string;
}) {
  for (const step of DELETE_ACCOUNT_STEPS) {
    const params = new URLSearchParams({
      [step.column]: `eq.${userId}`,
    });

    const response = await fetchImpl(
      `${supabaseUrl}/rest/v1/${step.tableName}?${params.toString()}`,
      {
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
          Prefer: 'return=minimal',
        },
        method: 'DELETE',
      },
    );

    if (!response.ok) return false;
  }

  return true;
}

async function deleteAuthUser({
  fetchImpl,
  serviceRoleKey,
  supabaseUrl,
  userId,
}: {
  fetchImpl: typeof fetch;
  serviceRoleKey: string;
  supabaseUrl: string;
  userId: string;
}) {
  const response = await fetchImpl(
    `${supabaseUrl}/auth/v1/admin/users/${encodeURIComponent(userId)}`,
    {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
      method: 'DELETE',
    },
  );

  return response.ok || response.status === 404;
}

async function readJsonSafely(response: Response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function createSafeErrorResponse(status: number, code: SafeErrorCode) {
  return new Response(
    JSON.stringify({
      error: {
        code,
        message: 'Account could not be deleted.',
      },
      status: 'failed',
    }),
    {
      headers: JSON_HEADERS,
      status,
    },
  );
}
