import { featureFlags } from '@/lib/feature-flags';
import {
  createLocalBackupDataSource,
  type LocalBackupDataSource,
} from '@/lib/sync/local-backup-data-source';
import {
  BACKUP_PAYLOAD_SCHEMA_VERSION,
  type BackupErrorCode,
  type BackupPayload,
  type BackupResult,
  type BackupService,
  type BackupSkippedReason,
  type RemoteBackupAdapter,
} from '@/lib/sync/sync-types';
import type { Category } from '@/types/category';
import type { Transaction } from '@/types/transaction';

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

    const nonDeletedCategories = localData.categories.filter(
      (category) => category.deletedAt === null,
    );

    return {
      userId: normalizedUserId,
      schemaVersion: BACKUP_PAYLOAD_SCHEMA_VERSION,
      createdAt: toRemoteTimestamp(now()),
      includesTombstones: true,
      transactions: localData.transactions.map((transaction) =>
        mapTransactionToRemote({
          transaction,
          userId: normalizedUserId,
        }),
      ),
      categories: nonDeletedCategories.map((category) =>
        mapCategoryToRemote({
          category,
          userId: normalizedUserId,
        }),
      ),
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
        };
      } catch {
        return createFailedResult('remote_write_failed');
      }
    },
  };
}

function mapTransactionToRemote({
  transaction,
  userId,
}: {
  transaction: Transaction;
  userId: string;
}) {
  return {
    id: transaction.id,
    userId,
    amount: transaction.amount,
    categoryId: transaction.category,
    isLeak: transaction.isLeak,
    leakReason: transaction.leakReason,
    note: transaction.note,
    createdAt: toRemoteTimestamp(transaction.createdAt),
    updatedAt: toRemoteTimestamp(transaction.updatedAt),
    deletedAt:
      transaction.deletedAt === null
        ? null
        : toRemoteTimestamp(transaction.deletedAt),
    schemaVersion: transaction.schemaVersion,
    sourceDeviceId: transaction.sourceDeviceId || null,
  };
}

function mapCategoryToRemote({
  category,
  userId,
}: {
  category: Category;
  userId: string;
}) {
  return {
    id: category.id,
    userId,
    name: category.name,
    isDefault: category.isDefault,
    isArchived: category.isArchived,
    sortOrder: category.sortOrder,
    createdAt: toRemoteTimestamp(category.createdAt),
    updatedAt: toRemoteTimestamp(category.updatedAt),
    deletedAt:
      category.deletedAt === null
        ? null
        : toRemoteTimestamp(category.deletedAt),
    schemaVersion: category.schemaVersion,
    sourceDeviceId: category.sourceDeviceId || null,
  };
}

function toRemoteTimestamp(epochMilliseconds: number) {
  if (
    typeof epochMilliseconds !== 'number' ||
    !Number.isFinite(epochMilliseconds)
  ) {
    throw new Error(
      'Remote backup timestamps must be finite epoch milliseconds.',
    );
  }

  return new Date(epochMilliseconds).toISOString();
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
