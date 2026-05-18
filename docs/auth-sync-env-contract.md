# ML-52 Auth/Sync Environment Contract

## Purpose

This document defines future auth/sync configuration names for Money Leak. It
does not change runtime config loading, add provider packages, or enable auth.

Only placeholder examples are documented here. Real local values belong in
ignored env files or deployment/provider dashboards, not in committed docs.

## Future Public Client Config

These keys are expected to be public client configuration when auth/sync is
implemented. They may be exposed to the Expo client because they identify
public endpoints or app identifiers.

| Key                                 | Placeholder example               | Purpose                                                                     |
| ----------------------------------- | --------------------------------- | --------------------------------------------------------------------------- |
| `EXPO_PUBLIC_SUPABASE_URL`          | `https://PROJECT_REF.supabase.co` | Public Supabase project URL used by the mobile client.                      |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY`     | `PUBLIC_ANON_KEY_PLACEHOLDER`     | Public Supabase anon key. Safe to ship only with proper Row Level Security. |
| `EXPO_PUBLIC_AUTH_REDIRECT_SCHEME`  | `moneyleak`                       | App URL scheme for future auth redirects.                                   |
| `EXPO_PUBLIC_AUTH_REDIRECT_PATH`    | `auth/callback`                   | Future in-app auth callback path.                                           |
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

## Provider Dashboard Configuration

Future Google and Apple provider setup should live in the relevant provider
dashboards and Supabase Auth provider settings. The app should not hardcode
provider secrets.

Expected dashboard-managed values include:

- Google OAuth client IDs and client secrets.
- Apple Services ID, Team ID, Key ID, and private key.
- Allowed redirect URLs.
- iOS bundle identifier and Android package allowlists.

Public identifiers can be mirrored in app config or public environment values
when needed. Private provider secrets must stay outside the app.

## Environment Handling

Recommended handling when auth/sync is implemented:

- Local development: use an ignored local env file with real development
  values.
- Preview builds: use preview Supabase/provider projects or preview-scoped
  EAS/CI environment values.
- Production builds: use production Supabase/provider projects and production
  EAS/CI environment values.
- `.env.example`: keep placeholders only.

ML-52 does not wire these values into Expo config or runtime code.
