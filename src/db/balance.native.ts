import type {
  BalanceEntry,
  BalanceEntryInput,
  BalanceType,
  BalanceTypeInput,
} from '@/types/balance';
import { sortBalanceTypes } from '@/lib/balance-utils';

import { getDatabase, initDatabase } from './database.native';

export { initDatabase };

type BalanceEntryRow = {
  id: unknown;
  amount: unknown;
  type_id: unknown;
  created_at: unknown;
};

type BalanceTypeRow = {
  id: unknown;
  name: unknown;
  created_at: unknown;
  updated_at: unknown;
  is_default: unknown;
  is_archived: unknown;
  sort_order: unknown;
};

export async function getBalanceEntries() {
  await initDatabase();

  const database = await getDatabase();
  const rows = await database.getAllAsync<BalanceEntryRow>(
    `
      SELECT
        id,
        amount,
        type_id,
        created_at
      FROM balance_entries
      ORDER BY created_at DESC, id DESC
    `,
  );

  return rows.map(mapBalanceEntryRow);
}

export async function createBalanceEntry(entry: BalanceEntryInput) {
  await initDatabase();

  const database = await getDatabase();

  await database.runAsync(
    `
      INSERT INTO balance_entries (
        id,
        amount,
        type_id,
        created_at
      ) VALUES (?, ?, ?, ?)
    `,
    entry.id,
    entry.amount,
    entry.typeId,
    entry.createdAt,
  );
}

export async function getBalanceTypes() {
  await initDatabase();

  const database = await getDatabase();
  const rows = await database.getAllAsync<BalanceTypeRow>(
    `
      SELECT
        id,
        name,
        created_at,
        updated_at,
        is_default,
        is_archived,
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

  await database.runAsync(
    `
      INSERT INTO balance_types (
        id,
        name,
        created_at,
        updated_at,
        is_default,
        is_archived,
        sort_order
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    balanceType.id,
    balanceType.name,
    balanceType.createdAt,
    balanceType.updatedAt,
    balanceType.isDefault ? 1 : 0,
    balanceType.isArchived ? 1 : 0,
    balanceType.sortOrder,
  );
}

function mapBalanceEntryRow(row: BalanceEntryRow): BalanceEntry {
  assertRecord(row, 'Balance entry row must be an object.');

  return {
    id: parseString(row.id, 'id'),
    amount: parseNumber(row.amount, 'amount'),
    typeId: parseString(row.type_id, 'type_id'),
    createdAt: parseNumber(row.created_at, 'created_at'),
  };
}

function mapBalanceTypeRow(row: BalanceTypeRow): BalanceType {
  assertRecord(row, 'Balance type row must be an object.');

  return {
    id: parseString(row.id, 'id'),
    name: parseString(row.name, 'name'),
    createdAt: parseNumber(row.created_at, 'created_at'),
    updatedAt: parseNumber(row.updated_at, 'updated_at'),
    isDefault: parseBooleanInteger(row.is_default, 'is_default'),
    isArchived: parseBooleanInteger(row.is_archived, 'is_archived'),
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

function parseBooleanInteger(value: unknown, fieldName: string) {
  if (value === 0) return false;
  if (value === 1) return true;

  throw new Error(`Invalid balance row: ${fieldName} must be 0 or 1.`);
}
