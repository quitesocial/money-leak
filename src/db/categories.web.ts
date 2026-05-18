import type { Category, CategoryInput } from '@/types/category';

const NATIVE_ONLY_ERROR_MESSAGE =
  'SQLite category persistence is only available on native platforms in this build.';

export async function initDatabase() {}

export async function getCategories(): Promise<Category[]> {
  throw new Error(NATIVE_ONLY_ERROR_MESSAGE);
}

export async function createCategory(_category: CategoryInput) {
  throw new Error(NATIVE_ONLY_ERROR_MESSAGE);
}

export async function updateCategoryName(_input: {
  id: string;
  name: string;
  updatedAt: number;
}) {
  throw new Error(NATIVE_ONLY_ERROR_MESSAGE);
}

export async function archiveCategory(_input: {
  id: string;
  updatedAt: number;
}) {
  throw new Error(NATIVE_ONLY_ERROR_MESSAGE);
}

export async function ensureArchivedCategoriesForIds(_categoryIds: string[]) {
  throw new Error(NATIVE_ONLY_ERROR_MESSAGE);
}
