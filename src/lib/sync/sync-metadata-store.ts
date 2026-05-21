import {
  getSyncMetadata,
  recordSyncFailure,
  recordSyncSuccess,
} from '@/db/sync-status';
import type { LocalSyncMetadataStore } from '@/lib/sync/sync-types';

export function createLocalSyncMetadataStore({
  readMetadata = getSyncMetadata,
  writeFailure = recordSyncFailure,
  writeSuccess = recordSyncSuccess,
}: {
  readMetadata?: LocalSyncMetadataStore['getMetadata'];
  writeFailure?: LocalSyncMetadataStore['recordFailure'];
  writeSuccess?: LocalSyncMetadataStore['recordSuccess'];
} = {}): LocalSyncMetadataStore {
  return {
    getMetadata: readMetadata,
    recordFailure: writeFailure,
    recordSuccess: writeSuccess,
  };
}
