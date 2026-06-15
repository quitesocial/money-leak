import { featureFlags } from '@/lib/feature-flags';
import {
  createLocalSyncDataSource,
  type LocalSyncData,
  type LocalSyncDataSource,
} from '@/lib/sync/local-sync-data-source';
import { createLocalSyncDataTarget } from '@/lib/sync/local-sync-data-target';
import { createLocalSyncMetadataStore } from '@/lib/sync/sync-metadata-store';
import {
  mapLocalBalanceEntryToRemote,
  mapLocalBalanceTypeToRemote,
  mapLocalCategoryToRemote,
  mapLocalSettingToRemote,
  mapLocalTransactionToRemote,
  parseRemoteTimestamp,
} from '@/lib/sync/sync-mappers';
import type {
  SettingsPreferenceKey,
  SettingsPreference,
} from '@/lib/settings-preferences';
import type {
  LocalSyncDataTarget,
  LocalSyncMetadataStore,
  RemoteBalanceEntry,
  RemoteBalanceType,
  RemoteCategory,
  RemoteSetting,
  RemoteSyncAdapter,
  RemoteSyncChanges,
  RemoteTransaction,
  SyncCounts,
  SyncErrorCode,
  SyncResult,
  SyncService,
  SyncSkippedReason,
  SyncSummary,
} from '@/lib/sync/sync-types';
import type { BalanceEntry, BalanceType } from '@/types/balance';
import type { Category } from '@/types/category';
import type { Transaction } from '@/types/transaction';

type SyncServiceOptions = {
  dataSource?: LocalSyncDataSource;
  dataTarget?: LocalSyncDataTarget;
  isSyncEnabled?: boolean;
  metadataStore?: LocalSyncMetadataStore;
  now?: () => number;
  remoteAdapter: RemoteSyncAdapter;
};

type SyncPlan = SyncCounts & {
  cursorFloor: number;
  localBalanceEntriesToPush: BalanceEntry[];
  localBalanceTypesToPush: BalanceType[];
  localCategoriesToPush: Category[];
  localSettingsToPush: SettingsPreference[];
  localTransactionsToPush: Transaction[];
  remoteChangesToApply: RemoteSyncChanges;
};

type RowDecision = 'local_wins' | 'remote_wins' | 'same';

const GENERIC_SYNC_ERROR_MESSAGE =
  'Sync could not finish. Local data remains on this device.';

const EMPTY_COUNTS: SyncCounts = {
  pulledTransactionsCount: 0,
  pulledCategoriesCount: 0,
  pulledBalanceTypesCount: 0,
  pulledBalanceEntriesCount: 0,
  pulledSettingsCount: 0,
  appliedTransactionsCount: 0,
  appliedCategoriesCount: 0,
  appliedBalanceTypesCount: 0,
  appliedBalanceEntriesCount: 0,
  appliedSettingsCount: 0,
  pushedTransactionsCount: 0,
  pushedCategoriesCount: 0,
  pushedBalanceTypesCount: 0,
  pushedBalanceEntriesCount: 0,
  pushedSettingsCount: 0,
  ignoredTransactionTombstonesCount: 0,
  ignoredCategoryTombstonesCount: 0,
  ignoredBalanceTypeTombstonesCount: 0,
  ignoredBalanceEntryTombstonesCount: 0,
  ignoredSettingsCount: 0,
  conflictsCount: 0,
};

export function createSyncService({
  dataSource = createLocalSyncDataSource(),
  dataTarget = createLocalSyncDataTarget(),
  isSyncEnabled = featureFlags.incrementalSyncEnabled,
  metadataStore = createLocalSyncMetadataStore(),
  now = Date.now,
  remoteAdapter,
}: SyncServiceOptions): SyncService {
  let incrementalSyncPromise: Promise<SyncResult> | null = null;

  async function createFailedResult(code: SyncErrorCode): Promise<SyncResult> {
    try {
      await metadataStore.recordFailure(now());
    } catch {
      // Sync errors must stay generic and must not depend on metadata writes.
    }

    return {
      status: 'failed',
      error: {
        code,
        isRecoverable: true,
        message: GENERIC_SYNC_ERROR_MESSAGE,
      },
    };
  }

  async function runIncrementalSyncOnce({
    auth,
    source,
  }: Parameters<SyncService['runIncrementalSync']>[0]): Promise<SyncResult> {
    if (!isSyncEnabled) return createSkippedResult('sync_disabled');

    if (auth.status !== 'authenticated') {
      return createSkippedResult('guest_mode');
    }

    const userId = auth.userId?.trim();

    if (!userId) return createSkippedResult('missing_user_id');

    let sessionUserId: string | null;

    try {
      sessionUserId = await remoteAdapter.getAuthenticatedUserId();
    } catch {
      return createSkippedResult('missing_session');
    }

    if (!sessionUserId) return createSkippedResult('missing_session');
    if (sessionUserId !== userId) {
      return createSkippedResult('session_user_mismatch');
    }

    let lastSuccessfulSyncAt: number | null;

    try {
      const metadata = await metadataStore.getMetadata();
      lastSuccessfulSyncAt = metadata.lastSuccessfulSyncAt;
    } catch {
      return createFailedResult('metadata_read_failed');
    }

    let remoteChanges: RemoteSyncChanges;

    try {
      remoteChanges = await remoteAdapter.pullChanges({
        userId,
        since: lastSuccessfulSyncAt,
      });
    } catch {
      return createFailedResult('remote_read_failed');
    }

    let localData: LocalSyncData;

    try {
      localData = await dataSource.getSyncData();
    } catch {
      return createFailedResult('local_read_failed');
    }

    let plan: SyncPlan;

    try {
      plan = createSyncPlan({
        localData,
        remoteChanges,
        since: lastSuccessfulSyncAt,
      });
    } catch {
      return createFailedResult('remote_read_failed');
    }

    let appliedCounts: Pick<
      SyncCounts,
      | 'appliedBalanceEntriesCount'
      | 'appliedBalanceTypesCount'
      | 'appliedCategoriesCount'
      | 'appliedSettingsCount'
      | 'ignoredSettingsCount'
      | 'appliedTransactionsCount'
    >;

    try {
      appliedCounts = await dataTarget.applyRemoteChanges(
        plan.remoteChangesToApply,
      );
    } catch {
      return createFailedResult('local_write_failed');
    }

    let pushedCounts: Pick<
      SyncCounts,
      | 'pushedBalanceEntriesCount'
      | 'pushedBalanceTypesCount'
      | 'pushedCategoriesCount'
      | 'pushedSettingsCount'
      | 'pushedTransactionsCount'
    >;

    try {
      pushedCounts = await remoteAdapter.pushChanges({
        userId,
        transactions: plan.localTransactionsToPush.map((transaction) =>
          mapLocalTransactionToRemote({ transaction, userId }),
        ),
        categories: plan.localCategoriesToPush.map((category) =>
          mapLocalCategoryToRemote({ category, userId }),
        ),
        balanceTypes: plan.localBalanceTypesToPush.map((balanceType) =>
          mapLocalBalanceTypeToRemote({ balanceType, userId }),
        ),
        balanceEntries: plan.localBalanceEntriesToPush.map((entry) =>
          mapLocalBalanceEntryToRemote({ entry, userId }),
        ),
        settings: plan.localSettingsToPush.map((setting) =>
          mapLocalSettingToRemote({ setting, userId }),
        ),
      });
    } catch {
      return createFailedResult('remote_write_failed');
    }

    const completedAt = now();
    const cursor = Math.max(completedAt, plan.cursorFloor);
    const summary: SyncSummary = {
      completedAt,
      cursor,
      pulledTransactionsCount: plan.pulledTransactionsCount,
      pulledCategoriesCount: plan.pulledCategoriesCount,
      pulledBalanceTypesCount: plan.pulledBalanceTypesCount,
      pulledBalanceEntriesCount: plan.pulledBalanceEntriesCount,
      pulledSettingsCount: plan.pulledSettingsCount,
      appliedTransactionsCount: appliedCounts.appliedTransactionsCount,
      appliedCategoriesCount: appliedCounts.appliedCategoriesCount,
      appliedBalanceTypesCount: appliedCounts.appliedBalanceTypesCount,
      appliedBalanceEntriesCount: appliedCounts.appliedBalanceEntriesCount,
      appliedSettingsCount: appliedCounts.appliedSettingsCount ?? 0,
      pushedTransactionsCount: pushedCounts.pushedTransactionsCount,
      pushedCategoriesCount: pushedCounts.pushedCategoriesCount,
      pushedBalanceTypesCount: pushedCounts.pushedBalanceTypesCount,
      pushedBalanceEntriesCount: pushedCounts.pushedBalanceEntriesCount,
      pushedSettingsCount: pushedCounts.pushedSettingsCount ?? 0,
      ignoredTransactionTombstonesCount: plan.ignoredTransactionTombstonesCount,
      ignoredCategoryTombstonesCount: plan.ignoredCategoryTombstonesCount,
      ignoredBalanceTypeTombstonesCount: plan.ignoredBalanceTypeTombstonesCount,
      ignoredBalanceEntryTombstonesCount:
        plan.ignoredBalanceEntryTombstonesCount,
      ignoredSettingsCount:
        (plan.ignoredSettingsCount ?? 0) +
        (appliedCounts.ignoredSettingsCount ?? 0),
      conflictsCount: plan.conflictsCount,
    };

    try {
      await metadataStore.recordSuccess({ source, summary });
    } catch {
      return createFailedResult('metadata_write_failed');
    }

    return {
      status: 'succeeded',
      lastSuccessfulSyncAt: cursor,
      pulledTransactionsCount: summary.pulledTransactionsCount,
      pulledCategoriesCount: summary.pulledCategoriesCount,
      pulledBalanceTypesCount: summary.pulledBalanceTypesCount,
      pulledBalanceEntriesCount: summary.pulledBalanceEntriesCount,
      pulledSettingsCount: summary.pulledSettingsCount,
      appliedTransactionsCount: summary.appliedTransactionsCount,
      appliedCategoriesCount: summary.appliedCategoriesCount,
      appliedBalanceTypesCount: summary.appliedBalanceTypesCount,
      appliedBalanceEntriesCount: summary.appliedBalanceEntriesCount,
      appliedSettingsCount: summary.appliedSettingsCount,
      pushedTransactionsCount: summary.pushedTransactionsCount,
      pushedCategoriesCount: summary.pushedCategoriesCount,
      pushedBalanceTypesCount: summary.pushedBalanceTypesCount,
      pushedBalanceEntriesCount: summary.pushedBalanceEntriesCount,
      pushedSettingsCount: summary.pushedSettingsCount,
      ignoredTransactionTombstonesCount:
        summary.ignoredTransactionTombstonesCount,
      ignoredCategoryTombstonesCount: summary.ignoredCategoryTombstonesCount,
      ignoredBalanceTypeTombstonesCount:
        summary.ignoredBalanceTypeTombstonesCount,
      ignoredBalanceEntryTombstonesCount:
        summary.ignoredBalanceEntryTombstonesCount,
      ignoredSettingsCount: summary.ignoredSettingsCount,
      conflictsCount: summary.conflictsCount,
    };
  }

  return {
    isIncrementalSyncInFlight() {
      return incrementalSyncPromise !== null;
    },

    runIncrementalSync(input) {
      if (incrementalSyncPromise) return incrementalSyncPromise;

      const syncPromise = runIncrementalSyncOnce(input).finally(() => {
        incrementalSyncPromise = null;
      });

      incrementalSyncPromise = syncPromise;

      return syncPromise;
    },
  };
}

function createSyncPlan({
  localData,
  remoteChanges,
  since,
}: {
  localData: LocalSyncData;
  remoteChanges: RemoteSyncChanges;
  since: number | null;
}): SyncPlan {
  const remoteTransactions = remoteChanges.transactions ?? [];
  const remoteCategories = remoteChanges.categories ?? [];
  const remoteBalanceTypes = remoteChanges.balanceTypes ?? [];
  const remoteBalanceEntries = remoteChanges.balanceEntries ?? [];
  const remoteSettings = remoteChanges.settings ?? [];
  const localTransactionsById = new Map(
    localData.transactions.map((transaction) => [transaction.id, transaction]),
  );
  const localCategoriesById = new Map(
    localData.categories.map((category) => [category.id, category]),
  );
  const localBalanceTypesById = new Map(
    localData.balanceTypes.map((balanceType) => [balanceType.id, balanceType]),
  );
  const localBalanceEntriesById = new Map(
    localData.balanceEntries.map((balanceEntry) => [
      balanceEntry.id,
      balanceEntry,
    ]),
  );
  const transactionDecisions = new Map<string, RowDecision>();
  const categoryDecisions = new Map<string, RowDecision>();
  const balanceTypeDecisions = new Map<string, RowDecision>();
  const balanceEntryDecisions = new Map<string, RowDecision>();
  const settingDecisions = new Map<SettingsPreferenceKey, RowDecision>();
  const transactionsToApply: RemoteTransaction[] = [];
  const categoriesToApply: RemoteCategory[] = [];
  const balanceTypesToApply: RemoteBalanceType[] = [];
  const balanceEntriesToApply: RemoteBalanceEntry[] = [];
  const settingsToApply: RemoteSetting[] = [];
  let ignoredTransactionTombstonesCount = 0;
  let ignoredCategoryTombstonesCount = 0;
  let ignoredBalanceTypeTombstonesCount = 0;
  let ignoredBalanceEntryTombstonesCount = 0;
  let ignoredSettingsCount = 0;
  let conflictsCount = 0;
  let cursorFloor = 0;

  for (const transaction of remoteTransactions) {
    const remoteTimestamp = getRemoteTransactionEffectiveTimestamp(transaction);
    const localTransaction = localTransactionsById.get(transaction.id);

    cursorFloor = Math.max(cursorFloor, remoteTimestamp);

    if (!localTransaction) {
      if (transaction.deletedAt === null) {
        transactionsToApply.push(transaction);
        transactionDecisions.set(transaction.id, 'remote_wins');
      } else {
        ignoredTransactionTombstonesCount += 1;
      }

      continue;
    }

    const localTimestamp =
      getLocalTransactionEffectiveTimestamp(localTransaction);
    const areSame = isSameTransactionPayload({
      localTransaction,
      remoteTransaction: transaction,
    });
    const hasConflict =
      !areSame &&
      isChangedSince(localTimestamp, since) &&
      isChangedSince(remoteTimestamp, since);

    if (hasConflict) conflictsCount += 1;

    const decision = getLwwDecision({
      areSame,
      localTimestamp,
      remoteTimestamp,
    });

    transactionDecisions.set(transaction.id, decision);

    if (decision === 'remote_wins') {
      transactionsToApply.push(transaction);
    }
  }

  for (const category of remoteCategories) {
    const remoteTimestamp = getRemoteCategoryEffectiveTimestamp(category);
    const localCategory = localCategoriesById.get(category.id);

    cursorFloor = Math.max(cursorFloor, remoteTimestamp);

    if (category.deletedAt !== null) {
      ignoredCategoryTombstonesCount += 1;

      continue;
    }

    if (!localCategory) {
      categoriesToApply.push(category);
      categoryDecisions.set(category.id, 'remote_wins');

      continue;
    }

    const localTimestamp = localCategory.updatedAt;
    const areSame = isSameCategoryPayload({
      localCategory,
      remoteCategory: category,
    });
    const hasConflict =
      !areSame &&
      isChangedSince(localTimestamp, since) &&
      isChangedSince(remoteTimestamp, since);

    if (hasConflict) conflictsCount += 1;

    const decision = getLwwDecision({
      areSame,
      localTimestamp,
      remoteTimestamp,
    });

    categoryDecisions.set(category.id, decision);

    if (decision === 'remote_wins') {
      categoriesToApply.push(category);
    }
  }

  for (const balanceType of remoteBalanceTypes) {
    const remoteTimestamp = getRemoteBalanceTypeEffectiveTimestamp(balanceType);
    const localBalanceType = localBalanceTypesById.get(balanceType.id);

    cursorFloor = Math.max(cursorFloor, remoteTimestamp);

    if (!localBalanceType) {
      if (balanceType.deletedAt === null) {
        balanceTypesToApply.push(balanceType);
        balanceTypeDecisions.set(balanceType.id, 'remote_wins');
      } else {
        ignoredBalanceTypeTombstonesCount += 1;
      }

      continue;
    }

    const localTimestamp =
      getLocalBalanceTypeEffectiveTimestamp(localBalanceType);
    const areSame = isSameBalanceTypePayload({
      localBalanceType,
      remoteBalanceType: balanceType,
    });
    const hasConflict =
      !areSame &&
      isChangedSince(localTimestamp, since) &&
      isChangedSince(remoteTimestamp, since);

    if (hasConflict) conflictsCount += 1;

    const decision = getLwwDecision({
      areSame,
      localTimestamp,
      remoteTimestamp,
    });

    balanceTypeDecisions.set(balanceType.id, decision);

    if (decision === 'remote_wins') {
      balanceTypesToApply.push(balanceType);
    }
  }

  for (const balanceEntry of remoteBalanceEntries) {
    const remoteTimestamp =
      getRemoteBalanceEntryEffectiveTimestamp(balanceEntry);
    const localBalanceEntry = localBalanceEntriesById.get(balanceEntry.id);

    cursorFloor = Math.max(cursorFloor, remoteTimestamp);

    if (!localBalanceEntry) {
      if (balanceEntry.deletedAt === null) {
        balanceEntriesToApply.push(balanceEntry);
        balanceEntryDecisions.set(balanceEntry.id, 'remote_wins');
      } else {
        ignoredBalanceEntryTombstonesCount += 1;
      }

      continue;
    }

    const localTimestamp =
      getLocalBalanceEntryEffectiveTimestamp(localBalanceEntry);
    const areSame = isSameBalanceEntryPayload({
      localBalanceEntry,
      remoteBalanceEntry: balanceEntry,
    });
    const hasConflict =
      !areSame &&
      isChangedSince(localTimestamp, since) &&
      isChangedSince(remoteTimestamp, since);

    if (hasConflict) conflictsCount += 1;

    const decision = getLwwDecision({
      areSame,
      localTimestamp,
      remoteTimestamp,
    });

    balanceEntryDecisions.set(balanceEntry.id, decision);

    if (decision === 'remote_wins') {
      balanceEntriesToApply.push(balanceEntry);
    }
  }

  const localSettings = localData.settings
    ? [localData.settings.currency, localData.settings.language]
    : [];
  const localSettingsByKey = new Map(
    localSettings.map((setting) => [setting.key, setting]),
  );

  for (const setting of remoteSettings) {
    const remoteTimestamp = parseRemoteTimestamp(setting.updatedAt);
    const localSetting = localSettingsByKey.get(setting.key);

    cursorFloor = Math.max(cursorFloor, remoteTimestamp);

    if (!localSetting) {
      ignoredSettingsCount += 1;

      continue;
    }

    const localTimestamp = localSetting.updatedAt;
    const areSame = localSetting.value === setting.value;
    const hasConflict =
      !areSame &&
      isChangedSince(localTimestamp, since) &&
      isChangedSince(remoteTimestamp, since);

    if (hasConflict) conflictsCount += 1;

    const decision = getLwwDecision({
      areSame,
      localTimestamp,
      remoteTimestamp,
    });

    settingDecisions.set(setting.key, decision);

    if (decision === 'remote_wins') {
      settingsToApply.push(setting);
    }
  }

  const localTransactionsToPush = localData.transactions.filter(
    (transaction) => {
      const effectiveTimestamp =
        getLocalTransactionEffectiveTimestamp(transaction);

      cursorFloor = Math.max(cursorFloor, effectiveTimestamp);

      if (!isChangedSince(effectiveTimestamp, since)) return false;

      const decision = transactionDecisions.get(transaction.id);

      return decision !== 'remote_wins' && decision !== 'same';
    },
  );

  const localCategoriesToPush = localData.categories.filter((category) => {
    cursorFloor = Math.max(cursorFloor, category.updatedAt);

    if (!isChangedSince(category.updatedAt, since)) return false;

    const decision = categoryDecisions.get(category.id);

    return decision !== 'remote_wins' && decision !== 'same';
  });

  const localBalanceTypesToPush = localData.balanceTypes.filter(
    (balanceType) => {
      const effectiveTimestamp =
        getLocalBalanceTypeEffectiveTimestamp(balanceType);

      cursorFloor = Math.max(cursorFloor, effectiveTimestamp);

      if (!isChangedSince(effectiveTimestamp, since)) return false;

      const decision = balanceTypeDecisions.get(balanceType.id);

      return decision !== 'remote_wins' && decision !== 'same';
    },
  );

  const localBalanceEntriesToPush = localData.balanceEntries.filter(
    (balanceEntry) => {
      const effectiveTimestamp =
        getLocalBalanceEntryEffectiveTimestamp(balanceEntry);

      cursorFloor = Math.max(cursorFloor, effectiveTimestamp);

      if (!isChangedSince(effectiveTimestamp, since)) return false;

      const decision = balanceEntryDecisions.get(balanceEntry.id);

      return decision !== 'remote_wins' && decision !== 'same';
    },
  );

  const localSettingsToPush = localSettings.filter((setting) => {
    cursorFloor = Math.max(cursorFloor, setting.updatedAt);

    if (!isChangedSince(setting.updatedAt, since)) return false;

    const decision = settingDecisions.get(setting.key);

    return decision !== 'remote_wins' && decision !== 'same';
  });

  return {
    ...EMPTY_COUNTS,
    pulledTransactionsCount: remoteTransactions.length,
    pulledCategoriesCount: remoteCategories.length,
    pulledBalanceTypesCount: remoteBalanceTypes.length,
    pulledBalanceEntriesCount: remoteBalanceEntries.length,
    pulledSettingsCount: remoteSettings.length,
    appliedTransactionsCount: transactionsToApply.length,
    appliedCategoriesCount: categoriesToApply.length,
    appliedBalanceTypesCount: balanceTypesToApply.length,
    appliedBalanceEntriesCount: balanceEntriesToApply.length,
    appliedSettingsCount: settingsToApply.length,
    pushedTransactionsCount: localTransactionsToPush.length,
    pushedCategoriesCount: localCategoriesToPush.length,
    pushedBalanceTypesCount: localBalanceTypesToPush.length,
    pushedBalanceEntriesCount: localBalanceEntriesToPush.length,
    pushedSettingsCount: localSettingsToPush.length,
    ignoredTransactionTombstonesCount,
    ignoredCategoryTombstonesCount,
    ignoredBalanceTypeTombstonesCount,
    ignoredBalanceEntryTombstonesCount,
    ignoredSettingsCount,
    conflictsCount,
    cursorFloor,
    localBalanceEntriesToPush,
    localBalanceTypesToPush,
    localCategoriesToPush,
    localSettingsToPush,
    localTransactionsToPush,
    remoteChangesToApply: {
      transactions: transactionsToApply,
      categories: categoriesToApply,
      balanceTypes: balanceTypesToApply,
      balanceEntries: balanceEntriesToApply,
      settings: settingsToApply,
    },
  };
}

function getLwwDecision({
  areSame,
  localTimestamp,
  remoteTimestamp,
}: {
  areSame: boolean;
  localTimestamp: number;
  remoteTimestamp: number;
}): RowDecision {
  if (areSame) return 'same';
  if (remoteTimestamp > localTimestamp) return 'remote_wins';

  return 'local_wins';
}

function isChangedSince(timestamp: number, since: number | null) {
  return since === null || timestamp > since;
}

function getRemoteTransactionEffectiveTimestamp(
  transaction: RemoteTransaction,
) {
  const updatedAt = parseRemoteTimestamp(transaction.updatedAt);
  const deletedAt =
    transaction.deletedAt === null
      ? null
      : parseRemoteTimestamp(transaction.deletedAt);

  return deletedAt === null ? updatedAt : Math.max(updatedAt, deletedAt);
}

function getLocalTransactionEffectiveTimestamp(transaction: Transaction) {
  return transaction.deletedAt === null
    ? transaction.updatedAt
    : Math.max(transaction.updatedAt, transaction.deletedAt);
}

function getRemoteCategoryEffectiveTimestamp(category: RemoteCategory) {
  const updatedAt = parseRemoteTimestamp(category.updatedAt);
  const deletedAt =
    category.deletedAt === null
      ? null
      : parseRemoteTimestamp(category.deletedAt);

  return deletedAt === null ? updatedAt : Math.max(updatedAt, deletedAt);
}

function getRemoteBalanceTypeEffectiveTimestamp(
  balanceType: RemoteBalanceType,
) {
  const updatedAt = parseRemoteTimestamp(balanceType.updatedAt);
  const deletedAt =
    balanceType.deletedAt === null
      ? null
      : parseRemoteTimestamp(balanceType.deletedAt);

  return deletedAt === null ? updatedAt : Math.max(updatedAt, deletedAt);
}

function getLocalBalanceTypeEffectiveTimestamp(balanceType: BalanceType) {
  return balanceType.deletedAt === null
    ? balanceType.updatedAt
    : Math.max(balanceType.updatedAt, balanceType.deletedAt);
}

function getRemoteBalanceEntryEffectiveTimestamp(
  balanceEntry: RemoteBalanceEntry,
) {
  const updatedAt = parseRemoteTimestamp(balanceEntry.updatedAt);
  const deletedAt =
    balanceEntry.deletedAt === null
      ? null
      : parseRemoteTimestamp(balanceEntry.deletedAt);

  return deletedAt === null ? updatedAt : Math.max(updatedAt, deletedAt);
}

function getLocalBalanceEntryEffectiveTimestamp(balanceEntry: BalanceEntry) {
  return balanceEntry.deletedAt === null
    ? balanceEntry.updatedAt
    : Math.max(balanceEntry.updatedAt, balanceEntry.deletedAt);
}

function isSameTransactionPayload({
  localTransaction,
  remoteTransaction,
}: {
  localTransaction: Transaction;
  remoteTransaction: RemoteTransaction;
}) {
  return (
    localTransaction.amount === remoteTransaction.amount &&
    localTransaction.category === remoteTransaction.categoryId &&
    localTransaction.isLeak === remoteTransaction.isLeak &&
    localTransaction.leakReason === remoteTransaction.leakReason &&
    localTransaction.note === remoteTransaction.note &&
    localTransaction.createdAt ===
      parseRemoteTimestamp(remoteTransaction.createdAt) &&
    localTransaction.updatedAt ===
      parseRemoteTimestamp(remoteTransaction.updatedAt) &&
    localTransaction.deletedAt ===
      (remoteTransaction.deletedAt === null
        ? null
        : parseRemoteTimestamp(remoteTransaction.deletedAt))
  );
}

function isSameCategoryPayload({
  localCategory,
  remoteCategory,
}: {
  localCategory: Category;
  remoteCategory: RemoteCategory;
}) {
  return (
    localCategory.name === remoteCategory.name &&
    localCategory.isDefault === remoteCategory.isDefault &&
    localCategory.isArchived === remoteCategory.isArchived &&
    localCategory.sortOrder === remoteCategory.sortOrder &&
    localCategory.createdAt ===
      parseRemoteTimestamp(remoteCategory.createdAt) &&
    localCategory.updatedAt ===
      parseRemoteTimestamp(remoteCategory.updatedAt) &&
    localCategory.deletedAt ===
      (remoteCategory.deletedAt === null
        ? null
        : parseRemoteTimestamp(remoteCategory.deletedAt))
  );
}

function isSameBalanceTypePayload({
  localBalanceType,
  remoteBalanceType,
}: {
  localBalanceType: BalanceType;
  remoteBalanceType: RemoteBalanceType;
}) {
  return (
    localBalanceType.name === remoteBalanceType.name &&
    localBalanceType.isDefault === remoteBalanceType.isDefault &&
    localBalanceType.isArchived === remoteBalanceType.isArchived &&
    localBalanceType.sortOrder === remoteBalanceType.sortOrder &&
    localBalanceType.createdAt ===
      parseRemoteTimestamp(remoteBalanceType.createdAt) &&
    localBalanceType.updatedAt ===
      parseRemoteTimestamp(remoteBalanceType.updatedAt) &&
    localBalanceType.deletedAt ===
      (remoteBalanceType.deletedAt === null
        ? null
        : parseRemoteTimestamp(remoteBalanceType.deletedAt))
  );
}

function isSameBalanceEntryPayload({
  localBalanceEntry,
  remoteBalanceEntry,
}: {
  localBalanceEntry: BalanceEntry;
  remoteBalanceEntry: RemoteBalanceEntry;
}) {
  return (
    localBalanceEntry.amount === remoteBalanceEntry.amount &&
    localBalanceEntry.typeId === remoteBalanceEntry.typeId &&
    localBalanceEntry.createdAt ===
      parseRemoteTimestamp(remoteBalanceEntry.createdAt) &&
    localBalanceEntry.updatedAt ===
      parseRemoteTimestamp(remoteBalanceEntry.updatedAt) &&
    localBalanceEntry.deletedAt ===
      (remoteBalanceEntry.deletedAt === null
        ? null
        : parseRemoteTimestamp(remoteBalanceEntry.deletedAt))
  );
}

function createSkippedResult(skippedReason: SyncSkippedReason): SyncResult {
  return {
    status: 'skipped',
    skippedReason,
    isRecoverable: true,
  };
}
