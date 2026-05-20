import type { SupabaseClient } from '@supabase/supabase-js';

import { getSupabaseClient } from '@/lib/supabase/supabase-client';
import type { AuthProvider, AuthSession, AuthUser } from '@/types/auth';

const PROFILE_SELECT_COLUMNS =
  'id,email,display_name,avatar_url,provider,created_at,updated_at';

type SupabaseProfileClient = Pick<SupabaseClient, 'from'>;

type SupabaseProfileServiceOptions = {
  getClient?: () => SupabaseProfileClient | null;
};

type SupabaseProfileRow = {
  id: string;
  email: string | null;
  display_name: string | null;
  avatar_url: string | null;
  provider: string | null;
  created_at: string;
  updated_at: string;
};

type ProfileUpsertPayload = {
  id: string;
  email: string | null;
  display_name: string | null;
  avatar_url: string | null;
  provider: AuthProvider;
};

export type Profile = {
  id: string;
  email: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  provider: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ProfileEnsureSkippedReason = 'unauthenticated' | 'missing_user_id';

export type ProfileErrorCode =
  | 'profile_client_unavailable'
  | 'profile_ensure_failed';

export type ProfileResult =
  | {
      status: 'ensured';
      profile: Profile;
    }
  | {
      status: 'skipped';
      profile: null;
      skippedReason: ProfileEnsureSkippedReason;
    }
  | {
      status: 'failed';
      error: {
        code: ProfileErrorCode;
        isRecoverable: true;
        message: string;
      };
      profile: null;
    };

export async function ensureUserProfile(
  sessionOrUser: AuthSession | AuthUser | null | undefined,
  { getClient = getSupabaseClient }: SupabaseProfileServiceOptions = {},
): Promise<ProfileResult> {
  const user = getAuthUser(sessionOrUser);

  if (!user) return createSkippedResult('unauthenticated');

  const userId = user.id.trim();

  if (!userId) return createSkippedResult('missing_user_id');

  const client = getClient();

  if (!client) return createFailedResult('profile_client_unavailable');

  try {
    const payload: ProfileUpsertPayload = {
      id: userId,
      email: user.email,
      display_name: user.displayName,
      avatar_url: user.photoUrl,
      provider: user.provider,
    };

    const result = (await client
      .from('profiles')
      .upsert(payload, { onConflict: 'id' })
      .select(PROFILE_SELECT_COLUMNS)
      .single()) as {
      data: SupabaseProfileRow | null;
      error: unknown;
    };

    if (result.error || !result.data) {
      return createFailedResult('profile_ensure_failed');
    }

    return {
      status: 'ensured',
      profile: mapProfileRow(result.data),
    };
  } catch {
    return createFailedResult('profile_ensure_failed');
  }
}

function createSkippedResult(
  skippedReason: ProfileEnsureSkippedReason,
): ProfileResult {
  return {
    status: 'skipped',
    profile: null,
    skippedReason,
  };
}

function createFailedResult(code: ProfileErrorCode): ProfileResult {
  return {
    status: 'failed',
    error: {
      code,
      isRecoverable: true,
      message: 'Profile could not be prepared. Local mode remains available.',
    },
    profile: null,
  };
}

function getAuthUser(
  sessionOrUser: AuthSession | AuthUser | null | undefined,
): AuthUser | null {
  if (!sessionOrUser) return null;

  if ('user' in sessionOrUser) return sessionOrUser.user;

  return sessionOrUser;
}

function mapProfileRow(row: SupabaseProfileRow): Profile {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    provider: row.provider,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
