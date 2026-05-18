# ML-52 Auth Provider Decision

## Final Decision

Money Leak will use Supabase Auth for future optional account support.

This is a planning decision only. ML-52 does not add login, auth packages,
runtime auth code, backend tables, or provider dashboard configuration.

Login order:

- Google login will be the first implemented provider.
- Apple Sign-In must follow before public iOS release if Google login is
  visible as a primary auth option on iOS.
- Guest/local mode remains permanently available.
- Login must never be required to use the local expense tracker.

Local-first rule:

- SQLite remains the source of truth for the current app experience.
- Auth is only a future identity layer for optional backup/sync.
- Logout must never delete local data.
- Delete account is a separate future flow with explicit user confirmation and
  privacy handling.

## Why Supabase Auth

Supabase Auth fits the current solo-developer, local-first Money Leak stage
because it provides hosted authentication, OAuth provider support, session
management, and a direct path to Supabase Postgres with Row Level Security
without requiring a custom backend now.

It keeps the implementation path small:

- Use Supabase Auth for identity.
- Use Supabase Postgres later for manual backup and sync metadata.
- Keep the app usable without an account.
- Add provider SDKs only when the auth implementation epic starts.
- Avoid building and operating custom auth infrastructure.

## Alternatives Considered

| Option         | Fit                                                                                                                                                   | Decision                          |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| Supabase Auth  | Strong fit for optional auth plus future Postgres backup/sync. Good balance of speed, control, and local-first compatibility.                         | Choose for future implementation. |
| Firebase Auth  | Mature auth product, but Firestore/Realtime Database would pull the app toward a different remote data model than the preferred Postgres backup path. | Do not choose for the main path.  |
| Auth0          | Powerful identity platform, but too broad and operationally heavy for a minimal solo-developer app at this stage.                                     | Do not choose now.                |
| Clerk          | Strong hosted auth UI and user management, but less aligned with the desired Supabase Postgres backup/sync foundation.                                | Do not choose now.                |
| Custom backend | Maximum control, but high auth/security/operations burden before the product needs it.                                                                | Do not build now.                 |

## Why Not Frontend-Only Auth

Frontend-only auth is not the main path because the client cannot be the
trusted authority for identity, account ownership, provider token validation,
backup access, account deletion, or future Row Level Security.

A frontend-only approach would also make it harder to:

- Bind local backup records to a durable user identity.
- Revoke sessions safely.
- Protect remote transaction/category backups.
- Support privacy flows such as delete account.
- Avoid shipping privileged credentials in the app.

## Why Not A Custom Backend Now

A custom backend is not needed for ML-52 or the next auth foundation steps. It
would add hosting, auth security, OAuth callback handling, account lifecycle,
database access control, monitoring, and incident responsibility before Money
Leak has a product need for that complexity.

The current product guardrail is speed and simplicity. Supabase gives the app a
reasonable future backend path without forcing a backend rewrite today.

## Future Implementation Rules

- No forced login.
- Guest/local mode stays available even after auth ships.
- Logging out must preserve local SQLite data and local CSV import/export
  ability.
- Delete account must be a separate future flow, not part of logout.
- No secrets belong in the repo.
- Supabase service role keys must never be used in the mobile app.
- The Supabase anon key is public client config, but it must be protected by
  Row Level Security once remote data exists.
- Future token/session storage must use SecureStore, Keychain-style storage, or
  an equivalent secure native storage path. Do not store auth sessions in
  AsyncStorage.
- Google and Apple provider secrets belong in provider dashboards and server
  side settings, not hardcoded in the app.
