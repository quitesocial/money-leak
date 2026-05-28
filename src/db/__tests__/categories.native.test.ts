import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { getActiveCategories } from '@/lib/category-utils';

import {
  applyCategorySyncChanges,
  archiveCategory,
  createCategory,
  getCategories,
  restoreCategories,
  updateCategoryName,
} from '../categories.native';

const mockInitDatabase = jest.fn<() => Promise<void>>();
const mockGetDatabase = jest.fn<() => Promise<FakeCategoriesDatabase>>();
const mockEnsureLocalIdentity =
  jest.fn<() => Promise<{ localOwnerId: string; deviceId: string }>>();

jest.mock('../database.native', () => ({
  initDatabase: () => mockInitDatabase(),
  getDatabase: () => mockGetDatabase(),
}));

jest.mock('../local-identity.native', () => ({
  ensureLocalIdentity: () => mockEnsureLocalIdentity(),
}));

type RawCategoryRow = {
  id: string;
  owner_id: string;
  name: string;
  icon_name?: string;
  created_at: number;
  updated_at: number;
  is_default: number;
  is_archived: number;
  deleted_at: number | null;
  schema_version: number;
  source_device_id: string;
  sort_order: number;
};

class FakeCategoriesDatabase {
  categories: RawCategoryRow[] = [
    {
      id: 'food',
      owner_id: 'local_test-owner',
      name: 'Food',
      icon_name: 'food',
      created_at: 1000,
      updated_at: 1000,
      is_default: 1,
      is_archived: 0,
      deleted_at: null,
      schema_version: 1,
      source_device_id: 'device_seed',
      sort_order: 0,
    },
    {
      id: 'coffee',
      owner_id: 'local_test-owner',
      name: 'Coffee',
      icon_name: 'tag',
      created_at: 1001,
      updated_at: 1001,
      is_default: 0,
      is_archived: 0,
      deleted_at: null,
      schema_version: 1,
      source_device_id: 'device_seed',
      sort_order: 10,
    },
  ];

  async runAsync(source: string, ...params: unknown[]) {
    if (
      source.includes('INSERT INTO categories') ||
      source.includes('INSERT OR IGNORE INTO categories')
    ) {
      return { changes: this.insertCategory(params) ? 1 : 0 };
    }

    if (source.includes('UPDATE categories') && source.includes('is_default')) {
      return { changes: this.updateCategory(params) ? 1 : 0 };
    }

    if (
      source.includes('UPDATE categories') &&
      source.includes('icon_name = COALESCE')
    ) {
      return { changes: this.updateCategoryName(params) ? 1 : 0 };
    }

    if (!source.includes('is_archived = 1')) return { changes: 0 };

    const [updatedAt, sourceDeviceId, id] = params;
    const category = this.categories.find(
      (currentCategory) =>
        currentCategory.id === id && currentCategory.deleted_at === null,
    );

    if (!category) return { changes: 0 };

    category.is_archived = 1;
    category.updated_at = updatedAt as number;
    category.source_device_id = sourceDeviceId as string;

    return { changes: 1 };
  }

  async withExclusiveTransactionAsync(
    callback: (transactionDatabase: FakeCategoriesDatabase) => Promise<void>,
  ) {
    await callback(this);
  }

  async getAllAsync<T>(source: string): Promise<T[]> {
    if (!source.includes('FROM categories')) return [];

    return this.categories
      .filter((category) => category.deleted_at === null)
      .sort((firstCategory, secondCategory) => {
        if (firstCategory.sort_order !== secondCategory.sort_order) {
          return firstCategory.sort_order - secondCategory.sort_order;
        }

        if (firstCategory.created_at !== secondCategory.created_at) {
          return firstCategory.created_at - secondCategory.created_at;
        }

        return firstCategory.id.localeCompare(secondCategory.id);
      }) as T[];
  }

  private insertCategory(params: unknown[]) {
    const [
      id,
      ownerId,
      name,
      iconName,
      createdAt,
      updatedAt,
      isDefault,
      isArchived,
      deletedAt,
      schemaVersion,
      sourceDeviceId,
      sortOrder,
    ] = params;

    if (
      typeof id !== 'string' ||
      typeof ownerId !== 'string' ||
      typeof name !== 'string' ||
      typeof iconName !== 'string' ||
      typeof createdAt !== 'number' ||
      typeof updatedAt !== 'number' ||
      typeof isDefault !== 'number' ||
      typeof isArchived !== 'number' ||
      typeof schemaVersion !== 'number' ||
      typeof sourceDeviceId !== 'string' ||
      typeof sortOrder !== 'number'
    ) {
      throw new Error('Invalid category insert params.');
    }

    const hasDuplicateId = this.categories.some(
      (category) => category.id === id,
    );

    if (hasDuplicateId) return false;

    this.categories.push({
      id,
      owner_id: ownerId,
      name,
      icon_name: iconName,
      created_at: createdAt,
      updated_at: updatedAt,
      is_default: isDefault,
      is_archived: isArchived,
      deleted_at: typeof deletedAt === 'number' ? deletedAt : null,
      schema_version: schemaVersion,
      source_device_id: sourceDeviceId,
      sort_order: sortOrder,
    });

    return true;
  }

  private updateCategory(params: unknown[]) {
    const [
      name,
      updatedAt,
      isDefault,
      isArchived,
      schemaVersion,
      sourceDeviceId,
      sortOrder,
      id,
    ] = params;

    const category = this.categories.find(
      (currentCategory) => currentCategory.id === id,
    );

    if (!category) return false;

    category.name = name as string;
    category.updated_at = updatedAt as number;
    category.is_default = isDefault as number;
    category.is_archived = isArchived as number;
    category.deleted_at = null;
    category.schema_version = schemaVersion as number;
    category.source_device_id = sourceDeviceId as string;
    category.sort_order = sortOrder as number;

    return true;
  }

  private updateCategoryName(params: unknown[]) {
    const [
      name,
      iconName,
      touchUpdatedAt,
      updatedAt,
      touchSourceDeviceId,
      sourceDeviceId,
      id,
    ] = params;

    const category = this.categories.find(
      (currentCategory) =>
        currentCategory.id === id && currentCategory.deleted_at === null,
    );

    if (!category) return false;

    category.name = name as string;
    if (typeof iconName === 'string') category.icon_name = iconName;
    if (touchUpdatedAt === 1) category.updated_at = updatedAt as number;
    if (touchSourceDeviceId === 1) {
      category.source_device_id = sourceDeviceId as string;
    }

    return true;
  }
}

describe('native category persistence', () => {
  let database: FakeCategoriesDatabase;

  beforeEach(() => {
    jest.restoreAllMocks();

    database = new FakeCategoriesDatabase();

    mockInitDatabase.mockResolvedValue(undefined);
    mockGetDatabase.mockResolvedValue(database);
    mockEnsureLocalIdentity.mockResolvedValue({
      localOwnerId: 'local_test-owner',
      deviceId: 'device_test-device',
    });
  });

  it('keeps archive behavior without setting deletedAt', async () => {
    await archiveCategory({
      id: 'coffee',
      updatedAt: 5000,
    });

    const categories = await getCategories();
    const coffee = categories.find((category) => category.id === 'coffee');

    expect(coffee).toMatchObject({
      id: 'coffee',
      isArchived: true,
      deletedAt: null,
      updatedAt: 5000,
      sourceDeviceId: 'device_test-device',
    });

    expect(
      getActiveCategories(categories).map((category) => category.id),
    ).toEqual(['food']);
  });

  it('persists iconName when creating a category', async () => {
    await createCategory({
      id: 'travel',
      name: 'Travel',
      iconName: 'travel',
      createdAt: 7000,
      updatedAt: 8000,
      isDefault: false,
      isArchived: false,
      sortOrder: 11,
    });

    expect(
      database.categories.find((category) => category.id === 'travel'),
    ).toMatchObject({
      owner_id: 'local_test-owner',
      name: 'Travel',
      icon_name: 'travel',
      source_device_id: 'device_test-device',
    });
  });

  it('persists iconName when updating a category name', async () => {
    await updateCategoryName({
      id: 'coffee',
      name: 'Coffee Runs',
      iconName: 'coffee',
      updatedAt: 9000,
    });

    expect(
      database.categories.find((category) => category.id === 'coffee'),
    ).toMatchObject({
      name: 'Coffee Runs',
      icon_name: 'coffee',
      updated_at: 9000,
      source_device_id: 'device_test-device',
    });
  });

  it('preserves iconName when updating a category name without icon input', async () => {
    await updateCategoryName({
      id: 'coffee',
      name: 'Coffee Runs',
      updatedAt: 9000,
    });

    expect(
      database.categories.find((category) => category.id === 'coffee'),
    ).toMatchObject({
      name: 'Coffee Runs',
      icon_name: 'tag',
      updated_at: 9000,
    });
  });

  it('can update local iconName without touching sync metadata', async () => {
    await updateCategoryName({
      id: 'coffee',
      name: 'Coffee',
      iconName: 'snacks',
      touchSyncMetadata: false,
      updatedAt: 9000,
    });

    expect(
      database.categories.find((category) => category.id === 'coffee'),
    ).toMatchObject({
      name: 'Coffee',
      icon_name: 'snacks',
      updated_at: 1001,
      source_device_id: 'device_seed',
    });
  });

  it('reads legacy rows without iconName safely', async () => {
    const legacyCategory = database.categories.find(
      (category) => category.id === 'coffee',
    );

    if (legacyCategory) {
      delete legacyCategory.icon_name;
    }

    const categories = await getCategories();

    expect(
      categories.find((category) => category.id === 'coffee'),
    ).toMatchObject({
      id: 'coffee',
      iconName: 'tag',
    });
  });

  it('restores backup categories without duplicating or overwriting local rows', async () => {
    await expect(
      restoreCategories([
        {
          id: 'coffee',
          name: 'Remote Coffee',
          iconName: 'coffee',
          createdAt: 5000,
          updatedAt: 6000,
          isDefault: false,
          isArchived: true,
          sortOrder: 99,
        },
        {
          id: 'snacks',
          name: 'Snacks',
          iconName: 'snacks',
          createdAt: 7000,
          updatedAt: 8000,
          isDefault: false,
          isArchived: false,
          sortOrder: 11,
        },
      ]),
    ).resolves.toBe(1);

    await expect(
      restoreCategories([
        {
          id: 'snacks',
          name: 'Snacks',
          iconName: 'snacks',
          createdAt: 7000,
          updatedAt: 8000,
          isDefault: false,
          isArchived: false,
          sortOrder: 11,
        },
      ]),
    ).resolves.toBe(0);

    expect(database.categories).toHaveLength(3);
    expect(
      database.categories.find((category) => category.id === 'coffee'),
    ).toMatchObject({
      name: 'Coffee',
      is_archived: 0,
      sort_order: 10,
    });
    expect(
      database.categories.find((category) => category.id === 'snacks'),
    ).toMatchObject({
      owner_id: 'local_test-owner',
      name: 'Snacks',
      created_at: 7000,
      updated_at: 8000,
      is_default: 0,
      is_archived: 0,
      deleted_at: null,
      schema_version: 1,
      source_device_id: 'device_test-device',
      icon_name: 'snacks',
      sort_order: 11,
    });
  });

  it('applies sync category upserts while preserving stable ids and createdAt', async () => {
    await archiveCategory({
      id: 'coffee',
      updatedAt: 5000,
    });

    await expect(
      applyCategorySyncChanges([
        {
          id: 'coffee',
          name: 'Remote Coffee',
          iconName: 'coffee',
          createdAt: 9999,
          updatedAt: 6000,
          isDefault: false,
          isArchived: false,
          sortOrder: 9,
        },
        {
          id: 'snacks',
          name: 'Snacks',
          iconName: 'snacks',
          createdAt: 7000,
          updatedAt: 8000,
          isDefault: false,
          isArchived: true,
          sortOrder: 11,
        },
      ]),
    ).resolves.toBe(2);

    expect(
      database.categories.find((category) => category.id === 'coffee'),
    ).toMatchObject({
      id: 'coffee',
      name: 'Remote Coffee',
      created_at: 1001,
      updated_at: 6000,
      is_archived: 0,
      sort_order: 9,
    });
    expect(
      database.categories.find((category) => category.id === 'snacks'),
    ).toMatchObject({
      owner_id: 'local_test-owner',
      name: 'Snacks',
      created_at: 7000,
      updated_at: 8000,
      is_archived: 1,
      deleted_at: null,
      icon_name: 'snacks',
      sort_order: 11,
    });
  });

  it('keeps repeated sync category upserts idempotent by stable row id', async () => {
    await applyCategorySyncChanges([
      {
        id: 'snacks',
        name: 'Snacks',
        iconName: 'snacks',
        createdAt: 7000,
        updatedAt: 8000,
        isDefault: false,
        isArchived: true,
        sortOrder: 11,
      },
    ]);

    await applyCategorySyncChanges([
      {
        id: 'snacks',
        name: 'Snacks',
        iconName: 'snacks',
        createdAt: 7000,
        updatedAt: 8000,
        isDefault: false,
        isArchived: true,
        sortOrder: 11,
      },
    ]);

    expect(
      database.categories.filter((row) => row.id === 'snacks'),
    ).toHaveLength(1);
    expect(
      database.categories.find((row) => row.id === 'snacks'),
    ).toMatchObject({
      owner_id: 'local_test-owner',
      name: 'Snacks',
      is_archived: 1,
      deleted_at: null,
      icon_name: 'snacks',
      sort_order: 11,
    });
  });
});
