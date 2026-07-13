import { describe, expect, it, jest } from '@jest/globals';

import { createSupabaseFeedbackAdapter } from '@/lib/feedback/supabase-feedback-adapter';
import type { FeedbackSubmissionPayload } from '@/lib/feedback/feedback-service';

const payload: FeedbackSubmissionPayload = {
  rating: 5,
  comment: null,
  app_version: '1.28.0',
  platform: 'ios',
  language: 'English',
};

function createClient(error: unknown = null) {
  const insert = jest.fn(async () => ({ error }));
  const from = jest.fn(() => ({ insert }));

  return { client: { from }, from, insert };
}

describe('Supabase feedback adapter', () => {
  it('performs one insert without reading the feedback row', async () => {
    const { client, from, insert } = createClient();
    const adapter = createSupabaseFeedbackAdapter({
      getClient: () => client as never,
    });

    await expect(adapter.insertSubmission(payload)).resolves.toEqual({
      status: 'succeeded',
    });
    expect(from).toHaveBeenCalledTimes(1);
    expect(from).toHaveBeenCalledWith('feedback_submissions');
    expect(insert).toHaveBeenCalledTimes(1);
    expect(insert).toHaveBeenCalledWith(payload);
    expect(Object.keys(insert.mock.results[0] ?? {})).not.toContain('select');
  });

  it('returns a safe failure when Supabase is unavailable', async () => {
    const adapter = createSupabaseFeedbackAdapter({ getClient: () => null });

    await expect(adapter.insertSubmission(payload)).resolves.toEqual({
      status: 'failed',
      error: {
        code: 'feedback_client_unavailable',
        isRecoverable: true,
      },
    });
  });

  it('returns a safe failure for an insert error', async () => {
    const { client } = createClient({
      message: 'raw backend url token ownerId',
    });
    const adapter = createSupabaseFeedbackAdapter({
      getClient: () => client as never,
    });

    await expect(adapter.insertSubmission(payload)).resolves.toEqual({
      status: 'failed',
      error: { code: 'remote_insert_failed', isRecoverable: true },
    });
  });

  it('returns a safe failure when insert throws', async () => {
    const adapter = createSupabaseFeedbackAdapter({
      getClient: () =>
        ({
          from: () => ({
            insert: async () => {
              throw new Error('raw response');
            },
          }),
        }) as never,
    });

    await expect(adapter.insertSubmission(payload)).resolves.toEqual({
      status: 'failed',
      error: { code: 'remote_insert_failed', isRecoverable: true },
    });
  });
});
