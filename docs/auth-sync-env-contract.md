# ML-52 Auth/Sync Environment Contract

## Purpose

This document defines auth/sync configuration names for Money Leak. ML-56 uses
the public Supabase and redirect values for optional Google login.

Only placeholder examples are documented here. Real local values belong in
ignored env files or deployment/provider dashboards, not in committed docs.

## Public Client Config

These keys are public client configuration. They may be exposed to the Expo
client because they identify public endpoints or app identifiers.

| Key                                 | Placeholder example               | Purpose                                                                     |
| ----------------------------------- | --------------------------------- | --------------------------------------------------------------------------- |
| `EXPO_PUBLIC_SUPABASE_URL`          | `https://PROJECT_REF.supabase.co` | Public Supabase project URL used by the mobile client.                      |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY`     | `PUBLIC_ANON_KEY_PLACEHOLDER`     | Public Supabase anon key. Safe to ship only with proper Row Level Security. |
| `EXPO_PUBLIC_AUTH_REDIRECT_SCHEME`  | `moneyleak`                       | App URL scheme for auth redirects.                                          |
| `EXPO_PUBLIC_AUTH_REDIRECT_PATH`    | `auth/callback`                   | In-app auth callback path.                                                  |
| `EXPO_PUBLIC_IOS_BUNDLE_IDENTIFIER` | `com.example.moneyleak`           | iOS bundle identifier used when configuring auth providers.                 |
| `EXPO_PUBLIC_ANDROID_PACKAGE`       | `com.example.moneyleak`           | Android package name used when configuring auth providers.                  |

## Values That Must Never Be Committed

Do not commit real secrets to the repo, including:

- Supabase service role keys.
- OAuth client secrets.
- Apple private keys.
- Provider webhook secrets.
- Any production credential that grants privileged account or database access.

Supabase service role keys must never be shipped in the app. They bypass normal
client access controls and belong only in trusted server-side environments if a
future backend job ever requires them.

## Google / Supabase Setup

Google provider setup lives in Google Cloud and Supabase Auth provider settings.
The app must not hardcode provider secrets.

Required dashboard-managed values include:

- Google OAuth client IDs and client secrets.
- Allowed redirect URLs.
- iOS bundle identifier and Android package allowlists.

Public identifiers can be mirrored in app config or public environment values
when needed. Private provider secrets must stay outside the app.

For ML-56 Google login:

- Supabase Auth Google provider must be enabled.
- Google Cloud OAuth consent screen must be configured.
- A Google OAuth Web client must exist.
- The Supabase callback URL must be added to Google Authorized redirect URIs.
- The Google client ID and client secret must be saved only in Supabase provider
  settings.
- Supabase redirect allow list must include:
  - `moneyleak://auth/callback`
  - `moneyleak:///auth/callback`
- Real local values belong in ignored `.env` files or build environment
  settings, not committed docs.

Google OAuth should be manually tested in an EAS development build or native iOS
build. Expo Go is not the reliable target for this redirect flow.

Reference docs:

- [Supabase native mobile deep linking](https://supabase.com/docs/guides/auth/native-mobile-deep-linking)
- [Supabase React Native quickstart](https://supabase.com/docs/guides/auth/quickstarts/react-native)
- [Supabase Google login](https://supabase.com/docs/guides/auth/social-login/auth-google)
- [Expo WebBrowser auth session](https://docs.expo.dev/versions/latest/sdk/webbrowser/)

## Environment Handling

Recommended handling:

- Local development: use an ignored local env file with real development
  values.
- Preview builds: use preview Supabase/provider projects or preview-scoped
  EAS/CI environment values.
- Production builds: use production Supabase/provider projects and production
  EAS/CI environment values.
- `.env.example`: keep placeholders only.

ML-56 wires these values into runtime Google auth config only. Backup, restore,
incremental sync, database tables, Row Level Security policies, Apple Sign-In,
and account linking remain future work.
