import {
  getReadableCategoryNameFromId,
  sortCategories,
} from '@/lib/category-utils';
import {
  CATEGORY_ICON_FALLBACK_NAME,
  normalizeCategoryIconName,
  resolveCategoryIconName,
  type CategoryIconName,
} from '@/lib/category-icons';
import type { Category, CategoryInput } from '@/types/category';

import { ensureLocalIdentity } from './local-identity.native';
import { getDatabase, initDatabase } from './database.native';

type CategoryRow = {
  id: unknown;
  owner_id: unknown;
  name: unknown;
  icon_name?: unknown;
  created_at: unknown;
  updated_at: unknown;
  is_default: unknown;
  is_archived: unknown;
  deleted_at: unknown;
  schema_version: unknown;
  source_device_id: unknown;
  sort_order: unknown;
};

type CategoryIdRow = {
  id: unknown;
};

type SortOrderRow = {
  max_sort_order: unknown;
};

export { initDatabase };

export async function getCategories() {
  await initDatabase();

  const database = await getDatabase();
  const rows = await database.getAllAsync<CategoryRow>(
    `
      SELECT
        id,
        owner_id,
        name,
        icon_name,
        created_at,
        updated_at,
        is_default,
        is_archived,
        deleted_at,
        schema_version,
        source_device_id,
        sort_order
      FROM categories
      WHERE deleted_at IS NULL
      ORDER BY sort_order ASC, created_at ASC, id ASC
    `,
  );

  return sortCategories(rows.map(mapCategoryRow));
}

export async function createCategory(category: CategoryInput) {
  await initDatabase();

  const database = await getDatabase();
  const identity = await ensureLocalIdentity(database);

  await database.runAsync(
    `
      INSERT INTO categories (
        id,
        owner_id,
        name,
        icon_name,
        created_at,
        updated_at,
        is_default,
        is_archived,
        deleted_at,
        schema_version,
        source_device_id,
        sort_order
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    category.id,
    identity.localOwnerId,
    category.name,
    category.iconName,
    category.createdAt,
    category.updatedAt,
    category.isDefault ? 1 : 0,
    category.isArchived ? 1 : 0,
    null,
    1,
    identity.deviceId,
    category.sortOrder,
  );
}

export async function restoreCategories(categories: CategoryInput[]) {
  if (!categories.length) return 0;

  await initDatabase();

  const database = await getDatabase();
  const identity = await ensureLocalIdentity(database);
  let restoredCount = 0;

  await database.withExclusiveTransactionAsync(async (transactionDatabase) => {
    for (const category of categories) {
      const result = await transactionDatabase.runAsync(
        `
          INSERT OR IGNORE INTO categories (
            id,
            owner_id,
            name,
            icon_name,
            created_at,
            updated_at,
            is_default,
            is_archived,
            deleted_at,
            schema_version,
            source_device_id,
            sort_order
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        category.id,
        identity.localOwnerId,
        category.name,
        category.iconName,
        category.createdAt,
        category.updatedAt,
        category.isDefault ? 1 : 0,
        category.isArchived ? 1 : 0,
        null,
        1,
        identity.deviceId,
        category.sortOrder,
      );

      restoredCount += getChangedRowCount(result);
    }
  });

  return restoredCount;
}

export async function updateCategoryName({
  iconName,
  id,
  name,
  touchSyncMetadata = true,
  updatedAt,
}: {
  iconName?: CategoryIconName | null;
  id: string;
  name: string;
  touchSyncMetadata?: boolean;
  updatedAt: number;
}) {
  await initDatabase();

  const database = await getDatabase();
  const identity = await ensureLocalIdentity(database);
  const nextIconName =
    iconName === undefined ? null : normalizeCategoryIconName(iconName);
  const touchSyncMetadataFlag = touchSyncMetadata ? 1 : 0;

  await database.runAsync(
    `
      UPDATE categories
      SET
        name = ?,
        icon_name = COALESCE(?, icon_name),
        updated_at = CASE
          WHEN ? = 1 THEN ?
          ELSE updated_at
        END,
        source_device_id = CASE
          WHEN ? = 1 THEN ?
          ELSE source_device_id
        END
      WHERE id = ? AND deleted_at IS NULL
    `,
    name,
    nextIconName,
    touchSyncMetadataFlag,
    updatedAt,
    touchSyncMetadataFlag,
    identity.deviceId,
    id,
  );
}

function getChangedRowCount(result: { changes?: unknown }) {
  return typeof result.changes === 'number' && Number.isFinite(result.changes)
    ? result.changes
    : 0;
}

export async function archiveCategory({
  id,
  updatedAt,
}: {
  id: string;
  updatedAt: number;
}) {
  await initDatabase();

  const database = await getDatabase();
  const identity = await ensureLocalIdentity(database);

  await database.runAsync(
    `
      UPDATE categories
      SET
        is_archived = 1,
        updated_at = ?,
        source_device_id = ?
      WHERE id = ? AND deleted_at IS NULL
    `,
    updatedAt,
    identity.deviceId,
    id,
  );
}

export async function applyCategorySyncChanges(categories: CategoryInput[]) {
  if (!categories.length) return 0;

  await initDatabase();

  const database = await getDatabase();
  const identity = await ensureLocalIdentity(database);
  let appliedCount = 0;

  await database.withExclusiveTransactionAsync(async (transactionDatabase) => {
    for (const category of categories) {
      const updateResult = await transactionDatabase.runAsync(
        `
          UPDATE categories
          SET
            name = ?,
            updated_at = ?,
            is_default = ?,
            is_archived = ?,
            deleted_at = NULL,
            schema_version = ?,
            source_device_id = ?,
            sort_order = ?
          WHERE id = ?
        `,
        category.name,
        category.updatedAt,
        category.isDefault ? 1 : 0,
        category.isArchived ? 1 : 0,
        1,
        identity.deviceId,
        category.sortOrder,
        category.id,
      );

      const updatedRows = getChangedRowCount(updateResult);

      if (updatedRows > 0) {
        appliedCount += updatedRows;

        continue;
      }

      const insertResult = await transactionDatabase.runAsync(
        `
          INSERT OR IGNORE INTO categories (
            id,
            owner_id,
            name,
            icon_name,
            created_at,
            updated_at,
            is_default,
            is_archived,
            deleted_at,
            schema_version,
            source_device_id,
            sort_order
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        category.id,
        identity.localOwnerId,
        category.name,
        category.iconName,
        category.createdAt,
        category.updatedAt,
        category.isDefault ? 1 : 0,
        category.isArchived ? 1 : 0,
        null,
        1,
        identity.deviceId,
        category.sortOrder,
      );

      appliedCount += getChangedRowCount(insertResult);
    }
  });

  return appliedCount;
}

export async function ensureArchivedCategoriesForIds(categoryIds: string[]) {
  const normalizedCategoryIds = [
    ...new Set(
      categoryIds
        .map((categoryId) => categoryId.trim())
        .filter((categoryId) => categoryId.length > 0),
    ),
  ];

  if (!normalizedCategoryIds.length) return;

  await initDatabase();

  const database = await getDatabase();
  const identity = await ensureLocalIdentity(database);

  const existingRows = await database.getAllAsync<CategoryIdRow>(
    'SELECT id FROM categories',
  );

  const existingIds = new Set(
    existingRows
      .map((row) => row.id)
      .filter((id): id is string => typeof id === 'string'),
  );

  const missingCategoryIds = normalizedCategoryIds.filter(
    (categoryId) => !existingIds.has(categoryId),
  );

  if (!missingCategoryIds.length) return;

  const sortOrderRow = await database.getFirstAsync<SortOrderRow>(
    'SELECT MAX(sort_order) AS max_sort_order FROM categories',
  );

  const maxSortOrder =
    typeof sortOrderRow?.max_sort_order === 'number' &&
    Number.isFinite(sortOrderRow.max_sort_order)
      ? sortOrderRow.max_sort_order
      : 0;

  let nextSortOrder = maxSortOrder + 1;

  const now = Date.now();

  await database.withExclusiveTransactionAsync(async (transactionDatabase) => {
    for (const categoryId of missingCategoryIds) {
      await transactionDatabase.runAsync(
        `
          INSERT OR IGNORE INTO categories (
            id,
            owner_id,
            name,
            icon_name,
            created_at,
            updated_at,
            is_default,
            is_archived,
            deleted_at,
            schema_version,
            source_device_id,
            sort_order
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        categoryId,
        identity.localOwnerId,
        getReadableCategoryNameFromId(categoryId),
        CATEGORY_ICON_FALLBACK_NAME,
        now,
        now,
        0,
        1,
        null,
        1,
        identity.deviceId,
        nextSortOrder,
      );

      nextSortOrder += 1;
    }
  });
}

function mapCategoryRow(row: CategoryRow): Category {
  assertRecord(row, 'Category row must be an object.');

  const id = parseString(row.id, 'id');
  const isDefault = parseBooleanInteger(row.is_default, 'is_default');

  return {
    id,
    ownerId: parseString(row.owner_id, 'owner_id'),
    name: parseString(row.name, 'name'),
    iconName: resolveCategoryIconName({
      categoryId: id,
      iconName: row.icon_name,
      isDefault,
    }),
    createdAt: parseNumber(row.created_at, 'created_at'),
    updatedAt: parseNumber(row.updated_at, 'updated_at'),
    isDefault,
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
    throw new Error(`Invalid category row: ${fieldName} must be a string.`);
  }

  return value;
}

function parseNumber(value: unknown, fieldName: string) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`Invalid category row: ${fieldName} must be a number.`);
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

  throw new Error(`Invalid category row: ${fieldName} must be 0 or 1.`);
}
