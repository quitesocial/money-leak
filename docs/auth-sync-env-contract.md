# Auth, Sync, and Supabase Environment Contract

This document defines the public Expo configuration used by Money Leak's
current optional account and Supabase-backed functionality. Only placeholder
examples belong in the repository.

## Public client configuration

These values identify public endpoints or app identifiers and are baked into
the Expo client at build time. They are not service-role/admin credentials.

| Key                                 | Placeholder example               | Current purpose                                                                 |
| ----------------------------------- | --------------------------------- | ------------------------------------------------------------------------------- |
| `EXPO_PUBLIC_SUPABASE_URL`          | `https://PROJECT_REF.supabase.co` | Public Supabase endpoint for auth, profiles, backup/restore/sync, and feedback. |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY`     | `PUBLIC_ANON_KEY_PLACEHOLDER`     | Public client key; safe only with the committed RLS/grant boundaries deployed.  |
| `EXPO_PUBLIC_AUTH_REDIRECT_SCHEME`  | `moneyleak`                       | Native Google OAuth return scheme.                                              |
| `EXPO_PUBLIC_AUTH_REDIRECT_PATH`    | `auth/callback`                   | Native Google OAuth callback path.                                              |
| `EXPO_PUBLIC_IOS_BUNDLE_IDENTIFIER` | `com.example.moneyleak`           | iOS identifier used when configuring auth providers.                            |
| `EXPO_PUBLIC_ANDROID_PACKAGE`       | `com.example.moneyleak`           | Android package used when configuring auth providers.                           |

## Production and TestFlight builds

Local ignored env files do not configure GitHub/EAS builds. The EAS
`production` environment must provide all six public values before building.
Expo inlines `EXPO_PUBLIC_*` values into the app bundle, so changing them
requires a new build.

The same Supabase public client boundary is used by:

- Google OAuth and native Sign in with Apple token exchange;
- authenticated profile preparation and session restore;
- manual backup and restore;
- manual and foreground incremental sync;
- the authenticated `delete-account` Edge Function invocation;
- anonymous insert-only feedback.

The `Release iOS` workflow creates a production build only when
`package.json.version` changes. Any production configuration correction that
requires a new binary must therefore use an intentional version bump.

## Provider and Supabase setup outside the repository

The owner must configure and verify:

- Supabase Auth Apple and Google providers;
- Apple Sign in with Apple capability/provider configuration for
  `com.quitesocialorg.moneyleak`;
- Google OAuth consent, client credentials, and Supabase callback URL;
- Supabase redirect allowlist entries for `moneyleak://auth/callback` and
  `moneyleak:///auth/callback`;
- the committed Supabase migrations and RLS/grants;
- the deployed `delete-account` Edge Function and its server-only service-role
  environment;
- production EAS public environment values.

Google and Apple provider secrets stay in their provider/Supabase dashboards.
The Supabase service-role key stays only in the server-side Edge Function
environment.

## Values that must never be committed or shipped

- Supabase service-role/admin keys.
- Apple private keys.
- OAuth client secrets.
- App Store Connect API private keys.
- Provider webhook secrets.
- Access, refresh, provider, or identity tokens.
- Any production credential that grants privileged account or database access.

Public Supabase URL and anon-key values are client configuration, but they must
still be stored in the EAS environment rather than replacing the placeholders
in `.env.example`. Their safety depends on the deployed RLS/grant policies.

## Validation

- Test both Google and Apple authentication in a native production-like build;
  Expo Go is not the acceptance target for native auth.
- Verify guest mode remains available if configuration is missing or a
  provider fails.
- Verify authenticated backup, restore, sync, and Delete Account against the
  intended Supabase project.
- Verify guest and authenticated feedback inserts while select/update/delete
  remain denied.
- Confirm safe UI copy never renders raw URLs, environment values, tokens,
  identifiers, or backend errors.

Reference documentation:

- [Supabase native mobile deep linking](https://supabase.com/docs/guides/auth/native-mobile-deep-linking)
- [Supabase React Native quickstart](https://supabase.com/docs/guides/auth/quickstarts/react-native)
- [Supabase Google login](https://supabase.com/docs/guides/auth/social-login/auth-google)
- [Supabase Apple login](https://supabase.com/docs/guides/auth/social-login/auth-apple)
- [Expo WebBrowser auth session](https://docs.expo.dev/versions/latest/sdk/webbrowser/)
