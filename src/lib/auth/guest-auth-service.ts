import type { AuthService } from '@/lib/auth/auth-service';
import {
  secureAuthSessionStorage,
  type AuthSessionStorage,
} from '@/lib/auth/session-storage';

type GuestAuthServiceOptions = {
  sessionStorage?: AuthSessionStorage;
};

export function createGuestAuthService({
  sessionStorage = secureAuthSessionStorage,
}: GuestAuthServiceOptions = {}): AuthService {
  return {
    restoreSession() {
      return sessionStorage.getSession();
    },

    setSession(session) {
      return sessionStorage.setSession(session);
    },

    signOut() {
      return sessionStorage.clearSession();
    },
  };
}

export const guestAuthService = createGuestAuthService();
