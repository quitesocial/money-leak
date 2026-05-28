import { create } from 'zustand';

import {
  archiveCategory as persistCategoryArchive,
  createCategory,
  getCategories,
  updateCategoryName,
} from '@/db/categories';
import {
  createCategoryFromName,
  getActiveCategories,
  getArchiveCategoryError,
  normalizeCategoryName,
  sortCategories,
  validateCategoryName,
} from '@/lib/category-utils';
import type { CategoryIconName } from '@/lib/category-icons';
import type { Category } from '@/types/category';

type CategoryNameUpdates = {
  iconName?: CategoryIconName | null;
  name: string;
};

type CategoryCreateInput = {
  iconName?: CategoryIconName | null;
  name: string;
};

type CategoriesStore = {
  categories: Category[];
  activeCategories: Category[];
  isLoading: boolean;
  isInitialized: boolean;
  error: string | null;
  loadCategories: () => Promise<void>;
  addCategory: (input: CategoryCreateInput) => Promise<void>;
  updateCategory: (id: string, updates: CategoryNameUpdates) => Promise<void>;
  archiveCategory: (id: string) => Promise<void>;
  clearError: () => void;
};

function getErrorMessage(error: unknown, fallbackMessage: string) {
  if (error instanceof Error && error.message) return error.message;

  return fallbackMessage;
}

function getCategoryState(categories: Category[]) {
  const sortedCategories = sortCategories(categories);

  return {
    categories: sortedCategories,
    activeCategories: getActiveCategories(sortedCategories),
  };
}

export const useCategoriesStore = create<CategoriesStore>((set, get) => ({
  categories: [],
  activeCategories: [],
  isLoading: false,
  isInitialized: false,
  error: null,

  loadCategories: async () => {
    set({ isLoading: true, error: null });

    try {
      const categories = await getCategories();

      set({
        ...getCategoryState(categories),
        isLoading: false,
        isInitialized: true,
        error: null,
      });
    } catch (error) {
      set({
        isLoading: false,
        isInitialized: true,
        error: getErrorMessage(error, 'Failed to load categories.'),
      });
    }
  },

  addCategory: async ({ iconName = null, name }) => {
    set({ isLoading: true, error: null });

    try {
      const categories = get().categories;
      const validationError = validateCategoryName({ name, categories });

      if (validationError) throw new Error(validationError);

      await createCategory(
        createCategoryFromName({
          name,
          categories,
          iconName,
        }),
      );

      const nextCategories = await getCategories();

      set({
        ...getCategoryState(nextCategories),
        isLoading: false,
        isInitialized: true,
        error: null,
      });
    } catch (error) {
      set({
        isLoading: false,
        error: getErrorMessage(error, 'Failed to add category.'),
      });
    }
  },

  updateCategory: async (id, updates) => {
    set({ isLoading: true, error: null });

    try {
      const categories = get().categories;
      const validationError = validateCategoryName({
        name: updates.name,
        categories,
        currentCategoryId: id,
      });

      if (validationError) throw new Error(validationError);
      const nextName = normalizeCategoryName(updates.name);
      const currentCategory = categories.find((category) => category.id === id);

      await updateCategoryName({
        id,
        iconName: updates.iconName,
        name: nextName,
        touchSyncMetadata:
          !currentCategory ||
          normalizeCategoryName(currentCategory.name) !== nextName,
        updatedAt: Date.now(),
      });

      const nextCategories = await getCategories();

      set({
        ...getCategoryState(nextCategories),
        isLoading: false,
        isInitialized: true,
        error: null,
      });
    } catch (error) {
      set({
        isLoading: false,
        error: getErrorMessage(error, 'Failed to update category.'),
      });
    }
  },

  archiveCategory: async (id) => {
    set({ isLoading: true, error: null });

    try {
      const categories = get().categories;

      const category = categories.find(
        (currentCategory) => currentCategory.id === id,
      );

      const archiveError = getArchiveCategoryError({
        category: category ?? null,
        categories,
      });

      if (archiveError) throw new Error(archiveError);

      await persistCategoryArchive({
        id,
        updatedAt: Date.now(),
      });

      const nextCategories = await getCategories();

      set({
        ...getCategoryState(nextCategories),
        isLoading: false,
        isInitialized: true,
        error: null,
      });
    } catch (error) {
      set({
        isLoading: false,
        error: getErrorMessage(error, 'Failed to delete category.'),
      });
    }
  },

  clearError: () => {
    set({ error: null });
  },
}));
