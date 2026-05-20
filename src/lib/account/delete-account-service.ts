import { supabaseDeleteAccountAdapter } from '@/lib/account/supabase-delete-account-adapter';
import type { AuthStatus } from '@/types/auth';

export type DeleteAccountAuthContext = {
  status: AuthStatus;
  userId: string | null | undefined;
};

export type DeleteAccountSkippedReason = 'guest_mode' | 'missing_user_id';

export type DeleteAccountErrorCode =
  | 'delete_client_unavailable'
  | 'remote_delete_failed';

export type DeleteAccountResult =
  | {
      status: 'succeeded';
    }
  | {
      status: 'skipped';
      skippedReason: DeleteAccountSkippedReason;
      isRecoverable: true;
    }
  | {
      status: 'failed';
      error: {
        code: DeleteAccountErrorCode;
        isRecoverable: true;
        message: string;
      };
    };

export type DeleteAccountAdapter = {
  deleteAccountData: (input: {
    userId: string;
  }) => Promise<DeleteAccountResult>;
};

type DeleteAccountServiceOptions = {
  adapter: DeleteAccountAdapter;
};

export type DeleteAccountService = {
  runDeleteAccount: (input: {
    auth: DeleteAccountAuthContext;
  }) => Promise<DeleteAccountResult>;
};

export function createDeleteAccountService({
  adapter,
}: DeleteAccountServiceOptions): DeleteAccountService {
  return {
    async runDeleteAccount({ auth }) {
      if (auth.status !== 'authenticated') {
        return createSkippedResult('guest_mode');
      }

      const userId = auth.userId?.trim();

      if (!userId) return createSkippedResult('missing_user_id');

      try {
        return await adapter.deleteAccountData({ userId });
      } catch {
        return createFailedResult('remote_delete_failed');
      }
    },
  };
}

function createSkippedResult(
  skippedReason: DeleteAccountSkippedReason,
): DeleteAccountResult {
  return {
    status: 'skipped',
    skippedReason,
    isRecoverable: true,
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

export const deleteAccountService = createDeleteAccountService({
  adapter: supabaseDeleteAccountAdapter,
});
