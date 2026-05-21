import type { RemoteCategory, RemoteTransaction } from '@/lib/sync/sync-types';

export type RemoteTransactionRow = {
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

export type RemoteCategoryRow = {
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

export type RemoteTransactionWriteRow = {
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

export type RemoteCategoryWriteRow = {
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

export const REMOTE_CATEGORY_COLUMNS = [
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

export const REMOTE_TRANSACTION_COLUMNS = [
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

export function mapRemoteTransactionToRow(
  transaction: RemoteTransaction,
): RemoteTransactionWriteRow {
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

export function mapRemoteCategoryToRow(
  category: RemoteCategory,
): RemoteCategoryWriteRow {
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

export function mapRemoteCategoryRow(row: RemoteCategoryRow): RemoteCategory {
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

export function mapRemoteTransactionRow(
  row: RemoteTransactionRow,
): RemoteTransaction {
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
    throw new Error(`Invalid remote sync row: ${fieldName}.`);
  }

  return value;
}

function parseNullableString(value: unknown, fieldName: string) {
  if (value === null) return null;

  return parseString(value, fieldName);
}

function parseNumber(value: unknown, fieldName: string) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`Invalid remote sync row: ${fieldName}.`);
  }

  return value;
}

function parseBoolean(value: unknown, fieldName: string) {
  if (typeof value !== 'boolean') {
    throw new Error(`Invalid remote sync row: ${fieldName}.`);
  }

  return value;
}

function parseNullableLeakReason(
  value: unknown,
): RemoteTransaction['leakReason'] {
  if (value === null) return null;

  return parseString(value, 'leak_reason') as RemoteTransaction['leakReason'];
}
