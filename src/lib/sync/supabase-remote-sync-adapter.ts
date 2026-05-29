import type { SupabaseClient } from '@supabase/supabase-js';

import { getSupabaseClient } from '@/lib/supabase/supabase-client';
import { toRemoteTimestamp } from '@/lib/sync/sync-mappers';
import {
  mapRemoteBalanceEntryRow,
  mapRemoteBalanceEntryToRow,
  mapRemoteBalanceTypeRow,
  mapRemoteBalanceTypeToRow,
  mapRemoteCategoryRow,
  mapRemoteCategoryToRow,
  mapRemoteTransactionRow,
  mapRemoteTransactionToRow,
  REMOTE_BALANCE_ENTRY_COLUMNS,
  REMOTE_BALANCE_TYPE_COLUMNS,
  REMOTE_CATEGORY_COLUMNS,
  REMOTE_TRANSACTION_COLUMNS,
  type RemoteBalanceEntryRow,
  type RemoteBalanceTypeRow,
  type RemoteCategoryRow,
  type RemoteTransactionRow,
} from '@/lib/sync/supabase-remote-row-mappers';
import type {
  RemoteBalanceEntry,
  RemoteBalanceType,
  RemoteCategory,
  RemoteSyncAdapter,
  RemoteTransaction,
} from '@/lib/sync/sync-types';

type SupabaseRemoteSyncClient = Pick<SupabaseClient, 'from'> & {
  auth: Pick<SupabaseClient['auth'], 'getSession'>;
};

type SupabaseRemoteSyncAdapterOptions = {
  getClient?: () => SupabaseRemoteSyncClient | null;
};

type SupabaseReadResult<T> = {
  data: T | null;
  error: unknown;
};

type SupabaseWriteResult = {
  error: unknown;
};

const GENERIC_REMOTE_SYNC_ERROR_MESSAGE = 'Remote sync could not finish.';

export function createSupabaseRemoteSyncAdapter({
  getClient = getSupabaseClient,
}: SupabaseRemoteSyncAdapterOptions = {}): RemoteSyncAdapter {
  return {
    async getAuthenticatedUserId() {
      const client = getClient();

      if (!client) return null;

      try {
        const { data, error } = await client.auth.getSession();

        if (error) return null;

        const userId = data.session?.user.id.trim();

        return userId && userId.length > 0 ? userId : null;
      } catch {
        return null;
      }
    },

    async pullChanges({ userId, since }) {
      const normalizedUserId = userId.trim();
      const client = getClient();

      if (!client || !normalizedUserId) {
        throw new Error(GENERIC_REMOTE_SYNC_ERROR_MESSAGE);
      }

      try {
        const [categories, transactions, balanceTypes, balanceEntries] =
          await Promise.all([
            readRemoteCategories({ client, since, userId: normalizedUserId }),
            readRemoteTransactions({ client, since, userId: normalizedUserId }),
            readRemoteBalanceTypes({ client, since, userId: normalizedUserId }),
            readRemoteBalanceEntries({
              client,
              since,
              userId: normalizedUserId,
            }),
          ]);

        return {
          categories,
          transactions,
          balanceTypes,
          balanceEntries,
        };
      } catch {
        throw new Error(GENERIC_REMOTE_SYNC_ERROR_MESSAGE);
      }
    },

    async pushChanges({
      balanceEntries,
      balanceTypes,
      categories,
      transactions,
    }) {
      const client = getClient();

      if (!client) throw new Error(GENERIC_REMOTE_SYNC_ERROR_MESSAGE);

      try {
        await upsertRemoteCategories({ categories, client });
        await upsertRemoteBalanceTypes({ balanceTypes, client });
        await upsertRemoteTransactions({ client, transactions });
        await upsertRemoteBalanceEntries({ balanceEntries, client });
      } catch {
        throw new Error(GENERIC_REMOTE_SYNC_ERROR_MESSAGE);
      }

      return {
        pushedTransactionsCount: transactions.length,
        pushedCategoriesCount: categories.length,
        pushedBalanceTypesCount: balanceTypes.length,
        pushedBalanceEntriesCount: balanceEntries.length,
      };
    },
  };
}

export const supabaseRemoteSyncAdapter = createSupabaseRemoteSyncAdapter();

async function readRemoteCategories({
  client,
  since,
  userId,
}: {
  client: SupabaseRemoteSyncClient;
  since: number | null;
  userId: string;
}) {
  const query = client
    .from('remote_categories')
    .select(REMOTE_CATEGORY_COLUMNS)
    .eq('user_id', userId);

  const result = (await applySinceFilter({
    query,
    since,
  })) as SupabaseReadResult<RemoteCategoryRow[]>;

  if (result.error || !Array.isArray(result.data)) {
    throw new Error(GENERIC_REMOTE_SYNC_ERROR_MESSAGE);
  }

  return result.data.map(mapRemoteCategoryRow);
}

async function readRemoteTransactions({
  client,
  since,
  userId,
}: {
  client: SupabaseRemoteSyncClient;
  since: number | null;
  userId: string;
}) {
  const query = client
    .from('remote_transactions')
    .select(REMOTE_TRANSACTION_COLUMNS)
    .eq('user_id', userId);

  const result = (await applySinceFilter({
    query,
    since,
  })) as SupabaseReadResult<RemoteTransactionRow[]>;

  if (result.error || !Array.isArray(result.data)) {
    throw new Error(GENERIC_REMOTE_SYNC_ERROR_MESSAGE);
  }

  return result.data.map(mapRemoteTransactionRow);
}

async function readRemoteBalanceTypes({
  client,
  since,
  userId,
}: {
  client: SupabaseRemoteSyncClient;
  since: number | null;
  userId: string;
}) {
  const query = client
    .from('remote_balance_types')
    .select(REMOTE_BALANCE_TYPE_COLUMNS)
    .eq('user_id', userId);

  const result = (await applySinceFilter({
    query,
    since,
  })) as SupabaseReadResult<RemoteBalanceTypeRow[]>;

  if (result.error || !Array.isArray(result.data)) {
    throw new Error(GENERIC_REMOTE_SYNC_ERROR_MESSAGE);
  }

  return result.data.map(mapRemoteBalanceTypeRow);
}

async function readRemoteBalanceEntries({
  client,
  since,
  userId,
}: {
  client: SupabaseRemoteSyncClient;
  since: number | null;
  userId: string;
}) {
  const query = client
    .from('remote_balance_entries')
    .select(REMOTE_BALANCE_ENTRY_COLUMNS)
    .eq('user_id', userId);

  const result = (await applySinceFilter({
    query,
    since,
  })) as SupabaseReadResult<RemoteBalanceEntryRow[]>;

  if (result.error || !Array.isArray(result.data)) {
    throw new Error(GENERIC_REMOTE_SYNC_ERROR_MESSAGE);
  }

  return result.data.map(mapRemoteBalanceEntryRow);
}

function applySinceFilter({
  query,
  since,
}: {
  query: {
    or?: (filters: string) => unknown;
    then?: unknown;
  };
  since: number | null;
}) {
  if (since === null) return query;

  const remoteTimestamp = toRemoteTimestamp(since);

  if (typeof query.or !== 'function') return query;

  return query.or(
    `updated_at.gt.${remoteTimestamp},deleted_at.gt.${remoteTimestamp}`,
  );
}

async function upsertRemoteCategories({
  categories,
  client,
}: {
  categories: RemoteCategory[];
  client: SupabaseRemoteSyncClient;
}) {
  if (categories.length === 0) return;

  const result = (await client
    .from('remote_categories')
    .upsert(categories.map(mapRemoteCategoryToRow), {
      onConflict: 'user_id,id',
    })) as SupabaseWriteResult;

  if (result.error) throw new Error(GENERIC_REMOTE_SYNC_ERROR_MESSAGE);
}

async function upsertRemoteBalanceTypes({
  balanceTypes,
  client,
}: {
  balanceTypes: RemoteBalanceType[];
  client: SupabaseRemoteSyncClient;
}) {
  if (balanceTypes.length === 0) return;

  const result = (await client
    .from('remote_balance_types')
    .upsert(balanceTypes.map(mapRemoteBalanceTypeToRow), {
      onConflict: 'user_id,id',
    })) as SupabaseWriteResult;

  if (result.error) throw new Error(GENERIC_REMOTE_SYNC_ERROR_MESSAGE);
}

async function upsertRemoteTransactions({
  client,
  transactions,
}: {
  client: SupabaseRemoteSyncClient;
  transactions: RemoteTransaction[];
}) {
  if (transactions.length === 0) return;

  const result = (await client
    .from('remote_transactions')
    .upsert(transactions.map(mapRemoteTransactionToRow), {
      onConflict: 'user_id,id',
    })) as SupabaseWriteResult;

  if (result.error) throw new Error(GENERIC_REMOTE_SYNC_ERROR_MESSAGE);
}

async function upsertRemoteBalanceEntries({
  balanceEntries,
  client,
}: {
  balanceEntries: RemoteBalanceEntry[];
  client: SupabaseRemoteSyncClient;
}) {
  if (balanceEntries.length === 0) return;

  const result = (await client
    .from('remote_balance_entries')
    .upsert(balanceEntries.map(mapRemoteBalanceEntryToRow), {
      onConflict: 'user_id,id',
    })) as SupabaseWriteResult;

  if (result.error) throw new Error(GENERIC_REMOTE_SYNC_ERROR_MESSAGE);
}
