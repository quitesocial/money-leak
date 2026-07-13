import { describe, expect, it, jest } from '@jest/globals';

import {
  createFeedbackService,
  type FeedbackAdapter,
  type FeedbackSubmissionPayload,
} from '@/lib/feedback/feedback-service';

function createAdapter() {
  const payloads: FeedbackSubmissionPayload[] = [];
  const insertSubmission = jest.fn<FeedbackAdapter['insertSubmission']>(
    async (payload) => {
      payloads.push(payload);

      return { status: 'succeeded' };
    },
  );

  return {
    adapter: { insertSubmission },
    insertSubmission,
    payloads,
  };
}

function createService(adapter: FeedbackAdapter) {
  return createFeedbackService({
    adapter,
    getAppVersion: () => '1.28.0',
    getPlatform: () => 'ios',
  });
}

describe('feedback service', () => {
  it.each([1, 2, 3, 4, 5])('submits valid rating %s', async (rating) => {
    const { adapter, insertSubmission } = createAdapter();

    await expect(
      createService(adapter).submitFeedback({
        rating,
        comment: '  Helpful app  ',
        language: 'English',
      }),
    ).resolves.toEqual({ status: 'succeeded' });

    expect(insertSubmission).toHaveBeenCalledWith({
      rating,
      comment: 'Helpful app',
      app_version: '1.28.0',
      platform: 'ios',
      language: 'English',
    });
  });

  it('normalizes an empty comment to null', async () => {
    const { adapter, insertSubmission } = createAdapter();

    await createService(adapter).submitFeedback({
      rating: 4,
      comment: ' \n\t ',
      language: 'Indian',
    });

    expect(insertSubmission).toHaveBeenCalledWith(
      expect.objectContaining({ comment: null, language: 'Indian' }),
    );
  });

  it.each([0, 6, 1.5, Number.NaN])(
    'rejects invalid rating %s without a remote write',
    async (rating) => {
      const { adapter, insertSubmission } = createAdapter();

      await expect(
        createService(adapter).submitFeedback({
          rating,
          comment: '',
          language: 'English',
        }),
      ).resolves.toMatchObject({
        status: 'failed',
        error: { code: 'invalid_rating', isRecoverable: true },
      });
      expect(insertSubmission).not.toHaveBeenCalled();
    },
  );

  it('rejects a long comment without a remote write', async () => {
    const { adapter, insertSubmission } = createAdapter();

    await expect(
      createService(adapter).submitFeedback({
        rating: 5,
        comment: 'x'.repeat(2001),
        language: 'English',
      }),
    ).resolves.toMatchObject({
      status: 'failed',
      error: { code: 'comment_too_long' },
    });
    expect(insertSubmission).not.toHaveBeenCalled();
  });

  it.each([
    { appVersion: null, platform: 'ios' },
    { appVersion: '', platform: 'ios' },
    { appVersion: '1.28.0', platform: '' },
    { appVersion: 'x'.repeat(65), platform: 'ios' },
  ])('rejects unsafe runtime metadata %#', async ({ appVersion, platform }) => {
    const { adapter, insertSubmission } = createAdapter();
    const service = createFeedbackService({
      adapter,
      getAppVersion: () => appVersion,
      getPlatform: () => platform,
    });

    await expect(
      service.submitFeedback({
        rating: 5,
        comment: '',
        language: 'English',
      }),
    ).resolves.toMatchObject({
      status: 'failed',
      error: { code: 'runtime_metadata_unavailable' },
    });
    expect(insertSubmission).not.toHaveBeenCalled();
  });

  it('turns a thrown adapter error into a safe failure', async () => {
    const rawError = new Error('raw backend token ownerId');
    const adapter: FeedbackAdapter = {
      insertSubmission: jest.fn(async () => {
        throw rawError;
      }),
    };

    await expect(
      createService(adapter).submitFeedback({
        rating: 3,
        comment: 'private comment',
        language: 'English',
      }),
    ).resolves.toEqual({
      status: 'failed',
      error: { code: 'remote_insert_failed', isRecoverable: true },
    });
  });

  it('creates an anonymous payload with no identifier or financial fields', async () => {
    const { adapter, payloads } = createAdapter();

    await createService(adapter).submitFeedback({
      rating: 5,
      comment: 'Great',
      language: 'German',
    });

    expect(Object.keys(payloads[0] ?? {}).sort()).toEqual([
      'app_version',
      'comment',
      'language',
      'platform',
      'rating',
    ]);
  });
});
