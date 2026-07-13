import {
  afterAll,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import * as React from 'react';
import { Alert } from 'react-native';
import {
  act,
  create,
  type ReactTestInstance,
  type ReactTestRenderer,
} from 'react-test-renderer';

import { FeedbackSheet } from '@/features/settings/feedback-sheet';
import type {
  FeedbackService,
  FeedbackSubmissionResult,
} from '@/lib/feedback/feedback-service';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 24, left: 0 }),
}));

jest.mock('expo-symbols', () => ({
  SymbolView: ({ fallback }: { fallback?: React.ReactNode }) => fallback,
}));

const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

function createService(
  result: FeedbackSubmissionResult = { status: 'succeeded' },
) {
  const submitFeedback = jest.fn<FeedbackService['submitFeedback']>(
    async () => result,
  );

  return { service: { submitFeedback }, submitFeedback };
}

function getText(node: ReactTestInstance | string): string {
  if (typeof node === 'string') return node;

  return node.children.map((child) => getText(child)).join('');
}

function findByTestID(renderer: ReactTestRenderer, testID: string) {
  return renderer.root.find(
    (node) => node.props.testID === testID,
  ) as ReactTestInstance & { props: any };
}

function findByAccessibilityLabel(
  renderer: ReactTestRenderer,
  accessibilityLabel: string,
) {
  return renderer.root.find(
    (node) => node.props.accessibilityLabel === accessibilityLabel,
  ) as ReactTestInstance & { props: any };
}

async function renderSheet({
  onClose = jest.fn(),
  service = createService().service,
  visible = true,
}: {
  onClose?: () => void;
  service?: FeedbackService;
  visible?: boolean;
} = {}) {
  let renderer: ReactTestRenderer | null = null;

  await act(async () => {
    renderer = create(
      <FeedbackSheet
        language="English"
        onClose={onClose}
        service={service}
        visible={visible}
      />,
    );
    await Promise.resolve();
  });

  if (!renderer) throw new Error('Feedback sheet did not render.');

  return renderer as unknown as ReactTestRenderer;
}

beforeEach(() => {
  alertSpy.mockClear();
});

afterAll(() => {
  alertSpy.mockRestore();
});

describe('FeedbackSheet', () => {
  it('starts with five outline stars and accessible unselected buttons', async () => {
    const renderer = await renderSheet();

    for (const rating of [1, 2, 3, 4, 5]) {
      const star = findByTestID(renderer, `feedback-rating-${rating}`);

      expect(star.props.accessibilityRole).toBe('button');
      expect(star.props.accessibilityState).toEqual({ selected: false });
      expect(star.props.accessibilityLabel).toBe(`Rate ${rating} out of 5`);
      expect(getText(star)).toContain('☆');
    }
    expect(getText(renderer.root)).not.toContain('Loved it');
  });

  it.each<[number, string]>([
    [1, 'Hated it'],
    [2, "Didn't like it"],
    [3, 'It was okay'],
    [4, 'Liked it'],
    [5, 'Loved it'],
  ])('selects rating %s and renders its label', async (rating, label) => {
    const renderer = await renderSheet();

    await act(async () => {
      findByTestID(renderer, `feedback-rating-${rating}`).props.onPress();
    });

    expect(getText(findByTestID(renderer, 'feedback-rating-label'))).toBe(
      label,
    );
    expect(
      findByTestID(renderer, `feedback-rating-${rating}`).props
        .accessibilityState,
    ).toEqual({ selected: true });
    expect(getText(findByTestID(renderer, 'feedback-rating-1'))).toContain('★');
    expect(getText(findByTestID(renderer, 'feedback-rating-5'))).toContain(
      rating === 5 ? '★' : '☆',
    );
  });

  it('allows changing the selected rating before submission', async () => {
    const renderer = await renderSheet();

    await act(async () => {
      findByTestID(renderer, 'feedback-rating-5').props.onPress();
      findByTestID(renderer, 'feedback-rating-2').props.onPress();
    });

    expect(getText(findByTestID(renderer, 'feedback-rating-label'))).toBe(
      "Didn't like it",
    );
  });

  it('requires a rating without calling the service', async () => {
    const { service, submitFeedback } = createService();
    const renderer = await renderSheet({ service });

    await act(async () => {
      findByTestID(renderer, 'feedback-submit').props.onPress();
      await Promise.resolve();
    });

    expect(submitFeedback).not.toHaveBeenCalled();
    expect(getText(renderer.root)).toContain(
      'Choose a rating before submitting.',
    );
  });

  it('passes comment input and applies maxLength', async () => {
    const { service, submitFeedback } = createService();
    const renderer = await renderSheet({ service });
    const input = findByAccessibilityLabel(renderer, 'Feedback comment');

    expect(input.props.maxLength).toBe(2000);
    expect(input.props.multiline).toBe(true);

    await act(async () => {
      findByTestID(renderer, 'feedback-rating-4').props.onPress();
      input.props.onChangeText('  useful feedback  ');
    });
    await act(async () => {
      findByTestID(renderer, 'feedback-submit').props.onPress();
      await Promise.resolve();
    });

    expect(submitFeedback).toHaveBeenCalledWith({
      rating: 4,
      comment: '  useful feedback  ',
      language: 'English',
    });
  });

  it('blocks close and fast repeated submit while sending', async () => {
    let resolveSubmission: ((value: FeedbackSubmissionResult) => void) | null =
      null;
    const submitFeedback = jest.fn<FeedbackService['submitFeedback']>(
      () =>
        new Promise((resolve) => {
          resolveSubmission = resolve;
        }),
    );
    const onClose = jest.fn();
    const renderer = await renderSheet({
      onClose,
      service: { submitFeedback },
    });

    await act(async () => {
      findByTestID(renderer, 'feedback-rating-5').props.onPress();
    });

    const submit = findByTestID(renderer, 'feedback-submit');
    await act(async () => {
      submit.props.onPress();
      submit.props.onPress();
      await Promise.resolve();
    });

    expect(submitFeedback).toHaveBeenCalledTimes(1);
    expect(findByTestID(renderer, 'feedback-submit').props.disabled).toBe(true);
    expect(findByTestID(renderer, 'feedback-rating-1').props.disabled).toBe(
      true,
    );
    expect(
      findByAccessibilityLabel(renderer, 'Feedback comment').props.editable,
    ).toBe(false);

    await act(async () => {
      findByTestID(renderer, 'feedback-sheet-backdrop').props.onPress();
    });
    expect(onClose).not.toHaveBeenCalled();

    await act(async () => {
      resolveSubmission?.({ status: 'succeeded' });
      await Promise.resolve();
    });
  });

  it('keeps the sheet open with a generic error after failure', async () => {
    const rawValue = 'raw backend token ownerId private comment';
    const consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    const { service } = createService({
      status: 'failed',
      error: { code: 'remote_insert_failed', isRecoverable: true },
    });
    const onClose = jest.fn();
    const renderer = await renderSheet({ onClose, service });

    await act(async () => {
      findByTestID(renderer, 'feedback-rating-1').props.onPress();
      findByAccessibilityLabel(renderer, 'Feedback comment').props.onChangeText(
        rawValue,
      );
    });
    await act(async () => {
      findByTestID(renderer, 'feedback-submit').props.onPress();
      await Promise.resolve();
    });

    expect(onClose).not.toHaveBeenCalled();
    expect(getText(renderer.root)).toContain(
      "Couldn't send your feedback. Try again.",
    );
    expect(getText(renderer.root)).not.toContain('ownerId');
    expect(consoleErrorSpy).not.toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });

  it('closes, thanks the user, and starts clean when reopened', async () => {
    const { service } = createService();
    const onClose = jest.fn();
    const renderer = await renderSheet({ onClose, service });

    await act(async () => {
      findByTestID(renderer, 'feedback-rating-5').props.onPress();
      findByAccessibilityLabel(renderer, 'Feedback comment').props.onChangeText(
        'Great',
      );
    });
    await act(async () => {
      findByTestID(renderer, 'feedback-submit').props.onPress();
      await Promise.resolve();
    });

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(alertSpy).toHaveBeenCalledWith(
      'Thank you',
      'Your feedback helps us improve Money Leak.',
    );

    await act(async () => {
      (renderer as any).update(
        <FeedbackSheet
          language="English"
          onClose={onClose}
          service={service}
          visible={false}
        />,
      );
      (renderer as any).update(
        <FeedbackSheet
          language="English"
          onClose={onClose}
          service={service}
          visible
        />,
      );
      await Promise.resolve();
    });

    expect(getText(renderer.root)).not.toContain('Loved it');
    expect(
      findByAccessibilityLabel(renderer, 'Feedback comment').props.value,
    ).toBe('');
    expect(getText(findByTestID(renderer, 'feedback-rating-1'))).toContain('☆');
  });
});
