# ML-52 Sync Provider Decision

## Final Decision

Money Leak will use Supabase Postgres as the future remote data provider for
optional backup/sync.

This is a planning decision only. ML-52 does not create backend tables, add
Supabase packages, write sync code, or change local schemas.

## Local-First Boundary

SQLite remains the source of truth for the current app UX. The backend is a
future backup/sync layer, not the primary online CRUD path.

Initial backup model:

- Manual backup first.
- No automatic sync in the first backup implementation.
- No forced account creation.
- CSV v1 remains unchanged during auth/sync foundation work.

Explicit data safety rule:

- Never silently overwrite, replace, or delete local data.

Future backup, restore, and sync flows must require clear user intent and must
preserve the user's existing local data unless the user explicitly chooses a
destructive action.

## Future Remote-Backed Data

The future Supabase Postgres layer may back up or sync:

- User profile/account identity.
- Transactions backup.
- Categories backup.
- Account-level settings.
- Sync metadata.
- Delete-account state.

Remote storage should not change the meaning of existing local transaction and
category data without a prior data contract and migration plan.

## Not Initially Required

The first backend foundation does not need:

- Realtime sync.
- Social features.
- Bank integrations.
- Server-generated analytics.
- A cloud-first rewrite of transaction/category screens.

Analytics should continue to run from local data until a separate product need
requires otherwise.

## Recommended Future Order

1. ML-53 sync-ready data contract.
2. ML-54 local migration runner / sync-ready migrations.
3. ML-55 auth foundation.
4. ML-56 Google Auth.
5. ML-57 session restore.
6. ML-58 account screen/logout.
7. ML-59 link local data to authenticated identity.
8. ML-60 backend user profile/RLS.
9. ML-61 backup/sync foundation.
10. ML-64 Apple Sign-In.
11. ML-62 manual backup.
12. ML-63 restore backup.
13. ML-65 delete account/privacy.
14. ML-66 incremental sync prototype.

This order keeps local data preservation ahead of remote writes and avoids
shipping auth UI before account lifecycle, storage, and privacy boundaries are
clear.

## Implementation Constraints

- Keep SQLite as the active local source of truth.
- Keep CSV v1 as `id,amount,category,isLeak,leakReason,note,createdAt`.
- Do not add sync metadata to CSV v1.
- Do not add automatic remote writes before the data contract and migration
  runner exist.
- Do not use Supabase service role keys in the mobile app.
- Use Row Level Security before any user data is stored remotely.
- Treat logout and delete account as separate flows.
