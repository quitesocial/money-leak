# ML-53 Sync-Ready Data Contract

## Purpose

This document defines the Money Leak data contract for future optional auth,
backup, and sync work.

ML-53 is documentation only. It does not add SQLite migrations, Supabase SDK,
auth UI, backend tables, Row Level Security policies, backup services, or CSV
format changes.

SQLite remains the source of truth for the current app UX. Guest/local mode
remains a permanent product mode.

## ML-54 Implementation Notes

ML-54 implements the local-only foundation described in this contract without
adding auth, backup, cloud sync, Supabase SDKs, or CSV format changes.

- Native SQLite now has a versioned `schema_migrations` runner.
- `localOwnerId` and `deviceId` are stored in local SQLite `app_metadata`.
- Transaction and category rows have local sync-ready metadata columns.
- Normal reads hide rows with `deletedAt` / `deleted_at` set.
- Transaction delete now writes a local tombstone instead of physically deleting
  the row.
- Category archive remains the product-level hide behavior; category
  `deletedAt` remains reserved for future sync tombstones.
- SQLite keeps the physical transaction `category` column for compatibility;
  it still stores the category ID.
- CSV v1 remains exactly `id,amount,category,isLeak,leakReason,note,createdAt`.

## Current Local Baseline

### Transactions

Current transaction fields in TypeScript, SQLite, store state, and CSV import:

- `id`
- `amount`
- `category`
- `isLeak`
- `leakReason`
- `note`
- `createdAt`

Current SQLite behavior:

- Native transactions live in `money-leak.db`.
- `transactions.id` is the local primary key.
- `transactions.category` stores the category ID string, not the display name.
- Reads sort by `created_at DESC, id DESC`.
- Transaction deletes currently hard-delete rows with
  `DELETE FROM transactions WHERE id = ?`.
- Web transaction persistence is intentionally unsupported in this build.

### Categories

Current category fields:

- `id`
- `name`
- `createdAt`
- `updatedAt`
- `isDefault`
- `isArchived`
- `sortOrder`

Current category behavior:

- Default category IDs are stable: `food`, `transport`, `alcohol`,
  `shopping`, `subscriptions`, and `other`.
- Custom category IDs are generated locally from normalized names.
- Renaming a category preserves the category ID, so existing transactions stay
  attached.
- Deleting a category archives the category with `isArchived = true`; it does
  not physically delete the row.
- Imported transactions with unknown category IDs create archived placeholder
  categories.
- Web category persistence is intentionally unsupported in this build.

### Settings And Storage

Current local settings/storage baseline:

- Onboarding completion is stored in AsyncStorage as
  `money-leak:onboarding-completed`.
- Daily reminder enabled state is stored in AsyncStorage as
  `money-leak:daily-check-in-reminder-enabled`.
- Local notifications are scheduled by the OS through `expo-notifications`.
- Reminder permission state and scheduled notification identifiers are
  device-local.
- The shared period scope is in-memory Zustand state:
  `selectedPeriod` and `selectedCustomDateStart`.

These values are not currently account-scoped and do not sync.

### CSV v1

CSV v1 header:

```csv
id,amount,category,isLeak,leakReason,note,createdAt
```

CSV v1 exports the stored category ID through the `category` column, not a
display name.

## Future Sync-Ready Local Contract

### Transactions

Future sync-ready transaction fields:

- `id`
- `ownerId`
- `amount`
- `categoryId`
- `isLeak`
- `leakReason`
- `note`
- `createdAt`
- `updatedAt`
- `deletedAt`
- `schemaVersion`
- `sourceDeviceId`

Category field decision:

- `categoryId` is the future sync/domain name.
- The current `category` field and CSV `category` column are legacy names for
  the same stored category ID.
- Future code should avoid treating `category` as a display name.
- A migration can keep the SQLite column name temporarily if that reduces risk,
  but new contracts and remote tables should use `categoryId` or `category_id`.

Later-only sync metadata:

- `syncStatus`
- `lastSyncedAt`
- `localRevision`
- `remoteRevision`
- `conflictStatus`
- `syncCursor`

These fields should not be added until backup/restore/sync services actually
need them. ML-54 should focus on durable local identity, timestamps, tombstones,
schema version, and migration safety first.

### Categories

Future sync-ready category fields:

- `id`
- `ownerId`
- `name`
- `createdAt`
- `updatedAt`
- `isDefault`
- `isArchived`
- `deletedAt`
- `sortOrder`
- `schemaVersion`
- `sourceDeviceId`

Archived/deleted policy:

- `isArchived` remains the user-facing category state for hiding a category
  from normal pickers while preserving transaction references.
- `deletedAt` is reserved for true sync tombstones.
- Archived categories can sync as archived records.
- Physical category purge should wait for a later retention policy and confirmed
  sync state.

Later-only sync metadata:

- `syncStatus`
- `lastSyncedAt`
- `localRevision`
- `remoteRevision`
- `conflictStatus`
- `syncCursor`

### Settings

Future account-level settings that can sync later:

- Account mode and backup status.
- Last successful manual backup timestamp.
- User-facing data management preferences if they become product settings.
- Category catalog preferences if categories sync across devices.
- Optional onboarding-complete state only if product decides onboarding should
  be account-aware.

Future device-level settings that must remain local:

- Notification permission status.
- Scheduled local notification identifiers.
- Daily reminder enabled state for this install unless product explicitly
  designs cross-device reminder behavior.
- Device local time and OS notification behavior.
- In-memory period scope and transient UI state.
- Auth session storage, which should use secure native storage in a later auth
  epic and should not live in AsyncStorage.

## Ownership Model

Money Leak needs one domain-level ownership concept that works before and after
optional auth.

Required identities:

- `localOwnerId`: generated locally for guest/local mode and used before auth.
- `appUserId`: normalized Money Leak app user identity after account creation or
  linking.
- `authUserId`: provider/Supabase Auth user ID, isolated to auth/profile mapping.
- Provider-specific IDs: Google/Apple provider IDs, isolated to auth/profile
  mapping.

Contract rules:

- Domain rows should use `ownerId`.
- In guest/local mode, `ownerId` points to `localOwnerId`.
- After explicit linking/auth, `ownerId` points to `appUserId`.
- `authUserId` and provider IDs must not leak through transaction, category, or
  settings domain models.
- Logging out must not delete local data.
- Delete account must be a separate future flow with explicit confirmation and
  privacy handling.
- Linking local data to an account must never silently overwrite, replace, or
  delete existing local rows.

## Soft Deletes And Tombstones

Syncable deletes should use `deletedAt`.

Rules:

- UI queries should hide records where `deletedAt` is not null.
- Sync and backup code should retain tombstones long enough to propagate deletes.
- Physical purge should happen only after a later confirmed sync and retention
  policy exists.
- Current transaction hard-delete behavior is a known risk.
- The hard-delete transaction behavior should be fixed in later migration work,
  not in ML-53.

Category archive is not the same as delete:

- `isArchived` hides a category from normal selection.
- `deletedAt` marks a category tombstone for sync/delete propagation.

## Device Identity

Future local foundation work should create a `deviceId` once per install.

Rules:

- `deviceId` identifies the install/device for diagnostics, tie-breaking, and
  local write attribution.
- `sourceDeviceId` on records stores where the record or mutation originated.
- Device identity is never user identity.
- Device identity must not grant access to remote account data.
- Reinstalling the app may produce a new `deviceId`; sync logic must tolerate
  that.

## Timestamps

Rules:

- Every future local create/update/delete mutation should update `updatedAt`.
- Soft deletes should set both `deletedAt` and `updatedAt`.
- Legacy transactions can backfill `updatedAt` from `createdAt` during a future
  migration.
- Categories already have `updatedAt`, but future migration work should
  normalize behavior so every category mutation reliably updates it.
- Timestamps should be stored consistently as Unix epoch milliseconds locally
  unless a later migration explicitly changes the local convention.
- Remote tables can expose `timestamptz` while preserving deterministic local
  conversion rules.

## Schema Versioning

Each syncable entity should carry an entity-level `schemaVersion` or equivalent.

Rules:

- Entity `schemaVersion` describes how to interpret one row.
- SQLite migration version describes which local database migrations have run.
- These are separate concepts and should not share one field.
- Entity schema versions allow backup/restore/sync code to handle rows created
  by older app versions.

## CSV Compatibility

CSV v1 remains unchanged through auth/sync foundation work.

Header:

```csv
id,amount,category,isLeak,leakReason,note,createdAt
```

Rules:

- Do not add `ownerId`, `updatedAt`, `deletedAt`, `schemaVersion`,
  `sourceDeviceId`, `deviceId`, or sync metadata to CSV v1.
- CSV v1 import should keep requiring the existing strict header.
- CSV v1 export should continue writing the stored category ID in `category`,
  not the display name.
- CSV v2 is a separate future product/compatibility decision if needed.
- Future soft-deleted rows should not be included in normal CSV v1 export unless
  a separate archival export mode is designed.

## Draft Supabase Remote Contract

Supabase Postgres is the future remote backup/sync provider. This section is
conceptual only. ML-53 does not create Supabase migrations or RLS policies.

Required security rule:

- Row Level Security must be enabled and tested before any user data is stored
  remotely.
- The mobile app must never use a Supabase service role key.

Conceptual tables:

### Profiles / App Users

Expected columns:

- `id` as the normalized `appUserId`
- `auth_user_id` mapped to Supabase Auth
- `created_at`
- `updated_at`
- optional account lifecycle fields for later delete-account/privacy work

### `remote_transactions`

Expected columns:

- `id`
- `owner_id`
- `amount`
- `category_id`
- `is_leak`
- `leak_reason`
- `note`
- `created_at`
- `updated_at`
- `deleted_at`
- `schema_version`
- `source_device_id`
- later sync metadata only when needed

### `remote_categories`

Expected columns:

- `id`
- `owner_id`
- `name`
- `created_at`
- `updated_at`
- `is_default`
- `is_archived`
- `deleted_at`
- `sort_order`
- `schema_version`
- `source_device_id`
- later sync metadata only when needed

### `remote_settings`

Expected columns:

- `id`
- `owner_id`
- account-level setting key/value or typed setting columns
- `created_at`
- `updated_at`
- `deleted_at` if settings need tombstones
- `schema_version`
- `source_device_id`

Device-only settings should not be stored in `remote_settings`.

## Now Vs Later

Soon / ML-54 candidates:

- Versioned local migration runner.
- Local owner identity foundation.
- `ownerId`.
- Transaction `updatedAt`.
- Transaction and category `deletedAt`.
- Entity `schemaVersion`.
- Install-level `deviceId`.
- Record-level `sourceDeviceId`.
- Backfill policy for existing transactions and categories.
- Query updates that hide soft-deleted records.

Later sync foundation:

- `syncStatus`.
- `lastSyncedAt`.
- `localRevision`.
- `remoteRevision`.
- `conflictStatus`.
- `syncCursor`.
- Full manual backup service.
- Restore service.
- Incremental sync service.
- Conflict resolution UI or policy.
- Supabase SQL migrations and RLS policies.
