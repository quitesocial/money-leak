import type { AuthStatus } from '@/types/auth';
import type { LeakReason } from '@/types/transaction';
import type { SettingsPreferenceKey } from '@/lib/settings-preferences';

export const BACKUP_PAYLOAD_SCHEMA_VERSION = 2;

export type RemoteTransaction = {
  id: string;
  userId: string;
  amount: number;
  categoryId: string;
  isLeak: boolean;
  leakReason: LeakReason | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  schemaVersion: number;
  sourceDeviceId: string | null;
};

export type RemoteCategory = {
  id: string;
  userId: string;
  name: string;
  isDefault: boolean;
  isArchived: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  schemaVersion: number;
  sourceDeviceId: string | null;
};

export type RemoteBalanceType = {
  id: string;
  userId: string;
  name: string;
  isDefault: boolean;
  isArchived: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  schemaVersion: number;
  sourceDeviceId: string | null;
};

export type RemoteBalanceEntry = {
  id: string;
  userId: string;
  amount: number;
  typeId: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  schemaVersion: number;
  sourceDeviceId: string | null;
};

export type RemoteSetting = {
  userId: string;
  key: SettingsPreferenceKey;
  value: string;
  updatedAt: string;
  schemaVersion: number;
  sourceDeviceId: string | null;
};

export type BackupPayload = {
  userId: string;
  schemaVersion: typeof BACKUP_PAYLOAD_SCHEMA_VERSION;
  createdAt: string;
  includesTombstones: boolean;
  includesBalance: true;
  transactions: RemoteTransaction[];
  categories: RemoteCategory[];
  balanceTypes: RemoteBalanceType[];
  balanceEntries: RemoteBalanceEntry[];
  settings?: RemoteSetting[];
};

export type BackupSkippedReason =
  | 'backup_disabled'
  | 'guest_mode'
  | 'missing_user_id';

export type BackupErrorCode = 'local_read_failed' | 'remote_write_failed';

export type BackupResult =
  | {
      status: 'succeeded';
      payload: BackupPayload;
      uploadedTransactionsCount: number;
      uploadedCategoriesCount: number;
      uploadedBalanceTypesCount: number;
      uploadedBalanceEntriesCount: number;
      uploadedSettingsCount?: number;
    }
  | {
      status: 'skipped';
      payload: null;
      skippedReason: BackupSkippedReason;
      isRecoverable: true;
    }
  | {
      status: 'failed';
      payload: null;
      error: {
        code: BackupErrorCode;
        isRecoverable: true;
        message: string;
      };
    };

export type RestorePayload = {
  userId: string;
  schemaVersion: typeof BACKUP_PAYLOAD_SCHEMA_VERSION;
  categories: RemoteCategory[];
  transactions: RemoteTransaction[];
  balanceTypes: RemoteBalanceType[];
  balanceEntries: RemoteBalanceEntry[];
  settings?: RemoteSetting[];
};

export type RestoreSkippedReason =
  | 'restore_disabled'
  | 'guest_mode'
  | 'missing_user_id';

export type RestoreErrorCode = 'remote_read_failed' | 'local_write_failed';

export type RestoreResult =
  | {
      status: 'succeeded';
      restoredTransactionsCount: number;
      restoredCategoriesCount: number;
      restoredBalanceTypesCount: number;
      restoredBalanceEntriesCount: number;
      ignoredSettingsCount?: number;
      restoredSettingsCount?: number;
    }
  | {
      status: 'empty';
      restoredTransactionsCount: 0;
      restoredCategoriesCount: 0;
      restoredBalanceTypesCount: 0;
      restoredBalanceEntriesCount: 0;
      ignoredSettingsCount?: 0;
      restoredSettingsCount?: 0;
      isRecoverable: true;
    }
  | {
      status: 'skipped';
      skippedReason: RestoreSkippedReason;
      isRecoverable: true;
    }
  | {
      status: 'failed';
      error: {
        code: RestoreErrorCode;
        isRecoverable: true;
        message: string;
      };
    };

export type RemoteBackupWriteResult = {
  uploadedTransactionsCount: number;
  uploadedCategoriesCount: number;
  uploadedBalanceTypesCount: number;
  uploadedBalanceEntriesCount: number;
  uploadedSettingsCount?: number;
};

export type RemoteBackupAdapter = {
  writeBackup: (payload: BackupPayload) => Promise<RemoteBackupWriteResult>;
};

export type RemoteRestoreAdapter = {
  readBackup: (input: { userId: string }) => Promise<RestorePayload>;
};

export type LocalRestoreWriteResult = {
  restoredTransactionsCount: number;
  restoredCategoriesCount: number;
  restoredBalanceTypesCount: number;
  restoredBalanceEntriesCount: number;
  ignoredSettingsCount?: number;
  restoredSettingsCount?: number;
};

export type LocalRestoreDataTarget = {
  hasLocalData: () => Promise<boolean>;
  restoreBackup: (payload: RestorePayload) => Promise<LocalRestoreWriteResult>;
};

export type BackupAuthContext = {
  status: AuthStatus;
  userId: string | null | undefined;
};

export type SyncAuthContext = BackupAuthContext;

export type BackupService = {
  prepareBackupPayload: (input: { userId: string }) => Promise<BackupPayload>;
  runBackup: (input: { auth: BackupAuthContext }) => Promise<BackupResult>;
};

export type RestoreService = {
  hasLocalData: () => Promise<boolean>;
  runRestore: (input: { auth: BackupAuthContext }) => Promise<RestoreResult>;
};

export type SyncSkippedReason =
  | 'sync_disabled'
  | 'guest_mode'
  | 'missing_user_id'
  | 'missing_session'
  | 'session_user_mismatch';

export type SyncErrorCode =
  | 'metadata_read_failed'
  | 'local_read_failed'
  | 'remote_read_failed'
  | 'local_write_failed'
  | 'remote_write_failed'
  | 'metadata_write_failed';

export type SyncCounts = {
  pulledTransactionsCount: number;
  pulledCategoriesCount: number;
  pulledBalanceTypesCount: number;
  pulledBalanceEntriesCount: number;
  pulledSettingsCount?: number;
  appliedTransactionsCount: number;
  appliedCategoriesCount: number;
  appliedBalanceTypesCount: number;
  appliedBalanceEntriesCount: number;
  appliedSettingsCount?: number;
  pushedTransactionsCount: number;
  pushedCategoriesCount: number;
  pushedBalanceTypesCount: number;
  pushedBalanceEntriesCount: number;
  pushedSettingsCount?: number;
  ignoredTransactionTombstonesCount: number;
  ignoredCategoryTombstonesCount: number;
  ignoredBalanceTypeTombstonesCount: number;
  ignoredBalanceEntryTombstonesCount: number;
  ignoredSettingsCount?: number;
  conflictsCount: number;
};

export type SyncSummary = SyncCounts & {
  completedAt: number;
  cursor: number;
};

export type SyncAttemptSource = 'manual' | 'foreground';

export type SyncMetadata = {
  lastSuccessfulSyncAt: number | null;
  lastSyncErrorAt: number | null;
  lastSyncSummary: SyncSummary | null;
  lastSuccessfulSyncSource: SyncAttemptSource | null;
};

export type SyncResult =
  | ({
      status: 'succeeded';
      lastSuccessfulSyncAt: number;
    } & SyncCounts)
  | {
      status: 'skipped';
      skippedReason: SyncSkippedReason;
      isRecoverable: true;
    }
  | {
      status: 'failed';
      error: {
        code: SyncErrorCode;
        isRecoverable: true;
        message: string;
      };
    };

export type RemoteSyncChanges = {
  transactions: RemoteTransaction[];
  categories: RemoteCategory[];
  balanceTypes: RemoteBalanceType[];
  balanceEntries: RemoteBalanceEntry[];
  settings?: RemoteSetting[];
};

export type RemoteSyncPushResult = {
  pushedTransactionsCount: number;
  pushedCategoriesCount: number;
  pushedBalanceTypesCount: number;
  pushedBalanceEntriesCount: number;
  pushedSettingsCount?: number;
};

export type RemoteSyncAdapter = {
  getAuthenticatedUserId: () => Promise<string | null>;
  pullChanges: (input: {
    userId: string;
    since: number | null;
  }) => Promise<RemoteSyncChanges>;
  pushChanges: (input: {
    userId: string;
    transactions: RemoteTransaction[];
    categories: RemoteCategory[];
    balanceTypes: RemoteBalanceType[];
    balanceEntries: RemoteBalanceEntry[];
    settings?: RemoteSetting[];
  }) => Promise<RemoteSyncPushResult>;
};

export type LocalSyncWriteResult = {
  appliedTransactionsCount: number;
  appliedCategoriesCount: number;
  appliedBalanceTypesCount: number;
  appliedBalanceEntriesCount: number;
  appliedSettingsCount?: number;
  ignoredSettingsCount?: number;
};

export type LocalSyncDataTarget = {
  applyRemoteChanges: (
    changes: RemoteSyncChanges,
  ) => Promise<LocalSyncWriteResult>;
};

export type LocalSyncMetadataStore = {
  getMetadata: () => Promise<SyncMetadata>;
  recordSuccess: (input: {
    source: SyncAttemptSource;
    summary: SyncSummary;
  }) => Promise<void>;
  recordFailure: (timestamp: number) => Promise<void>;
};

export type SyncService = {
  isIncrementalSyncInFlight: () => boolean;
  runIncrementalSync: (input: {
    auth: SyncAuthContext;
    source: SyncAttemptSource;
  }) => Promise<SyncResult>;
};
