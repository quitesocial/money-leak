import type { AuthProvider, AuthSession } from '@/types/auth';

export type AuthProviderAdapter = {
  provider: AuthProvider;
  isEnabled: boolean;
  signIn: () => Promise<AuthSession | null>;
  signOut?: (session: AuthSession) => Promise<void>;
};

export type AuthService = {
  restoreSession: () => Promise<AuthSession | null>;
  setSession: (session: AuthSession) => Promise<void>;
  signOut: () => Promise<void>;
};
