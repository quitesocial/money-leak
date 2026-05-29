import type {
  BalanceEntry,
  BalanceEntryInput,
  BalanceEntryRestoreInput,
  BalanceEntryTombstoneRestoreInput,
  BalanceType,
  BalanceTypeInput,
  BalanceTypeTombstoneRestoreInput,
} from '@/types/balance';
import { sortBalanceTypes } from '@/lib/balance-utils';

import { ensureLocalIdentity } from './local-identity.native';
import { getDatabase, initDatabase } from './database.native';

export { initDatabase };

type BalanceEntryRow = {
  id: unknown;
  owner_id: unknown;
  amount: unknown;
  type_id: unknown;
  created_at: unknown;
  updated_at: unknown;
  deleted_at: unknown;
  schema_version: unknown;
  source_device_id: unknown;
};

type BalanceTypeRow = {
  id: unknown;
  owner_id: unknown;
  name: unknown;
  created_at: unknown;
  updated_at: unknown;
  is_default: unknown;
  is_archived: unknown;
  deleted_at: unknown;
  schema_version: unknown;
  source_device_id: unknown;
  sort_order: unknown;
};

export async function getBalanceEntries() {
  await initDatabase();

  const database = await getDatabase();
  const rows = await database.getAllAsync<BalanceEntryRow>(
    `
      SELECT
        id,
        owner_id,
        amount,
        type_id,
        created_at,
        updated_at,
        deleted_at,
        schema_version,
        source_device_id
      FROM balance_entries
      WHERE deleted_at IS NULL
      ORDER BY created_at DESC, id DESC
    `,
  );

  return rows.map(mapBalanceEntryRow);
}

export async function createBalanceEntry(entry: BalanceEntryInput) {
  await initDatabase();

  const database = await getDatabase();
  const identity = await ensureLocalIdentity(database);

  await database.runAsync(
    `
      INSERT INTO balance_entries (
        id,
        owner_id,
        amount,
        type_id,
        created_at,
        updated_at,
        deleted_at,
        schema_version,
        source_device_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    entry.id,
    identity.localOwnerId,
    entry.amount,
    entry.typeId,
    entry.createdAt,
    entry.createdAt,
    null,
    1,
    identity.deviceId,
  );
}

export async function getBalanceEntriesForBackup() {
  await initDatabase();

  const database = await getDatabase();
  const rows = await database.getAllAsync<BalanceEntryRow>(
    `
      SELECT
        id,
        owner_id,
        amount,
        type_id,
        created_at,
        updated_at,
        deleted_at,
        schema_version,
        source_device_id
      FROM balance_entries
      ORDER BY created_at DESC, id DESC
    `,
  );

  return rows.map(mapBalanceEntryRow);
}

export async function getBalanceTypes() {
  await initDatabase();

  const database = await getDatabase();
  const rows = await database.getAllAsync<BalanceTypeRow>(
    `
      SELECT
        id,
        owner_id,
        name,
        created_at,
        updated_at,
        is_default,
        is_archived,
        deleted_at,
        schema_version,
        source_device_id,
        sort_order
      FROM balance_types
      WHERE deleted_at IS NULL
      ORDER BY sort_order ASC, created_at ASC, id ASC
    `,
  );

  return sortBalanceTypes(rows.map(mapBalanceTypeRow));
}

export async function getBalanceTypesForBackup() {
  await initDatabase();

  const database = await getDatabase();
  const rows = await database.getAllAsync<BalanceTypeRow>(
    `
      SELECT
        id,
        owner_id,
        name,
        created_at,
        updated_at,
        is_default,
        is_archived,
        deleted_at,
        schema_version,
        source_device_id,
        sort_order
      FROM balance_types
      ORDER BY sort_order ASC, created_at ASC, id ASC
    `,
  );

  return sortBalanceTypes(rows.map(mapBalanceTypeRow));
}

export async function createBalanceType(balanceType: BalanceTypeInput) {
  await initDatabase();

  const database = await getDatabase();
  const identity = await ensureLocalIdentity(database);

  await database.runAsync(
    `
      INSERT INTO balance_types (
        id,
        owner_id,
        name,
        created_at,
        updated_at,
        is_default,
        is_archived,
        deleted_at,
        schema_version,
        source_device_id,
        sort_order
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    balanceType.id,
    identity.localOwnerId,
    balanceType.name,
    balanceType.createdAt,
    balanceType.updatedAt,
    balanceType.isDefault ? 1 : 0,
    balanceType.isArchived ? 1 : 0,
    null,
    1,
    identity.deviceId,
    balanceType.sortOrder,
  );
}

export async function restoreBalanceTypes(balanceTypes: BalanceTypeInput[]) {
  if (!balanceTypes.length) return 0;

  await initDatabase();

  const database = await getDatabase();
  const identity = await ensureLocalIdentity(database);
  let restoredCount = 0;

  await database.withExclusiveTransactionAsync(async (transactionDatabase) => {
    for (const balanceType of balanceTypes) {
      const result = await transactionDatabase.runAsync(
        `
          INSERT OR IGNORE INTO balance_types (
            id,
            owner_id,
            name,
            created_at,
            updated_at,
            is_default,
            is_archived,
            deleted_at,
            schema_version,
            source_device_id,
            sort_order
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        balanceType.id,
        identity.localOwnerId,
        balanceType.name,
        balanceType.createdAt,
        balanceType.updatedAt,
        balanceType.isDefault ? 1 : 0,
        balanceType.isArchived ? 1 : 0,
        null,
        1,
        identity.deviceId,
        balanceType.sortOrder,
      );

      restoredCount += getChangedRowCount(result);
    }
  });

  return restoredCount;
}

export async function restoreBalanceTypeTombstones(
  tombstones: BalanceTypeTombstoneRestoreInput[],
) {
  if (!tombstones.length) return 0;

  await initDatabase();

  const database = await getDatabase();
  const identity = await ensureLocalIdentity(database);
  let restoredCount = 0;

  await database.withExclusiveTransactionAsync(async (transactionDatabase) => {
    for (const tombstone of tombstones) {
      const result = await transactionDatabase.runAsync(
        `
          UPDATE balance_types
          SET
            deleted_at = ?,
            updated_at = ?,
            source_device_id = ?
          WHERE id = ? AND deleted_at IS NULL
        `,
        tombstone.deletedAt,
        tombstone.updatedAt,
        identity.deviceId,
        tombstone.id,
      );

      restoredCount += getChangedRowCount(result);
    }
  });

  return restoredCount;
}

export async function restoreBalanceEntries(
  entries: BalanceEntryRestoreInput[],
) {
  if (!entries.length) return 0;

  await initDatabase();

  const database = await getDatabase();
  const identity = await ensureLocalIdentity(database);
  let restoredCount = 0;

  await database.withExclusiveTransactionAsync(async (transactionDatabase) => {
    for (const entry of entries) {
      const result = await transactionDatabase.runAsync(
        `
          INSERT OR IGNORE INTO balance_entries (
            id,
            owner_id,
            amount,
            type_id,
            created_at,
            updated_at,
            deleted_at,
            schema_version,
            source_device_id
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        entry.id,
        identity.localOwnerId,
        entry.amount,
        entry.typeId,
        entry.createdAt,
        entry.updatedAt,
        null,
        1,
        identity.deviceId,
      );

      restoredCount += getChangedRowCount(result);
    }
  });

  return restoredCount;
}

export async function restoreBalanceEntryTombstones(
  tombstones: BalanceEntryTombstoneRestoreInput[],
) {
  if (!tombstones.length) return 0;

  await initDatabase();

  const database = await getDatabase();
  const identity = await ensureLocalIdentity(database);
  let restoredCount = 0;

  await database.withExclusiveTransactionAsync(async (transactionDatabase) => {
    for (const tombstone of tombstones) {
      const result = await transactionDatabase.runAsync(
        `
          UPDATE balance_entries
          SET
            deleted_at = ?,
            updated_at = ?,
            source_device_id = ?
          WHERE id = ? AND deleted_at IS NULL
        `,
        tombstone.deletedAt,
        tombstone.updatedAt,
        identity.deviceId,
        tombstone.id,
      );

      restoredCount += getChangedRowCount(result);
    }
  });

  return restoredCount;
}

export async function applyBalanceSyncChanges({
  entryTombstones,
  entryUpserts,
  typeTombstones,
  typeUpserts,
}: {
  entryUpserts: BalanceEntryRestoreInput[];
  entryTombstones: BalanceEntryTombstoneRestoreInput[];
  typeUpserts: BalanceTypeInput[];
  typeTombstones: BalanceTypeTombstoneRestoreInput[];
}) {
  if (
    !entryUpserts.length &&
    !entryTombstones.length &&
    !typeUpserts.length &&
    !typeTombstones.length
  ) {
    return {
      upsertedBalanceTypesCount: 0,
      deletedBalanceTypesCount: 0,
      upsertedBalanceEntriesCount: 0,
      deletedBalanceEntriesCount: 0,
    };
  }

  await initDatabase();

  const database = await getDatabase();
  const identity = await ensureLocalIdentity(database);
  let upsertedBalanceTypesCount = 0;
  let deletedBalanceTypesCount = 0;
  let upsertedBalanceEntriesCount = 0;
  let deletedBalanceEntriesCount = 0;

  await database.withExclusiveTransactionAsync(async (transactionDatabase) => {
    for (const balanceType of typeUpserts) {
      const updateResult = await transactionDatabase.runAsync(
        `
          UPDATE balance_types
          SET
            name = ?,
            created_at = ?,
            updated_at = ?,
            is_default = ?,
            is_archived = ?,
            deleted_at = NULL,
            schema_version = ?,
            source_device_id = ?,
            sort_order = ?
          WHERE id = ?
        `,
        balanceType.name,
        balanceType.createdAt,
        balanceType.updatedAt,
        balanceType.isDefault ? 1 : 0,
        balanceType.isArchived ? 1 : 0,
        1,
        identity.deviceId,
        balanceType.sortOrder,
        balanceType.id,
      );

      const updatedRows = getChangedRowCount(updateResult);

      if (updatedRows > 0) {
        upsertedBalanceTypesCount += updatedRows;

        continue;
      }

      const insertResult = await transactionDatabase.runAsync(
        `
          INSERT OR IGNORE INTO balance_types (
            id,
            owner_id,
            name,
            created_at,
            updated_at,
            is_default,
            is_archived,
            deleted_at,
            schema_version,
            source_device_id,
            sort_order
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        balanceType.id,
        identity.localOwnerId,
        balanceType.name,
        balanceType.createdAt,
        balanceType.updatedAt,
        balanceType.isDefault ? 1 : 0,
        balanceType.isArchived ? 1 : 0,
        null,
        1,
        identity.deviceId,
        balanceType.sortOrder,
      );

      upsertedBalanceTypesCount += getChangedRowCount(insertResult);
    }

    for (const entry of entryUpserts) {
      const updateResult = await transactionDatabase.runAsync(
        `
          UPDATE balance_entries
          SET
            amount = ?,
            type_id = ?,
            created_at = ?,
            updated_at = ?,
            deleted_at = NULL,
            schema_version = ?,
            source_device_id = ?
          WHERE id = ?
        `,
        entry.amount,
        entry.typeId,
        entry.createdAt,
        entry.updatedAt,
        1,
        identity.deviceId,
        entry.id,
      );

      const updatedRows = getChangedRowCount(updateResult);

      if (updatedRows > 0) {
        upsertedBalanceEntriesCount += updatedRows;

        continue;
      }

      const insertResult = await transactionDatabase.runAsync(
        `
          INSERT OR IGNORE INTO balance_entries (
            id,
            owner_id,
            amount,
            type_id,
            created_at,
            updated_at,
            deleted_at,
            schema_version,
            source_device_id
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        entry.id,
        identity.localOwnerId,
        entry.amount,
        entry.typeId,
        entry.createdAt,
        entry.updatedAt,
        null,
        1,
        identity.deviceId,
      );

      upsertedBalanceEntriesCount += getChangedRowCount(insertResult);
    }

    for (const tombstone of typeTombstones) {
      const result = await transactionDatabase.runAsync(
        `
          UPDATE balance_types
          SET
            deleted_at = ?,
            updated_at = ?,
            source_device_id = ?
          WHERE id = ?
            AND (
              deleted_at IS NULL
              OR deleted_at < ?
              OR updated_at < ?
            )
        `,
        tombstone.deletedAt,
        tombstone.updatedAt,
        identity.deviceId,
        tombstone.id,
        tombstone.deletedAt,
        tombstone.updatedAt,
      );

      deletedBalanceTypesCount += getChangedRowCount(result);
    }

    for (const tombstone of entryTombstones) {
      const result = await transactionDatabase.runAsync(
        `
          UPDATE balance_entries
          SET
            deleted_at = ?,
            updated_at = ?,
            source_device_id = ?
          WHERE id = ?
            AND (
              deleted_at IS NULL
              OR deleted_at < ?
              OR updated_at < ?
            )
        `,
        tombstone.deletedAt,
        tombstone.updatedAt,
        identity.deviceId,
        tombstone.id,
        tombstone.deletedAt,
        tombstone.updatedAt,
      );

      deletedBalanceEntriesCount += getChangedRowCount(result);
    }
  });

  return {
    upsertedBalanceTypesCount,
    deletedBalanceTypesCount,
    upsertedBalanceEntriesCount,
    deletedBalanceEntriesCount,
  };
}

function getChangedRowCount(result: { changes?: unknown }) {
  return typeof result.changes === 'number' && Number.isFinite(result.changes)
    ? result.changes
    : 0;
}

function mapBalanceEntryRow(row: BalanceEntryRow): BalanceEntry {
  assertRecord(row, 'Balance entry row must be an object.');

  return {
    id: parseString(row.id, 'id'),
    ownerId: parseString(row.owner_id, 'owner_id'),
    amount: parseNumber(row.amount, 'amount'),
    typeId: parseString(row.type_id, 'type_id'),
    createdAt: parseNumber(row.created_at, 'created_at'),
    updatedAt: parseNumber(row.updated_at, 'updated_at'),
    deletedAt: parseNullableNumber(row.deleted_at, 'deleted_at'),
    schemaVersion: parseNumber(row.schema_version, 'schema_version'),
    sourceDeviceId: parseString(row.source_device_id, 'source_device_id'),
  };
}

function mapBalanceTypeRow(row: BalanceTypeRow): BalanceType {
  assertRecord(row, 'Balance type row must be an object.');

  return {
    id: parseString(row.id, 'id'),
    ownerId: parseString(row.owner_id, 'owner_id'),
    name: parseString(row.name, 'name'),
    createdAt: parseNumber(row.created_at, 'created_at'),
    updatedAt: parseNumber(row.updated_at, 'updated_at'),
    isDefault: parseBooleanInteger(row.is_default, 'is_default'),
    isArchived: parseBooleanInteger(row.is_archived, 'is_archived'),
    deletedAt: parseNullableNumber(row.deleted_at, 'deleted_at'),
    schemaVersion: parseNumber(row.schema_version, 'schema_version'),
    sourceDeviceId: parseString(row.source_device_id, 'source_device_id'),
    sortOrder: parseNumber(row.sort_order, 'sort_order'),
  };
}

function assertRecord(
  value: unknown,
  message: string,
): asserts value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) {
    throw new Error(message);
  }
}

function parseString(value: unknown, fieldName: string) {
  if (typeof value !== 'string') {
    throw new Error(`Invalid balance row: ${fieldName} must be a string.`);
  }

  return value;
}

function parseNumber(value: unknown, fieldName: string) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`Invalid balance row: ${fieldName} must be a number.`);
  }

  return value;
}

function parseNullableNumber(value: unknown, fieldName: string) {
  if (value === null) return null;

  return parseNumber(value, fieldName);
}

function parseBooleanInteger(value: unknown, fieldName: string) {
  if (value === 0) return false;
  if (value === 1) return true;

  throw new Error(`Invalid balance row: ${fieldName} must be 0 or 1.`);
}
