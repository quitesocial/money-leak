import { featureFlags } from '@/lib/feature-flags';
import {
  createLocalSyncDataSource,
  type LocalSyncData,
  type LocalSyncDataSource,
} from '@/lib/sync/local-sync-data-source';
import { createLocalSyncDataTarget } from '@/lib/sync/local-sync-data-target';
import { createLocalSyncMetadataStore } from '@/lib/sync/sync-metadata-store';
import {
  mapLocalCategoryToRemote,
  mapLocalTransactionToRemote,
  parseRemoteTimestamp,
} from '@/lib/sync/sync-mappers';
import type {
  LocalSyncDataTarget,
  LocalSyncMetadataStore,
  RemoteCategory,
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
  localCategoriesToPush: Category[];
  localTransactionsToPush: Transaction[];
  remoteChangesToApply: RemoteSyncChanges;
};

type RowDecision = 'local_wins' | 'remote_wins' | 'same';

const GENERIC_SYNC_ERROR_MESSAGE =
  'Sync could not finish. Local data remains on this device.';

const EMPTY_COUNTS: SyncCounts = {
  pulledTransactionsCount: 0,
  pulledCategoriesCount: 0,
  appliedTransactionsCount: 0,
  appliedCategoriesCount: 0,
  pushedTransactionsCount: 0,
  pushedCategoriesCount: 0,
  ignoredTransactionTombstonesCount: 0,
  ignoredCategoryTombstonesCount: 0,
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

  return {
    async runIncrementalSync({ auth }) {
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
        'appliedCategoriesCount' | 'appliedTransactionsCount'
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
        'pushedCategoriesCount' | 'pushedTransactionsCount'
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
        appliedTransactionsCount: appliedCounts.appliedTransactionsCount,
        appliedCategoriesCount: appliedCounts.appliedCategoriesCount,
        pushedTransactionsCount: pushedCounts.pushedTransactionsCount,
        pushedCategoriesCount: pushedCounts.pushedCategoriesCount,
        ignoredTransactionTombstonesCount:
          plan.ignoredTransactionTombstonesCount,
        ignoredCategoryTombstonesCount: plan.ignoredCategoryTombstonesCount,
        conflictsCount: plan.conflictsCount,
      };

      try {
        await metadataStore.recordSuccess(summary);
      } catch {
        return createFailedResult('metadata_write_failed');
      }

      return {
        status: 'succeeded',
        lastSuccessfulSyncAt: cursor,
        pulledTransactionsCount: summary.pulledTransactionsCount,
        pulledCategoriesCount: summary.pulledCategoriesCount,
        appliedTransactionsCount: summary.appliedTransactionsCount,
        appliedCategoriesCount: summary.appliedCategoriesCount,
        pushedTransactionsCount: summary.pushedTransactionsCount,
        pushedCategoriesCount: summary.pushedCategoriesCount,
        ignoredTransactionTombstonesCount:
          summary.ignoredTransactionTombstonesCount,
        ignoredCategoryTombstonesCount: summary.ignoredCategoryTombstonesCount,
        conflictsCount: summary.conflictsCount,
      };
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
  const localTransactionsById = new Map(
    localData.transactions.map((transaction) => [transaction.id, transaction]),
  );
  const localCategoriesById = new Map(
    localData.categories.map((category) => [category.id, category]),
  );
  const transactionDecisions = new Map<string, RowDecision>();
  const categoryDecisions = new Map<string, RowDecision>();
  const transactionsToApply: RemoteTransaction[] = [];
  const categoriesToApply: RemoteCategory[] = [];
  let ignoredTransactionTombstonesCount = 0;
  let ignoredCategoryTombstonesCount = 0;
  let conflictsCount = 0;
  let cursorFloor = 0;

  for (const transaction of remoteChanges.transactions) {
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

  for (const category of remoteChanges.categories) {
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

  return {
    ...EMPTY_COUNTS,
    pulledTransactionsCount: remoteChanges.transactions.length,
    pulledCategoriesCount: remoteChanges.categories.length,
    appliedTransactionsCount: transactionsToApply.length,
    appliedCategoriesCount: categoriesToApply.length,
    pushedTransactionsCount: localTransactionsToPush.length,
    pushedCategoriesCount: localCategoriesToPush.length,
    ignoredTransactionTombstonesCount,
    ignoredCategoryTombstonesCount,
    conflictsCount,
    cursorFloor,
    localCategoriesToPush,
    localTransactionsToPush,
    remoteChangesToApply: {
      transactions: transactionsToApply,
      categories: categoriesToApply,
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

function createSkippedResult(skippedReason: SyncSkippedReason): SyncResult {
  return {
    status: 'skipped',
    skippedReason,
    isRecoverable: true,
  };
}
