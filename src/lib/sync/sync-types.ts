import type { AuthStatus } from '@/types/auth';
import type { LeakReason } from '@/types/transaction';

export const BACKUP_PAYLOAD_SCHEMA_VERSION = 1;

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

export type BackupPayload = {
  userId: string;
  schemaVersion: typeof BACKUP_PAYLOAD_SCHEMA_VERSION;
  createdAt: string;
  includesTombstones: false;
  transactions: RemoteTransaction[];
  categories: RemoteCategory[];
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
    }
  | {
      status: 'empty';
      restoredTransactionsCount: 0;
      restoredCategoriesCount: 0;
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
};

export type LocalRestoreDataTarget = {
  hasLocalData: () => Promise<boolean>;
  restoreBackup: (payload: RestorePayload) => Promise<LocalRestoreWriteResult>;
};

export type BackupAuthContext = {
  status: AuthStatus;
  userId: string | null | undefined;
};

export type BackupService = {
  prepareBackupPayload: (input: { userId: string }) => Promise<BackupPayload>;
  runBackup: (input: { auth: BackupAuthContext }) => Promise<BackupResult>;
};

export type RestoreService = {
  hasLocalData: () => Promise<boolean>;
  runRestore: (input: { auth: BackupAuthContext }) => Promise<RestoreResult>;
};
