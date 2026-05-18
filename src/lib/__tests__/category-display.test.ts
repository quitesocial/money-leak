import { describe, expect, it } from '@jest/globals';

import {
  compareCategoryIds,
  getCategoryDisplayName,
} from '@/lib/category-display';
import type { Category } from '@/types/category';

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

describe('category display helpers', () => {
  it('resolves category names from active or archived categories', () => {
    expect(
      getCategoryDisplayName('coffee', [
        createCategory({
          id: 'coffee',
          name: 'Coffee',
          isArchived: true,
        }),
      ]),
    ).toBe('Coffee');
  });

  it('falls back to a readable name for unknown category IDs', () => {
    expect(getCategoryDisplayName('late-night-snacks', [])).toBe(
      'Late Night Snacks',
    );
  });

  it('sorts default category IDs before custom IDs deterministically', () => {
    expect(
      ['z-custom', 'other', 'food', 'a-custom'].sort(compareCategoryIds),
    ).toEqual(['food', 'other', 'a-custom', 'z-custom']);
  });
});
