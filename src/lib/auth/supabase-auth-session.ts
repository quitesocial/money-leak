import type { Session, User } from '@supabase/supabase-js';

import type { AuthSession, AuthUser } from '@/types/auth';

function getStringMetadataValue(
  metadata: User['user_metadata'],
  keys: string[],
) {
  if (!metadata || typeof metadata !== 'object') return null;

  for (const key of keys) {
    const value = metadata[key];

    if (typeof value === 'string' && value.trim().length > 0) {
      return value;
    }
  }

  return null;
}

export function mapSupabaseSessionToAuthSession({
  now = Date.now,
  session,
}: {
  now?: () => number;
  session: Session;
}): AuthSession {
  const user = session.user;

  const authUser: AuthUser = {
    id: user.id,
    provider: 'google',
    email: typeof user.email === 'string' ? user.email : null,
    displayName: getStringMetadataValue(user.user_metadata, [
      'full_name',
      'name',
      'user_name',
    ]),
    photoUrl: getStringMetadataValue(user.user_metadata, [
      'avatar_url',
      'picture',
    ]),
  };

  return {
    user: authUser,
    provider: 'google',
    createdAt: now(),
    expiresAt:
      typeof session.expires_at === 'number' ? session.expires_at * 1000 : null,
  };
}
