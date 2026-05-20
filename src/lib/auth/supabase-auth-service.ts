import {
  isAuthRetryableFetchError,
  type Session,
  type SupabaseClient,
  type User,
} from '@supabase/supabase-js';

import type { AuthService } from '@/lib/auth/auth-service';
import {
  secureAuthSessionStorage,
  type AuthSessionStorage,
} from '@/lib/auth/session-storage';
import { mapSupabaseSessionToAuthSession } from '@/lib/auth/supabase-auth-session';
import { getSupabaseClient } from '@/lib/supabase/supabase-client';
import {
  clearSupabaseAuthStorage,
  getStoredSupabaseAuthSessionValue,
} from '@/lib/supabase/supabase-secure-storage';
import type { AuthSession } from '@/types/auth';

type SupabaseAuthClient = Pick<
  SupabaseClient['auth'],
  'getSession' | 'getUser' | 'signOut'
>;

type SupabaseAuthServiceOptions = {
  clearSupabaseSessionStorage?: () => Promise<void>;
  getClient?: () => { auth: SupabaseAuthClient } | null;
  getStoredSupabaseSessionValue?: () => Promise<string | null>;
  now?: () => number;
  sessionStorage?: AuthSessionStorage;
};

function getSessionWithVerifiedUser({
  session,
  user,
}: {
  session: Session;
  user: User;
}): Session {
  return {
    ...session,
    user,
  };
}

export function createSupabaseAuthService({
  clearSupabaseSessionStorage = clearSupabaseAuthStorage,
  getClient = getSupabaseClient,
  getStoredSupabaseSessionValue = getStoredSupabaseAuthSessionValue,
  now = Date.now,
  sessionStorage = secureAuthSessionStorage,
}: SupabaseAuthServiceOptions = {}): AuthService {
  async function clearStoredAuthState() {
    await Promise.all([
      sessionStorage.clearSession(),
      clearSupabaseSessionStorage(),
    ]);
  }

  async function failRestore(message: string): Promise<never> {
    await clearStoredAuthState();

    throw new Error(message);
  }

  async function saveTokenFreeSession(session: Session) {
    const authSession = mapSupabaseSessionToAuthSession({ now, session });

    try {
      await sessionStorage.setSession(authSession);
    } catch {
      await failRestore('Supabase auth session could not be restored.');
    }

    return authSession;
  }

  async function hasStoredSupabaseSession() {
    try {
      return (await getStoredSupabaseSessionValue()) !== null;
    } catch {
      return failRestore('Supabase auth session could not be restored.');
    }
  }

  async function getSupabaseSessionResult(client: {
    auth: SupabaseAuthClient;
  }) {
    try {
      return await client.auth.getSession();
    } catch {
      return failRestore('Supabase auth session could not be restored.');
    }
  }

  async function getSupabaseUserResult(client: { auth: SupabaseAuthClient }) {
    try {
      return await client.auth.getUser();
    } catch {
      return failRestore('Supabase auth session could not be verified.');
    }
  }

  return {
    async restoreSession() {
      const client = getClient();

      if (!client) {
        await clearStoredAuthState();

        return null;
      }

      const hadStoredSupabaseSession = await hasStoredSupabaseSession();
      const sessionResult = await getSupabaseSessionResult(client);
      const { data: sessionData, error: sessionError } = sessionResult;

      if (sessionError) {
        await failRestore('Supabase auth session could not be restored.');
      }

      if (!sessionData.session) {
        if (hadStoredSupabaseSession) {
          await failRestore('Supabase auth session could not be restored.');
        }

        await clearStoredAuthState();

        return null;
      }

      const userResult = await getSupabaseUserResult(client);
      const { data: userData, error: userError } = userResult;

      if (userError) {
        if (isAuthRetryableFetchError(userError)) {
          return saveTokenFreeSession(sessionData.session);
        }

        await failRestore('Supabase auth session could not be verified.');
      }

      const verifiedUser = userData.user;

      if (!verifiedUser) {
        return failRestore('Supabase auth session could not be verified.');
      }

      return saveTokenFreeSession(
        getSessionWithVerifiedUser({
          session: sessionData.session,
          user: verifiedUser,
        }),
      );
    },

    setSession(session: AuthSession) {
      return sessionStorage.setSession(session);
    },

    async signOut() {
      const client = getClient();
      let signOutError: unknown = null;

      if (client) {
        try {
          const { error } = await client.auth.signOut({ scope: 'local' });

          signOutError = error;
        } catch (error) {
          signOutError = error;
        }
      }

      await clearStoredAuthState();

      if (signOutError) {
        throw new Error('Supabase auth session could not be cleared.');
      }
    },
  };
}

export const supabaseAuthService = createSupabaseAuthService();
