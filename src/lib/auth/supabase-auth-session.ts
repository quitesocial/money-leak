import type { Session, User } from '@supabase/supabase-js';

import type { AuthProvider, AuthSession, AuthUser } from '@/types/auth';

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

function getMetadataArrayValue(metadata: User['app_metadata'], key: string) {
  if (!metadata || typeof metadata !== 'object') return null;

  const value = metadata[key];

  return Array.isArray(value) ? value : null;
}

function getStringAppMetadataValue(
  metadata: User['app_metadata'],
  key: string,
) {
  if (!metadata || typeof metadata !== 'object') return null;

  const value = metadata[key];

  return typeof value === 'string' ? value : null;
}

function normalizeAuthProvider(value: unknown): AuthProvider | null {
  return value === 'apple' || value === 'google' ? value : null;
}

function getIdentityProvider(user: User): AuthProvider | null {
  const identities = user.identities;

  if (!Array.isArray(identities)) return null;

  for (const identity of identities) {
    const provider = normalizeAuthProvider(identity.provider);

    if (provider) return provider;
  }

  return null;
}

function inferAuthProvider(user: User): AuthProvider {
  const metadataProvider = normalizeAuthProvider(
    getStringAppMetadataValue(user.app_metadata, 'provider'),
  );

  if (metadataProvider) return metadataProvider;

  const metadataProviders = getMetadataArrayValue(
    user.app_metadata,
    'providers',
  );

  if (metadataProviders) {
    for (const providerValue of metadataProviders) {
      const provider = normalizeAuthProvider(providerValue);

      if (provider) return provider;
    }
  }

  return getIdentityProvider(user) ?? 'google';
}

export function mapSupabaseSessionToAuthSession({
  displayNameOverride = null,
  now = Date.now,
  providerOverride = null,
  session,
}: {
  displayNameOverride?: string | null;
  now?: () => number;
  providerOverride?: AuthProvider | null;
  session: Session;
}): AuthSession {
  const user = session.user;
  const provider = providerOverride ?? inferAuthProvider(user);
  const displayName =
    getStringMetadataValue(user.user_metadata, [
      'full_name',
      'name',
      'user_name',
    ]) ?? displayNameOverride;

  const authUser: AuthUser = {
    id: user.id,
    provider,
    email: typeof user.email === 'string' ? user.email : null,
    displayName,
    photoUrl: getStringMetadataValue(user.user_metadata, [
      'avatar_url',
      'picture',
    ]),
  };

  return {
    user: authUser,
    provider,
    createdAt: now(),
    expiresAt:
      typeof session.expires_at === 'number' ? session.expires_at * 1000 : null,
  };
}
