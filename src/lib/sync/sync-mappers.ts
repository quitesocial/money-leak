import type {
  RemoteBalanceEntry,
  RemoteBalanceType,
  RemoteCategory,
  RemoteSetting,
  RemoteTransaction,
} from '@/lib/sync/sync-types';
import { CATEGORY_ICON_FALLBACK_NAME } from '@/lib/category-icons';
import type {
  SettingsPreferenceKey,
  SettingsPreferenceSnapshot,
} from '@/lib/settings-preferences';
import type {
  BalanceEntry,
  BalanceEntryRestoreInput,
  BalanceEntryTombstoneRestoreInput,
  BalanceType,
  BalanceTypeInput,
  BalanceTypeTombstoneRestoreInput,
} from '@/types/balance';
import type { Category, CategoryInput } from '@/types/category';
import type {
  Transaction,
  TransactionRestoreInput,
  TransactionTombstoneRestoreInput,
} from '@/types/transaction';

export function mapLocalTransactionToRemote({
  transaction,
  userId,
}: {
  transaction: Transaction;
  userId: string;
}): RemoteTransaction {
  return {
    id: transaction.id,
    userId,
    amount: transaction.amount,
    categoryId: transaction.category,
    isLeak: transaction.isLeak,
    leakReason: transaction.leakReason,
    note: transaction.note,
    createdAt: toRemoteTimestamp(transaction.createdAt),
    updatedAt: toRemoteTimestamp(transaction.updatedAt),
    deletedAt:
      transaction.deletedAt === null
        ? null
        : toRemoteTimestamp(transaction.deletedAt),
    schemaVersion: transaction.schemaVersion,
    sourceDeviceId: transaction.sourceDeviceId || null,
  };
}

export function mapLocalCategoryToRemote({
  category,
  userId,
}: {
  category: Category;
  userId: string;
}): RemoteCategory {
  return {
    id: category.id,
    userId,
    name: category.name,
    isDefault: category.isDefault,
    isArchived: category.isArchived,
    sortOrder: category.sortOrder,
    createdAt: toRemoteTimestamp(category.createdAt),
    updatedAt: toRemoteTimestamp(category.updatedAt),
    deletedAt:
      category.deletedAt === null
        ? null
        : toRemoteTimestamp(category.deletedAt),
    schemaVersion: category.schemaVersion,
    sourceDeviceId: category.sourceDeviceId || null,
  };
}

export function mapLocalBalanceTypeToRemote({
  balanceType,
  userId,
}: {
  balanceType: BalanceType;
  userId: string;
}): RemoteBalanceType {
  return {
    id: balanceType.id,
    userId,
    name: balanceType.name,
    isDefault: balanceType.isDefault,
    isArchived: balanceType.isArchived,
    sortOrder: balanceType.sortOrder,
    createdAt: toRemoteTimestamp(balanceType.createdAt),
    updatedAt: toRemoteTimestamp(balanceType.updatedAt),
    deletedAt:
      balanceType.deletedAt === null
        ? null
        : toRemoteTimestamp(balanceType.deletedAt),
    schemaVersion: balanceType.schemaVersion,
    sourceDeviceId: balanceType.sourceDeviceId || null,
  };
}

export function mapLocalBalanceEntryToRemote({
  entry,
  userId,
}: {
  entry: BalanceEntry;
  userId: string;
}): RemoteBalanceEntry {
  return {
    id: entry.id,
    userId,
    amount: entry.amount,
    typeId: entry.typeId,
    createdAt: toRemoteTimestamp(entry.createdAt),
    updatedAt: toRemoteTimestamp(entry.updatedAt),
    deletedAt:
      entry.deletedAt === null ? null : toRemoteTimestamp(entry.deletedAt),
    schemaVersion: entry.schemaVersion,
    sourceDeviceId: entry.sourceDeviceId || null,
  };
}

export function mapLocalSettingToRemote<Key extends SettingsPreferenceKey>({
  setting,
  userId,
}: {
  setting: SettingsPreferenceSnapshot[Key];
  userId: string;
}): RemoteSetting {
  return {
    userId,
    key: setting.key,
    value: setting.value,
    updatedAt: toRemoteTimestamp(setting.updatedAt),
    schemaVersion: setting.schemaVersion,
    sourceDeviceId: setting.sourceDeviceId,
  };
}

export function mapRemoteSettingToLocalInput(setting: RemoteSetting) {
  return {
    key: setting.key,
    value: setting.value,
    updatedAt: parseRemoteTimestamp(setting.updatedAt),
    schemaVersion: setting.schemaVersion,
    sourceDeviceId: setting.sourceDeviceId,
  };
}

export function mapRemoteCategoryToLocalInput(
  category: RemoteCategory,
): CategoryInput {
  return {
    id: category.id,
    name: category.name,
    iconName: CATEGORY_ICON_FALLBACK_NAME,
    createdAt: parseRemoteTimestamp(category.createdAt),
    updatedAt: parseRemoteTimestamp(category.updatedAt),
    isDefault: category.isDefault,
    isArchived: category.isArchived,
    sortOrder: category.sortOrder,
  };
}

export function mapRemoteBalanceTypeToLocalInput(
  balanceType: RemoteBalanceType,
): BalanceTypeInput {
  return {
    id: balanceType.id,
    name: balanceType.name,
    createdAt: parseRemoteTimestamp(balanceType.createdAt),
    updatedAt: parseRemoteTimestamp(balanceType.updatedAt),
    isDefault: balanceType.isDefault,
    isArchived: balanceType.isArchived,
    sortOrder: balanceType.sortOrder,
  };
}

export function mapRemoteBalanceTypeTombstoneToLocalInput(
  balanceType: RemoteBalanceType,
): BalanceTypeTombstoneRestoreInput {
  if (balanceType.deletedAt === null) {
    throw new Error('Remote balance type tombstone is missing.');
  }

  return {
    id: balanceType.id,
    updatedAt: parseRemoteTimestamp(balanceType.updatedAt),
    deletedAt: parseRemoteTimestamp(balanceType.deletedAt),
  };
}

export function mapRemoteTransactionToLocalInput(
  transaction: RemoteTransaction,
): TransactionRestoreInput {
  return {
    id: transaction.id,
    amount: transaction.amount,
    category: transaction.categoryId,
    isLeak: transaction.isLeak,
    leakReason: transaction.leakReason,
    note: transaction.note,
    createdAt: parseRemoteTimestamp(transaction.createdAt),
    updatedAt: parseRemoteTimestamp(transaction.updatedAt),
  };
}

export function mapRemoteBalanceEntryToLocalInput(
  entry: RemoteBalanceEntry,
): BalanceEntryRestoreInput {
  return {
    id: entry.id,
    amount: entry.amount,
    typeId: entry.typeId,
    createdAt: parseRemoteTimestamp(entry.createdAt),
    updatedAt: parseRemoteTimestamp(entry.updatedAt),
  };
}

export function mapRemoteBalanceEntryTombstoneToLocalInput(
  entry: RemoteBalanceEntry,
): BalanceEntryTombstoneRestoreInput {
  if (entry.deletedAt === null) {
    throw new Error('Remote balance entry tombstone is missing.');
  }

  return {
    id: entry.id,
    updatedAt: parseRemoteTimestamp(entry.updatedAt),
    deletedAt: parseRemoteTimestamp(entry.deletedAt),
  };
}

export function mapRemoteTransactionTombstoneToLocalInput(
  transaction: RemoteTransaction,
): TransactionTombstoneRestoreInput {
  if (transaction.deletedAt === null) {
    throw new Error('Remote transaction tombstone is missing.');
  }

  return {
    id: transaction.id,
    updatedAt: parseRemoteTimestamp(transaction.updatedAt),
    deletedAt: parseRemoteTimestamp(transaction.deletedAt),
  };
}

export function parseRemoteTimestamp(timestamp: string) {
  const parsedTimestamp = Date.parse(timestamp);

  if (!Number.isFinite(parsedTimestamp)) {
    throw new Error('Remote sync timestamp is invalid.');
  }

  return parsedTimestamp;
}

export function toRemoteTimestamp(epochMilliseconds: number) {
  if (
    typeof epochMilliseconds !== 'number' ||
    !Number.isFinite(epochMilliseconds)
  ) {
    throw new Error(
      'Remote sync timestamps must be finite epoch milliseconds.',
    );
  }

  return new Date(epochMilliseconds).toISOString();
}
