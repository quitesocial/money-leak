import {
  TRANSACTION_CATEGORIES,
  type DefaultTransactionCategory,
} from '@/types/transaction';

export const CATEGORY_NAME_MAX_LENGTH = 32;

export const OTHER_CATEGORY_ID = 'other';

export type CategoryInput = {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  isDefault: boolean;
  isArchived: boolean;
  sortOrder: number;
};

export type Category = CategoryInput & {
  ownerId: string;
  deletedAt: number | null;
  schemaVersion: number;
  sourceDeviceId: string;
};

export const DEFAULT_CATEGORY_NAMES: Record<
  DefaultTransactionCategory,
  string
> = {
  food: 'Food',
  transport: 'Transport',
  alcohol: 'Alcohol',
  shopping: 'Shopping',
  subscriptions: 'Subscriptions',
  other: 'Other',
};

export const DEFAULT_CATEGORIES: CategoryInput[] = TRANSACTION_CATEGORIES.map(
  (id, index) => ({
    id,
    name: DEFAULT_CATEGORY_NAMES[id],
    createdAt: 0,
    updatedAt: 0,
    isDefault: true,
    isArchived: false,
    sortOrder: index,
  }),
);
