import type {
  LocalAccountLinkingResult,
  LocalAccountLinkingSkippedReason,
} from './account-linking.native';
import type { AuthSession } from '@/types/auth';

export type { LocalAccountLinkingResult, LocalAccountLinkingSkippedReason };

export async function linkLocalAccount(
  _session: AuthSession,
): Promise<LocalAccountLinkingResult> {
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
    skippedReason: 'native_sqlite_unavailable',
  };
}
