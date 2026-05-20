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

export type RestoreResult = {
  status: 'not_implemented';
  isRecoverable: true;
  message: string;
};

export type RemoteBackupWriteResult = {
  uploadedTransactionsCount: number;
  uploadedCategoriesCount: number;
};

export type RemoteBackupAdapter = {
  writeBackup: (payload: BackupPayload) => Promise<RemoteBackupWriteResult>;
};

export type BackupAuthContext = {
  status: AuthStatus;
  userId: string | null | undefined;
};

export type BackupService = {
  prepareBackupPayload: (input: { userId: string }) => Promise<BackupPayload>;
  runBackup: (input: { auth: BackupAuthContext }) => Promise<BackupResult>;
};
