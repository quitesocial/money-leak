import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { getActiveCategories } from '@/lib/category-utils';

import { archiveCategory, getCategories } from '../categories.native';

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
});
