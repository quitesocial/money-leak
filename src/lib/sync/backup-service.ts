import { featureFlags } from '@/lib/feature-flags';
import {
  createLocalBackupDataSource,
  type LocalBackupDataSource,
} from '@/lib/sync/local-backup-data-source';
import {
  mapLocalBalanceEntryToRemote,
  mapLocalBalanceTypeToRemote,
  mapLocalCategoryToRemote,
  mapLocalSettingToRemote,
  mapLocalTransactionToRemote,
  toRemoteTimestamp,
} from '@/lib/sync/sync-mappers';
import {
  BACKUP_PAYLOAD_SCHEMA_VERSION,
  type BackupErrorCode,
  type BackupPayload,
  type BackupResult,
  type BackupService,
  type BackupSkippedReason,
  type RemoteBackupAdapter,
} from '@/lib/sync/sync-types';

type BackupServiceOptions = {
  adapter: RemoteBackupAdapter;
  dataSource?: LocalBackupDataSource;
  isBackupEnabled?: boolean;
  now?: () => number;
};

export function createBackupService({
  adapter,
  dataSource = createLocalBackupDataSource(),
  isBackupEnabled = featureFlags.backupEnabled,
  now = Date.now,
}: BackupServiceOptions): BackupService {
  async function prepareBackupPayload({
    userId,
  }: {
    userId: string;
  }): Promise<BackupPayload> {
    const normalizedUserId = userId.trim();

    if (!normalizedUserId) {
      throw new Error('Authenticated user id is required for backup payloads.');
    }

    const localData = await dataSource.getBackupData();

    return {
      userId: normalizedUserId,
      schemaVersion: BACKUP_PAYLOAD_SCHEMA_VERSION,
      createdAt: toRemoteTimestamp(now()),
      includesTombstones: true,
      includesBalance: true,
      transactions: localData.transactions.map((transaction) =>
        mapLocalTransactionToRemote({
          transaction,
          userId: normalizedUserId,
        }),
      ),
      categories: localData.categories.map((category) =>
        mapLocalCategoryToRemote({
          category,
          userId: normalizedUserId,
        }),
      ),
      balanceTypes: localData.balanceTypes.map((balanceType) =>
        mapLocalBalanceTypeToRemote({
          balanceType,
          userId: normalizedUserId,
        }),
      ),
      balanceEntries: localData.balanceEntries.map((entry) =>
        mapLocalBalanceEntryToRemote({
          entry,
          userId: normalizedUserId,
        }),
      ),
      settings: localData.settings
        ? [
            mapLocalSettingToRemote({
              setting: localData.settings.currency,
              userId: normalizedUserId,
            }),
            mapLocalSettingToRemote({
              setting: localData.settings.language,
              userId: normalizedUserId,
            }),
          ]
        : [],
    };
  }

  return {
    prepareBackupPayload,
    async runBackup({ auth }) {
      if (!isBackupEnabled) return createSkippedResult('backup_disabled');

      if (auth.status !== 'authenticated') {
        return createSkippedResult('guest_mode');
      }

      const userId = auth.userId?.trim();

      if (!userId) return createSkippedResult('missing_user_id');

      let payload: BackupPayload;

      try {
        payload = await prepareBackupPayload({ userId });
      } catch {
        return createFailedResult('local_read_failed');
      }

      try {
        const writeResult = await adapter.writeBackup(payload);

        return {
          status: 'succeeded',
          payload,
          uploadedTransactionsCount: writeResult.uploadedTransactionsCount,
          uploadedCategoriesCount: writeResult.uploadedCategoriesCount,
          uploadedBalanceTypesCount: writeResult.uploadedBalanceTypesCount,
          uploadedBalanceEntriesCount: writeResult.uploadedBalanceEntriesCount,
          uploadedSettingsCount: writeResult.uploadedSettingsCount,
        };
      } catch {
        return createFailedResult('remote_write_failed');
      }
    },
  };
}

function createSkippedResult(skippedReason: BackupSkippedReason): BackupResult {
  return {
    status: 'skipped',
    payload: null,
    skippedReason,
    isRecoverable: true,
  };
}

function createFailedResult(code: BackupErrorCode): BackupResult {
  return {
    status: 'failed',
    payload: null,
    error: {
      code,
      isRecoverable: true,
      message: 'Backup could not finish. Local data remains on this device.',
    },
  };
}
