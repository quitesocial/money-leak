import { featureFlags } from '@/lib/feature-flags';
import { createLocalRestoreDataTarget } from '@/lib/sync/local-restore-data-target';
import type {
  LocalRestoreDataTarget,
  RemoteRestoreAdapter,
  RestoreErrorCode,
  RestorePayload,
  RestoreResult,
  RestoreService,
  RestoreSkippedReason,
} from '@/lib/sync/sync-types';

type RestoreServiceOptions = {
  adapter: RemoteRestoreAdapter;
  dataTarget?: LocalRestoreDataTarget;
  isRestoreEnabled?: boolean;
};

export function createRestoreService({
  adapter,
  dataTarget = createLocalRestoreDataTarget(),
  isRestoreEnabled = featureFlags.restoreEnabled,
}: RestoreServiceOptions): RestoreService {
  return {
    hasLocalData() {
      return dataTarget.hasLocalData();
    },

    async runRestore({ auth }) {
      if (!isRestoreEnabled) return createSkippedResult('restore_disabled');

      if (auth.status !== 'authenticated') {
        return createSkippedResult('guest_mode');
      }

      const userId = auth.userId?.trim();

      if (!userId) return createSkippedResult('missing_user_id');

      let payload: RestorePayload;

      try {
        payload = await adapter.readBackup({ userId });
      } catch {
        return createFailedResult('remote_read_failed');
      }

      if (!hasRestorableRemoteRows(payload)) {
        return {
          status: 'empty',
          restoredTransactionsCount: 0,
          restoredCategoriesCount: 0,
          isRecoverable: true,
        };
      }

      try {
        const result = await dataTarget.restoreBackup(payload);

        return {
          status: 'succeeded',
          restoredTransactionsCount: result.restoredTransactionsCount,
          restoredCategoriesCount: result.restoredCategoriesCount,
        };
      } catch {
        return createFailedResult('local_write_failed');
      }
    },
  };
}

function hasRestorableRemoteRows(payload: RestorePayload) {
  return (
    payload.categories.some((category) => category.deletedAt === null) ||
    payload.transactions.length > 0
  );
}

function createSkippedResult(
  skippedReason: RestoreSkippedReason,
): RestoreResult {
  return {
    status: 'skipped',
    skippedReason,
    isRecoverable: true,
  };
}

function createFailedResult(code: RestoreErrorCode): RestoreResult {
  return {
    status: 'failed',
    error: {
      code,
      isRecoverable: true,
      message: 'Restore could not finish. Local data remains on this device.',
    },
  };
}
