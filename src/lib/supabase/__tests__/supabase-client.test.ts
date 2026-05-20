import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { createSupabaseClient } from '@/lib/supabase/supabase-client';
import { SUPABASE_AUTH_STORAGE_KEY } from '@/lib/supabase/supabase-secure-storage';
import type { SupabaseClientConfig } from '@/lib/supabase/supabase-config';

const mockCreateClient = jest.fn();

jest.mock('@supabase/supabase-js', () => ({
  createClient: (...args: unknown[]) => mockCreateClient(...args),
}));

const TEST_CONFIG: SupabaseClientConfig = {
  supabaseUrl: 'unit-test-supabase-url',
  supabaseAnonKey: 'unit-test-public-key',
  authRedirectScheme: 'unit-test-scheme',
  authRedirectPath: 'unit-test-auth-path',
  authRedirectUrl: 'unit-test-auth-redirect',
  iosBundleIdentifier: 'unit-test-ios-bundle',
  androidPackage: 'unit-test-android-package',
};

beforeEach(() => {
  jest.clearAllMocks();

  mockCreateClient.mockReturnValue({ auth: {} });
});

describe('Supabase client', () => {
  it('uses SecureStore-backed auth persistence with an explicit storage key', () => {
    createSupabaseClient(TEST_CONFIG);

    expect(mockCreateClient).toHaveBeenCalledTimes(1);
    expect(mockCreateClient).toHaveBeenCalledWith(
      TEST_CONFIG.supabaseUrl,
      TEST_CONFIG.supabaseAnonKey,
      {
        auth: expect.objectContaining({
          autoRefreshToken: false,
          detectSessionInUrl: false,
          flowType: 'pkce',
          persistSession: true,
          skipAutoInitialize: true,
          storageKey: SUPABASE_AUTH_STORAGE_KEY,
        }),
      },
    );
  });
});
