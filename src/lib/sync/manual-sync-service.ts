import { createSyncService } from '@/lib/sync/sync-service';
import { supabaseRemoteSyncAdapter } from '@/lib/sync/supabase-remote-sync-adapter';

export const manualSyncService = createSyncService({
  remoteAdapter: supabaseRemoteSyncAdapter,
});
