import {
  getDefaultCategoryIconName,
  resolveCategoryIconName,
  type CategoryIconName,
} from '@/lib/category-icons';
import { getReadableCategoryNameFromId } from '@/lib/category-utils';
import type { Category } from '@/types/category';
import { TRANSACTION_CATEGORIES } from '@/types/transaction';

const defaultCategoryOrder = new Map<string, number>(
  TRANSACTION_CATEGORIES.map((categoryId, index) => [categoryId, index]),
);

export function getCategoryDisplayName(
  categoryId: string,
  categories: Category[],
) {
  return (
    categories.find((category) => category.id === categoryId)?.name ??
    getReadableCategoryNameFromId(categoryId)
  );
}

export function getCategoryDisplayIconName(
  categoryId: string,
  categories: Category[],
): CategoryIconName {
  const category = categories.find(
    (candidateCategory) => candidateCategory.id === categoryId,
  );

  if (!category) return getDefaultCategoryIconName(categoryId);

  return resolveCategoryIconName({
    categoryId,
    iconName: category.iconName,
    isDefault: category.isDefault,
  });
}

export function compareCategoryIds(
  firstCategoryId: string,
  secondCategoryId: string,
) {
  const firstDefaultOrder = defaultCategoryOrder.get(firstCategoryId);
  const secondDefaultOrder = defaultCategoryOrder.get(secondCategoryId);

  if (
    firstDefaultOrder !== undefined &&
    secondDefaultOrder !== undefined &&
    firstDefaultOrder !== secondDefaultOrder
  ) {
    return firstDefaultOrder - secondDefaultOrder;
  }

  if (firstDefaultOrder !== undefined) return -1;

  if (secondDefaultOrder !== undefined) return 1;

  if (firstCategoryId < secondCategoryId) return -1;

  if (firstCategoryId > secondCategoryId) return 1;

  return 0;
}
