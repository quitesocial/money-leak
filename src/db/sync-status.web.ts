import type {
  SyncAttemptSource,
  SyncMetadata,
  SyncSummary,
} from '@/lib/sync/sync-types';

export async function getSyncMetadata(): Promise<SyncMetadata> {
  return {
    lastSuccessfulSyncAt: null,
    lastSyncErrorAt: null,
    lastSyncSummary: null,
    lastSuccessfulSyncSource: null,
  };
}

export async function recordSyncSuccess(_input: {
  source: SyncAttemptSource;
  summary: SyncSummary;
}) {}

export async function recordSyncFailure(_timestamp: number) {}
