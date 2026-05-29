import type { AuthSession } from '@/types/auth';

import { getDatabase, initDatabase } from './database.native';
import { ensureLocalIdentity } from './local-identity.native';

export type LocalAccountLinkingSkippedReason =
  | 'missing_app_user_id'
  | 'native_sqlite_unavailable'
  | 'same_local_owner';

export type LocalAccountLinkingResult = {
  status: 'already_linked' | 'linked' | 'skipped';
  linkedTransactionsCount: number;
  linkedCategoriesCount: number;
  linkedBalanceTypesCount: number;
  linkedBalanceEntriesCount: number;
  alreadyLinkedTransactionsCount: number;
  alreadyLinkedCategoriesCount: number;
  alreadyLinkedBalanceTypesCount: number;
  alreadyLinkedBalanceEntriesCount: number;
  skippedReason?: LocalAccountLinkingSkippedReason;
};

type CountRow = {
  count: unknown;
};

type RunResult = {
  changes?: unknown;
};

const ACCOUNT_LINKED_APP_USER_ID_KEY = 'account_linked_app_user_id';
const ACCOUNT_LINKED_AT_KEY = 'account_linked_at';

export async function linkLocalAccount(
  session: AuthSession,
): Promise<LocalAccountLinkingResult> {
  const appUserId = session.user.id.trim();

  if (!appUserId) return createSkippedResult('missing_app_user_id');

  await initDatabase();

  const database = await getDatabase();
  const { deviceId, localOwnerId } = await ensureLocalIdentity(database);

  if (appUserId === localOwnerId) {
    return createSkippedResult('same_local_owner');
  }

  const linkedAt = Date.now();
  const alreadyLinkedTransactionsCount = await countRowsOwnedBy({
    database,
    ownerId: appUserId,
    tableName: 'transactions',
  });

  const alreadyLinkedCategoriesCount = await countRowsOwnedBy({
    database,
    ownerId: appUserId,
    tableName: 'categories',
  });

  const alreadyLinkedBalanceTypesCount = await countRowsOwnedBy({
    database,
    ownerId: appUserId,
    tableName: 'balance_types',
  });

  const alreadyLinkedBalanceEntriesCount = await countRowsOwnedBy({
    database,
    ownerId: appUserId,
    tableName: 'balance_entries',
  });

  let linkedTransactionsCount = 0;
  let linkedCategoriesCount = 0;
  let linkedBalanceTypesCount = 0;
  let linkedBalanceEntriesCount = 0;

  await database.withExclusiveTransactionAsync(async (transactionDatabase) => {
    const transactionResult = (await transactionDatabase.runAsync(
      `
        UPDATE transactions
        SET
          owner_id = ?,
          updated_at = ?,
          source_device_id = ?
        WHERE owner_id = ?
      `,
      appUserId,
      linkedAt,
      deviceId,
      localOwnerId,
    )) as RunResult;

    linkedTransactionsCount = getChangedRowCount(transactionResult);

    const categoryResult = (await transactionDatabase.runAsync(
      `
        UPDATE categories
        SET
          owner_id = ?,
          updated_at = ?,
          source_device_id = ?
        WHERE owner_id = ?
      `,
      appUserId,
      linkedAt,
      deviceId,
      localOwnerId,
    )) as RunResult;

    linkedCategoriesCount = getChangedRowCount(categoryResult);

    const balanceTypeResult = (await transactionDatabase.runAsync(
      `
        UPDATE balance_types
        SET
          owner_id = ?,
          updated_at = ?,
          source_device_id = ?
        WHERE owner_id = ?
      `,
      appUserId,
      linkedAt,
      deviceId,
      localOwnerId,
    )) as RunResult;

    linkedBalanceTypesCount = getChangedRowCount(balanceTypeResult);

    const balanceEntryResult = (await transactionDatabase.runAsync(
      `
        UPDATE balance_entries
        SET
          owner_id = ?,
          updated_at = ?,
          source_device_id = ?
        WHERE owner_id = ?
      `,
      appUserId,
      linkedAt,
      deviceId,
      localOwnerId,
    )) as RunResult;

    linkedBalanceEntriesCount = getChangedRowCount(balanceEntryResult);

    await upsertMetadataValue({
      database: transactionDatabase,
      key: ACCOUNT_LINKED_APP_USER_ID_KEY,
      updatedAt: linkedAt,
      value: appUserId,
    });

    await upsertMetadataValue({
      database: transactionDatabase,
      key: ACCOUNT_LINKED_AT_KEY,
      updatedAt: linkedAt,
      value: String(linkedAt),
    });
  });

  return {
    status:
      linkedTransactionsCount > 0 ||
      linkedCategoriesCount > 0 ||
      linkedBalanceTypesCount > 0 ||
      linkedBalanceEntriesCount > 0
        ? 'linked'
        : 'already_linked',
    linkedTransactionsCount,
    linkedCategoriesCount,
    linkedBalanceTypesCount,
    linkedBalanceEntriesCount,
    alreadyLinkedTransactionsCount,
    alreadyLinkedCategoriesCount,
    alreadyLinkedBalanceTypesCount,
    alreadyLinkedBalanceEntriesCount,
  };
}

function createSkippedResult(
  skippedReason: LocalAccountLinkingSkippedReason,
): LocalAccountLinkingResult {
  return {
    status: 'skipped',
    linkedTransactionsCount: 0,
    linkedCategoriesCount: 0,
    linkedBalanceTypesCount: 0,
    linkedBalanceEntriesCount: 0,
    alreadyLinkedTransactionsCount: 0,
    alreadyLinkedCategoriesCount: 0,
    alreadyLinkedBalanceTypesCount: 0,
    alreadyLinkedBalanceEntriesCount: 0,
    skippedReason,
  };
}

async function countRowsOwnedBy({
  database,
  ownerId,
  tableName,
}: {
  database: {
    getFirstAsync<T>(source: string, ...params: unknown[]): Promise<T | null>;
  };
  ownerId: string;
  tableName:
    | 'balance_entries'
    | 'balance_types'
    | 'categories'
    | 'transactions';
}) {
  const row = await database.getFirstAsync<CountRow>(
    `
      SELECT COUNT(*) AS count
      FROM ${tableName}
      WHERE owner_id = ?
    `,
    ownerId,
  );

  return typeof row?.count === 'number' && Number.isFinite(row.count)
    ? row.count
    : 0;
}

function getChangedRowCount(result: RunResult) {
  return typeof result.changes === 'number' && Number.isFinite(result.changes)
    ? result.changes
    : 0;
}

async function upsertMetadataValue({
  database,
  key,
  updatedAt,
  value,
}: {
  database: {
    runAsync(source: string, ...params: unknown[]): Promise<unknown>;
  };
  key: string;
  updatedAt: number;
  value: string;
}) {
  await database.runAsync(
    `
      INSERT OR REPLACE INTO app_metadata (
        key,
        value,
        updated_at
      ) VALUES (?, ?, ?)
    `,
    key,
    value,
    updatedAt,
  );
}
