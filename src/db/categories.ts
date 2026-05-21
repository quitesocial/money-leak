import { Platform } from 'react-native';

import type { Category, CategoryInput } from '@/types/category';

import * as nativeCategories from './categories.native';
import * as webCategories from './categories.web';

type CategoriesModule = {
  initDatabase: () => Promise<void>;
  getCategories: () => Promise<Category[]>;
  createCategory: (category: CategoryInput) => Promise<void>;
  restoreCategories: (categories: CategoryInput[]) => Promise<number>;
  updateCategoryName: (input: {
    id: string;
    name: string;
    updatedAt: number;
  }) => Promise<void>;
  archiveCategory: (input: { id: string; updatedAt: number }) => Promise<void>;
  applyCategorySyncChanges: (categories: CategoryInput[]) => Promise<number>;
  ensureArchivedCategoriesForIds: (categoryIds: string[]) => Promise<void>;
};

const categoriesModule: CategoriesModule =
  Platform.OS === 'web' ? webCategories : nativeCategories;

export const {
  initDatabase,
  getCategories,
  createCategory,
  restoreCategories,
  updateCategoryName,
  archiveCategory,
  applyCategorySyncChanges,
  ensureArchivedCategoriesForIds,
} = categoriesModule;
