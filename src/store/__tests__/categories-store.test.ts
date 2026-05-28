import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { useCategoriesStore } from '@/store/categories-store';
import type { Category } from '@/types/category';

const mockGetCategories = jest.fn<() => Promise<Category[]>>();
const mockCreateCategory = jest.fn<(_input: unknown) => Promise<void>>();
const mockUpdateCategoryName = jest.fn<(_input: unknown) => Promise<void>>();
const mockArchiveCategory = jest.fn<(_input: unknown) => Promise<void>>();

jest.mock('@/db/categories', () => ({
  getCategories: () => mockGetCategories(),
  createCategory: (input: unknown) => mockCreateCategory(input),
  updateCategoryName: (input: unknown) => mockUpdateCategoryName(input),
  archiveCategory: (input: unknown) => mockArchiveCategory(input),
}));

function createCategory(overrides: Partial<Category> & Pick<Category, 'id'>) {
  return {
    id: overrides.id,
    ownerId: overrides.ownerId ?? 'local_test-owner',
    name: overrides.name ?? overrides.id,
    iconName: overrides.iconName ?? 'tag',
    createdAt: overrides.createdAt ?? 1,
    updatedAt: overrides.updatedAt ?? 1,
    isDefault: overrides.isDefault ?? false,
    isArchived: overrides.isArchived ?? false,
    deletedAt: overrides.deletedAt ?? null,
    schemaVersion: overrides.schemaVersion ?? 1,
    sourceDeviceId: overrides.sourceDeviceId ?? 'device_test-device',
    sortOrder: overrides.sortOrder ?? 1,
  };
}

function resetStore(categories: Category[]) {
  useCategoriesStore.setState({
    categories,
    activeCategories: categories.filter((category) => !category.isArchived),
    isLoading: false,
    isInitialized: true,
    error: null,
  });
}

describe('categories store', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetStore([
      createCategory({
        id: 'coffee',
        name: 'Coffee',
        iconName: 'coffee',
      }),
    ]);
  });

  it('keeps category icon-only edits local by not touching sync metadata', async () => {
    const updatedCategory = createCategory({
      id: 'coffee',
      name: 'Coffee',
      iconName: 'snacks',
    });

    mockGetCategories.mockResolvedValue([updatedCategory]);

    await useCategoriesStore.getState().updateCategory('coffee', {
      name: 'Coffee',
      iconName: 'snacks',
    });

    expect(mockUpdateCategoryName).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'coffee',
        name: 'Coffee',
        iconName: 'snacks',
        touchSyncMetadata: false,
      }),
    );
  });

  it('touches sync metadata when a category name changes', async () => {
    const updatedCategory = createCategory({
      id: 'coffee',
      name: 'Coffee Runs',
      iconName: 'snacks',
    });

    mockGetCategories.mockResolvedValue([updatedCategory]);

    await useCategoriesStore.getState().updateCategory('coffee', {
      name: 'Coffee Runs',
      iconName: 'snacks',
    });

    expect(mockUpdateCategoryName).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'coffee',
        name: 'Coffee Runs',
        iconName: 'snacks',
        touchSyncMetadata: true,
      }),
    );
  });
});
