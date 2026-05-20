import { create, type StoreApi, type UseBoundStore } from 'zustand';

import { linkLocalAccount } from '@/db/account-linking';
import { createSafeAuthError } from '@/lib/auth/auth-errors';
import type { AuthService } from '@/lib/auth/auth-service';
import { supabaseAuthService } from '@/lib/auth/supabase-auth-service';
import type {
  AuthError,
  AuthSession,
  AuthStatus,
  AuthUser,
} from '@/types/auth';

type AuthStoreOptions = {
  authService?: AuthService;
  linkAccount?: (session: AuthSession) => Promise<unknown>;
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
  authService = supabaseAuthService,
  linkAccount = linkLocalAccount,
}: AuthStoreOptions = {}): AuthStoreApi {
  let initializePromise: Promise<void> | null = null;

  return create<AuthStore>((set, get) => ({
    status: 'loading',
    session: null,
    user: null,
    error: null,
    isInitialized: false,

    // Linking is intentionally post-auth and recoverable. Local app usage and
    // the authenticated display state must not depend on this finishing.
    async initializeAuth() {
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

          void linkAuthenticatedLocalData({
            get,
            linkAccount,
            session,
            set,
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

        void linkAuthenticatedLocalData({
          get,
          linkAccount,
          session,
          set,
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

async function linkAuthenticatedLocalData({
  get,
  linkAccount,
  session,
  set,
}: {
  get: () => AuthStore;
  linkAccount: (session: AuthSession) => Promise<unknown>;
  session: AuthSession;
  set: StoreApi<AuthStore>['setState'];
}) {
  try {
    await linkAccount(session);
  } catch {
    const currentState = get();

    if (
      currentState.status !== 'authenticated' ||
      currentState.session?.user.id !== session.user.id
    ) {
      return;
    }

    set({
      error: createSafeAuthError({
        code: 'account_link_failed',
        message:
          'Your local data is still on this device, but account linking could not finish.',
      }),
    });
  }
}
