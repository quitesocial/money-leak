export type AuthProvider = 'google' | 'apple';

export type AuthStatus = 'loading' | 'guest' | 'authenticated' | 'error';

export type AuthUser = {
  id: string;
  provider: AuthProvider;
  email: string | null;
  displayName: string | null;
  photoUrl: string | null;
};

export type AuthSession = {
  user: AuthUser;
  provider: AuthProvider;
  createdAt: number;
  expiresAt: number | null;
};

export type AuthErrorCode =
  | 'account_link_failed'
  | 'session_restore_failed'
  | 'session_save_failed'
  | 'sign_out_failed'
  | 'unknown';

export type AuthError = {
  code: AuthErrorCode;
  message: string;
  isRecoverable: boolean;
};
