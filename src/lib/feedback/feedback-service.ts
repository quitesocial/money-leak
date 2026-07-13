import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { supabaseFeedbackAdapter } from '@/lib/feedback/supabase-feedback-adapter';
import type { SettingsLanguage } from '@/lib/settings-preferences';

export const FEEDBACK_COMMENT_MAX_LENGTH = 2000;
export const FEEDBACK_APP_VERSION_MAX_LENGTH = 64;
export const FEEDBACK_PLATFORM_MAX_LENGTH = 32;
export const FEEDBACK_LANGUAGE_MAX_LENGTH = 64;

export type FeedbackRating = 1 | 2 | 3 | 4 | 5;

export type FeedbackSubmissionInput = {
  rating: number;
  comment: string;
  language: SettingsLanguage;
};

export type FeedbackSubmissionPayload = {
  rating: FeedbackRating;
  comment: string | null;
  app_version: string;
  platform: string;
  language: string;
};

export type FeedbackSubmissionErrorCode =
  | 'invalid_rating'
  | 'comment_too_long'
  | 'runtime_metadata_unavailable'
  | 'feedback_client_unavailable'
  | 'remote_insert_failed';

export type FeedbackSubmissionResult =
  | { status: 'succeeded' }
  | {
      status: 'failed';
      error: {
        code: FeedbackSubmissionErrorCode;
        isRecoverable: true;
      };
    };

export type FeedbackAdapter = {
  insertSubmission: (
    payload: FeedbackSubmissionPayload,
  ) => Promise<FeedbackSubmissionResult>;
};

type FeedbackServiceOptions = {
  adapter: FeedbackAdapter;
  getAppVersion?: () => string | null;
  getPlatform?: () => string;
};

export type FeedbackService = {
  submitFeedback: (
    input: FeedbackSubmissionInput,
  ) => Promise<FeedbackSubmissionResult>;
};

export function createFeedbackService({
  adapter,
  getAppVersion = () => Constants.expoConfig?.version ?? null,
  getPlatform = () => Platform.OS,
}: FeedbackServiceOptions): FeedbackService {
  return {
    async submitFeedback({ rating, comment, language }) {
      if (!isFeedbackRating(rating)) {
        return createFailedResult('invalid_rating');
      }

      const normalizedComment = comment.trim();

      if (normalizedComment.length > FEEDBACK_COMMENT_MAX_LENGTH) {
        return createFailedResult('comment_too_long');
      }

      const appVersion = getAppVersion()?.trim() ?? '';
      const platform = getPlatform().trim();
      const runtimeLanguage = language.trim();

      if (
        !isSafeMetadata(appVersion, FEEDBACK_APP_VERSION_MAX_LENGTH) ||
        !isSafeMetadata(platform, FEEDBACK_PLATFORM_MAX_LENGTH) ||
        !isSafeMetadata(runtimeLanguage, FEEDBACK_LANGUAGE_MAX_LENGTH)
      ) {
        return createFailedResult('runtime_metadata_unavailable');
      }

      try {
        return await adapter.insertSubmission({
          rating,
          comment: normalizedComment.length > 0 ? normalizedComment : null,
          app_version: appVersion,
          platform,
          language: runtimeLanguage,
        });
      } catch {
        return createFailedResult('remote_insert_failed');
      }
    },
  };
}

function isFeedbackRating(value: number): value is FeedbackRating {
  return Number.isInteger(value) && value >= 1 && value <= 5;
}

function isSafeMetadata(value: string, maxLength: number) {
  return value.length > 0 && value.length <= maxLength;
}

function createFailedResult(
  code: FeedbackSubmissionErrorCode,
): FeedbackSubmissionResult {
  return {
    status: 'failed',
    error: {
      code,
      isRecoverable: true,
    },
  };
}

export const feedbackService = createFeedbackService({
  adapter: supabaseFeedbackAdapter,
});
