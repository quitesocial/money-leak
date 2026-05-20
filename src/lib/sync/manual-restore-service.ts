import { createRestoreService } from '@/lib/sync/restore-service';
import { supabaseRemoteRestoreAdapter } from '@/lib/sync/supabase-remote-restore-adapter';

export const manualRestoreService = createRestoreService({
  adapter: supabaseRemoteRestoreAdapter,
});
