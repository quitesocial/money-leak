import type { SupabaseClient } from '@supabase/supabase-js';

import { getSupabaseClient } from '@/lib/supabase/supabase-client';
import type {
  BackupPayload,
  RemoteBackupAdapter,
  RemoteCategory,
  RemoteTransaction,
} from '@/lib/sync/sync-types';

type SupabaseRemoteBackupClient = Pick<SupabaseClient, 'from'>;

type SupabaseRemoteBackupAdapterOptions = {
  getClient?: () => SupabaseRemoteBackupClient | null;
};

type RemoteTransactionRow = {
  user_id: string;
  id: string;
  amount: number;
  category_id: string;
  is_leak: boolean;
  leak_reason: RemoteTransaction['leakReason'];
  note: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  schema_version: number;
  source_device_id: string | null;
};

type RemoteCategoryRow = {
  user_id: string;
  id: string;
  name: string;
  is_default: boolean;
  is_archived: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  schema_version: number;
  source_device_id: string | null;
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

        await upsertRemoteTransactions({
          client,
          transactions: payload.transactions,
        });
      } catch {
        throw new Error(GENERIC_REMOTE_BACKUP_ERROR_MESSAGE);
      }

      return {
        uploadedTransactionsCount: payload.transactions.length,
        uploadedCategoriesCount: payload.categories.length,
      };
    },
  };
}

export const supabaseRemoteBackupAdapter = createSupabaseRemoteBackupAdapter();

async function upsertRemoteCategories({
  categories,
  client,
}: {
  categories: RemoteCategory[];
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
  transactions: RemoteTransaction[];
}) {
  if (transactions.length === 0) return;

  const result = (await client
    .from('remote_transactions')
    .upsert(transactions.map(mapRemoteTransactionToRow), {
      onConflict: 'user_id,id',
    })) as SupabaseWriteResult;

  if (result.error) throw new Error(GENERIC_REMOTE_BACKUP_ERROR_MESSAGE);
}

function mapRemoteTransactionToRow(
  transaction: RemoteTransaction,
): RemoteTransactionRow {
  return {
    user_id: transaction.userId,
    id: transaction.id,
    amount: transaction.amount,
    category_id: transaction.categoryId,
    is_leak: transaction.isLeak,
    leak_reason: transaction.leakReason,
    note: transaction.note,
    created_at: transaction.createdAt,
    updated_at: transaction.updatedAt,
    deleted_at: transaction.deletedAt,
    schema_version: transaction.schemaVersion,
    source_device_id: transaction.sourceDeviceId,
  };
}

function mapRemoteCategoryToRow(category: RemoteCategory): RemoteCategoryRow {
  return {
    user_id: category.userId,
    id: category.id,
    name: category.name,
    is_default: category.isDefault,
    is_archived: category.isArchived,
    sort_order: category.sortOrder,
    created_at: category.createdAt,
    updated_at: category.updatedAt,
    deleted_at: category.deletedAt,
    schema_version: category.schemaVersion,
    source_device_id: category.sourceDeviceId,
  };
}
