import { create, type StoreApi, type UseBoundStore } from 'zustand';

import { createSafeAuthError } from '@/lib/auth/auth-errors';
import type { AuthService } from '@/lib/auth/auth-service';
import { guestAuthService } from '@/lib/auth/guest-auth-service';
import type {
  AuthError,
  AuthSession,
  AuthStatus,
  AuthUser,
} from '@/types/auth';

type AuthStoreOptions = {
  authService?: AuthService;
};

export type AuthStore = {
  status: AuthStatus;
  session: AuthSession | null;
  user: AuthUser | null;
  error: AuthError | null;
  isInitialized: boolean;
  initializeAuth: () => Promise<void>;
  setSession: (session: AuthSession) => Promise<void>;
  clearAuthError: () => void;
  signOut: () => Promise<void>;
};

export type AuthStoreApi = UseBoundStore<StoreApi<AuthStore>>;

export function createAuthStore({
  authService = guestAuthService,
}: AuthStoreOptions = {}): AuthStoreApi {
  let initializePromise: Promise<void> | null = null;

  return create<AuthStore>((set, get) => ({
    status: 'loading',
    session: null,
    user: null,
    error: null,
    isInitialized: false,

    initializeAuth: async () => {
      if (get().isInitialized) return;
      if (initializePromise) return initializePromise;

      set({ status: 'loading', error: null });

      initializePromise = (async () => {
        try {
          const session = await authService.restoreSession();

          if (!session) {
            set({
              status: 'guest',
              session: null,
              user: null,
              error: null,
              isInitialized: true,
            });

            return;
          }

          set({
            status: 'authenticated',
            session,
            user: session.user,
            error: null,
            isInitialized: true,
          });
        } catch {
          set({
            status: 'guest',
            session: null,
            user: null,
            error: createSafeAuthError({
              code: 'session_restore_failed',
              message: 'Auth could not be restored. Continuing as guest.',
            }),
            isInitialized: true,
          });
        } finally {
          initializePromise = null;
        }
      })();

      return initializePromise;
    },

    setSession: async (session) => {
      set({ status: 'loading', error: null });

      try {
        await authService.setSession(session);

        set({
          status: 'authenticated',
          session,
          user: session.user,
          error: null,
          isInitialized: true,
        });
      } catch {
        set({
          status: 'guest',
          session: null,
          user: null,
          error: createSafeAuthError({
            code: 'session_save_failed',
            message: 'Auth session could not be saved. Continuing as guest.',
          }),
          isInitialized: true,
        });
      }
    },

    clearAuthError: () => {
      set({ error: null });
    },

    signOut: async () => {
      try {
        await authService.signOut();

        set({
          status: 'guest',
          session: null,
          user: null,
          error: null,
          isInitialized: true,
        });
      } catch {
        set({
          status: 'guest',
          session: null,
          user: null,
          error: createSafeAuthError({
            code: 'sign_out_failed',
            message: 'Auth session could not be cleared locally.',
          }),
          isInitialized: true,
        });
      }
    },
  }));
}

export const useAuthStore = createAuthStore();
