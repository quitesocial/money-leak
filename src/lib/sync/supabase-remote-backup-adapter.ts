import type { SupabaseClient } from '@supabase/supabase-js';

import { getSupabaseClient } from '@/lib/supabase/supabase-client';
import {
  mapRemoteBalanceEntryToRow,
  mapRemoteBalanceTypeToRow,
  mapRemoteCategoryToRow,
  mapRemoteSettingToRow,
  mapRemoteTransactionToRow,
} from '@/lib/sync/supabase-remote-row-mappers';
import type { BackupPayload, RemoteBackupAdapter } from '@/lib/sync/sync-types';

type SupabaseRemoteBackupClient = Pick<SupabaseClient, 'from'>;

type SupabaseRemoteBackupAdapterOptions = {
  getClient?: () => SupabaseRemoteBackupClient | null;
};

type SupabaseWriteResult = {
  error: unknown;
};

const GENERIC_REMOTE_BACKUP_ERROR_MESSAGE =
  'Remote backup could not be written.';

export function createSupabaseRemoteBackupAdapter({
  getClient = getSupabaseClient,
}: SupabaseRemoteBackupAdapterOptions = {}): RemoteBackupAdapter {
  return {
    async writeBackup(payload: BackupPayload) {
      const client = getClient();

      if (!client) throw new Error(GENERIC_REMOTE_BACKUP_ERROR_MESSAGE);

      try {
        await upsertRemoteCategories({
          categories: payload.categories,
          client,
        });

        await upsertRemoteBalanceTypes({
          balanceTypes: payload.balanceTypes,
          client,
        });

        await upsertRemoteTransactions({
          client,
          transactions: payload.transactions,
        });

        await upsertRemoteBalanceEntries({
          balanceEntries: payload.balanceEntries,
          client,
        });

        await upsertRemoteSettings({
          client,
          settings: payload.settings ?? [],
        });
      } catch {
        throw new Error(GENERIC_REMOTE_BACKUP_ERROR_MESSAGE);
      }

      return {
        uploadedTransactionsCount: payload.transactions.length,
        uploadedCategoriesCount: payload.categories.length,
        uploadedBalanceTypesCount: payload.balanceTypes.length,
        uploadedBalanceEntriesCount: payload.balanceEntries.length,
        uploadedSettingsCount: payload.settings?.length ?? 0,
      };
    },
  };
}

export const supabaseRemoteBackupAdapter = createSupabaseRemoteBackupAdapter();

async function upsertRemoteCategories({
  categories,
  client,
}: {
  categories: BackupPayload['categories'];
  client: SupabaseRemoteBackupClient;
}) {
  if (categories.length === 0) return;

  const result = (await client
    .from('remote_categories')
    .upsert(categories.map(mapRemoteCategoryToRow), {
      onConflict: 'user_id,id',
    })) as SupabaseWriteResult;

  if (result.error) throw new Error(GENERIC_REMOTE_BACKUP_ERROR_MESSAGE);
}

async function upsertRemoteTransactions({
  client,
  transactions,
}: {
  client: SupabaseRemoteBackupClient;
  transactions: BackupPayload['transactions'];
}) {
  if (transactions.length === 0) return;

  const result = (await client
    .from('remote_transactions')
    .upsert(transactions.map(mapRemoteTransactionToRow), {
      onConflict: 'user_id,id',
    })) as SupabaseWriteResult;

  if (result.error) throw new Error(GENERIC_REMOTE_BACKUP_ERROR_MESSAGE);
}

async function upsertRemoteBalanceTypes({
  balanceTypes,
  client,
}: {
  balanceTypes: BackupPayload['balanceTypes'];
  client: SupabaseRemoteBackupClient;
}) {
  if (balanceTypes.length === 0) return;

  const result = (await client
    .from('remote_balance_types')
    .upsert(balanceTypes.map(mapRemoteBalanceTypeToRow), {
      onConflict: 'user_id,id',
    })) as SupabaseWriteResult;

  if (result.error) throw new Error(GENERIC_REMOTE_BACKUP_ERROR_MESSAGE);
}

async function upsertRemoteBalanceEntries({
  balanceEntries,
  client,
}: {
  balanceEntries: BackupPayload['balanceEntries'];
  client: SupabaseRemoteBackupClient;
}) {
  if (balanceEntries.length === 0) return;

  const result = (await client
    .from('remote_balance_entries')
    .upsert(balanceEntries.map(mapRemoteBalanceEntryToRow), {
      onConflict: 'user_id,id',
    })) as SupabaseWriteResult;

  if (result.error) throw new Error(GENERIC_REMOTE_BACKUP_ERROR_MESSAGE);
}

async function upsertRemoteSettings({
  client,
  settings,
}: {
  client: SupabaseRemoteBackupClient;
  settings: NonNullable<BackupPayload['settings']>;
}) {
  if (settings.length === 0) return;

  const result = (await client
    .from('remote_settings')
    .upsert(settings.map(mapRemoteSettingToRow), {
      onConflict: 'user_id,key',
    })) as SupabaseWriteResult;

  if (result.error) throw new Error(GENERIC_REMOTE_BACKUP_ERROR_MESSAGE);
}
