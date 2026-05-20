import type { SupabaseClient } from '@supabase/supabase-js';

import type {
  DeleteAccountAdapter,
  DeleteAccountErrorCode,
  DeleteAccountResult,
} from '@/lib/account/delete-account-service';
import { getSupabaseClient } from '@/lib/supabase/supabase-client';

type SupabaseAccountDeleteClient = Pick<SupabaseClient, 'from'>;

type SupabaseDeleteAccountAdapterOptions = {
  getClient?: () => SupabaseAccountDeleteClient | null;
};

type SupabaseDeleteResult = {
  error: unknown;
};

type RemoteAccountDeleteStep = {
  column: 'id' | 'user_id';
  tableName: 'profiles' | 'remote_categories' | 'remote_transactions';
};

const DELETE_ACCOUNT_STEPS: RemoteAccountDeleteStep[] = [
  {
    tableName: 'remote_transactions',
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

export function createSupabaseDeleteAccountAdapter({
  getClient = getSupabaseClient,
}: SupabaseDeleteAccountAdapterOptions = {}): DeleteAccountAdapter {
  return {
    async deleteAccountData({ userId }) {
      const normalizedUserId = userId.trim();
      const client = getClient();

      if (!client) return createFailedResult('delete_client_unavailable');
      if (!normalizedUserId) return createFailedResult('remote_delete_failed');

      try {
        for (const step of DELETE_ACCOUNT_STEPS) {
          const result = (await client
            .from(step.tableName)
            .delete()
            .eq(step.column, normalizedUserId)) as SupabaseDeleteResult;

          if (result.error) return createFailedResult('remote_delete_failed');
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
