import type { SupabaseClient } from '@supabase/supabase-js';

import type {
  DeleteAccountAdapter,
  DeleteAccountErrorCode,
  DeleteAccountResult,
} from '@/lib/account/delete-account-service';
import { getSupabaseClient } from '@/lib/supabase/supabase-client';

type SupabaseAccountDeleteClient = Pick<SupabaseClient, 'functions'>;

type SupabaseDeleteAccountAdapterOptions = {
  getClient?: () => SupabaseAccountDeleteClient | null;
};

type SupabaseFunctionResult = {
  data: unknown;
  error: unknown;
};

export function createSupabaseDeleteAccountAdapter({
  getClient = getSupabaseClient,
}: SupabaseDeleteAccountAdapterOptions = {}): DeleteAccountAdapter {
  return {
    async deleteAccountData() {
      const client = getClient();

      if (!client) return createFailedResult('delete_client_unavailable');

      try {
        const result = (await client.functions.invoke(
          'delete-account',
        )) as SupabaseFunctionResult;

        if (result.error) return createFailedResult('remote_delete_failed');
        if (!isDeleteAccountFunctionSuccess(result.data)) {
          return createFailedResult('remote_delete_failed');
        }

        return {
          status: 'succeeded',
        };
      } catch {
        return createFailedResult('remote_delete_failed');
      }
    },
  };
}

function isDeleteAccountFunctionSuccess(data: unknown) {
  return (
    typeof data === 'object' &&
    data !== null &&
    'status' in data &&
    data.status === 'deleted'
  );
}

function createFailedResult(code: DeleteAccountErrorCode): DeleteAccountResult {
  return {
    status: 'failed',
    error: {
      code,
      isRecoverable: true,
      message:
        'Account cloud data could not be deleted. Local data remains on this device.',
    },
  };
}

export const supabaseDeleteAccountAdapter =
  createSupabaseDeleteAccountAdapter();
