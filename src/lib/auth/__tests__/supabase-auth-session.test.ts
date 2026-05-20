import { describe, expect, it } from '@jest/globals';
import type { Session } from '@supabase/supabase-js';

import { mapSupabaseSessionToAuthSession } from '@/lib/auth/supabase-auth-session';

function createSupabaseSession({
  appMetadata,
  identities,
  userMetadata = {
    full_name: 'Test User',
  },
}: {
  appMetadata: Record<string, unknown>;
  identities?: { provider: string }[];
  userMetadata?: Record<string, unknown>;
}) {
  return {
    access_token: 'sample-access-credential',
    refresh_token: 'sample-refresh-credential',
    expires_at: 1760003600,
    expires_in: 3600,
    token_type: 'bearer',
    user: {
      id: 'supabase-user-id',
      email: 'test@example.com',
      app_metadata: appMetadata,
      aud: 'authenticated',
      created_at: '2026-01-01T00:00:00.000Z',
      identities,
      user_metadata: userMetadata,
    },
  } as unknown as Session;
}

describe('Supabase auth session mapping', () => {
  it('infers Google provider from Supabase app metadata', () => {
    const session = mapSupabaseSessionToAuthSession({
      now: () => 1760000000000,
      session: createSupabaseSession({
        appMetadata: {
          provider: 'google',
          providers: ['google'],
        },
      }),
    });

    expect(session).toMatchObject({
      provider: 'google',
      user: {
        provider: 'google',
        displayName: 'Test User',
      },
    });
  });

  it('infers Apple provider from Supabase app metadata', () => {
    const session = mapSupabaseSessionToAuthSession({
      now: () => 1760000000000,
      session: createSupabaseSession({
        appMetadata: {
          provider: 'apple',
          providers: ['apple'],
        },
        userMetadata: {},
      }),
    });

    expect(session).toMatchObject({
      provider: 'apple',
      user: {
        provider: 'apple',
        displayName: null,
      },
    });
  });

  it('can infer Apple provider from identities when metadata is missing', () => {
    const session = mapSupabaseSessionToAuthSession({
      session: createSupabaseSession({
        appMetadata: {},
        identities: [{ provider: 'apple' }],
      }),
    });

    expect(session.provider).toBe('apple');
    expect(session.user.provider).toBe('apple');
  });

  it('keeps Google as the legacy fallback provider', () => {
    const session = mapSupabaseSessionToAuthSession({
      session: createSupabaseSession({
        appMetadata: {},
      }),
    });

    expect(session.provider).toBe('google');
    expect(session.user.provider).toBe('google');
  });

  it('uses a provider and display name override for native Apple first login', () => {
    const session = mapSupabaseSessionToAuthSession({
      displayNameOverride: 'Ada Appleseed',
      providerOverride: 'apple',
      session: createSupabaseSession({
        appMetadata: {},
        userMetadata: {},
      }),
    });

    expect(session).toMatchObject({
      provider: 'apple',
      user: {
        provider: 'apple',
        displayName: 'Ada Appleseed',
      },
    });
  });
});
