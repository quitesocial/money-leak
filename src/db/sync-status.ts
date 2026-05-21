import { Platform } from 'react-native';

import * as nativeSyncStatus from './sync-status.native';
import * as webSyncStatus from './sync-status.web';

type SyncStatusModule = {
  getSyncMetadata: typeof nativeSyncStatus.getSyncMetadata;
  recordSyncSuccess: typeof nativeSyncStatus.recordSyncSuccess;
  recordSyncFailure: typeof nativeSyncStatus.recordSyncFailure;
};

const syncStatusModule: SyncStatusModule =
  Platform.OS === 'web' ? webSyncStatus : nativeSyncStatus;

export const { getSyncMetadata, recordSyncFailure, recordSyncSuccess } =
  syncStatusModule;
