import type { SyncMetadata, SyncSummary } from '@/lib/sync/sync-types';

export async function getSyncMetadata(): Promise<SyncMetadata> {
  return {
    lastSuccessfulSyncAt: null,
    lastSyncErrorAt: null,
    lastSyncSummary: null,
  };
}

export async function recordSyncSuccess(_summary: SyncSummary) {}

export async function recordSyncFailure(_timestamp: number) {}
