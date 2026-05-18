import type { AuthError, AuthErrorCode } from '@/types/auth';

type AuthErrorInput = {
  code: AuthErrorCode;
  message: string;
  isRecoverable?: boolean;
};

export function createSafeAuthError({
  code,
  message,
  isRecoverable = true,
}: AuthErrorInput): AuthError {
  return {
    code,
    message,
    isRecoverable,
  };
}
