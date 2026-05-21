import type { SupabaseClient } from '@supabase/supabase-js';

import { getSupabaseClient } from '@/lib/supabase/supabase-client';
import {
  mapRemoteCategoryRow,
  mapRemoteTransactionRow,
  REMOTE_CATEGORY_COLUMNS,
  REMOTE_TRANSACTION_COLUMNS,
  type RemoteCategoryRow,
  type RemoteTransactionRow,
} from '@/lib/sync/supabase-remote-row-mappers';
import {
  BACKUP_PAYLOAD_SCHEMA_VERSION,
  type RemoteRestoreAdapter,
} from '@/lib/sync/sync-types';

type SupabaseRemoteRestoreClient = Pick<SupabaseClient, 'from'>;

type SupabaseRemoteRestoreAdapterOptions = {
  getClient?: () => SupabaseRemoteRestoreClient | null;
};

type SupabaseReadResult<T> = {
  data: T | null;
  error: unknown;
};

const GENERIC_REMOTE_RESTORE_ERROR_MESSAGE = 'Remote backup could not be read.';

export function createSupabaseRemoteRestoreAdapter({
  getClient = getSupabaseClient,
}: SupabaseRemoteRestoreAdapterOptions = {}): RemoteRestoreAdapter {
  return {
    async readBackup({ userId }) {
      const normalizedUserId = userId.trim();
      const client = getClient();

      if (!client || !normalizedUserId) {
        throw new Error(GENERIC_REMOTE_RESTORE_ERROR_MESSAGE);
      }

      try {
        const [categories, transactions] = await Promise.all([
          readRemoteCategories({ client, userId: normalizedUserId }),
          readRemoteTransactions({ client, userId: normalizedUserId }),
        ]);

        return {
          userId: normalizedUserId,
          schemaVersion: BACKUP_PAYLOAD_SCHEMA_VERSION,
          categories,
          transactions,
        };
      } catch {
        throw new Error(GENERIC_REMOTE_RESTORE_ERROR_MESSAGE);
      }
    },
  };
}

export const supabaseRemoteRestoreAdapter =
  createSupabaseRemoteRestoreAdapter();

async function readRemoteCategories({
  client,
  userId,
}: {
  client: SupabaseRemoteRestoreClient;
  userId: string;
}) {
  const result = (await client
    .from('remote_categories')
    .select(REMOTE_CATEGORY_COLUMNS)
    .eq('user_id', userId)) as SupabaseReadResult<RemoteCategoryRow[]>;

  if (result.error || !Array.isArray(result.data)) {
    throw new Error(GENERIC_REMOTE_RESTORE_ERROR_MESSAGE);
  }

  return result.data.map(mapRemoteCategoryRow);
}

async function readRemoteTransactions({
  client,
  userId,
}: {
  client: SupabaseRemoteRestoreClient;
  userId: string;
}) {
  const result = (await client
    .from('remote_transactions')
    .select(REMOTE_TRANSACTION_COLUMNS)
    .eq('user_id', userId)) as SupabaseReadResult<RemoteTransactionRow[]>;

  if (result.error || !Array.isArray(result.data)) {
    throw new Error(GENERIC_REMOTE_RESTORE_ERROR_MESSAGE);
  }

  return result.data.map(mapRemoteTransactionRow);
}
