import { Platform } from 'react-native';

import * as nativeBackupStatus from './backup-status.native';
import * as webBackupStatus from './backup-status.web';

type BackupStatusModule = {
  getLastSuccessfulBackupAt: () => Promise<number | null>;
  setLastSuccessfulBackupAt: (timestamp: number) => Promise<void>;
};

const backupStatusModule: BackupStatusModule =
  Platform.OS === 'web' ? webBackupStatus : nativeBackupStatus;

export const { getLastSuccessfulBackupAt, setLastSuccessfulBackupAt } =
  backupStatusModule;
