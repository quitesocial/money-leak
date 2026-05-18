# ML-51 Auth & Sync Readiness Audit

## 1. Current Baseline

Money Leak is currently an Expo, React Native, TypeScript, Expo Router app with
local-first data and no backend, auth, cloud sync, or account system.

Current architecture:

- Route files live in `app/`.
- Screen implementations live in `src/features/*`.
- Shared route wrappers and UI helpers live in `src/components` and `src/lib`.
- Local state uses Zustand stores in `src/store`.
- Native persistence uses Expo SQLite through `src/db`.
- Device preferences use AsyncStorage for onboarding and reminder flags.
- Web transaction/category persistence is intentionally unsupported in this
  build.

Current navigation shape:

- `app/_layout.tsx` defines the root Stack.
- `app/(tabs)/_layout.tsx` defines exactly three bottom tabs: Home,
  Analytics & Leaks, and Settings.
- Add Transaction is a pushed root Stack screen at `/add-transaction`.
- Shame Card is a pushed root Stack screen at `/shame-card`.
- Manage Categories is a pushed root Stack screen at `/categories`.
- Edit Transaction is a pushed Stack screen at `/transaction/[id]/edit`.

Current local-first behavior:

- Transactions and categories are stored locally on native devices in
  `money-leak.db`.
- Screens load through Zustand stores, then refresh from SQLite on focus.
- CSV import/export is the only backup/restore path.
- Reminder permission and scheduling are local to the device.
- Onboarding completion is local to the device.

Current versioning setup:

- `package.json.version` is the app version source.
- `app.config.js` imports `package.json.version` and exposes it as Expo
  `version`.
- `package-lock.json` mirrors the package version at the top level and root
  package entry.
- `eas.json` uses `cli.appVersionSource: "remote"` and production
  `autoIncrement: true`.
- `scripts/release-preflight.js` verifies strict semver, Expo config version
  resolution, EAS remote version source, production auto-increment, submit
  placeholders, and required GitHub workflows.

## 2. Transaction Model Audit

Current `Transaction` type in `src/types/transaction.ts`:

- `id: string`
- `amount: number`
- `category: string`
- `isLeak: boolean`
- `leakReason: LeakReason | null`
- `note: string | null`
- `createdAt: number`

Current native SQLite columns in `transactions`:

- `id TEXT PRIMARY KEY NOT NULL`
- `amount REAL NOT NULL`
- `category TEXT NOT NULL`
- `is_leak INTEGER NOT NULL CHECK (is_leak IN (0, 1))`
- `leak_reason TEXT CHECK (...)`
- `note TEXT`
- `created_at INTEGER NOT NULL`

Current store actions in `src/store/transactions-store.ts`:

- `loadTransactions`
- `addTransaction`
- `importTransactions`
- `updateTransaction`
- `removeTransaction`
- `clearError`

ID generation:

- Add Transaction uses `globalThis.crypto?.randomUUID?.()` when available.
- It falls back to a timestamp-plus-random `transaction-*` ID.
- CSV import preserves incoming IDs and SQLite uses `INSERT OR IGNORE`, so
  duplicate imported IDs are skipped by the database layer.

Current create/edit/delete behavior:

- Create inserts a full `Transaction` row and creates archived placeholder
  categories for unknown category IDs.
- Import inserts rows in an exclusive transaction with `INSERT OR IGNORE`.
- Edit updates amount, category, leak state, leak reason, and note. It
  preserves `id` and `createdAt`.
- Delete hard-deletes the row with `DELETE FROM transactions WHERE id = ?`.
- Reads sort by `created_at DESC, id DESC`.

Missing sync-ready fields:

- `ownerId` or equivalent account/user partition.
- `updatedAt` for conflict detection and edit propagation.
- `deletedAt` for soft-delete/tombstone sync.
- `schemaVersion` for durable local and remote record interpretation.
- `deviceId`, `revision`, or similar fields if conflict resolution needs
  deterministic device/write ordering.

Migration risks:

- Hard deletes cannot be synchronized later without a tombstone migration or
  change log.
- Existing rows have no `updatedAt`, so a migration must backfill it carefully,
  likely from `createdAt` for historical records.
- Existing IDs are local UUIDs or fallback IDs, not account-scoped IDs.
- CSV imports can introduce IDs from other devices, so future account mode must
  decide whether IDs remain globally stable or get remapped on import.
- Adding ownership must preserve all existing local guest data and avoid silent
  reassignment or wipe.

## 3. Category Model Audit

Current `Category` type in `src/types/category.ts`:

- `id: string`
- `name: string`
- `createdAt: number`
- `updatedAt: number`
- `isDefault: boolean`
- `isArchived: boolean`
- `sortOrder: number`

Current native SQLite columns in `categories`:

- `id TEXT PRIMARY KEY NOT NULL`
- `name TEXT NOT NULL`
- `created_at INTEGER NOT NULL`
- `updated_at INTEGER NOT NULL`
- `is_default INTEGER NOT NULL CHECK (is_default IN (0, 1))`
- `is_archived INTEGER NOT NULL CHECK (is_archived IN (0, 1))`
- `sort_order INTEGER NOT NULL`
- Unique active-name index on `LOWER(name)` where `is_archived = 0`

Default/custom/archived behavior:

- Default categories are seeded from `TRANSACTION_CATEGORIES`.
- Default category IDs are stable: `food`, `transport`, `alcohol`,
  `shopping`, `subscriptions`, and `other`.
- Custom category IDs are generated from normalized slugs, with numeric
  suffixes for collisions.
- Category names can be updated and `updatedAt` is refreshed.
- Deleting a category archives it instead of deleting the row.
- `other` cannot be archived and at least one active category must remain.
- Unknown imported category IDs are inserted as archived categories with a
  readable generated name.

How transactions reference categories:

- Transactions store the category ID string in `transaction.category` and
  `transactions.category`.
- Display helpers resolve category IDs through the category list and fall back
  to a readable name derived from the ID.
- Renaming a category preserves existing transaction references because the ID
  does not change.

Missing sync-ready fields:

- `ownerId` or account partition.
- `deletedAt` if archived categories later need hard-delete semantics or remote
  tombstones.
- `schemaVersion`.
- `deviceId`, `revision`, or equivalent conflict metadata.
- Optional remote/source metadata if default categories become server-defined.

Migration risks:

- Custom category IDs are locally generated slugs, so two devices can create
  the same ID for semantically different categories or different IDs for the
  same category name.
- Active-name uniqueness is local only and does not solve cross-device merge
  conflicts.
- Archived placeholder categories from CSV recovery may need a clear ownership
  and sync policy.
- Default category IDs should remain stable across auth/sync work because
  transactions depend on them.

## 4. Settings, Reminder, And Local Preference Audit

Current local settings and preferences:

- Reminder enabled flag is stored in AsyncStorage under
  `money-leak:daily-check-in-reminder-enabled`.
- Onboarding completion is stored in AsyncStorage under
  `money-leak:onboarding-completed`.
- Notification permission and scheduled notification records are controlled by
  the OS through `expo-notifications`.
- Period selection lives in the in-memory Zustand period scope store.
- Support links are static constants in `src/lib/app-links.ts`.

Device-local later:

- Notification permission status.
- Scheduled local notification identifiers.
- Whether the current device has a local daily reminder enabled.
- In-memory period selection and transient UI state.
- Local onboarding completion can remain device-local unless product decides
  onboarding should be account-aware.

Possible account-level later:

- Account mode state, such as guest/local versus signed in.
- Backup status and last successful backup time.
- Category catalog if categories sync across devices.
- User-facing import/export or data management preferences if they become part
  of account settings.

## 5. CSV Import/Export Audit

Current CSV v1 schema:

```csv
id,amount,category,isLeak,leakReason,note,createdAt
```

Current behavior:

- Export writes exactly the seven v1 columns.
- Export writes category IDs, not display names.
- `createdAt` is exported as strict ISO-8601 using `toISOString()`.
- Empty exports contain only the header.
- Import requires the exact header and skips invalid data rows.
- Import accepts UTF-8 BOM and CRLF fixtures.
- Import accepts non-empty custom category IDs.
- Import parses duplicate IDs as valid rows, then SQLite import skips already
  existing IDs through `INSERT OR IGNORE`.
- Native import uses `expo-document-picker` and `expo-file-system`.
- Web import is intentionally unsupported.

Fixtures and tests:

- Fixtures live in `docs/qa-fixtures`.
- CSV parser/export tests live in `src/features/export/__tests__`.
- Covered fixtures include valid CSV, BOM, CRLF, wrong header, malformed CSV,
  duplicate IDs, and mixed valid/invalid rows.

Compatibility risks:

- Adding sync metadata directly to CSV v1 would break the strict header check.
- Adding owner fields to CSV could expose account identifiers in user-managed
  files.
- Imported IDs may collide with local or future synced IDs.
- Future soft-deleted rows should not be exported casually unless product
  chooses an archival export mode.

Recommendation:

- Keep CSV v1 unchanged while adding auth and sync foundations.
- Treat sync metadata as internal database/account metadata, not CSV v1 fields.
- If CSV must include sync fields later, create an explicit CSV v2 design with
  migration, import compatibility, user-facing copy, and fixtures before
  changing the header.

## 6. SQLite And Migration Audit

Current initialization:

- `initDatabase` opens `money-leak.db`.
- It enables WAL with `PRAGMA journal_mode = WAL`.
- It creates the `transactions` table if missing.
- It creates the `categories` table and active-name index if missing.
- It seeds default categories with `INSERT OR IGNORE`.

Existing migration approach:

- There is no generic migration runner.
- There is one ad hoc transaction migration that detects an older
  `category IN (...)` constraint by inspecting `sqlite_master`.
- That migration rebuilds the transactions table without the old category
  constraint and copies compatible rows.

What must be added before owner/timestamp/tombstone migrations:

- A versioned local migration table or metadata record.
- Ordered, idempotent migration steps.
- Transactional migrations with rollback behavior on failure.
- Backfill policy for existing local rows, especially `ownerId`, `updatedAt`,
  `deletedAt`, and schema version.
- Tests or manual QA steps that verify existing native data survives app
  upgrade.

Preservation risks:

- Rebuilding tables without a migration runner increases data-loss risk as more
  schema changes arrive.
- Owner/account migrations must not erase local guest data.
- Tombstone migration needs careful handling because existing hard-deleted
  records cannot be reconstructed.
- Category and transaction migrations should be coordinated because
  transactions reference category IDs.

## 7. Store And Data-Flow Audit

Current stores:

- `useTransactionsStore` owns transaction loading, create, import, update, hard
  delete, and error state.
- `useCategoriesStore` owns category loading, create, rename, archive, active
  category derivation, and error state.
- `usePeriodScopeStore` owns in-memory selected period and custom date state.

Where direct DB access happens:

- Stores call `src/db/transactions` and `src/db/categories` directly.
- Feature screens call store actions, not DB functions directly.
- Native DB modules contain SQL and mapping logic.
- CSV import/export parses and serializes in `src/features/export`, then
  Settings passes imported transactions into the transaction store.

Future sync-ready API recommendation:

- Introduce repository or service functions before sync writes are added.
- Keep screens calling stores, but move sync-sensitive write metadata into a
  centralized data layer.
- Avoid scattering `updatedAt`, `deletedAt`, owner assignment, revision, or
  sync queue logic across feature screens.

Actions that eventually need sync metadata:

- Transaction create should set owner/account, created timestamp, updated
  timestamp, schema version, and local revision metadata.
- Transaction update should refresh `updatedAt` and revision metadata.
- Transaction delete should become soft delete or emit a durable tombstone.
- Transaction import should decide whether imported rows are guest data,
  account data, restored backup data, or conflict candidates.
- Category create/update/archive should update owner, `updatedAt`, schema
  version, and revision metadata.

## 8. Account/Auth Entry Point Recommendation

Settings is the right first account entry point because it already owns data,
support/legal, reminders, and category management. Do not add Account as a
bottom tab.

Recommended later shape:

- Add an Account section to Settings.
- Push a new `/account` route when account state needs more than one row of UI.
- Preserve guest/local mode as the default first-run mode.
- Make sign-in optional and explicit.
- Keep Add Transaction and Shame Card as pushed root screens.
- Keep bottom tabs exactly Home, Analytics & Leaks, and Settings.

## 9. Recommended Next Epics

ML-52 - Provider/config decision docs:

- Add `docs/auth-provider-decision.md`.
- Add `docs/sync-provider-decision.md`.
- Add `docs/auth-sync-env-contract.md`.
- Decide provider, token storage posture, backup/sync boundary, and required
  local config names before adding dependencies.

ML-53 - Sync-ready data contract:

- Add `docs/sync-data-contract.md`.
- Define intended future fields for transactions and categories before editing
  `src/types/transaction.ts`, `src/types/category.ts`, or SQLite tables.
- Decide ID stability, owner assignment, soft-delete semantics, conflict
  policy, and CSV compatibility.

ML-54 - Local migrations:

- Add a versioned migration runner around `src/db/database.native.ts`.
- Consider moving migration steps into a dedicated `src/db/migrations` module.
- Add migration tests or manual QA fixtures before adding sync columns.
- Verify existing local transactions and categories survive upgrade.

ML-55 - Auth foundation:

- Add optional account UI through Settings and a pushed `/account` route.
- Preserve guest/local mode.
- Do not add forced login.
- Add provider dependencies only after ML-52 decisions are locked.
- Defer cloud sync writes until local data contracts and migrations exist.

## 10. Risks And Non-Goals

Risks:

- Silent data wipe during schema or owner migration.
- Forced login blocking existing local users.
- CSV breaking changes that make existing backups impossible to import.
- Cloud-first rewrite that bypasses the local-first data model.
- Sync metadata scattered across screens and stores.
- Hard deletes losing information needed for future sync tombstones.
- Cross-device category ID conflicts from local slug generation.

Non-goals for ML-51:

- No runtime behavior changes.
- No transaction or category schema changes.
- No CSV format changes.
- No auth implementation.
- No backend, Supabase, Firebase, Google, or Apple implementation.
- No new dependencies.
- No broad UI redesign.

No validation-blocking critical runtime bug was identified during this audit.
