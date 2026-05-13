import {
  getReadableCategoryNameFromId,
  sortCategories,
} from '@/lib/category-utils';
import type { Category } from '@/types/category';

import { getDatabase, initDatabase } from './database.native';

type CategoryRow = {
  id: unknown;
  name: unknown;
  created_at: unknown;
  updated_at: unknown;
  is_default: unknown;
  is_archived: unknown;
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
        name,
        created_at,
        updated_at,
        is_default,
        is_archived,
        sort_order
      FROM categories
      ORDER BY sort_order ASC, created_at ASC, id ASC
    `,
  );

  return sortCategories(rows.map(mapCategoryRow));
}

export async function createCategory(category: Category) {
  await initDatabase();

  const database = await getDatabase();

  await database.runAsync(
    `
      INSERT INTO categories (
        id,
        name,
        created_at,
        updated_at,
        is_default,
        is_archived,
        sort_order
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    category.id,
    category.name,
    category.createdAt,
    category.updatedAt,
    category.isDefault ? 1 : 0,
    category.isArchived ? 1 : 0,
    category.sortOrder,
  );
}

export async function updateCategoryName({
  id,
  name,
  updatedAt,
}: {
  id: string;
  name: string;
  updatedAt: number;
}) {
  await initDatabase();

  const database = await getDatabase();

  await database.runAsync(
    `
      UPDATE categories
      SET
        name = ?,
        updated_at = ?
      WHERE id = ?
    `,
    name,
    updatedAt,
    id,
  );
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

  await database.runAsync(
    `
      UPDATE categories
      SET
        is_archived = 1,
        updated_at = ?
      WHERE id = ?
    `,
    updatedAt,
    id,
  );
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
            name,
            created_at,
            updated_at,
            is_default,
            is_archived,
            sort_order
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
        categoryId,
        getReadableCategoryNameFromId(categoryId),
        now,
        now,
        0,
        1,
        nextSortOrder,
      );

      nextSortOrder += 1;
    }
  });
}

function mapCategoryRow(row: CategoryRow): Category {
  assertRecord(row, 'Category row must be an object.');

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

function parseBooleanInteger(value: unknown, fieldName: string) {
  if (value === 0) return false;
  if (value === 1) return true;

  throw new Error(`Invalid category row: ${fieldName} must be 0 or 1.`);
}
