import {
  CATEGORY_NAME_MAX_LENGTH,
  DEFAULT_CATEGORIES,
  OTHER_CATEGORY_ID,
  type Category,
  type CategoryInput,
} from '@/types/category';

type ValidateCategoryNameArgs = {
  name: string;
  categories: Category[];
  currentCategoryId?: string | null;
};

type CreateCategoryFromNameArgs = {
  name: string;
  categories: Category[];
  now?: number;
};

type GetArchiveCategoryErrorArgs = {
  category: Category | null;
  categories: Category[];
};

export function normalizeCategoryName(name: string) {
  return name.trim();
}

function normalizeNameForComparison(name: string) {
  return normalizeCategoryName(name).toLocaleLowerCase();
}

export function validateCategoryName({
  name,
  categories,
  currentCategoryId = null,
}: ValidateCategoryNameArgs) {
  const trimmedName = normalizeCategoryName(name);

  if (!trimmedName) return 'Category name is required.';

  if (trimmedName.length > CATEGORY_NAME_MAX_LENGTH) {
    return `Category name must be ${CATEGORY_NAME_MAX_LENGTH} characters or fewer.`;
  }

  const normalizedName = normalizeNameForComparison(trimmedName);

  const hasDuplicateActiveName = categories.some((category) => {
    if (category.isArchived) return false;

    if (category.id === currentCategoryId) return false;

    return normalizeNameForComparison(category.name) === normalizedName;
  });

  if (hasDuplicateActiveName) {
    return 'An active category with this name already exists.';
  }

  return null;
}

export function sortCategories(categories: Category[]) {
  return [...categories].sort((firstCategory, secondCategory) => {
    if (firstCategory.sortOrder !== secondCategory.sortOrder) {
      return firstCategory.sortOrder - secondCategory.sortOrder;
    }

    if (firstCategory.createdAt !== secondCategory.createdAt) {
      return firstCategory.createdAt - secondCategory.createdAt;
    }

    if (firstCategory.id < secondCategory.id) return -1;

    if (firstCategory.id > secondCategory.id) return 1;

    return 0;
  });
}

export function getActiveCategories(categories: Category[]) {
  return sortCategories(categories.filter((category) => !category.isArchived));
}

export function slugifyCategoryName(name: string) {
  const slug = normalizeCategoryName(name)
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return slug || 'category';
}

export function generateCategoryId(
  name: string,
  existingIds: Iterable<string>,
) {
  const baseId = slugifyCategoryName(name);
  const usedIds = new Set(existingIds);

  if (!usedIds.has(baseId)) return baseId;

  let suffix = 2;
  let candidateId = `${baseId}-${suffix}`;

  while (usedIds.has(candidateId)) {
    suffix += 1;
    candidateId = `${baseId}-${suffix}`;
  }

  return candidateId;
}

function getNextSortOrder(categories: Category[]) {
  if (!categories.length) return DEFAULT_CATEGORIES.length;

  return Math.max(...categories.map((category) => category.sortOrder)) + 1;
}

export function createCategoryFromName({
  name,
  categories,
  now = Date.now(),
}: CreateCategoryFromNameArgs): CategoryInput {
  const trimmedName = normalizeCategoryName(name);

  return {
    id: generateCategoryId(
      trimmedName,
      categories.map((category) => category.id),
    ),
    name: trimmedName,
    createdAt: now,
    updatedAt: now,
    isDefault: false,
    isArchived: false,
    sortOrder: getNextSortOrder(categories),
  };
}

export function getArchiveCategoryError({
  category,
  categories,
}: GetArchiveCategoryErrorArgs) {
  if (!category) return 'Category not found.';

  if (category.id === OTHER_CATEGORY_ID) {
    return 'Other cannot be deleted.';
  }

  if (category.isArchived) {
    return 'Category is already archived.';
  }

  if (getActiveCategories(categories).length <= 1) {
    return 'Keep at least one active category.';
  }

  return null;
}

export function getReadableCategoryNameFromId(categoryId: string) {
  const words = categoryId
    .trim()
    .replace(/[^A-Za-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .split(' ')
    .filter(Boolean);

  if (!words.length) return 'Imported category';

  return words
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
