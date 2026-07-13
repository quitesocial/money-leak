import { useEffect, useRef, useState } from 'react';
import { SymbolView } from 'expo-symbols';
import {
  Alert,
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  FEEDBACK_COMMENT_MAX_LENGTH,
  feedbackService,
  type FeedbackRating,
  type FeedbackService,
} from '@/lib/feedback/feedback-service';
import { t } from '@/lib/i18n/i18n';
import type { SettingsLanguage } from '@/lib/settings-preferences';

const RATINGS: FeedbackRating[] = [1, 2, 3, 4, 5];
const SHEET_HIDDEN_OFFSET = 640;

const TITLE_FONT_FAMILY = Platform.select({
  ios: 'NewYork',
  default: 'serif',
});

const TITLE_FONT_WEIGHT = Platform.select({
  ios: '700' as const,
  default: '800' as const,
});

const RATING_LABEL_KEYS = {
  1: 'settings.feedback.rating1',
  2: 'settings.feedback.rating2',
  3: 'settings.feedback.rating3',
  4: 'settings.feedback.rating4',
  5: 'settings.feedback.rating5',
} as const;

export function FeedbackSheet({
  language,
  onClose,
  service = feedbackService,
  visible,
}: {
  language: SettingsLanguage;
  onClose: () => void;
  service?: FeedbackService;
  visible: boolean;
}) {
  const insets = useSafeAreaInsets();
  const [rating, setRating] = useState<FeedbackRating | null>(null);
  const [comment, setComment] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSubmittingRef = useRef(false);
  const translateY = useRef(new Animated.Value(SHEET_HIDDEN_OFFSET)).current;

  useEffect(() => {
    if (!visible) return;

    resetForm();
    translateY.setValue(SHEET_HIDDEN_OFFSET);
    Animated.timing(translateY, {
      duration: 260,
      toValue: 0,
      useNativeDriver: true,
    }).start();
  }, [translateY, visible]);

  function resetForm() {
    isSubmittingRef.current = false;
    setRating(null);
    setComment('');
    setValidationError(null);
    setSubmissionError(null);
    setIsSubmitting(false);
  }

  function handleClose() {
    if (isSubmittingRef.current) return;

    resetForm();
    onClose();
  }

  async function handleSubmit() {
    if (isSubmittingRef.current) return;

    if (rating === null) {
      setValidationError(t(language, 'settings.feedback.ratingRequired'));

      return;
    }

    isSubmittingRef.current = true;
    setIsSubmitting(true);
    setValidationError(null);
    setSubmissionError(null);

    const result = await service.submitFeedback({
      rating,
      comment,
      language,
    });

    if (result.status === 'failed') {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
      setSubmissionError(t(language, 'settings.feedback.failure'));

      return;
    }

    resetForm();
    onClose();
    Alert.alert(
      t(language, 'settings.feedback.thankYouTitle'),
      t(language, 'settings.feedback.thankYouBody'),
    );
  }

  if (!visible) return null;

  return (
    <Modal
      animationType="none"
      onRequestClose={handleClose}
      statusBarTranslucent
      transparent
      visible
    >
      <View style={styles.modalRoot}>
        <Pressable
          accessibilityLabel={t(language, 'settings.feedback.closeA11y')}
          accessibilityRole="button"
          disabled={isSubmitting}
          onPress={handleClose}
          style={styles.backdrop}
          testID="feedback-sheet-backdrop"
        />

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          pointerEvents="box-none"
          style={styles.keyboardAvoider}
        >
          <Animated.View
            style={[
              styles.sheet,
              {
                paddingBottom: Math.max(insets.bottom, 24),
                transform: [{ translateY }],
              },
            ]}
            testID="feedback-sheet"
          >
            <Text style={styles.title}>
              {t(language, 'settings.feedback.title')}
            </Text>

            <View style={styles.ratingBlock}>
              <Text style={styles.question}>
                {t(language, 'settings.feedback.ratingQuestion')}
              </Text>

              <View style={styles.stars}>
                {RATINGS.map((value) => {
                  const isSelected = rating !== null && value <= rating;

                  return (
                    <Pressable
                      accessibilityLabel={t(
                        language,
                        'settings.feedback.starA11y',
                        { rating: value },
                      )}
                      accessibilityRole="button"
                      accessibilityState={{ selected: rating === value }}
                      disabled={isSubmitting}
                      hitSlop={6}
                      key={value}
                      onPress={() => {
                        setRating(value);
                        setValidationError(null);
                      }}
                      testID={`feedback-rating-${value}`}
                    >
                      <SymbolView
                        fallback={
                          <Text style={styles.starFallback}>
                            {isSelected ? '★' : '☆'}
                          </Text>
                        }
                        name={isSelected ? 'star.fill' : 'star'}
                        resizeMode="scaleAspectFit"
                        size={38}
                        tintColor="#100f10"
                        type="monochrome"
                        weight="regular"
                      />
                    </Pressable>
                  );
                })}
              </View>

              {rating !== null ? (
                <Text style={styles.ratingLabel} testID="feedback-rating-label">
                  {t(language, RATING_LABEL_KEYS[rating])}
                </Text>
              ) : null}
              {validationError ? (
                <Text style={styles.errorText}>{validationError}</Text>
              ) : null}
            </View>

            <View style={styles.commentBlock}>
              <Text style={styles.question}>
                {t(language, 'settings.feedback.commentQuestion')}
              </Text>
              <TextInput
                accessibilityLabel={t(
                  language,
                  'settings.feedback.commentA11y',
                )}
                editable={!isSubmitting}
                maxLength={FEEDBACK_COMMENT_MAX_LENGTH}
                multiline
                onChangeText={(value) => {
                  setComment(value);
                  setSubmissionError(null);
                }}
                style={styles.commentInput}
                textAlignVertical="top"
                value={comment}
              />
            </View>

            {submissionError ? (
              <Text style={styles.errorText}>{submissionError}</Text>
            ) : null}

            <Pressable
              accessibilityLabel={t(language, 'settings.feedback.submitA11y')}
              accessibilityRole="button"
              disabled={isSubmitting}
              onPress={() => {
                void handleSubmit();
              }}
              style={[
                styles.submitButton,
                isSubmitting ? styles.disabled : null,
              ]}
              testID="feedback-submit"
            >
              <Text style={styles.submitText}>
                {isSubmitting
                  ? t(language, 'settings.feedback.submitting')
                  : t(language, 'settings.feedback.submit')}
              </Text>
            </Pressable>
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(16, 15, 16, 0.08)',
  },
  keyboardAvoider: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    width: '100%',
    maxHeight: '90%',
    minHeight: 600,
    alignSelf: 'center',
    gap: 24,
    borderTopLeftRadius: 38,
    borderTopRightRadius: 38,
    backgroundColor: '#f7f7f5',
    paddingHorizontal: 22,
    paddingTop: 30,
    shadowColor: '#000000',
    shadowOpacity: 0.18,
    shadowRadius: 37.5,
    shadowOffset: { width: 0, height: 15 },
    elevation: 18,
  },
  title: {
    color: '#100f10',
    fontFamily: TITLE_FONT_FAMILY,
    fontSize: 26,
    fontWeight: TITLE_FONT_WEIGHT,
    lineHeight: 32,
  },
  ratingBlock: {
    alignItems: 'center',
    gap: 12,
  },
  question: {
    color: '#100f10',
    fontSize: 16,
    lineHeight: 22,
    textAlign: 'center',
  },
  stars: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  starFallback: {
    color: '#100f10',
    fontSize: 40,
    lineHeight: 44,
  },
  ratingLabel: {
    color: 'rgba(60, 60, 67, 0.6)',
    fontSize: 16,
    lineHeight: 22,
  },
  commentBlock: {
    gap: 8,
  },
  commentInput: {
    minHeight: 180,
    borderWidth: 1,
    borderColor: '#100f10',
    borderRadius: 28,
    color: '#100f10',
    fontSize: 16,
    lineHeight: 22,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  submitButton: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 26,
    backgroundColor: '#100f10',
    paddingHorizontal: 20,
  },
  submitText: {
    color: '#ffffff',
    fontSize: 16,
    lineHeight: 22,
  },
  errorText: {
    color: '#b91c1c',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  disabled: {
    opacity: 0.55,
  },
});
