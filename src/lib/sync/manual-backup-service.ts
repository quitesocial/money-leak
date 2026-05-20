import { createBackupService } from '@/lib/sync/backup-service';
import { supabaseRemoteBackupAdapter } from '@/lib/sync/supabase-remote-backup-adapter';

export const manualBackupService = createBackupService({
  adapter: supabaseRemoteBackupAdapter,
});
