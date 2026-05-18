import { describe, expect, it } from '@jest/globals';

import {
  createCategoryFromName,
  generateCategoryId,
  getActiveCategories,
  getArchiveCategoryError,
  getReadableCategoryNameFromId,
  validateCategoryName,
} from '@/lib/category-utils';
import {
  DEFAULT_CATEGORIES,
  DEFAULT_CATEGORY_NAMES,
  OTHER_CATEGORY_ID,
  type Category,
} from '@/types/category';
import { TRANSACTION_CATEGORIES } from '@/types/transaction';

function createCategory(overrides: Partial<Category> & Pick<Category, 'id'>) {
  return {
    id: overrides.id,
    name: overrides.name ?? overrides.id,
    createdAt: overrides.createdAt ?? 1,
    updatedAt: overrides.updatedAt ?? 1,
    isDefault: overrides.isDefault ?? false,
    isArchived: overrides.isArchived ?? false,
    ownerId: overrides.ownerId ?? 'local_test',
    deletedAt: overrides.deletedAt ?? null,
    schemaVersion: overrides.schemaVersion ?? 1,
    sourceDeviceId: overrides.sourceDeviceId ?? 'device_test',
    sortOrder: overrides.sortOrder ?? 10,
  };
}

describe('category utils', () => {
  it('defines default categories with existing transaction category IDs', () => {
    expect(DEFAULT_CATEGORIES.map((category) => category.id)).toEqual(
      TRANSACTION_CATEGORIES,
    );

    expect(
      DEFAULT_CATEGORIES.map((category) => [
        category.id,
        category.name,
        category.isDefault,
        category.isArchived,
      ]),
    ).toEqual(
      TRANSACTION_CATEGORIES.map((categoryId) => [
        categoryId,
        DEFAULT_CATEGORY_NAMES[categoryId],
        true,
        false,
      ]),
    );
  });

  it('validates required, trimmed, and max-length category names', () => {
    expect(validateCategoryName({ name: '   ', categories: [] })).toBe(
      'Category name is required.',
    );

    expect(
      validateCategoryName({
        name: 'x'.repeat(33),
        categories: [],
      }),
    ).toBe('Category name must be 32 characters or fewer.');

    expect(
      validateCategoryName({
        name: '  Coffee  ',
        categories: [],
      }),
    ).toBeNull();
  });

  it('prevents duplicate active category names case-insensitively', () => {
    const categories = [
      createCategory({ id: 'coffee', name: 'Coffee' }),
      createCategory({
        id: 'archived-coffee',
        name: 'Coffee',
        isArchived: true,
      }),
    ];

    expect(validateCategoryName({ name: ' coffee ', categories })).toBe(
      'An active category with this name already exists.',
    );

    expect(
      validateCategoryName({
        name: ' coffee ',
        categories,
        currentCategoryId: 'coffee',
      }),
    ).toBeNull();
  });

  it('generates stable readable category IDs with collision suffixes', () => {
    expect(generateCategoryId('Coffee runs', [])).toBe('coffee-runs');

    expect(
      generateCategoryId('Coffee runs', ['coffee-runs', 'coffee-runs-2']),
    ).toBe('coffee-runs-3');
  });

  it('creates a category with a trimmed name and next sort order', () => {
    expect(
      createCategoryFromName({
        name: '  Coffee  ',
        categories: [createCategory({ id: 'food', sortOrder: 3 })],
        now: 42,
      }),
    ).toEqual({
      id: 'coffee',
      name: 'Coffee',
      createdAt: 42,
      updatedAt: 42,
      isDefault: false,
      isArchived: false,
      sortOrder: 4,
    });
  });

  it('excludes archived categories from active categories', () => {
    expect(
      getActiveCategories([
        createCategory({ id: 'archived', isArchived: true, sortOrder: 1 }),
        createCategory({ id: 'active-two', sortOrder: 2 }),
        createCategory({ id: 'active-one', sortOrder: 0 }),
      ]).map((category) => category.id),
    ).toEqual(['active-one', 'active-two']);
  });

  it('blocks unsafe category archive attempts', () => {
    const food = createCategory({ id: 'food', name: 'Food' });
    const other = createCategory({
      id: OTHER_CATEGORY_ID,
      name: 'Other',
      isDefault: true,
    });

    expect(
      getArchiveCategoryError({
        category: other,
        categories: [food, other],
      }),
    ).toBe('Other cannot be deleted.');

    expect(
      getArchiveCategoryError({
        category: food,
        categories: [food],
      }),
    ).toBe('Keep at least one active category.');

    expect(
      getArchiveCategoryError({
        category: createCategory({
          id: 'archived',
          isArchived: true,
        }),
        categories: [food],
      }),
    ).toBe('Category is already archived.');

    expect(
      getArchiveCategoryError({
        category: food,
        categories: [food, other],
      }),
    ).toBeNull();
  });

  it('derives readable fallback names from category IDs', () => {
    expect(getReadableCategoryNameFromId('coffee-runs')).toBe('Coffee Runs');
    expect(getReadableCategoryNameFromId('')).toBe('Imported category');
  });
});
