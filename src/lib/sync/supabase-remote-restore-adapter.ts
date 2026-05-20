import type { SupabaseClient } from '@supabase/supabase-js';

import { getSupabaseClient } from '@/lib/supabase/supabase-client';
import {
  BACKUP_PAYLOAD_SCHEMA_VERSION,
  type RemoteCategory,
  type RemoteRestoreAdapter,
  type RemoteTransaction,
} from '@/lib/sync/sync-types';

type SupabaseRemoteRestoreClient = Pick<SupabaseClient, 'from'>;

type SupabaseRemoteRestoreAdapterOptions = {
  getClient?: () => SupabaseRemoteRestoreClient | null;
};

type SupabaseReadResult<T> = {
  data: T | null;
  error: unknown;
};

type RemoteTransactionRow = {
  user_id: unknown;
  id: unknown;
  amount: unknown;
  category_id: unknown;
  is_leak: unknown;
  leak_reason: unknown;
  note: unknown;
  created_at: unknown;
  updated_at: unknown;
  deleted_at: unknown;
  schema_version: unknown;
  source_device_id: unknown;
};

type RemoteCategoryRow = {
  user_id: unknown;
  id: unknown;
  name: unknown;
  is_default: unknown;
  is_archived: unknown;
  sort_order: unknown;
  created_at: unknown;
  updated_at: unknown;
  deleted_at: unknown;
  schema_version: unknown;
  source_device_id: unknown;
};

const REMOTE_CATEGORY_COLUMNS = [
  'user_id',
  'id',
  'name',
  'is_default',
  'is_archived',
  'sort_order',
  'created_at',
  'updated_at',
  'deleted_at',
  'schema_version',
  'source_device_id',
].join(',');

const REMOTE_TRANSACTION_COLUMNS = [
  'user_id',
  'id',
  'amount',
  'category_id',
  'is_leak',
  'leak_reason',
  'note',
  'created_at',
  'updated_at',
  'deleted_at',
  'schema_version',
  'source_device_id',
].join(',');

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

function mapRemoteCategoryRow(row: RemoteCategoryRow): RemoteCategory {
  return {
    id: parseString(row.id, 'id'),
    userId: parseString(row.user_id, 'user_id'),
    name: parseString(row.name, 'name'),
    isDefault: parseBoolean(row.is_default, 'is_default'),
    isArchived: parseBoolean(row.is_archived, 'is_archived'),
    sortOrder: parseNumber(row.sort_order, 'sort_order'),
    createdAt: parseString(row.created_at, 'created_at'),
    updatedAt: parseString(row.updated_at, 'updated_at'),
    deletedAt: parseNullableString(row.deleted_at, 'deleted_at'),
    schemaVersion: parseNumber(row.schema_version, 'schema_version'),
    sourceDeviceId: parseNullableString(
      row.source_device_id,
      'source_device_id',
    ),
  };
}

function mapRemoteTransactionRow(row: RemoteTransactionRow): RemoteTransaction {
  return {
    id: parseString(row.id, 'id'),
    userId: parseString(row.user_id, 'user_id'),
    amount: parseNumber(row.amount, 'amount'),
    categoryId: parseString(row.category_id, 'category_id'),
    isLeak: parseBoolean(row.is_leak, 'is_leak'),
    leakReason: parseNullableLeakReason(row.leak_reason),
    note: parseNullableString(row.note, 'note'),
    createdAt: parseString(row.created_at, 'created_at'),
    updatedAt: parseString(row.updated_at, 'updated_at'),
    deletedAt: parseNullableString(row.deleted_at, 'deleted_at'),
    schemaVersion: parseNumber(row.schema_version, 'schema_version'),
    sourceDeviceId: parseNullableString(
      row.source_device_id,
      'source_device_id',
    ),
  };
}

function parseString(value: unknown, fieldName: string) {
  if (typeof value !== 'string') {
    throw new Error(`Invalid remote restore row: ${fieldName}.`);
  }

  return value;
}

function parseNullableString(value: unknown, fieldName: string) {
  if (value === null) return null;

  return parseString(value, fieldName);
}

function parseNumber(value: unknown, fieldName: string) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`Invalid remote restore row: ${fieldName}.`);
  }

  return value;
}

function parseBoolean(value: unknown, fieldName: string) {
  if (typeof value !== 'boolean') {
    throw new Error(`Invalid remote restore row: ${fieldName}.`);
  }

  return value;
}

function parseNullableLeakReason(
  value: unknown,
): RemoteTransaction['leakReason'] {
  if (value === null) return null;

  return parseString(value, 'leak_reason') as RemoteTransaction['leakReason'];
}
