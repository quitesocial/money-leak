import { Platform } from 'react-native';

import type { Category } from '@/types/category';

import * as nativeCategories from './categories.native';
import * as webCategories from './categories.web';

type CategoriesModule = {
  initDatabase: () => Promise<void>;
  getCategories: () => Promise<Category[]>;
  createCategory: (category: Category) => Promise<void>;
  updateCategoryName: (input: {
    id: string;
    name: string;
    updatedAt: number;
  }) => Promise<void>;
  archiveCategory: (input: { id: string; updatedAt: number }) => Promise<void>;
  ensureArchivedCategoriesForIds: (categoryIds: string[]) => Promise<void>;
};

const categoriesModule: CategoriesModule =
  Platform.OS === 'web' ? webCategories : nativeCategories;

export const {
  initDatabase,
  getCategories,
  createCategory,
  updateCategoryName,
  archiveCategory,
  ensureArchivedCategoriesForIds,
} = categoriesModule;
