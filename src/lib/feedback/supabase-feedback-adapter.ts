import type { SupabaseClient } from '@supabase/supabase-js';

import type {
  FeedbackAdapter,
  FeedbackSubmissionErrorCode,
  FeedbackSubmissionResult,
} from '@/lib/feedback/feedback-service';
import { getSupabaseClient } from '@/lib/supabase/supabase-client';

type SupabaseFeedbackClient = Pick<SupabaseClient, 'from'>;

type SupabaseFeedbackAdapterOptions = {
  getClient?: () => SupabaseFeedbackClient | null;
};

export function createSupabaseFeedbackAdapter({
  getClient = getSupabaseClient,
}: SupabaseFeedbackAdapterOptions = {}): FeedbackAdapter {
  return {
    async insertSubmission(payload) {
      const client = getClient();

      if (!client) {
        return createFailedResult('feedback_client_unavailable');
      }

      try {
        const { error } = await client
          .from('feedback_submissions')
          .insert(payload);

        if (error) return createFailedResult('remote_insert_failed');

        return { status: 'succeeded' };
      } catch {
        return createFailedResult('remote_insert_failed');
      }
    },
  };
}

function createFailedResult(
  code: FeedbackSubmissionErrorCode,
): FeedbackSubmissionResult {
  return {
    status: 'failed',
    error: { code, isRecoverable: true },
  };
}

export const supabaseFeedbackAdapter = createSupabaseFeedbackAdapter();
