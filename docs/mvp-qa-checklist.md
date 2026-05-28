# Money Leak MVP QA Checklist

## Notes

- Primary QA target: native device or simulator builds.
- Web is a limited fallback in this build. `src/db/transactions.web.ts` intentionally does not support SQLite persistence, so transaction create/load/delete flows are not expected to work the same way on web.
- Do not mark native manual QA complete unless the flow was actually verified on a device or simulator.
- Before starting, clear app data or reinstall the app if you need a true first-launch / empty-DB run.

## Release Candidate

- `npm run release:preflight` passes against the checked-in local release configuration.
- The pull request `Validate` workflow passes before merge.
- `package.json.version` changes only when the merge is intended to trigger a release candidate.

## Epic 34: First Live CI Release Verification

- PR CI runs `npm run release:preflight`.
- The release workflow runs `npm run release:preflight`.
- A `main` merge with a version change continues into the release path.
- A `main` merge without a version change exits through `Skip release when version is unchanged`.
- The EAS production iOS build appears.
- The processed build appears in App Store Connect.
- The processed build is available in TestFlight.

## Epic 35: App Store / TestFlight Readiness

- Settings shows "Privacy & Support"
- Privacy Policy button works or shows fallback alert
- Support button works or shows fallback alert
- Existing reminder / import / export features still work
- No crashes in Settings

## Epic 36: Production Links & Metadata Finalization

- Privacy Policy opens the real URL
- Support opens the mail client
- Settings screen remains stable if `Linking.openURL` fails
- No placeholder text remains in docs

## Epic 37: Screenshot Support + Demo Data v1

- `docs/app-store-screenshots.md` exists and documents the five canonical screenshot scenarios.
- `src/features/dev/demo-transactions.ts` exists and exports `createDemoTransactions(): Transaction[]`.
- Demo data is not seeded automatically at runtime from app startup, navigation, or Settings.
- No demo-data button, toggle, or other active runtime control was added.
- Regression check: `Home` still shows Today summary, History segmented controls, and transaction list behavior.
- Regression check: `Analytics` still shows the expected empty, no-leaks, and non-empty states.
- Regression check: `Shame Card` still shows the expected empty, no-leaks, populated preview, tone, and share states.
- Regression check: `Settings` still shows the reminder, `Data`, and `Privacy & Support` sections without regressions.
- Regression check: Import and export flows still work with the existing CSV fixtures and native-only platform boundaries.
- Regression check: Reminder enable, disable, denied, and unsupported flows still work.

## Epic 38: App Store Release Submission Finalization v1

- `docs/app-store-submission-checklist.md` exists and stays focused on repo-side release verification.
- `docs/release-notes/1.2.3.md` exists and matches the shipped feature set.
- `npm run release:preflight` passes.
- The pull request `Validate` workflow passes before merge.
- `package.json.version` is bumped to `1.2.3` intentionally for the release.
- A `main` merge with a version change continues into the `Release iOS` workflow release path.
- A `main` merge without a version change exits through `Skip release when version is unchanged`.

## Epic 41: Add Transaction Navigation Cleanup v1

- Add Transaction is no longer visible in the bottom tab bar.
- Home, Analytics, Shame Card, and Settings remain visible and selectable as the persistent bottom tabs.
- The Home Add Transaction CTA opens the Add Transaction screen as a pushed screen.
- The Add Transaction screen shows the normal header/back affordance, and back returns to the previous screen.
- Saving a transaction returns to Home or the previous screen.
- Today summary values and the History list refresh after a successful save.
- The Home Add Transaction CTA still opens Add Transaction.
- Analytics, Shame Card, and Settings tabs still open and behave as before.

## Epic 42: Period Selector v2

- The shared period selector defaults to `Today`.
- The selector shows `Yesterday`, `Today`, `This week`, and `Choose date`.
- The selector no longer shows `This month` or `All time`.
- `Home` History updates correctly for `Today`, `Yesterday`, and `This week`.
- `Analytics` updates when switching between each period option.
- `Shame Card` updates when switching between each period option.
- Canceling `Choose date` closes the picker without changing the previous period or custom date.
- Empty states and no-leaks states render without crashing for every period option.
- Add Transaction is still not visible in the bottom tab bar.
- Add Transaction remains available from the Home CTA at `/add-transaction`.

## ML-43 / Epic 43: App Icon v1

- Expo config resolves the app icon path to `./assets/images/icon.png`.
- Production/TestFlight build shows the Money Leak icon on the Home Screen.
- TestFlight/App Store Connect build displays the new icon after processing.
- Existing app navigation still works.
- Settings / Privacy & Support still works.
- No product behavior changed.

## ML-44 / Epic 44: Editable Categories v1

- Settings shows a `Categories` section with `Manage Categories`.
- `Manage Categories` opens `/categories` as a pushed screen.
- Adding a category with a valid unique name succeeds.
- Adding a duplicate active category name shows validation and does not create a duplicate.
- Editing a category name succeeds and keeps existing transactions attached to the same category ID.
- The new category appears in Add Transaction and Edit Transaction category selectors.
- A transaction saved with a custom category appears on Home with the custom category name.
- Analytics and Shame Card do not crash with custom categories.
- Deleting a category archives it after confirmation.
- Archived categories disappear from Add Transaction and normal Edit Transaction selectors.
- Existing transactions with archived categories still display a safe category name.
- Editing a transaction whose current category is archived does not crash and keeps the archived current value visible.
- `Other` cannot be deleted.
- Deleting the last active category is blocked.
- CSV export still uses the header `id,amount,category,isLeak,leakReason,note,createdAt`.
- CSV export still writes the stored category ID, not the display name.
- CSV import still accepts existing Money Leak CSV fixtures.
- CSV import with an unknown category ID imports safely and old transactions display a readable fallback category name.

## ML-47: iOS26 Footer Navigation

- ML-47 footer shows only `Home`, `Analytics & Leaks`, and `Settings`.
- Home tab active state matches Figma-style blue icon/label plus gray capsule.
- `Analytics & Leaks` label wraps into two lines.
- Settings tab icon and label render correctly.
- Switching tabs updates active state correctly.
- No gray spacer/band appears between screen content and footer.
- Shame Card is no longer a bottom tab.
- Shame Card opens from the Analytics CTA.
- Shame Card share still works.
- Add Transaction remains a pushed root screen and is not visible as a tab.
- Home, Analytics, Settings, Add/Edit Transaction, Manage Categories, CSV Import/Export, reminders, and editable categories still work.

## ML-48 / Epic 48: Home Page Redesign

- Home shows only the page title plus `Today summary` and `History` as the main content sections.
- Home and section titles use the bundled New York font on iOS.
- Old separate `Today check-in`, `Logging Streak`, and `Leak Risk` Home cards are not visible.
- Today summary empty state shows safe zero values and does not show `NaN`.
- Today summary updates after adding a normal transaction today.
- Today summary updates after adding a leak transaction today.
- Today summary excludes yesterday or older transactions.
- Home History segmented control shows only `Today`, `Yesterday`, and `This week`.
- History segmented control animates the selected capsule between periods.
- `More` beside `History` switches to the `Analytics & Leaks` tab.
- History empty state renders safely for the selected period.
- A normal History item shows amount, category display name, date/time, `Normal` state, and no leak-only details.
- A leak History item shows amount, category display name, date/time, `Leak` state, leak reason, and note when present.
- Swiping a History item left reveals the green edit action, opens the existing edit transaction screen, and updates Home after save.
- Swiping a History item right reveals the red delete action, asks for confirmation, and updates Today summary plus History after deletion.
- History items do not show persistent inline `Edit` or `Delete` buttons.
- History items do not show the retired gray left border.
- History items are gray at rest and the swiped foreground card becomes white while actions are revealed.
- Add Transaction remains a pushed screen from the Home CTA and is not visible as a tab.
- ML-47 footer still works and does not cover the last History item or create a gray/white spacer band.
- `Analytics & Leaks` and `Settings` tabs still work.
- Shame Card still opens from Analytics and remains a pushed root screen.

## ML-49: History Swipe Gesture Hardening

- Slow swipe left with slight upward/downward finger drift reveals the green edit action.
- Slow swipe right with slight upward/downward finger drift reveals the red delete action.
- Fast short swipe left can reveal Edit if velocity is high enough.
- Fast short swipe right can reveal Delete if velocity is high enough.
- Vertical scrolling over History cards still works normally.
- A mostly vertical gesture does not accidentally open swipe actions.
- Delete action still shows confirmation before removing.
- Edit action still opens `/transaction/[id]/edit`.
- Returning from edit preserves Home behavior.
- Opening one row closes the previously open row.
- Footer tabs remain `Home`, `Analytics & Leaks`, and `Settings`.

## ML-50 / Epic 50: Add/Edit Transaction Amount Autofocus

- Add Transaction opens with the amount input focused and ready for typing.
- Edit Transaction opens with the amount input focused and the existing amount still populated.
- The keyboard opens automatically on native devices when Add Transaction or Edit Transaction opens.
- Amount validation still works for empty, invalid, zero/negative, and valid values.
- Category selection, leak toggle, leak reason selection, note entry, and submit behavior still work.
- Back navigation from Add Transaction or Edit Transaction does not leave the app in a broken keyboard or focus state.
- Footer tabs remain `Home`, `Analytics & Leaks`, and `Settings`.
- Add Transaction and Shame Card remain pushed root screens and are not visible bottom tabs.

## ML-51: Auth & Sync Readiness Audit

- `docs/auth-sync-audit.md` exists and documents the current local-first auth/sync readiness baseline.
- `docs/ml-51-handoff.txt` exists and summarizes the audit handoff for the next epic.
- `package.json.version` is bumped to `1.10.3`.
- `package-lock.json` top-level and root package version fields are bumped to `1.10.3`.
- `app.config.js`, `app.json`, and `eas.json` are unchanged.
- Runtime app code is unchanged except for documentation and version metadata.
- Transaction and category TypeScript types are unchanged.
- SQLite transaction/category schemas are unchanged.
- CSV import/export format remains `id,amount,category,isLeak,leakReason,note,createdAt`.
- No auth, backend, account, cloud sync, or provider dependency was added.
- Footer tabs remain exactly `Home`, `Analytics & Leaks`, and `Settings`.
- Add Transaction and Shame Card remain pushed root screens and are not visible bottom tabs.
- `npm run release:preflight` passes.
- `npm test -- --runInBand` passes.
- `npm run typecheck` passes.
- `npm run lint` passes.
- `npm run format:check` passes.
- `npx expo config --json` resolves Expo version as `1.10.3`.
- `git diff --check` passes.

## ML-52 / Epic 52: Provider / Auth / Sync Config Decision

- `docs/auth-provider-decision.md` exists and documents Supabase Auth as the future auth provider decision.
- `docs/sync-provider-decision.md` exists and documents Supabase Postgres as the future remote backup/sync provider decision.
- `docs/auth-sync-env-contract.md` exists and documents future placeholder-only auth/sync config names.
- `.env.example` contains placeholders only and no real secrets.
- No runtime auth implementation was added.
- No backend, account, cloud sync, or provider runtime implementation was added.
- No Supabase, Firebase, Auth0, Clerk, Google auth, or Apple auth dependency was added.
- No secrets or Supabase service role key values were committed.
- CSV v1 remains `id,amount,category,isLeak,leakReason,note,createdAt`.
- Bottom tabs remain exactly `Home`, `Analytics & Leaks`, and `Settings`.
- Add Transaction, Shame Card, and Manage Categories remain pushed root Stack screens.
- `package.json.version` is bumped intentionally to `1.10.4`.
- `package-lock.json` top-level and root package version fields are bumped intentionally to `1.10.4`.
- `app.config.js`, `app.json`, and `eas.json` are unchanged.
- `npm run release:preflight` passes.
- `npm test -- --runInBand` passes.
- `npm run typecheck` passes.
- `npm run lint` passes.
- `npm run format:check` passes.
- `npx expo config --json` resolves Expo version as `1.10.4`.
- `git diff --check` passes.

## ML-53: Sync-Ready Data Contract

- `docs/sync-data-contract.md` exists and documents the sync-ready local and remote data contract.
- Transactions, categories, and settings/storage baselines are covered.
- Future transaction and category sync-ready fields are documented.
- The owner model is documented, including `localOwnerId`, `appUserId`, `authUserId`, and `ownerId` behavior.
- Logout is documented as preserving local data.
- Soft delete and tombstone behavior is documented, including the current transaction hard-delete risk.
- Device identity and timestamp normalization rules are documented.
- Entity `schemaVersion` is documented separately from SQLite migration version.
- CSV v1 remains `id,amount,category,isLeak,leakReason,note,createdAt`.
- CSV v1 compatibility is preserved and no sync metadata is added to CSV v1.
- `docs/ml-53-handoff.txt` exists and summarizes the contract handoff.
- No runtime auth, backend, account, backup, sync, SQLite schema, or navigation changes were made.
- No Supabase, Google Auth, Apple Sign-In, or other auth/provider runtime dependency was added.
- No secrets or Supabase service role key values were committed.
- `package.json.version` is bumped intentionally to `1.10.5`.
- `package-lock.json` top-level and root package version fields are bumped intentionally to `1.10.5`.
- `app.config.js`, `app.json`, and `eas.json` are unchanged.
- `npm run release:preflight` passes.
- `npm test -- --runInBand` passes.
- `npm run typecheck` passes.
- `npm run lint` passes.
- `npm run format:check` passes.
- `npx expo config --json` resolves Expo version as `1.10.5`.
- `git diff --check` passes.

## ML-54: Versioned Local Migrations And Sync-Ready SQLite

- Native SQLite initialization creates `schema_migrations` and records applied local migrations.
- Running native database initialization more than once does not duplicate or reapply completed migrations.
- Existing transaction rows keep their data and receive `ownerId`, `updatedAt`, `deletedAt`, `schemaVersion`, and `sourceDeviceId`.
- Existing category rows keep their data and receive `ownerId`, `deletedAt`, `schemaVersion`, and `sourceDeviceId`.
- Existing category `updatedAt` values are preserved when valid, otherwise repaired from `createdAt` or the migration time.
- New transaction rows receive local sync metadata at insert time.
- Edited transactions refresh `updatedAt`.
- Deleting a transaction hides it from Home, Analytics, and Shame Card while retaining a local soft-delete tombstone.
- Category delete/archive behavior remains unchanged: archived categories are hidden from selectors, and `deletedAt` stays reserved for future sync tombstones.
- CSV export still uses exactly `id,amount,category,isLeak,leakReason,note,createdAt`.
- CSV import still accepts CSV v1 files and imported rows receive local sync metadata in SQLite.
- Duplicate CSV import IDs continue to be skipped by `INSERT OR IGNORE`.
- `localOwnerId` and `deviceId` are stable local SQLite metadata values and are not auth/session tokens.
- `package.json.version` is bumped intentionally to `1.11.0`.
- `package-lock.json` top-level and root package version fields are bumped intentionally to `1.11.0`.
- `app.config.js`, `app.json`, and `eas.json` are unchanged.
- No Supabase SDK, auth UI, backend tables, RLS, backup, or sync service was added.
- No Google Auth or Apple Auth implementation was added.
- Bottom tabs remain exactly `Home`, `Analytics & Leaks`, and `Settings`.
- Add Transaction and Shame Card remain pushed root screens and are not visible bottom tabs.
- No `@expo/ui`, SwiftUI wrappers, BlurView, `expo-blur`, glass styling, or Liquid Glass imitation was added.
- `npm run release:preflight` passes.
- `npm test -- --runInBand` passes.
- `npm run typecheck` passes.
- `npm run lint` passes.
- `npm run format:check` passes.
- `npx expo config --json` resolves Expo version as `1.11.0`.
- `git diff --check` passes.

## ML-55: Auth Foundation / Guest Account Architecture

- Auth domain types exist for providers, status, user, session, and safe errors.
- Auth service and provider adapter interfaces exist without implementing Google, Apple, Supabase, backend, backup, restore, or sync behavior.
- Guest/no-op auth service restores a token-free local session when one exists and otherwise returns guest mode.
- Auth session storage uses `expo-secure-store` and does not use AsyncStorage for auth session data.
- SecureStore unavailable or failing during restore falls back safely to guest mode and does not block local expense tracking.
- App bootstrap initializes auth from `app/_layout.tsx` without waiting on auth before rendering.
- Auth initialization does not wipe, relink, or mutate transactions or categories.
- Feature flags exist and all future auth/sync features remain disabled:
  `googleAuthEnabled`, `appleAuthEnabled`, `backupEnabled`, `restoreEnabled`,
  and `incrementalSyncEnabled`.
- No login wall, account screen, provider button, or navigation route was added.
- CSV export still uses exactly `id,amount,category,isLeak,leakReason,note,createdAt`.
- CSV import still accepts CSV v1 and does not require auth.
- Bottom tabs remain exactly `Home`, `Analytics & Leaks`, and `Settings`.
- Add Transaction and Shame Card remain pushed root screens and are not visible bottom tabs.
- No transaction/category SQLite schema changes were made.
- No Supabase SDK, backend tables, RLS, backup, restore, or sync service was added.
- No Google Auth or Apple Auth implementation was added.
- No Supabase service role key or real auth secret was committed.
- `package.json.version` is bumped intentionally to `1.11.1`.
- `package-lock.json` top-level and root package version fields are bumped intentionally to `1.11.1`.
- `app.config.js` is unchanged and continues to read the Expo version from `package.json`.
- `app.json` includes the minimal `expo-secure-store` config plugin entry required by the Expo installer.
- `npm run release:preflight` passes.
- `npm test -- --runInBand` passes.
- `npm run typecheck` passes.
- `npm run lint` passes.
- `npm run format:check` passes.
- `npx expo config --json` resolves Expo version as `1.11.1`.
- `git diff --check` passes.

## ML-56: Google Auth v1 Through Supabase

- Settings shows a compact `Account` section.
- Guest/local mode remains the default when no token-free auth session exists.
- `Continue with Google` appears only when Google auth is enabled and required public config is present.
- Tapping `Continue with Google` opens the Supabase/Google OAuth flow in an EAS development build or native iOS build.
- Canceling or dismissing Google login returns quietly to Settings without an error.
- Successful Google login returns to the app and shows the signed-in account identity.
- Google login failure, bad config, or network failure shows safe generic copy without tokens or secrets.
- Local transactions and categories remain visible and unchanged after login.
- `Sign Out` returns to guest/local mode and does not delete, archive, relink, upload, merge, back up, restore, sync, or mutate local transactions/categories.
- App restart restores only the token-free local auth display session added by ML-55; deeper Supabase token-backed session restore hardening remains for ML-57.
- `.env.example` contains placeholders only and no real secrets.
- No Supabase service role key, OAuth client secret, provider token, access token, refresh token, ID token, or secret-like value was committed.
- CSV export still uses exactly `id,amount,category,isLeak,leakReason,note,createdAt`.
- CSV import still accepts CSV v1 and does not require auth.
- Bottom tabs remain exactly `Home`, `Analytics & Leaks`, and `Settings`.
- Add Transaction and Shame Card remain pushed root Stack screens and are not visible bottom tabs.
- No transaction/category SQLite schema changes or migrations were added.
- No backup, restore, incremental sync, Supabase database tables, RLS policies, Apple Sign-In, backend user profile logic, or account linking was added.
- No `@expo/ui`, SwiftUI wrappers, BlurView, `expo-blur`, glass styling, or broad visual redesign was added.
- `package.json.version` is bumped intentionally to `1.12.0`.
- `package-lock.json` top-level and root package version fields are bumped intentionally to `1.12.0`.
- `app.config.js`, `app.json`, and `eas.json` are unchanged.
- `npm run release:preflight` passes.
- `npm test -- --runInBand` passes.
- `npm run typecheck` passes.
- `npm run lint` passes.
- `npm run format:check` passes.
- `npx expo config --json` resolves Expo version as `1.12.0`.
- `git diff --check` passes.

Manual owner QA:

- Test Google login success on a real device or EAS development/native iOS build.
- Test Google login cancel/dismiss.
- Test bad or missing config if practical.
- Test no-internet or network failure if practical.
- Verify local data remains visible after login.
- Verify logout keeps local data.
- Verify app restart/session behavior and record any ML-57 restore hardening needed.

## ML-57: TestFlight Auth Env Rebuild Hotfix

- GitHub/EAS production build environment has the required public auth values:
  `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`,
  `EXPO_PUBLIC_AUTH_REDIRECT_SCHEME`, `EXPO_PUBLIC_AUTH_REDIRECT_PATH`,
  `EXPO_PUBLIC_IOS_BUNDLE_IDENTIFIER`, and
  `EXPO_PUBLIC_ANDROID_PACKAGE`.
- `package.json.version` is bumped intentionally to `1.12.1`.
- `package-lock.json` top-level and root package version fields are bumped
  intentionally to `1.12.1`.
- Auth env docs explain that local `.env` is not enough for TestFlight/GitHub
  Actions builds.
- Auth env docs explain that `EXPO_PUBLIC_*` values are baked into the app at
  build time and require a new build after being added or changed.
- Release docs explain that the `Release iOS` workflow only creates a real iOS
  build when `package.json.version` changes.
- After merge or push to `main`, `Release iOS` starts and continues past the
  unchanged-version skip path.
- A new TestFlight build appears as version `1.12.1`.
- Real device TestFlight update shows `Continue with Google` in Settings.
- Google login succeeds or shows a safe provider/config error without exposing
  URLs, keys, tokens, or secrets.
- Local transactions and categories remain visible after Google login.
- `Sign Out` returns to guest/local mode and does not delete, archive, relink,
  upload, merge, back up, restore, sync, or mutate local
  transactions/categories.
- Guest/local mode remains available.
- No Apple Sign-In, backup, restore, incremental sync, Supabase database
  tables, RLS policies, backend user profile logic, or account linking was
  added.
- CSV export still uses exactly
  `id,amount,category,isLeak,leakReason,note,createdAt`.
- CSV import still accepts CSV v1 and does not require auth.
- Bottom tabs remain exactly `Home`, `Analytics & Leaks`, and `Settings`.
- `npm run release:preflight` passes.
- `npm test -- --runInBand` passes.
- `npm run typecheck` passes.
- `npm run lint` passes.
- `npm run format:check` passes.
- `npx expo config --json` resolves Expo version as `1.12.1`.
- `git diff --check` passes.

## ML-58: TestFlight Google Auth Config Rebuild Hotfix

- Expo production environment has the required public auth values:
  `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`,
  `EXPO_PUBLIC_AUTH_REDIRECT_SCHEME`, `EXPO_PUBLIC_AUTH_REDIRECT_PATH`,
  `EXPO_PUBLIC_IOS_BUNDLE_IDENTIFIER`, and
  `EXPO_PUBLIC_ANDROID_PACKAGE`.
- `package.json.version` is bumped intentionally to `1.12.2`.
- `package-lock.json` top-level and root package version fields are bumped
  intentionally to `1.12.2`.
- After merge to `main`, `Release iOS` starts and continues past the
  unchanged-version skip path.
- A new TestFlight build appears as version `1.12.2`.
- Real device TestFlight update shows `Continue with Google` in Settings.
- Google login succeeds or shows a safe provider/config error without exposing
  URLs, keys, tokens, or secrets.
- Local transactions and categories remain visible after Google login and
  logout.
- `Sign Out` returns to guest/local mode and does not delete, archive, relink,
  upload, merge, back up, restore, sync, or mutate local
  transactions/categories.
- No Apple Sign-In, backup, restore, incremental sync, Supabase database
  tables, RLS policies, backend user profile logic, or account linking was
  added.
- CSV export still uses exactly
  `id,amount,category,isLeak,leakReason,note,createdAt`.
- Bottom tabs remain exactly `Home`, `Analytics & Leaks`, and `Settings`.
- Add Transaction and Shame Card remain pushed root Stack screens and are not
  visible bottom tabs.
- No `@expo/ui`, SwiftUI wrappers, BlurView, `expo-blur`, glass styling, or
  broad visual redesign was added.
- `npm run release:preflight` passes.
- `npm test -- --runInBand` passes.
- `npm run typecheck` passes.
- `npm run lint` passes.
- `npm run format:check` passes.
- `npx expo config --json` resolves Expo version as `1.12.2`.
- `git diff --check` passes.

## ML-59: TestFlight Google Auth Diagnostics

- `eas.json` `build.production.environment` is set to `production`.
- `npm run release:preflight` fails if
  `eas.json` `build.production.environment` is not `production`.
- EAS production builds read the named production environment that contains the
  required public auth values:
  `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`,
  `EXPO_PUBLIC_AUTH_REDIRECT_SCHEME`, `EXPO_PUBLIC_AUTH_REDIRECT_PATH`,
  `EXPO_PUBLIC_IOS_BUNDLE_IDENTIFIER`, and
  `EXPO_PUBLIC_ANDROID_PACKAGE`.
- When Settings is in guest mode and `Continue with Google` is hidden, Account
  shows a temporary diagnostics block with only boolean values:
  `googleAuthEnabled`, `hasSupabaseUrl`, `hasSupabaseAnonKey`,
  `hasRedirectScheme`, `hasRedirectPath`, `hasIosBundleIdentifier`,
  `hasAndroidPackage`, and `isGoogleAuthConfigAvailable`.
- Account diagnostics do not show actual URLs, keys, tokens, OAuth secrets,
  provider secrets, or raw `EXPO_PUBLIC_*` values.
- When Google auth is enabled and config is available, normal
  `Continue with Google` behavior is unchanged and the diagnostics block is not
  shown.
- `package.json.version` is bumped intentionally to `1.12.3`.
- `package-lock.json` top-level and root package version fields are bumped
  intentionally to `1.12.3`.
- After merge to `main`, `Release iOS` starts and continues past the
  unchanged-version skip path.
- A new TestFlight build appears as version `1.12.3`.
- Real device TestFlight update shows `Continue with Google` in Settings.
- If the Google button is hidden, the Account diagnostics reveal which config
  gate is false without exposing sensitive values.
- Google login succeeds or shows a safe provider/config error without exposing
  URLs, keys, tokens, or secrets.
- Local transactions and categories remain visible after Google login and
  logout.
- No local schema, CSV format, navigation, auth provider behavior, or sync
  behavior changed.
- `npm run release:preflight` passes.
- `npm test -- --runInBand` passes.
- `npm run typecheck` passes.
- `npm run lint` passes.
- `npm run format:check` passes.
- `npx expo config --json` resolves Expo version as `1.12.3`.
- `git diff --check` passes.

## ML-60: Remove TestFlight Google Auth Diagnostics

- Auth config reads the required Expo public values through static
  `process.env.EXPO_PUBLIC_*` property access. Do not use dynamic lookup such
  as `process.env[key]`, key reducers, or generic `getEnv(key)` helpers for
  these values because Expo/Metro may not inline them into production JS
  bundles.
- Settings Account does not show diagnostic booleans such as
  `googleAuthEnabled`, `hasSupabaseUrl`, `hasSupabaseAnonKey`,
  `hasRedirectScheme`, `hasRedirectPath`, `hasIosBundleIdentifier`,
  `hasAndroidPackage`, or `isGoogleAuthConfigAvailable` in production UI.
- Continue with Google appears when Google auth is enabled and the required
  Supabase/Auth config is available.
- Guest/local mode still works when Supabase/Auth config is unavailable.
- Canceling or failing Google login returns safe user-facing copy without raw
  URLs, keys, tokens, OAuth secrets, provider secrets, or `EXPO_PUBLIC_*`
  values.
- Signing out does not delete local transactions or categories.
- No raw env values or secrets appear in Settings UI.
- `package.json.version` is bumped intentionally to `1.12.6`.
- `package-lock.json` top-level and root package version fields are bumped
  intentionally to `1.12.6`.
- A new TestFlight build appears as version `1.12.6`.
- Real device TestFlight update shows `Continue with Google` when the Expo
  production environment contains all required public auth values.
- Local transactions and categories remain visible after Google login and
  logout.
- No Apple Sign-In, backup, restore, sync, Supabase database tables, RLS,
  backend profile logic, account linking, or delete account was added.
- CSV v1 remains exactly
  `id,amount,category,isLeak,leakReason,note,createdAt`.
- Bottom tabs remain Home, Analytics & Leaks, and Settings.
- Add Transaction and Shame Card remain pushed root Stack screens and are not
  visible bottom tabs.
- No `@expo/ui`, SwiftUI wrappers, BlurView, `expo-blur`, glass styling, or
  Liquid Glass imitation was added.
- `npm run release:preflight` passes.
- `npm test -- --runInBand` passes.
- `npm run typecheck` passes.
- `npm run lint` passes.
- `npm run format:check` passes.
- `npx expo config --json` resolves Expo version as `1.12.6`.
- `git diff --check` passes.

## ML-61: Supabase Session Restore And Auth Bootstrap Hardening

- Supabase Auth session restores on app restart when the stored Supabase session
  is valid.
- A missing Supabase session starts in guest/local mode and clears stale
  token-free account display state.
- An expired, revoked, corrupted, or failed Supabase restore falls back safely
  to guest/local mode with recoverable copy and no crash.
- Offline startup keeps the app usable locally and does not block onboarding,
  navigation, transactions, categories, import, or export.
- Google login still succeeds through Settings when the Expo production
  environment contains the required public auth values.
- `Continue with Google` remains visible when Google auth is enabled and config
  is valid.
- `Continue with Google` remains hidden when config is unavailable, without
  showing diagnostics labels or raw config values.
- Restart after Google login keeps the authenticated Account state when the
  Supabase session is valid.
- Cold start after Google login keeps the authenticated Account state when the
  Supabase session is valid.
- `Sign Out` clears Supabase auth state and Money Leak account display state.
- `Sign Out` does not delete, archive, relink, upload, merge, back up, restore,
  sync, or mutate local transactions/categories.
- Local transactions and categories remain visible after login, logout,
  restart, cold start, and offline startup.
- `ownerId`, `localOwnerId`, and device-local identity remain unchanged by auth
  restore and sign out.
- Settings Account does not show diagnostic booleans such as
  `googleAuthEnabled`, `hasSupabaseUrl`, `hasSupabaseAnonKey`,
  `hasRedirectScheme`, `hasRedirectPath`, `hasIosBundleIdentifier`,
  `hasAndroidPackage`, or `isGoogleAuthConfigAvailable`.
- No raw env values, Supabase URL, anon key, OAuth secrets, provider secrets,
  access tokens, refresh tokens, provider tokens, or raw `EXPO_PUBLIC_*` values
  are visible in UI, logs, tests, or docs.
- No Apple Sign-In, backup, restore, sync, Supabase database tables, RLS,
  backend profile logic, account linking, or delete account was added.
- CSV v1 remains exactly
  `id,amount,category,isLeak,leakReason,note,createdAt`.
- Bottom tabs remain Home, Analytics & Leaks, and Settings.
- Add Transaction and Shame Card remain pushed root Stack screens and are not
  visible bottom tabs.
- No `@expo/ui`, SwiftUI wrappers, BlurView, `expo-blur`, glass styling, or
  Liquid Glass imitation was added.
- `package.json.version` is bumped intentionally to `1.12.7`.
- `package-lock.json` top-level and root package version fields are bumped
  intentionally to `1.12.7`.
- `app.config.js`, `app.json`, and `eas.json` are unchanged.
- `npm run release:preflight` passes.
- `npm test -- --runInBand` passes.
- `npm run typecheck` passes.
- `npm run lint` passes.
- `npm run format:check` passes.
- `npx expo config --json` resolves Expo version as `1.12.7`.
- `git diff --check` passes.

Manual owner QA:

- Log in through Google from Settings.
- Restart the app after login and verify Account still shows authenticated
  state.
- Cold start the app after login and verify Account still shows authenticated
  state.
- Start the app offline and verify local Home, Analytics, Settings,
  transactions, categories, import, and export remain usable.
- Sign out from Settings and verify Account returns to guest/local mode.
- Verify local transactions/categories are preserved after login, logout,
  restart, cold start, and offline startup.
- Verify `Continue with Google` remains visible when the build has valid auth
  config.
- Verify no diagnostics UI is shown.
- Verify no raw env values, URLs, anon keys, tokens, OAuth secrets, provider
  secrets, or raw `EXPO_PUBLIC_*` values are visible.

## ML-62: Local Account Linking v1

- Successful auth restore locally relinks transactions owned by `localOwnerId`
  to the authenticated Money Leak user id.
- Successful Google login locally relinks transactions owned by `localOwnerId`
  to the authenticated Money Leak user id.
- Successful auth restore/login locally relinks categories owned by
  `localOwnerId` to the authenticated Money Leak user id.
- Repeated login or restore with the same account is idempotent and does not
  duplicate transaction or category rows.
- Rows already owned by the authenticated user stay single rows and are not
  duplicated.
- Rows owned by another owner id are not relinked, deleted, or mutated.
- Soft-deleted transaction tombstones keep `deleted_at` and are relinked so a
  future sync can still see them.
- Local account linking writes only safe SQLite `app_metadata` markers such as
  account-linked user and timestamp metadata; it does not use AsyncStorage.
- A local account linking failure does not sign the user out and does not block
  guest/local app usage.
- `Sign Out` does not unlink, delete, archive, relink, upload, merge, back up,
  restore, sync, or mutate local transactions/categories/owner ids.
- Guest/local mode remains permanent; there is no login wall.
- Local transactions and categories remain visible after login, logout, repeat
  login, auth restore, and account linking failure.
- `Continue with Google` remains visible when Google auth is enabled and config
  is valid.
- `Continue with Google` remains hidden when config is unavailable, without
  showing diagnostics labels or raw config values.
- Settings Account does not show diagnostic booleans such as
  `googleAuthEnabled`, `hasSupabaseUrl`, `hasSupabaseAnonKey`,
  `hasRedirectScheme`, `hasRedirectPath`, `hasIosBundleIdentifier`,
  `hasAndroidPackage`, or `isGoogleAuthConfigAvailable`.
- Settings Account does not show raw owner ids, local owner ids, device ids,
  env values, Supabase URL, anon key, OAuth secrets, provider secrets, access
  tokens, refresh tokens, provider tokens, or raw `EXPO_PUBLIC_*` values.
- No Google Auth adapter, Supabase config, TestFlight visibility, or redirect
  configuration was changed.
- No Apple Sign-In, backup, restore, sync, Supabase database tables, RLS,
  backend profile logic, account deletion, or remote merge was added.
- CSV v1 remains exactly
  `id,amount,category,isLeak,leakReason,note,createdAt`.
- Bottom tabs remain Home, Analytics & Leaks, and Settings.
- Add Transaction and Shame Card remain pushed root Stack screens and are not
  visible bottom tabs.
- No `@expo/ui`, SwiftUI wrappers, BlurView, `expo-blur`, glass styling, or
  Liquid Glass imitation was added.
- `package.json.version` is bumped intentionally to `1.12.8`.
- `package-lock.json` top-level and root package version fields are bumped
  intentionally to `1.12.8`.
- `app.config.js`, `app.json`, and `eas.json` are unchanged.
- `npm run release:preflight` passes.
- `npm test -- --runInBand` passes.
- `npm run typecheck` passes.
- `npm run lint` passes.
- `npm run format:check` passes.
- `npx expo config --json` resolves Expo version as `1.12.8`.
- `git diff --check` passes.

Manual owner QA:

- Confirm the already-verified ML-61 baseline still holds: `Continue with
Google` is visible, Google login works, authenticated state/email/user info
  appears, Sign Out preserves local transactions/categories, and a guest
  transaction added after Sign Out remains visible after the next login.
- Add a transaction in guest mode, then log in with Google and verify the
  transaction remains visible on Home and Analytics.
- Add or rename a category in guest mode, then log in with Google and verify
  categories remain available in transaction forms.
- Sign out, add another guest transaction, log in again with the same Google
  account, and verify no transactions disappear or duplicate.
- Restart the app after login and verify Account still shows authenticated
  state and local data remains visible.
- Verify no diagnostics UI, raw ids, env values, URLs, anon keys, tokens, OAuth
  secrets, provider secrets, or raw `EXPO_PUBLIC_*` values are visible.

## ML-63: Supabase Backend User Profile / RLS Foundation v1

- `supabase/migrations/20260520000000_create_profiles.sql` exists and creates
  only the remote `profiles` identity table.
- The `profiles` table has Row Level Security enabled.
- Authenticated users can select, insert, and update only their own profile.
- Anonymous users cannot read or write profiles.
- Profile creation uses the existing Supabase anon client and never uses a
  service role key in the mobile app.
- Successful auth restore ensures a remote profile without blocking app
  startup, navigation, SQLite initialization, or local-first usage.
- Successful Google login ensures a remote profile without blocking account
  display state.
- Profile ensure failure is recoverable: the user remains authenticated locally
  and local data stays visible.
- Profile ensure does not delete, hide, upload, restore, back up, sync, or merge
  transactions or categories.
- `Sign Out` remains auth-only and keeps local transactions/categories.
- No remote transactions, categories, settings, backup, restore, sync, upload,
  remote merge, Apple Sign-In, delete account, or account deletion was added.
- No Account diagnostics UI or visible profile management UI was added.
- CSV v1 remains exactly
  `id,amount,category,isLeak,leakReason,note,createdAt`.
- Bottom tabs remain Home, Analytics & Leaks, and Settings.
- Add Transaction and Shame Card remain pushed root Stack screens and are not
  visible bottom tabs.
- No `@expo/ui`, SwiftUI wrappers, BlurView, `expo-blur`, glass styling, or
  Liquid Glass imitation was added.
- `package.json.version` is bumped intentionally to `1.12.9`.
- `package-lock.json` top-level and root package version fields are bumped
  intentionally to `1.12.9`.
- `app.config.js`, `app.json`, and `eas.json` are unchanged.
- `npm run release:preflight` passes.
- `npm test -- --runInBand` passes.
- `npm run typecheck` passes.
- `npm run lint` passes.
- `npm run format:check` passes.
- `npx expo config --json` resolves Expo version as `1.12.9`.
- `git diff --check` passes.

Manual owner QA:

- Apply `supabase/migrations/20260520000000_create_profiles.sql` manually in the
  target Supabase project before testing the app build.
- Log in through Google and verify the Supabase dashboard shows exactly one
  profile row for that authenticated account.
- Restart the app and verify session restore does not create a duplicate
  profile row.
- Sign out from Settings and verify local transactions/categories remain
  visible in guest/local mode.
- Log in again with the same Google account and verify the existing profile row
  is reused/upserted instead of duplicated.
- Verify local transactions/categories remain visible after login, restart,
  sign out, and repeat login.
- Verify no backup/sync UI or remote transaction/category data appears.
- Verify no raw config values, secrets, tokens, account identifiers, or device
  identifiers are visible in the app, logs, tests, or docs.

## ML-64: Backup/Sync Foundation Layer v1

- `supabase/migrations/20260520010000_create_remote_backup_tables.sql` exists
  and creates only `remote_transactions` and `remote_categories`.
- `remote_transactions` and `remote_categories` use `(user_id, id)` composite
  primary keys and reference `auth.users(id)` with `on delete cascade`.
- Row Level Security is enabled on both remote backup tables.
- Anonymous/public table access is revoked, and authenticated users can select,
  insert, update, and delete only their own rows through `auth.uid()` policies.
- No `remote_settings`, `sync_metadata`, production backup button, restore UI,
  automatic sync, background sync, remote merge, delete account, Apple Sign-In,
  or login-triggered upload was added.
- Backup/restore/incremental sync feature flags remain disabled.
- The local backup read boundary reads through existing transaction/category DB
  boundaries and does not mutate local data.
- Normal backup payloads include active transactions and non-deleted categories;
  archived categories are included, and tombstones are not included.
- Guest mode skips backup without reading local data or calling a remote
  adapter.
- Authenticated backup requires a non-empty user id before any adapter write.
- Fake remote adapter tests use no live Supabase network calls and upsert by
  `(userId, id)` without duplicates.
- CSV v1 remains exactly
  `id,amount,category,isLeak,leakReason,note,createdAt`.
- Bottom tabs remain Home, Analytics & Leaks, and Settings.
- Add Transaction and Shame Card remain pushed root Stack screens and are not
  visible bottom tabs.
- No Account diagnostics UI was restored.
- No raw config values, secrets, tokens, service role keys, account identifiers,
  local owner ids, or device identifiers are rendered in UI/logs/docs.
- `package.json.version` is bumped intentionally to `1.12.10`.
- `package-lock.json` top-level and root package version fields are bumped
  intentionally to `1.12.10`.
- `app.config.js`, `app.json`, and `eas.json` are unchanged.
- `npm run release:preflight` passes.
- `npm test -- --runInBand` passes.
- `npm run typecheck` passes.
- `npm run lint` passes.
- `npm run format:check` passes.
- `npx expo config --json` resolves Expo version as `1.12.10`.
- `git diff --check` passes.

Manual owner QA:

- Apply `supabase/migrations/20260520010000_create_remote_backup_tables.sql`
  manually in the target Supabase project after ML-63 has already been applied.
- In the Supabase dashboard, confirm only `remote_transactions` and
  `remote_categories` were added by ML-64.
- Confirm RLS is enabled for both new tables and anonymous users cannot read or
  write rows.
- Confirm an authenticated user can access only rows where `user_id` equals the
  authenticated Supabase user id.
- Log in through Google, restart, sign out, and repeat login. Verify local
  transactions/categories remain visible and no remote transaction/category rows
  are created by the app.
- Verify Settings still has no backup/restore/sync button or prompt.

## ML-65: Manual Backup MVP

- `src/lib/sync/supabase-remote-backup-adapter.ts` exists and implements the
  existing `RemoteBackupAdapter` contract.
- Manual backup writes categories to `remote_categories` before transactions to
  `remote_transactions`.
- Both remote backup writes use Supabase anon-client auth and
  `onConflict: 'user_id,id'` upserts.
- No service-role key or service-role client is used in mobile app code.
- Local transaction `category` remains mapped to remote `category_id`.
- Re-running backup upserts existing remote rows instead of creating duplicates.
- `featureFlags.backupEnabled` is enabled.
- `restoreEnabled`, `incrementalSyncEnabled`, and `appleAuthEnabled` remain
  disabled.
- Settings shows the `Backup` card only when the user is authenticated and the
  backup feature flag is enabled.
- Guest/local mode remains available with no login wall and no backup action.
- The backup button label is `Create backup now`.
- The running state shows `Creating backup...`.
- Success copy shows saved transaction/category counts.
- Failure copy is generic: `Couldn't create backup. Try again.`
- Settings never renders raw backend errors, auth tokens, public env values,
  account identifiers, owner identifiers, or device identifiers.
- Last successful backup time is stored locally in `app_metadata` and shown as
  `Last backup: ...` when available.
- Sign Out still does not delete, unlink, upload, restore, merge, or mutate
  local transactions/categories.
- CSV v1 remains exactly
  `id,amount,category,isLeak,leakReason,note,createdAt`.
- Bottom tabs remain Home, Analytics & Leaks, and Settings.
- Add Transaction and Shame Card remain pushed root Stack screens and are not
  visible bottom tabs.
- No restore, restore prompt, remote merge, automatic backup, session-restore
  upload, background sync, incremental sync, delete account, Apple Sign-In,
  account diagnostics UI, CSV change, visual redesign, or glass styling was
  added.
- `package.json.version` is bumped intentionally to `1.13.0`.
- `package-lock.json` top-level and root package version fields are bumped
  intentionally to `1.13.0`.
- `app.config.js`, `app.json`, and `eas.json` are unchanged.
- `npm run release:preflight` passes.
- `npm test -- --runInBand` passes.
- `npm run typecheck` passes.
- `npm run lint` passes.
- `npm run format:check` passes.
- `npx expo config --json` resolves Expo version as `1.13.0`.
- `git diff --check` passes.

Manual owner QA:

- Log in through Google.
- Tap `Create backup now` in Settings.
- Verify rows appear in `remote_transactions` and `remote_categories`.
- Run backup twice and confirm there are no duplicate rows by `(user_id, id)`.
- Add a local transaction and run backup again.
- Confirm the new transaction is uploaded and existing rows are upserted, not
  duplicated.
- Sign out and confirm local transactions/categories remain visible and
  unchanged.
- Confirm guest mode has no login wall and no backup action.
- Confirm restore, sync, automatic upload, delete account, Apple Sign-In, CSV
  changes, and navigation changes are absent.

## ML-66: Restore Backup MVP

- `featureFlags.restoreEnabled` is enabled; `incrementalSyncEnabled` and
  `appleAuthEnabled` remain disabled.
- Settings shows the `Restore` card only when the user is authenticated and the
  restore feature flag is enabled.
- Guest/local mode remains available with no login wall and no restore action.
- The restore button label is `Restore from backup`.
- The running state shows `Restoring backup...`.
- If local non-deleted transactions or categories exist, Settings shows this
  confirmation before restore:
  `This will merge your cloud backup into this device. Existing local data will not be deleted.`
- Restore reads `remote_categories` and `remote_transactions` through the
  existing Supabase anon client and current authenticated session/RLS.
- Restore inserts remote categories first, then remote transactions.
- Restore is merge-only: existing local rows with the same stable id are not
  duplicated or overwritten, and local rows missing from remote remain
  untouched.
- Empty remote backup copy is
  `No backup found for this account.`
- Failure copy is generic:
  `Couldn't restore backup. Try again.`
- Settings never renders raw backend errors, auth tokens, public env values,
  auth ids, owner identifiers, or device identifiers during restore.
- Sign Out does not trigger restore and does not delete, unlink, upload, merge,
  or mutate local transactions/categories.
- No automatic restore on login, session restore, or app start was added.
- No replace-local-with-cloud, destructive merge, background sync, incremental
  sync, conflict UI, CSV v2, navigation change, visual redesign, or glass
  styling was added.
- CSV v1 remains exactly
  `id,amount,category,isLeak,leakReason,note,createdAt`.
- Bottom tabs remain Home, Analytics & Leaks, and Settings.
- Add Transaction and Shame Card remain pushed root Stack screens and are not
  visible bottom tabs.
- `package.json.version` is bumped intentionally to `1.14.0`.
- `package-lock.json` top-level and root package version fields are bumped
  intentionally to `1.14.0`.
- `app.config.js`, `app.json`, and `eas.json` are unchanged.
- `npm run release:preflight` passes.
- `npm test -- --runInBand` passes.
- `npm run typecheck` passes.
- `npm run lint` passes.
- `npm run format:check` passes.
- `npx expo config --json` resolves Expo version as `1.14.0`.
- `git diff --check` passes.

Manual owner QA:

- Log in through Google on a device/build with Supabase auth configured.
- Create a backup from Settings if no remote backup exists.
- On the same or another local install, tap `Restore from backup`.
- Confirm the merge warning when prompted.
- Verify restored categories appear before restored transactions are used.
- Run restore twice and confirm transaction/category rows are not duplicated.
- Create a local-only transaction, run restore, and confirm the local-only row
  remains visible.
- Test an account with no remote rows and confirm
  `No backup found for this account.`
- Sign out and confirm no restore occurs and local data remains visible.
- Confirm guest mode has no restore action.

## ML-67: Delete Tombstone Backup/Restore MVP

- Manual backup uploads active transactions and deleted transaction tombstones
  to `remote_transactions`.
- Manual backup remains idempotent by upserting remote transaction rows with
  `(user_id, id)`.
- Manual restore applies remote transaction tombstones only when a matching
  local transaction ID already exists.
- A restored transaction tombstone hides the matching local transaction from
  normal Home, Analytics, and export/UI reads.
- A remote transaction tombstone with no matching local transaction does not
  create a visible local transaction.
- Manual restore preserves unrelated local-only transactions.
- Re-running restore does not duplicate active rows and does not re-count an
  already-applied tombstone.
- Active remote transaction restore still works.
- Category tombstones are out of scope for ML-67. Archived categories continue
  to back up and restore as archived category records.
- Guest/local mode remains available with no login wall and no backup/restore
  action.
- Settings backup/restore copy remains generic and does not expose raw backend
  errors, auth tokens, public env values, auth IDs, owner identifiers, or device
  identifiers.
- No full incremental sync, background sync, automatic backup/restore,
  replace-local-with-cloud, destructive merge, conflict UI, Apple Sign-In,
  Delete Account, CSV v2, navigation change, visual redesign, or glass styling
  was added.
- CSV v1 remains exactly
  `id,amount,category,isLeak,leakReason,note,createdAt`.
- Bottom tabs remain Home, Analytics & Leaks, and Settings.
- Add Transaction and Shame Card remain pushed root Stack screens and are not
  visible bottom tabs.
- `package.json.version` is bumped intentionally to `1.14.1`.
- `package-lock.json` top-level and root package version fields are bumped
  intentionally to `1.14.1`.
- `app.config.js`, `app.json`, and `eas.json` are unchanged.
- `npm run release:preflight` passes.
- `npm test -- --runInBand` passes.
- `npm run typecheck` passes.
- `npm run lint` passes.
- `npm run format:check` passes.
- `npx expo config --json` resolves Expo version as `1.14.1`.
- `git diff --check` passes.

Manual owner QA:

- Log in through Google on a device/build with Supabase auth configured.
- Create a transaction, back it up from Settings, then delete it locally.
- Run `Create backup now` again and confirm the corresponding
  `remote_transactions` row has `deleted_at` set instead of staying active.
- Restore the same account on the same or another local install and confirm the
  deleted transaction does not reappear.
- Run restore twice and confirm no duplicate transaction/category rows appear.
- Create an unrelated local-only transaction, run restore, and confirm it
  remains visible.
- Confirm a remote tombstone for an ID not present locally does not create a
  visible transaction.
- Archive a category and confirm archived category backup/restore behavior still
  works.
- Sign out and confirm no backup/restore runs and local data remains visible.
- Confirm guest mode has no backup or restore action.

## ML-68: Native Apple Sign-In v1

- `featureFlags.appleAuthEnabled` is enabled only with native iOS availability
  gating.
- Settings Account shows `Continue with Apple` only in guest mode on iOS when
  the native Apple Sign-In adapter is available.
- Settings Account keeps `Continue with Apple` hidden on Android, web,
  unavailable native/config paths, and authenticated account state.
- Apple login uses `expo-apple-authentication` native credentials and
  `supabase.auth.signInWithIdToken({ provider: 'apple', token, nonce })`.
- Apple login does not use Supabase Apple OAuth browser redirect flow,
  `signInWithOAuth({ provider: 'apple' })`, Services ID, `.p8` key, or Apple
  OAuth client secret assumptions.
- Apple login cancel returns quietly without saving a session or showing an
  error.
- Missing identity token, revoked credential, failed provider, or Supabase token
  exchange failure shows generic safe copy only.
- Apple private relay email, null email, and null full name are accepted.
- Apple provider sessions normalize as provider `apple`; Google provider
  sessions continue to normalize as provider `google`.
- The app does not call `linkIdentity`, does not unlink identities, and does
  not match Google and Apple accounts by email in app code. Supabase may still
  automatically link OAuth identities with the same verified email on the
  backend, so same-email Google/Apple behavior requires manual QA in Supabase.
- Successful Apple login uses the existing auth store `setSession` path so
  local account linking and profile ensure are not duplicated.
- Sign Out does not delete, unlink, upload, backup, restore, sync, or mutate
  local transactions/categories.
- Guest/local mode remains available with no login wall.
- No automatic backup/restore after Apple login was added.
- No remote schema migrations, RLS changes, provider account-linking UI,
  incremental sync, CSV v2, navigation change, visual redesign, or glass
  styling was added.
- Settings never renders raw env values, Supabase URL, anon key, OAuth secrets,
  provider secrets, access tokens, refresh tokens, provider tokens, Apple
  identity tokens, local owner IDs, device IDs, or auth owner IDs.
- CSV v1 remains exactly
  `id,amount,category,isLeak,leakReason,note,createdAt`.
- Bottom tabs remain Home, Analytics & Leaks, and Settings.
- Add Transaction and Shame Card remain pushed root Stack screens and are not
  visible bottom tabs.
- `package.json.version` is bumped intentionally to `1.15.0`.
- `package-lock.json` top-level and root package version fields are bumped
  intentionally to `1.15.0`.
- `app.config.js` and `eas.json` are unchanged.
- `app.json` changes only to add the `expo-apple-authentication` config plugin.
- `npm run release:preflight` passes.
- `npm test -- --runInBand` passes.
- `npm run typecheck` passes.
- `npm run lint` passes.
- `npm run format:check` passes.
- `npx expo config --json` resolves Expo version as `1.15.0`.
- `git diff --check` passes.

Manual owner QA:

- Test on a real iPhone or TestFlight build with the Apple capability enabled.
- In guest mode, open Settings and confirm `Continue with Apple` appears next
  to `Continue with Google`.
- Tap `Continue with Apple`, cancel the native sheet, and confirm Settings
  returns quietly with no saved session.
- Complete Apple login and confirm Settings shows authenticated account state
  and no login buttons.
- Test first Apple login where Apple returns full name/email, and repeat login
  where full name and email may be null.
- Test Hide My Email/private relay and confirm login still succeeds.
- Restart the app after Apple login and confirm authenticated state restores.
- Sign out and confirm local transactions/categories remain visible and are not
  backed up, restored, deleted, unlinked, or synced.
- Sign in with Google and Apple accounts that share an email and confirm the
  actual Supabase same-email identity behavior matches the intended product
  decision before release.
- Confirm guest mode still works after signing out.

## ML-69: Delete Account / Privacy Controls v1

- Settings shows a separate `Privacy` section only when the user is
  authenticated.
- Guest/local mode remains available with no login wall and no Delete Account
  UI.
- `Delete Account` is separate from `Sign Out`.
- `Sign Out` behavior remains unchanged and does not call the delete account
  service.
- Tapping `Delete Account` shows a destructive confirmation that says cloud
  account/backup data will be deleted and local transactions/categories on this
  device will stay.
- Cancelling the confirmation does not delete remote data and does not sign
  out.
- Confirming delete removes rows for the authenticated user from
  `public.remote_transactions`, `public.remote_categories`, and
  `public.profiles`, then signs out through the existing auth flow.
- Delete account uses the existing Supabase anon client and authenticated RLS;
  no service-role key is used in mobile app code.
- `public.profiles` has authenticated owner-delete RLS policy coverage.
- Full Supabase Auth `auth.users` hard-delete is out of scope for ML-69 because
  it requires a future Edge Function or other server-side admin path.
- Local SQLite transactions/categories are not deleted, overwritten, unlinked,
  restored, imported, exported, backed up, or otherwise mutated by Delete
  Account.
- After successful delete, the app returns to guest/local mode and existing
  local data remains visible.
- No automatic backup, restore, sync, upload, or remote merge is triggered.
- The running state shows `Deleting account...`.
- Failure copy is generic: `Couldn't delete account. Try again.`
- Settings never renders raw env values, Supabase URL, anon key, provider
  secrets, access tokens, refresh tokens, provider tokens, backend errors, auth
  IDs, owner IDs, local owner IDs, or device IDs during delete account flows.
- CSV v1 remains exactly
  `id,amount,category,isLeak,leakReason,note,createdAt`.
- Bottom tabs remain Home, Analytics & Leaks, and Settings.
- Add Transaction and Shame Card remain pushed root Stack screens and are not
  visible bottom tabs.
- No @expo/ui, SwiftUI wrappers, BlurView, expo-blur, Liquid Glass, or glass
  styling was added.
- `package.json.version` is bumped intentionally to `1.16.0`.
- `package-lock.json` top-level and root package version fields are bumped
  intentionally to `1.16.0`.
- `app.config.js` and `eas.json` are unchanged.
- `npm run release:preflight` passes.
- `npm test -- --runInBand` passes.
- `npm run typecheck` passes.
- `npm run lint` passes.
- `npm run format:check` passes.
- `npx expo config --json` resolves Expo version as `1.16.0`.
- `git diff --check` passes.

Manual owner QA:

- Log in through Google or Apple on a device/build with Supabase auth
  configured.
- Create or confirm local transactions/categories are visible.
- Create a manual backup so remote rows exist for the account.
- Open Settings and confirm `Privacy` and `Delete Account` are visible while
  authenticated.
- Tap `Delete Account`, cancel the confirmation, and confirm no sign out occurs
  and remote rows remain.
- Tap `Delete Account` again, confirm deletion, and verify the account's
  `remote_transactions`, `remote_categories`, and `profiles` rows are removed.
- Confirm the app returns to guest/local mode after deletion.
- Confirm the same local transactions/categories remain visible after delete
  completes.
- Confirm guest Settings does not show `Privacy` or `Delete Account`.
- Confirm `Sign Out` still returns to guest/local mode without deleting remote
  account data.
- Confirm no automatic backup/restore/sync runs during or after deletion.

## ML-70: Full Account Deletion / Supabase Auth User Delete

- Delete Account uses the Supabase `delete-account` Edge Function as the
  server-side deletion boundary.
- The mobile app calls the Edge Function through the existing authenticated
  Supabase anon client and does not contain service-role/admin client usage.
- The Edge Function verifies the request JWT, derives the user id from the
  verified auth context, and ignores any body-provided user id.
- Confirming delete removes rows for the authenticated user from
  `public.remote_transactions`, `public.remote_categories`, and
  `public.profiles`, then deletes the Supabase Auth user.
- If app-owned row deletion fails, the Edge Function does not delete the Auth
  user.
- Delete Account then signs out through the existing auth flow and returns the
  app to guest/local mode.
- Guest/local mode remains available with no login wall and no Delete Account
  UI.
- `Sign Out` behavior remains unchanged and does not call Delete Account or the
  Edge Function.
- Local SQLite transactions/categories are not deleted, overwritten, unlinked,
  restored, imported, exported, backed up, or otherwise mutated by Delete
  Account.
- Manual backup, restore, import, and export do not run during Delete Account.
- Failure copy remains generic: `Couldn't delete account. Try again.`
- UI, tests, docs, and mobile-visible errors do not include real env values,
  Supabase URL, anon key, service-role key, OAuth secrets, provider secrets,
  access tokens, refresh tokens, provider tokens, Apple identity tokens,
  localOwnerId, deviceId, ownerId, or raw backend errors.
- CSV v1 remains exactly
  `id,amount,category,isLeak,leakReason,note,createdAt`.
- Bottom tabs remain Home, Analytics & Leaks, and Settings.
- Add Transaction and Shame Card remain pushed root Stack screens and are not
  visible bottom tabs.
- No @expo/ui, SwiftUI wrappers, BlurView, expo-blur, Liquid Glass, or glass
  styling was added.
- `package.json.version` is bumped intentionally to `1.16.1`.
- `package-lock.json` top-level and root package version fields are bumped
  intentionally to `1.16.1`.
- `app.config.js` and `eas.json` are unchanged.
- `npm run release:preflight` passes.
- `npm test -- --runInBand` passes.
- `npm run typecheck` passes.
- `npm run lint` passes.
- `npm run format:check` passes.
- `npx expo config --json` resolves Expo version as `1.16.1`.
- `git diff --check` passes.

Manual owner deployment and QA:

- Link the local Supabase project if needed with the Supabase CLI.
- Set `MONEY_LEAK_SERVICE_ROLE_KEY` as a Supabase Edge Function secret. Do not
  commit or expose the value:
  `npx supabase secrets set MONEY_LEAK_SERVICE_ROLE_KEY=<service-role-or-secret-key>`
- If any service role/secret key was exposed in code, logs, docs, screenshots,
  or chat, rotate it before deployment.
- Deploy the `delete-account` Edge Function.
- Log in through Google or Apple on a device/build with Supabase auth
  configured.
- Create or confirm local transactions/categories are visible.
- Create a manual backup so remote rows exist for the account.
- Open Settings and confirm `Privacy` and `Delete Account` are visible while
  authenticated.
- Tap `Delete Account`, cancel the confirmation, and confirm no sign out occurs
  and remote rows remain.
- Tap `Delete Account` again, confirm deletion, and verify the account's
  `remote_transactions`, `remote_categories`, and `profiles` rows are removed.
- In Supabase Authentication -> Users, verify the Auth user is deleted.
- Confirm the app returns to guest/local mode after deletion.
- Confirm the same local transactions/categories remain visible after delete
  completes.
- Confirm guest Settings does not show `Privacy` or `Delete Account`.
- Confirm `Sign Out` still returns to guest/local mode without deleting remote
  account data or calling the Edge Function.
- Confirm no automatic backup/restore/sync runs during or after deletion.

## ML-71: Incremental Sync Prototype v1

- `featureFlags.incrementalSyncEnabled` remains `false` by default.
- Incremental sync exists only as a hidden/manual service boundary; no Settings
  Sync UI, automatic background sync, login sync, session-restore sync, app
  start sync, or sign-out sync was added.
- Guest/local mode skips incremental sync safely and remains permanently
  available with no login wall.
- Missing user id, missing Supabase session, and session/user mismatch skip
  incremental sync safely before local or remote mutation.
- Incremental sync uses the existing authenticated Supabase anon client and RLS;
  no service-role/admin client or key is used in mobile app code/config.
- Local sync metadata is stored in `app_metadata` separately from manual backup
  metadata and includes last success, last error, and safe count summary values.
- Pull/apply/push structure covers transactions and categories.
- Remote-only active transactions and categories can be pulled into local
  SQLite without wiping local-only rows.
- Local new/edited transactions are pushed to `remote_transactions`.
- Local transaction tombstones are pushed to `remote_transactions`.
- Remote transaction tombstones soft-delete matching local transactions.
- Remote transaction tombstones with no matching local row do not create visible
  local transactions.
- Local new/edited/archived categories are pushed to `remote_categories`.
- Category tombstones are explicitly not fully supported in ML-71; remote
  category tombstones are ignored safely and counted, while archived categories
  remain resolvable for old transactions.
- Conflicts use deterministic last-write-wins by `updatedAt`; transaction
  tombstones compare `deletedAt` when present, and equal-timestamp differences
  keep the local row.
- `createdAt` and stable IDs are preserved during sync applies.
- Repeated sync does not duplicate remote or local rows.
- `SyncResult` exposes only safe status/count fields and generic recoverable
  failures; it does not return rows, raw backend errors, env values, Supabase
  URL, anon key, service-role key, OAuth/provider secrets, tokens, localOwnerId,
  deviceId, ownerId, or raw user IDs.
- Manual backup, restore, auth, sign out, and delete account behavior remains
  unchanged.
- CSV v1 remains exactly
  `id,amount,category,isLeak,leakReason,note,createdAt`.
- Bottom tabs remain Home, Analytics & Leaks, and Settings.
- Add Transaction and Shame Card remain pushed root Stack screens and are not
  visible bottom tabs.
- No @expo/ui, SwiftUI wrappers, BlurView, expo-blur, Liquid Glass, or glass
  styling was added.
- `package.json.version` is bumped intentionally to `1.16.2`.
- `package-lock.json` top-level and root package version fields are bumped
  intentionally to `1.16.2`.
- `app.config.js` and `eas.json` are unchanged.
- `npm run release:preflight` passes.
- `npm test -- --runInBand` passes.
- `npm run typecheck` passes.
- `npm run lint` passes.
- `npm run format:check` passes.
- `npx expo config --json` resolves Expo version as `1.16.2`.
- `git diff --check` passes.

Manual/dev QA:

- In the default build, confirm no Sync UI appears in Settings and no sync runs
  on app start, login, session restore, sign out, backup, restore, or delete
  account.
- In a dev harness with `incrementalSyncEnabled` enabled, run the manual sync
  service in guest mode and confirm it skips before local/remote mutation.
- In authenticated mode with a Supabase session, create local transactions and
  categories, run manual sync, and confirm rows upsert remotely without
  duplicates.
- Add or edit a remote transaction/category for the same account, run manual
  sync, and confirm it is pulled locally without deleting local-only rows.
- Delete a local transaction, run manual sync, and confirm the remote row becomes
  a tombstone.
- Create a remote transaction tombstone for an existing local row, run manual
  sync, and confirm the local row is soft-deleted.
- Create a remote transaction tombstone for a missing local row, run manual
  sync, and confirm no visible local row appears.
- Archive a category locally, run manual sync, and confirm the remote category
  remains present with `is_archived`.
- Exercise equal and newer timestamp conflicts and confirm local tie-wins and
  newer LWW behavior.
- Confirm UI/logs/tests/docs do not expose raw backend errors, env values,
  Supabase URL, anon key, service-role key, OAuth/provider secrets, tokens,
  localOwnerId, deviceId, ownerId, or raw user IDs.

## ML-72: Manual Sync Now UI v1

- `featureFlags.incrementalSyncEnabled` is `true` for this release.
- Settings shows the `Sync` card only when the user is authenticated and the
  sync flag is enabled.
- Guest/local mode does not show the `Sync` card and cannot trigger sync.
- Tapping `Sync now` runs only the existing manual sync service boundary.
- The button shows `Syncing...` and is disabled while manual sync is running.
- Successful sync shows only safe aggregate pulled, pushed, applied, conflicts,
  and ignored counts.
- Last successful sync time appears as `Last sync:` when existing sync metadata
  provides a valid timestamp.
- Failed, skipped, or thrown sync attempts show only
  `Couldn't sync. Try again.`
- No conflict UI, category tombstone semantics, auto-sync, raw diagnostics UI,
  service-role/admin client, CSV change, backup/restore change, Delete Account
  change, or navigation change was added.
- Sign Out, backup, restore, import/export, Delete Account, app start, login,
  session restore, background behavior, and transaction/category mutations do
  not trigger sync automatically.
- Settings/account/sync UI does not render raw backend errors, env values,
  Supabase URLs, anon keys, service-role keys, OAuth/provider secrets, access
  tokens, refresh tokens, provider tokens, Apple identity tokens, localOwnerId,
  deviceId, ownerId, raw user IDs, or row payloads.
- CSV v1 remains exactly
  `id,amount,category,isLeak,leakReason,note,createdAt`.
- Bottom tabs remain Home, Analytics & Leaks, and Settings.
- Add Transaction and Shame Card remain pushed root Stack screens and are not
  visible bottom tabs.
- No @expo/ui, SwiftUI wrappers, BlurView, expo-blur, Liquid Glass, or glass
  styling was added.
- `package.json.version` is bumped intentionally to `1.17.0`.
- `package-lock.json` top-level and root package version fields are bumped
  intentionally to `1.17.0`.
- `app.config.js` and `eas.json` are unchanged.
- `npm run release:preflight` passes.
- `npm test -- --runInBand` passes.
- `npm run typecheck` passes.
- `npm run lint` passes.
- `npm run format:check` passes.
- `npx expo config --json` resolves Expo version as `1.17.0`.
- `git diff --check` passes.

Manual QA:

- Confirm the owner-completed pre-Codex baseline remains true: Google login
  works, local data remains visible, one transaction exists, manual backup and
  restore were checked, and Sign Out does not delete local data.
- In guest/local mode, open Settings and confirm the `Sync` card is hidden.
- Sign in with Google, open Settings, and confirm the `Sync` card is visible.
- Tap `Sync now` and confirm the button changes to `Syncing...`, then returns
  to `Sync now`.
- Confirm successful sync shows only aggregate counts and, when available,
  `Last sync:`.
- Force a recoverable sync failure or missing session and confirm Settings
  shows only `Couldn't sync. Try again.`
- Tap Sign Out and confirm sync does not run and local data remains visible
  after returning to guest/local mode.
- Run manual backup, restore, and Delete Account flows and confirm they do not
  trigger sync.

## ML-73: Manual Sync Hardening & Cross-Screen Refresh v1

- `package.json.version` is bumped intentionally to `1.17.1`.
- `package-lock.json` top-level and root package version fields are bumped
  intentionally to `1.17.1`.
- `app.config.js` remains unchanged and continues to read
  `package.json.version`.
- Settings still shows the `Sync` card only for authenticated users while
  `featureFlags.incrementalSyncEnabled` is enabled.
- Guest/local mode still does not show the `Sync` card and cannot trigger sync.
- A fast double tap on `Sync now` starts only one manual sync operation.
- A successful manual sync refreshes local transaction and category stores so
  pulled remote changes are visible without restarting the app.
- Failed, skipped, or thrown manual sync attempts show only
  `Couldn't sync. Try again.` and do not run success-only store refresh.
- Existing persisted sync metadata can show `Last sync:` and safe aggregate
  pulled, pushed, applied, conflicts, and ignored counts after Settings reload.
- Missing, invalid, or corrupted sync metadata summary is ignored safely and
  does not render raw values.
- Sign Out, Delete Account, backup, restore, import/export, app start, login,
  session restore, background behavior, and transaction/category mutations do
  not trigger sync automatically.
- CSV v1 remains exactly
  `id,amount,category,isLeak,leakReason,note,createdAt`.
- Bottom tabs remain Home, Analytics & Leaks, and Settings.
- Add Transaction and Shame Card remain pushed root Stack screens and are not
  visible bottom tabs.
- Settings sync UI does not render raw backend errors, env values, Supabase
  URLs, anon keys, service-role keys, OAuth/provider secrets, access tokens,
  refresh tokens, provider tokens, Apple identity tokens, localOwnerId,
  deviceId, ownerId, raw user IDs, or row payloads.
- No @expo/ui, SwiftUI wrappers, BlurView, expo-blur, Liquid Glass, or glass
  styling was added.
- `npm run release:preflight` passes.
- `npm test -- --runInBand` passes.
- `npm run typecheck` passes.
- `npm run lint` passes.
- `npm run format:check` passes.
- `npx expo config --json` resolves Expo version as `1.17.1`.
- `git diff --check` passes.

Manual QA:

- In guest/local mode, open Settings and confirm the `Sync` card is hidden.
- Sign in with Google, open Settings, and confirm the `Sync` card is visible.
- Tap `Sync now` once and confirm the button changes to `Syncing...`, then
  returns to `Sync now`.
- Fast double tap `Sync now` and confirm only one sync operation runs.
- After a successful sync that pulls remote transaction/category changes,
  confirm Home, Analytics, transaction forms, and category-dependent UI show
  the fresh local data without app restart.
- Force a recoverable sync failure or missing session and confirm Settings
  shows only `Couldn't sync. Try again.` with no success summary from that
  attempt.
- Reload Settings after a successful sync and confirm only aggregate summary
  counts appear when valid metadata exists.
- Tap Sign Out and confirm sync does not run and local data remains visible
  after returning to guest/local mode.
- Run manual backup, restore, and Delete Account flows and confirm they do not
  trigger sync.

## ML-74: Incremental Sync Reliability QA + Edge Case Hardening v1

- `package.json.version` is bumped intentionally to `1.17.2`.
- `package-lock.json` top-level and root package version fields are bumped
  intentionally to `1.17.2`.
- `app.config.js` remains unchanged and continues to read
  `package.json.version`.
- Manual incremental sync remains authenticated-only and Settings-only.
- No automatic sync was added on app start, login, session restore, sign out,
  background behavior, or transaction/category add/edit/delete.
- LWW transaction conflicts are deterministic: newer local active rows push,
  newer remote active rows apply, and equal `updatedAt` conflicts preserve the
  local row while counting a conflict.
- Transaction tombstones follow the same timestamp behavior: newer local
  tombstones push, newer remote tombstones soft-delete local active rows, and
  orphan remote tombstones are ignored without creating visible rows.
- Repeated sync does not duplicate local or remote rows.
- Failed pull does not apply local changes or push local rows.
- Failed local apply, failed push, skipped sync, and recoverable failures do
  not write success metadata.
- Successful sync writes `last_successful_incremental_sync_at` and a safe
  aggregate summary only after pull, local apply, and push all complete.
- Corrupted, invalid, negative, or raw-field persisted sync summaries are
  ignored or normalized safely.
- Category active and archived changes apply safely; category tombstones remain
  out of product scope and are only counted/ignored safely.
- Settings sync UI still shows only safe aggregate counts and generic sync
  errors, never raw backend errors, env values, Supabase URLs, anon keys,
  service-role keys, OAuth/provider secrets, access tokens, refresh tokens,
  provider tokens, Apple identity tokens, localOwnerId, deviceId, ownerId, raw
  user IDs, or row payloads.
- CSV v1 remains exactly
  `id,amount,category,isLeak,leakReason,note,createdAt`.
- Bottom tabs remain Home, Analytics & Leaks, and Settings.
- Add Transaction and Shame Card remain pushed root Stack screens and are not
  visible bottom tabs.
- Backup, restore, Sign Out, Delete Account, import/export, auth lifecycle,
  navigation, and visual design remain unchanged.
- No @expo/ui, @expo/ui-swift-ui, BlurView, expo-blur, Liquid Glass, or glass
  styling was added.
- `npm run release:preflight` passes.
- `npm test -- --runInBand` passes.
- `npm run typecheck` passes.
- `npm run lint` passes.
- `npm run format:check` passes.
- `npx expo config --json` resolves Expo version as `1.17.2`.
- `git diff --check` passes.

Manual QA:

- In guest/local mode, open Settings and confirm the `Sync` card is hidden.
- Sign in with Google, open Settings, and confirm the `Sync` card is visible.
- Tap `Sync now` once and confirm the button changes to `Syncing...`, then
  returns to `Sync now`.
- Fast tap `Sync now` repeatedly and confirm only one sync operation runs.
- Add, edit, and delete a transaction locally, then run `Sync now` and confirm
  the expected aggregate pushed/applied counts with no duplicate visible rows.
- On two signed-in devices or simulators, create or edit data on device A,
  sync device A, then sync device B and confirm pull/push sanity.
- Delete a transaction on device A, sync device A, then sync device B and
  confirm the transaction is hidden locally on device B.
- Create a deterministic conflict on two devices and confirm the newer
  `updatedAt` row wins; for equal timestamps, confirm the local row is
  preserved and the conflict count increments.
- Run manual Backup and Restore flows and confirm they still work and do not
  trigger sync automatically.
- Tap Sign Out and confirm local data remains visible after returning to
  guest/local mode.
- Run Delete Account only through the existing confirmation flow and confirm
  local data remains on the device and the flow is not broken.

## ML-75: Foreground Auto Sync v1

- `package.json.version` is bumped intentionally to `1.18.0`.
- `package-lock.json` top-level and root package version fields are bumped
  intentionally to `1.18.0`.
- `app.config.js` remains unchanged and continues to read
  `package.json.version`.
- Authenticated users get an opportunistic foreground sync only when the app
  returns from `background` or `inactive` to `active`.
- Foreground sync skips guest/local mode, missing user id, disabled
  `featureFlags.incrementalSyncEnabled`, recent last successful sync within
  15 minutes, and any already in-flight sync.
- Foreground sync does not run on cold start, login, session restore, sign
  out, background execution, or transaction/category add/edit/delete.
- Successful foreground sync refreshes local transaction and category stores
  after sync succeeds; failed or skipped foreground sync stays silent and does
  not refresh success state.
- Manual Settings `Sync now` remains authenticated-only, unthrottled by the
  foreground 15-minute window, and protected by the shared in-flight sync
  boundary.
- Settings sync UI still shows only safe aggregate counts and generic sync
  errors, never raw backend errors, env values, Supabase URLs, anon keys,
  service-role keys, OAuth/provider secrets, access tokens, refresh tokens,
  provider tokens, Apple identity tokens, localOwnerId, deviceId, ownerId, raw
  user IDs, or row payloads.
- CSV v1 remains exactly
  `id,amount,category,isLeak,leakReason,note,createdAt`.
- Bottom tabs remain Home, Analytics & Leaks, and Settings.
- Add Transaction and Shame Card remain pushed root Stack screens and are not
  visible bottom tabs.
- Backup, restore, Sign Out, Delete Account, import/export, navigation, and
  visual design remain unchanged.
- No @expo/ui, @expo/ui-swift-ui, BlurView, expo-blur, Liquid Glass, or glass
  styling was added.
- `npm run release:preflight` passes.
- `npm test -- --runInBand` passes.
- `npm run typecheck` passes.
- `npm run lint` passes.
- `npm run format:check` passes.
- `npx expo config --json` resolves Expo version as `1.18.0`.
- `git diff --check` passes.

Manual QA:

- In guest/local mode, background and foreground the app and confirm no sync UI
  appears and local add/edit/delete stays available.
- Sign in with Google, run `Sync now` once, then background and foreground the
  app within 15 minutes and confirm no repeated sync batch is observed.
- After 15+ minutes from the last successful sync, background and foreground
  the app and confirm fresh remote changes can appear without tapping
  `Sync now`.
- Force a recoverable network/backend sync failure, return the app to
  foreground, and confirm local add/edit/delete still works with no raw
  diagnostics shown.
- Start a manual `Sync now`, immediately background/foreground the app, and
  confirm only one sync operation runs.
- Tap Sign Out and confirm sync does not run and local data remains visible
  after returning to guest/local mode.
- Add, edit, and delete local transactions/categories and confirm those local
  mutations do not trigger sync until manual sync or a later eligible
  foreground return.
- Recheck CSV import/export, bottom tabs, Add Transaction, Shame Card, Backup,
  Restore, and Delete Account flows.

## ML-76: Sync Status & Cross-device QA Hardening v1

- `package.json.version` is bumped intentionally to `1.18.1`.
- `package-lock.json` top-level and root package version fields are bumped
  intentionally to `1.18.1`.
- `app.config.js` remains unchanged and continues to read
  `package.json.version`.
- Settings shows the `Sync` card only for authenticated users while
  `featureFlags.incrementalSyncEnabled` is enabled.
- Authenticated Settings shows `Auto sync: On` and
  `Runs when you return to the app. Local tracking still works offline.`
- Manual Settings `Sync now` remains available, shows `Syncing...` while
  running, and still uses the existing manual sync service boundary.
- Valid sync metadata can show `Last sync:` plus only aggregate pulled,
  pushed, applied, conflicts, and ignored counts.
- Invalid or corrupted persisted sync summaries are ignored safely and never
  render raw values.
- Failed, skipped, or thrown sync attempts show only
  `Couldn't sync. Try again.`
- No persisted manual/foreground attempt type was added.
- No sync runs on cold start, login, session restore, sign out, background
  execution, or transaction/category add/edit/delete.
- Foreground auto sync remains limited to returning from `background` or
  `inactive` to `active`, throttled by last successful sync metadata, and
  routed through the existing sync service boundary.
- Settings/root lifecycle code does not call Supabase remote sync adapters or
  clients directly.
- Settings sync UI never renders raw env values, Supabase URLs, anon keys,
  service-role keys, OAuth/provider secrets, access tokens, refresh tokens,
  provider tokens, Apple identity tokens, localOwnerId, deviceId, ownerId, raw
  user IDs, row payloads, or raw backend errors.
- CSV v1 remains exactly
  `id,amount,category,isLeak,leakReason,note,createdAt`.
- Bottom tabs remain Home, Analytics & Leaks, and Settings.
- Add Transaction and Shame Card remain pushed root Stack screens and are not
  visible bottom tabs.
- Backup, restore, Sign Out, Delete Account, import/export, auth providers,
  navigation, and visual design remain unchanged.
- No @expo/ui, @expo/ui-swift-ui, BlurView, expo-blur, Liquid Glass, or glass
  styling was added.
- `npm run release:preflight` passes.
- `npm test -- --runInBand` passes.
- `npm run typecheck` passes.
- `npm run lint` passes.
- `npm run format:check` passes.
- `npx expo config --json` resolves Expo version as `1.18.1`.
- `git diff --check` passes.

Manual QA:

- In guest/local mode, open Settings and confirm the `Sync` card is hidden.
- Sign in with Google, open Settings, and confirm the `Sync` card shows
  `Auto sync: On`, foreground-return copy, and `Sync now`.
- Tap `Sync now` and confirm the button changes to `Syncing...`, then returns
  to `Sync now`.
- After a successful sync, reload Settings and confirm `Last sync:` plus only
  aggregate counts are shown.
- On two signed-in devices or simulators, create or edit data on device A,
  sync device A, then return device B to the foreground after the throttle
  window or tap `Sync now` and confirm remote changes appear.
- Delete a transaction on device A, sync device A, then sync or foreground
  device B and confirm the transaction is hidden locally on device B.
- Force a recoverable sync failure and confirm Settings shows only
  `Couldn't sync. Try again.` with no raw diagnostics.
- Background/foreground within 15 minutes of the last successful sync and
  confirm no repeated foreground sync batch is observed.
- Add, edit, and delete local transactions/categories and confirm those local
  mutations do not trigger sync until manual sync or a later eligible
  foreground return.
- Recheck CSV import/export, bottom tabs, Add Transaction, Shame Card, Backup,
  Restore, Delete Account, Sign Out, and local guest mode.

## ML-77: Sync Attempt Source Metadata v1

- `package.json.version` is bumped intentionally to `1.18.2`.
- `package-lock.json` top-level and root package version fields are bumped
  intentionally to `1.18.2`.
- `app.config.js` remains unchanged and continues to read
  `package.json.version`.
- Incremental sync calls now pass an explicit safe source: `manual` from
  Settings `Sync now` and `foreground` from foreground auto sync.
- Successful sync metadata persists only the safe source enum separately from
  the aggregate-only sync summary.
- Unknown or corrupted stored sync source values are ignored safely.
- Settings shows `Last sync: <date> · Manual` or
  `Last sync: <date> · Auto` only when both timestamp and source are valid.
- Settings falls back to the old `Last sync:` copy when source is missing or
  invalid.
- Failed, skipped, or thrown sync attempts still show only
  `Couldn't sync. Try again.`
- Guest/local mode still hides the Sync card and cannot trigger sync.
- No sync runs on cold start, login, session restore, sign out, background
  execution, or transaction/category add/edit/delete.
- Foreground auto sync remains limited to returning from `background` or
  `inactive` to `active`, throttled by last successful sync metadata, and
  routed through the existing sync service boundary.
- Settings/root lifecycle code does not call Supabase remote sync adapters or
  clients directly.
- Settings sync UI never renders raw env values, Supabase URLs, anon keys,
  service-role keys, OAuth/provider secrets, access tokens, refresh tokens,
  provider tokens, Apple identity tokens, localOwnerId, deviceId, ownerId, raw
  user IDs, row payloads, or raw backend errors.
- CSV v1 remains exactly
  `id,amount,category,isLeak,leakReason,note,createdAt`.
- Bottom tabs remain Home, Analytics & Leaks, and Settings.
- Add Transaction and Shame Card remain pushed root Stack screens and are not
  visible bottom tabs.
- No @expo/ui, @expo/ui-swift-ui, BlurView, expo-blur, Liquid Glass, or glass
  styling was added.
- `npm run release:preflight` passes.
- `npm test -- --runInBand` passes.
- `npm run typecheck` passes.
- `npm run lint` passes.
- `npm run format:check` passes.
- `npx expo config --json` resolves Expo version as `1.18.2`.
- `git diff --check` passes.

Manual QA:

- In guest/local mode, open Settings and confirm the `Sync` card is hidden.
- Sign in, tap `Sync now`, and confirm Settings later shows
  `Last sync: ... · Manual`.
- After the foreground throttle window, background/foreground the app and
  confirm Settings later can show `Last sync: ... · Auto`.
- Corrupt or unknown stored source should fall back to plain `Last sync:` with
  no source label.
- Force a sync failure and confirm Settings shows only
  `Couldn't sync. Try again.` with no raw diagnostics.
- Add, edit, and delete local transactions/categories and confirm those local
  mutations do not trigger sync until manual sync or a later eligible
  foreground return.
- Recheck CSV import/export, bottom tabs, Add Transaction, Shame Card, Backup,
  Restore, Delete Account, Sign Out, and local guest mode.

## ML-78: Privacy / App Store Review Readiness v1

- `package.json.version` is bumped intentionally to `1.18.3`.
- `package-lock.json` top-level and root package version fields are bumped
  intentionally to `1.18.3`.
- `app.config.js` remains unchanged and continues to read
  `package.json.version`.
- Settings shows `Privacy & Support` in guest/local mode without a login wall.
- Settings shows `Privacy & Support` for authenticated users.
- `Privacy Policy` opens
  `https://www.notion.so/quitesocial/35357a24e62c804dab18c28d24a6c75a?showMoveTo=true&saveParent=true`.
- `Support` opens `mailto:asrazdorskiy@gmail.com`.
- If a legal/support link cannot open, Settings shows only generic safe copy:
  `Couldn't open this link right now.`
- Sign Out remains separate from Delete Account and still preserves local data.
- Delete Account still deletes app-owned cloud account data through the
  existing service boundary, then signs out, while local data stays on device.
- Backup, Restore, and Sync still work through their existing Settings service
  boundaries.
- Settings does not render raw env values, Supabase URLs, anon keys,
  service-role keys, OAuth/provider secrets, access tokens, refresh tokens,
  provider tokens, Apple identity tokens, localOwnerId, deviceId, ownerId, raw
  user IDs, row payloads, or raw backend errors.
- Bottom tabs remain Home, Analytics & Leaks, and Settings.
- Add Transaction and Shame Card remain pushed root Stack screens and are not
  visible bottom tabs.
- CSV v1 remains exactly
  `id,amount,category,isLeak,leakReason,note,createdAt`.
- No @expo/ui, @expo/ui-swift-ui, BlurView, expo-blur, Liquid Glass, or glass
  styling was added.
- `docs/privacy-policy-update-draft.md` exists as a product/engineering patch
  draft for the existing Notion policy, not a replacement policy.
- `docs/app-store-privacy-checklist.md` exists and covers owner App Store
  privacy submission checks.
- `npm run release:preflight` passes.
- `npm test -- --runInBand` passes.
- `npm run typecheck` passes.
- `npm run lint` passes.
- `npm run format:check` passes.
- `npx expo config --json` resolves Expo version as `1.18.3`.
- `git diff --check` passes.

Manual QA:

- In guest/local mode, open Settings and confirm `Privacy & Support`, `Privacy
Policy`, and `Support` are visible without forcing sign-in.
- Sign in and confirm `Privacy & Support`, `Privacy Policy`, and `Support`
  remain visible.
- Tap `Privacy Policy` and confirm the configured Notion URL opens.
- Tap `Support` and confirm the mail client opens for
  `asrazdorskiy@gmail.com`.
- Force a link-open failure and confirm Settings shows only
  `Couldn't open this link right now.` with no raw technical details.
- Tap Sign Out and confirm local data remains on device.
- Run Delete Account through the existing confirmation flow and confirm cloud
  account deletion/sign-out behavior while local data remains on device.
- Recheck Backup, Restore, Sync, CSV import/export, bottom tabs, Add
  Transaction, Shame Card, and local guest mode.

## ML-79: Loading Screen / Native Splash Screen v1

- `package.json.version` is bumped intentionally to `1.18.4`.
- `package-lock.json` top-level and root package version fields are bumped
  intentionally to `1.18.4`.
- `app.config.js` remains unchanged and continues to read
  `package.json.version`.
- `expo-splash-screen` is installed as the only new splash/loading dependency.
- Expo config uses the `expo-splash-screen` config plugin with
  `./assets/images/splash-logo.png`.
- `assets/images/splash-logo.png` is a transparent PNG containing only the
  Money Leak droplet and wordmark, without a background fill.
- Native splash background is configured as `#E5E5EA`.
- Preview/production build shows the Money Leak splash, not the generic Expo
  splash.
- Logo and `Money Leak` wordmark are visually centered and close to the Figma
  reference.
- No white or black flash appears between native splash and app startup, as far
  as can be verified manually.
- The app opens normally after the splash.
- Guest/local mode still works.
- Authenticated mode still works.
- Settings Auth, Backup, Restore, Sync, and Delete Account smoke checks still
  pass.
- Bottom tabs remain Home, Analytics & Leaks, and Settings.
- Add Transaction and Shame Card remain pushed root Stack screens and are not
  visible bottom tabs.
- CSV v1 remains exactly
  `id,amount,category,isLeak,leakReason,note,createdAt`.
- No auth, sync, backup, restore, delete-account, or navigation runtime
  behavior changed.
- No service-role/admin Supabase usage was added to mobile app code/config.
- No @expo/ui, @expo/ui-swift-ui, BlurView, expo-blur, Liquid Glass, or glass
  styling was added.
- Expo Go/dev build is not treated as the main source of truth for splash QA;
  verify the splash in a preview/production standalone build.
- `npm run release:preflight` passes.
- `npm test -- --runInBand` passes.
- `npm run typecheck` passes.
- `npm run lint` passes.
- `npm run format:check` passes.
- `npx expo config --json` resolves Expo version as `1.18.4` and splash config
  without raw secret/env/token values.
- `git diff --check` passes.

Manual QA:

- Install a preview or production build.
- Launch the app cold and confirm the centered Money Leak droplet and wordmark
  appear on `#E5E5EA`.
- Confirm the splash is not the generic Expo icon/splash.
- Confirm the transition into the app does not show an obvious white or black
  flash.
- Confirm the app reaches the expected guest or authenticated startup state.
- Open Home, Analytics & Leaks, and Settings.
- Open Add Transaction from Home and confirm it is pushed outside the bottom
  tab bar.
- Open Shame Card from Analytics and confirm it is pushed outside the bottom
  tab bar.
- Smoke-test Settings Auth, Backup, Restore, Sync, Delete Account, and guest
  mode.

## ML-80: Clean App Icon

- `package.json.version` is bumped intentionally to `1.18.5`.
- `package-lock.json` top-level and root package version fields are bumped
  intentionally to `1.18.5`.
- `app.config.js` remains unchanged and continues to read
  `package.json.version`.
- Expo config resolves the global app icon path to
  `./assets/images/icon.png`.
- Expo config resolves the iOS app icon path to `./assets/images/icon.png`.
- Expo config resolves the Android adaptive foreground image path to
  `./assets/images/adaptive-icon.png`.
- Expo splash config still points to `./assets/images/splash-logo.png`.
- `assets/images/icon.png` is a 1024x1024 PNG without alpha/transparency.
- `assets/images/icon.png` has a full-square background, no baked rounded
  corners, and no unwanted white/light border, halo, stroke, or shadow around
  the droplet.
- `assets/images/adaptive-icon.png` is a 1024x1024 PNG with transparent
  background and droplet-only foreground for Android adaptive icons.
- iOS Home Screen icon has no unwanted border/halo.
- App Library icon looks clean.
- TestFlight/App Store installed app uses the new icon after reinstall/update.
- Splash from ML-79 still shows the centered Money Leak droplet and wordmark on
  `#E5E5EA`.
- The app opens normally.
- Guest/local mode still works.
- Authenticated Settings smoke test passes when authenticated mode is
  available.
- CSV v1 remains exactly
  `id,amount,category,isLeak,leakReason,note,createdAt`.
- Bottom tabs remain Home, Analytics & Leaks, and Settings.
- Add Transaction and Shame Card remain pushed root Stack screens and are not
  visible bottom tabs.
- No auth, sync, backup, restore, delete-account, or navigation runtime
  behavior changed.
- No service-role/admin Supabase usage was added to mobile app code/config.
- No dynamic `process.env[...]` access was added in `src` or `app`.
- No @expo/ui, @expo/ui-swift-ui, BlurView, expo-blur, Liquid Glass, or glass
  styling was added.
- `npm run release:preflight` passes.
- `npm test -- --runInBand` passes.
- `npm run typecheck` passes.
- `npm run lint` passes.
- `npm run format:check` passes.
- `npx expo config --json` resolves Expo version as `1.18.5` and the expected
  icon/splash paths.
- `git diff --check` passes.

Manual QA:

- Install or update a TestFlight or production-style iOS build.
- Confirm the iPhone Home Screen icon has no unwanted border, light stroke,
  glow, or halo.
- Confirm the App Library icon also looks clean.
- Confirm TestFlight/App Store installed app uses the new icon after
  reinstall/update.
- Confirm the ML-79 splash still shows the centered Money Leak droplet and
  wordmark on `#E5E5EA`.
- Confirm the app opens normally.
- Smoke-test guest/local mode.
- Smoke-test authenticated Settings if available.

## ML-81: Add Transaction Wizard

- `package.json.version` is bumped intentionally to `1.19.0`.
- `package-lock.json` top-level and root package version fields are bumped
  intentionally to `1.19.0`.
- `app.config.js` remains unchanged and continues to read
  `package.json.version`.
- Add Transaction remains `/add-transaction` as a pushed root Stack screen, not
  a bottom tab.
- Bottom tabs remain exactly Home, Analytics & Leaks, and Settings.
- Shame Card remains a pushed root Stack screen, not a bottom tab.
- Add Transaction opens with amount focused and accepts decimal dot or a single
  decimal comma value.
- Normal add flow saves amount, selected date, Normal type, and selected active
  category.
- Leak add flow requires a reason before continuing and saves the selected
  reason.
- Switching Leak back to Normal clears the leak reason before save.
- Date selection is saved to `Transaction.createdAt` and displays safely on
  Home and Analytics.
- Category is required before saving.
- Archived categories do not appear in the new Add Transaction category
  selector.
- Add Category from Add Transaction is name-only.
- No Add Category icon picker/grid is visible in ML-81.
- No category icon persistence, icon field, icon validation, SQLite migration,
  sync contract, backup contract, remote schema, or CSV field is added.
- A newly created category appears in the Category step, can be selected or
  auto-selected, and can be used to create a transaction.
- Duplicate and invalid Add Category names show the existing category
  validation behavior.
- Internal bottom secondary actions move back through wizard steps.
- Header/root back exits Add Transaction safely; Add Category header back
  returns to the Category step.
- Edit Transaction still uses the existing edit form, remains focused on the
  amount field, and still handles archived current categories safely.
- Home summary/history refreshes after saving a new transaction.
- Analytics reflects a new normal or leak transaction after save.
- Manage Categories still works.
- CSV v1 remains exactly
  `id,amount,category,isLeak,leakReason,note,createdAt`.
- No auth, sync, backup, restore, delete-account, Supabase migration, RLS,
  remote schema, app icon, splash, or release workflow behavior changed.
- No service-role/admin Supabase usage was added to mobile app code/config.
- No raw env values, secrets, tokens, or raw IDs are exposed in UI, logs, or
  docs.
- No @expo/ui, @expo/ui-swift-ui, BlurView, expo-blur, Liquid Glass, glass
  styling, or new dependency was added.
- `npm run release:preflight` passes.
- `npm test -- --runInBand` passes.
- `npm run typecheck` passes.
- `npm run lint` passes.
- `npm run format:check` passes.
- `npx expo config --json` resolves Expo version as `1.19.0`.
- `git diff --check` passes.

Manual QA:

- Open Add Transaction from Home and confirm it is pushed outside the bottom
  tab bar.
- Enter a normal amount, leave/change the date, tap Normal, choose a category,
  and save.
- Confirm Home summary/history and Analytics reflect the normal transaction.
- Enter a leak amount, tap Leak, try Next without a reason, and confirm the
  reason-required error.
- Choose a leak reason, choose a category, save, and confirm Home/Analytics
  reflect the leak reason.
- Start a Leak, choose a reason, switch to Normal, save, and confirm no leak
  reason is stored or displayed.
- Try saving from Category without selecting a category and confirm validation.
- Archive a category in Manage Categories and confirm it no longer appears in
  Add Transaction while old transactions still display safely elsewhere.
- From Category, tap Add, create a name-only category, and confirm it appears
  in the Category step.
- Use the newly created category to save a transaction and confirm Home and
  Analytics show the category display name.
- Try empty and duplicate Add Category names and confirm existing validation
  copy appears.
- Confirm Add Category shows no icon optional row, icon picker, or icon grid.
- Confirm internal back returns to the previous wizard step and root/header
  back exits safely.
- Smoke-test Edit Transaction amount autofocus, category selection, archived
  current category display, and save behavior.
- Smoke-test bottom tabs, Shame Card, Manage Categories, CSV import/export,
  Settings Auth, Backup, Restore, Sync, Delete Account, app icon, and splash.

## ML-81.5: Add Transaction Category Icons Picker

- `package.json.version` is bumped intentionally to `1.20.0`.
- `package-lock.json` top-level and root package version fields are bumped
  intentionally to `1.20.0`.
- Existing default categories show persisted category icons in the Add
  Transaction Category step.
- Category options render inline icons before the category name, without inner
  circular containers.
- Home History transaction rows show the transaction category icon before the
  category name.
- Add Category from Add Transaction initially shows a single circular plus
  button under `Icon (optional)`.
- Tapping the plus button expands the icon picker grid.
- The expanded icon picker renders five circular icon buttons per row.
- Tapping an icon shows a visible selected state.
- Saving a new category persists the selected `iconName`.
- The newly created category returns to the Category step, appears with its
  selected icon, and is auto-selected.
- Manage Categories in Settings uses the same collapsed-plus icon picker when
  creating or editing a category.
- Editing a category in Manage Categories can change and persist `iconName`
  without changing transaction category IDs.
- Restarting the app preserves category icons.
- Legacy/custom categories without icon data render a safe fallback icon.
- Normal and Leak transaction creation still save successfully.
- `Transaction.category` still stores only the stable category ID, not display
  name or icon.
- Edit Transaction still uses the shared TransactionForm.
- Manage Categories still works with the new local category field.
- CSV v1 remains exactly
  `id,amount,category,isLeak,leakReason,note,createdAt`.
- No auth, sync, backup, restore, delete-account, Supabase remote migration,
  RLS, remote schema, CSV format, bottom-tab, or pushed-screen behavior changed.
- No service-role/admin Supabase usage was added to mobile app code/config.
- No raw env values, secrets, tokens, or raw IDs are exposed in UI, logs, or
  docs.
- No @expo/ui, @expo/ui-swift-ui, BlurView, expo-blur, Liquid Glass, glass
  styling, or new dependency was added.
- `npm run release:preflight` passes.
- `npm test -- --runInBand` passes.
- `npm run typecheck` passes.
- `npm run lint` passes.
- `npm run format:check` passes.
- `npx expo config --json` resolves Expo version as `1.20.0`.
- `git diff --check` passes.

Manual QA:

- Open Add Transaction from Home and confirm default categories show inline
  icons in the Category step.
- From Category, tap Add and confirm Add Category initially shows only the
  circular plus button under `Icon (optional)`.
- Tap the plus button and confirm the picker expands into a five-column
  circular icon grid.
- Enter a valid category name, select an icon, and confirm the selected icon
  state is visible.
- Save the category and confirm it returns to Category, appears with the chosen
  icon, and is auto-selected.
- Save a transaction with the new category and confirm Home History shows its
  chosen category icon before the category name.
- Open Settings > Manage Categories, create a category, tap the circular plus
  button, select an icon, and confirm the category saves with that icon.
- Edit that category from Manage Categories, pick a different icon, save, and
  confirm Home History/category lists show the updated icon while old
  transactions still keep the same category ID.
- Force quit/restart the app and confirm category icons persist.
- Save one normal transaction and one leak transaction, then confirm Home and
  Analytics still display them safely.
- Confirm old/legacy categories without icon data render with a fallback icon
  and do not crash.
- Confirm CSV import/export still uses the v1 header and category ID value.
- Smoke-test Edit Transaction, Manage Categories, bottom tabs, Shame Card,
  Settings Auth, Backup, Restore, Sync, Delete Account, app icon, and splash.

## App Boot And Empty State

### 1. First app launch / empty DB

**Preconditions**

- App is installed with no existing local transaction data.

**Steps**

1. Launch the app for the first time.
2. Wait for the initial loading state to finish.
3. Open `Home`.
4. Open `Analytics`.
5. Open `Shame Card`.

**Expected result**

- App loads without crashing.
- Home shows the empty state with no transactions.
- Today summary shows `0.00€` total spent, `0.00€` total leaks, and `0%` leak percentage.
- Analytics shows the empty state for no transactions.
- Shame Card shows the empty state for no transactions.

## Add Transaction

### 2. Add a normal transaction

**Preconditions**

- App is running.
- There are no blocking store/database errors on screen.

**Steps**

1. Open `Add Transaction`.
2. Enter `12.50` as the amount.
3. Select any category.
4. Leave the type as `Normal`.
5. Tap `Save Transaction`.

**Expected result**

- Save succeeds without validation errors.
- App returns to `Home`.
- New transaction appears at the top of the list.
- Transaction shows the selected category, formatted amount, and `Normal` badge.
- Leak-only fields are not shown for this transaction.

### 3. Add a leak transaction

**Preconditions**

- App is running.

**Steps**

1. Open `Add Transaction`.
2. Enter `18.40` as the amount.
3. Select any category.
4. Switch type to `Leak`.
5. Select a leak reason.
6. Enter an optional note such as `Late-night impulse`.
7. Tap `Save Transaction`.

**Expected result**

- Save succeeds without validation errors.
- App returns to `Home`.
- New transaction appears at the top of the list.
- Transaction shows the `Leak` badge.
- Leak reason is shown.
- Note is shown when one was entered.
- Today summary updates total spent, total leaks, and leak percentage when the new transaction is from today.

### 4. Validation for missing amount

**Preconditions**

- App is on `Add Transaction`.

**Steps**

1. Leave amount empty.
2. Select any category.
3. Tap `Save Transaction`.

**Expected result**

- Amount field shows `Enter an amount.`
- Transaction is not saved.
- Screen stays on `Add Transaction`.

### 5. Validation for invalid amount

**Preconditions**

- App is on `Add Transaction`.

**Steps**

1. Enter a non-numeric value such as `abc`.
2. Select any category.
3. Tap `Save Transaction`.
4. Replace the value with `0`.
5. Tap `Save Transaction` again.

**Expected result**

- Non-numeric value shows `Use a number like 12.50.`
- Zero shows `Amount must be greater than 0.`
- Transaction is not saved in either case.

### 6. Validation for leak without leak reason

**Preconditions**

- App is on `Add Transaction`.

**Steps**

1. Enter a valid amount.
2. Select any category.
3. Switch type to `Leak`.
4. Do not select a leak reason.
5. Tap `Save Transaction`.

**Expected result**

- Leak reason field shows `Choose why this felt like a leak.`
- Transaction is not saved.

### 7. Switching Leak -> Normal clears leak-only fields

**Preconditions**

- App is on `Add Transaction`.

**Steps**

1. Enter a valid amount.
2. Select any category.
3. Switch type to `Leak`.
4. Select a leak reason.
5. Enter a note.
6. Switch type back to `Normal`.
7. Save the transaction.

**Expected result**

- Leak reason chips and note field disappear after switching back to `Normal`.
- Saved transaction is marked `Normal`.
- Saved transaction does not display a leak reason or note that came from the leak-only fields.

## Edit Transaction

### 8. Edit a normal transaction preserves identity and original timestamp

**Preconditions**

- At least one normal transaction exists on `Home`.

**Steps**

1. Open `Home`.
2. Pick a normal transaction and note its current amount, category, and timestamp.
3. Swipe the transaction left and tap the green edit action.
4. Change the amount.
5. Change the category.
6. Tap `Save Changes`.

**Expected result**

- Save succeeds without validation errors.
- App returns to `Home`.
- The edited transaction shows the new amount and category.
- The transaction keeps the same `id` and `createdAt`; in-app this means no duplicate transaction appears, the original timestamp stays the same, and sort order still matches the original creation time.

### 9. Edit a transaction to update leak fields

**Preconditions**

- At least one existing transaction is present.

**Steps**

1. Open `Home`.
2. Pick any transaction, swipe it left, and tap the green edit action.
3. Change the amount.
4. Change the category.
5. Switch type to `Leak`.
6. Select a leak reason.
7. Enter a note such as `Impulse snack run`.
8. Tap `Save Changes`.

**Expected result**

- Save succeeds without validation errors.
- App returns to `Home`.
- The edited transaction shows the new amount and category.
- The transaction now shows the `Leak` badge.
- Leak reason and note are shown with the updated values.
- Editing updates `amount`, `category`, `isLeak`, `leakReason`, and `note` for the saved transaction.

### 10. Switching Leak -> Normal clears leak-only fields on edit

**Preconditions**

- At least one leak transaction exists with a leak reason.

**Steps**

1. Open `Home`.
2. Pick a leak transaction, swipe it left, and tap the green edit action.
3. Confirm a leak reason is selected.
4. Enter or update the note field.
5. Switch type to `Normal`.
6. Tap `Save Changes`.

**Expected result**

- Leak reason chips and note field disappear after switching back to `Normal`.
- Save succeeds and returns to `Home`.
- Saved transaction is marked `Normal`.
- Saved transaction does not display a leak reason or note from the previous leak-only fields.

### 11. Today summary recalculates after edit

**Preconditions**

- At least one today-dated transaction exists on `Home`.

**Steps**

1. Open `Home`.
2. Note the current Today summary values.
3. Swipe any transaction left and tap the green edit action.
4. Change the amount and, if useful for verification, change the type between `Normal` and `Leak`.
5. Tap `Save Changes`.

**Expected result**

- App returns to `Home` after saving.
- The edited transaction card shows the updated values.
- Today summary `Total`, `Leak`, and `Leak %` recalculate immediately based on the edited today-dated transaction data.

### 12. Analytics reflects edited transaction data

**Preconditions**

- At least one transaction has been edited in the current session.

**Steps**

1. Edit a transaction so that it changes amount, category, type, or leak details.
2. After saving, open `Analytics`.
3. Review the summary card.
4. Review any visible metric cards or empty states.

**Expected result**

- Analytics reflects the latest edited transaction data without requiring app restart.
- Summary values match the current transaction list.
- Leak-related metric cards or no-leaks states update to match the post-edit data.

### 13. Add Transaction regression after shared form reuse

**Preconditions**

- App is running.

**Steps**

1. Re-run `Add Transaction` cases `2` through `7` without changing their steps.

**Expected result**

- Add Transaction behavior is unchanged after the Edit Transaction work.
- Normal and leak saves still work.
- Existing add-form validation and leak-field clearing behavior still match this checklist.

## Home

### 14. Home History item rendering

**Preconditions**

- At least one normal transaction and one leak transaction exist.

**Steps**

1. Open `Home`.
2. Review the `History` list.

**Expected result**

- History uses the selected period filter and renders transactions in descending `createdAt` order, newest first.
- Each item shows formatted amount, category display name, date/time, and `Normal` or `Leak` state.
- Leak transactions use subtle leak styling and show leak reason and note when present.
- Normal transactions use normal styling and do not show leak-only details.

### 15. Today summary recalculation

**Preconditions**

- At least one existing transaction is present.

**Steps**

1. Note the current Today summary values on `Home`.
2. Add one new normal transaction.
3. Add one new leak transaction.
4. Return to `Home` after each save.

**Expected result**

- Today summary `Total` increases by the sum of both new today-dated amounts.
- Today summary `Leak` increases only by the leak transaction amount.
- Today summary `Leak %` recalculates after each change.

### 16. Delete confirmation cancel

**Preconditions**

- At least one transaction exists on `Home`.

**Steps**

1. Swipe any transaction right and tap the red delete action.
2. In the confirmation alert, tap `Cancel`.

**Expected result**

- Transaction remains in the list.
- No loading or deleting state remains stuck on screen.
- Today summary and History values do not change.

### 17. Delete confirmation confirm

**Preconditions**

- At least one transaction exists on `Home`.

**Steps**

1. Swipe any transaction right and tap the red delete action.
2. In the confirmation alert, tap `Delete`.

**Expected result**

- Deleted transaction is removed from the list.
- Today summary recalculates after deletion completes when the deleted transaction was dated today.
- History recalculates for the selected period.
- Delete action closes after completion.

### 18. Deleting last transaction

**Preconditions**

- Exactly one transaction exists in local data.

**Steps**

1. Open `Home`.
2. Delete the final remaining transaction and confirm.
3. Open `Analytics`.
4. Open `Shame Card`.

**Expected result**

- Home returns to the empty state.
- Today summary returns to zero values.
- Analytics returns to the empty state.
- Shame Card returns to the empty state.

## Analytics

### 19. Analytics empty state

**Preconditions**

- Local transaction data is empty.

**Steps**

1. Open `Analytics`.

**Expected result**

- Empty-state copy is shown.
- No `Brutal insight` card is shown.
- No `Next move` card is shown.
- Screen does not crash.
- Summary values remain zero.

### 20. Analytics with only normal transactions

**Preconditions**

- At least one normal transaction exists.
- No leak transactions exist.

**Steps**

1. Open `Analytics`.

**Expected result**

- Summary reflects total spending and `0.00€` total leaks.
- `Leak percentage` shows `0%`.
- `No leaks yet` state is shown.
- Top leak cards, `Brutal insight` card, and `Next move` card are not shown.

### 21. Analytics with leak transactions

**Preconditions**

- At least two leak transactions exist.
- Leak data covers enough cases to generate category/reason/time groupings.

**Steps**

1. Open `Analytics`.
2. Review the summary card.
3. Review the `Brutal insight` card.
4. Review the `Next move` card.
5. Review the metric cards.
6. Change the underlying leak data so the dominant pattern changes.
7. Re-open or refresh `Analytics`.

**Expected result**

- Summary values match current transaction data.
- `Brutal insight` appears when leak transactions exist.
- `Next move` appears when leak transactions exist.
- `Brutal insight` changes when the leak pattern changes.
- `Next move` changes when the leak pattern changes.
- `Brutal insight` stays above `Next move`.
- Metric cards show top leak category, top leak reason, peak leak weekday, and peak leak hour when data exists.
- Analytics renders without crashing while showing the insight cards.

## Shame Card

### 22. Shame Card empty state

**Preconditions**

- Local transaction data is empty.

**Steps**

1. Open `Shame Card`.

**Expected result**

- Empty-state copy is shown.
- No preview card is shown.
- Share button is not shown.

### 23. Shame Card no-leaks state

**Preconditions**

- At least one normal transaction exists.
- No leak transactions exist.

**Steps**

1. Open `Shame Card`.

**Expected result**

- `No leaks yet` state is shown.
- Preview card is not shown.
- Share button is not shown.

### 24. Shame Card with leaks

**Preconditions**

- At least one leak transaction exists.

**Steps**

1. Open `Shame Card`.
2. Review the preview content.

**Expected result**

- Preview card is shown.
- Card includes a title, total leaks line, verdict, and any available top-category or peak-time lines.
- Screen does not crash when preview is rendered.

### 25. Shame Card tone switching

**Preconditions**

- At least one leak transaction exists.
- Shame Card preview is visible.

**Steps**

1. Open `Shame Card`.
2. Tap `Soft`.
3. Tap `Harsh`.
4. Tap `Unfiltered`.

**Expected result**

- Selected tone chip updates visually each time.
- Preview title and verdict change with the selected tone.
- No other leak data is lost while switching tone.

### 26. Share button visibility rules

**Preconditions**

- Ability to create both normal and leak test data.

**Steps**

1. Verify `Shame Card` with no transactions.
2. Verify `Shame Card` with only normal transactions.
3. Verify `Shame Card` with at least one leak transaction and no blocking error state.

**Expected result**

- Share button is hidden when there are no transactions.
- Share button is hidden when there are transactions but no leaks.
- Share button is visible only when the shame card preview is available for leak data.

### 27. Share action success path

**Preconditions**

- Test on a native device or simulator where sharing is available.
- At least one leak transaction exists.
- Shame Card preview and Share button are visible.

**Steps**

1. Open `Shame Card`.
2. Tap `Share`.
3. Wait for the platform share sheet.

**Expected result**

- Button changes to `Sharing...` while the share action is in flight.
- Native share sheet opens with the shame card image.
- App stays responsive after dismissing or completing the share sheet.
- No error message is shown on success.

### 28. Share unavailable/error path

**Preconditions**

- Use a runtime where sharing is unavailable, or simulate a capture/share failure if the environment allows it.
- At least one leak transaction exists.

**Steps**

1. Open `Shame Card`.
2. Tap `Share`.

**Expected result**

- If sharing is unavailable, the screen shows `Sharing is not available on this device.`
- If capture or share fails for another reason, the screen shows `Could not share the shame card. Try again.`
- App does not crash.
- Share button returns from `Sharing...` to its normal state after the failure.

## Settings / Data Export

### 29. Export CSV with an empty database

**Preconditions**

- Test on a native device or simulator where sharing is available.
- Local transaction data is empty.

**Steps**

1. Open `Settings`.
2. In the `Data` section, tap `Export CSV`.
3. Wait for the native share sheet.
4. Open the generated CSV in any available preview target if the platform allows it.

**Expected result**

- `Export CSV` changes to `Exporting...` while the export is in flight.
- Native share sheet opens with a CSV file named like `money-leak-transactions-YYYY-MM-DD.csv`.
- The CSV contains only the header row: `id,amount,category,isLeak,leakReason,note,createdAt`.
- App stays responsive after dismissing or completing the share sheet.

### 30. Export CSV with normal and leak transactions

**Preconditions**

- Test on a native device or simulator where sharing is available.
- At least one normal transaction and one leak transaction exist.

**Steps**

1. Open `Settings`.
2. Tap `Export CSV`.
3. Open the generated CSV in any available preview target if the platform allows it.

**Expected result**

- Native share sheet opens with the CSV file.
- CSV columns appear in this exact order: `id,amount,category,isLeak,leakReason,note,createdAt`.
- Each transaction is exported on its own row in newest-first order.
- Normal transactions export `isLeak` as `false` with empty `leakReason` and empty `note` when those values are null.
- Leak transactions export `isLeak` as `true`, include the saved `leakReason`, and preserve any saved note.
- `createdAt` values are ISO date strings.

### 31. Export CSV escapes commas, quotes, and newlines

**Preconditions**

- Test on a native device or simulator where sharing is available.
- At least two transactions exist whose notes collectively cover commas, double quotes, LF newlines, CRLF newlines, and embedded multi-line content.
- If useful, import `docs/qa-fixtures/valid-money-leak.csv` and `docs/qa-fixtures/valid-crlf.csv` first to create the data before exporting it again.

**Steps**

1. Open `Settings`.
2. Tap `Export CSV`.
3. Open the generated CSV in any available preview target if the platform allows it.

**Expected result**

- Native share sheet opens without crashing.
- Fields containing commas, quotes, LF newlines, CRLF newlines, or embedded multi-line content are wrapped in quotes.
- Embedded quotes are doubled inside the quoted CSV field.
- Line breaks inside notes stay inside the same CSV field instead of shifting later columns.

### 32. Export CSV loading state

**Preconditions**

- App has just launched, or `Settings` is the first tab opened in the session.

**Steps**

1. Open `Settings` immediately after launch.
2. Review the `Data` section before transaction loading settles.
3. Wait for loading to complete.
4. Tap `Export CSV`.

**Expected result**

- The `Data` section shows `Preparing your local transaction history for import and export…` while transaction data is still initializing.
- `Export CSV` is disabled until transaction loading finishes.
- Once loading finishes, `Export CSV` becomes enabled.
- Tapping the button changes the label to `Exporting...` until the export flow finishes.

### 33. Export CSV unavailable/error path

**Preconditions**

- Use a runtime where sharing is unavailable, or simulate a file/share failure if the environment allows it.

**Steps**

1. Open `Settings`.
2. Tap `Export CSV`.

**Expected result**

- If sharing is unavailable, the screen shows `Sharing is not available on this device.`
- If CSV file creation or sharing fails for another reason, the screen shows `Couldn't export transactions. Try again.`
- App does not crash.
- The button returns from `Exporting...` to `Export CSV` after the failure.
- Existing reminder controls still work after the error.

## Settings / Data Import

**Verification note**

- The shared CSV fixtures live in `docs/qa-fixtures/`.
- The shared period selector defaults to `Today` in Analytics and Shame Card. Home History only exposes `Today`, `Yesterday`, and `This week`, so fixed historical fixture rows are verified through Analytics and Shame Card `Choose date`.
- The fixture dates are fixed historical ISO timestamps. Clear app data before re-importing the same fixture if you need deterministic imported/skipped counts.

### 34. Import a valid Money Leak CSV backup

**Preconditions**

- Test on a native device or simulator.
- `docs/qa-fixtures/valid-money-leak.csv` is available on the device.
- Local transaction data is empty, or the fixture IDs have not been imported yet.

**Steps**

1. Open `Settings`.
2. In the `Data` section, tap `Import CSV`.
3. Pick `docs/qa-fixtures/valid-money-leak.csv` in the native document picker.
4. Wait for the import to finish.
5. Open `Home` and confirm the History selector still only offers `Today`, `Yesterday`, and `This week`.
6. Open `Analytics`, use `Choose date` for `Jan 1, 2025`, then `Jan 2, 2025`, and review the summary and any visible metric cards.
7. Open `Shame Card` with `Choose date` set to `Jan 2, 2025` and review the preview state.

**Expected result**

- Native document picker opens.
- `Import CSV` changes to `Importing...` while the import is in flight.
- Settings shows `Imported 2 transactions. Skipped 0 rows.`
- Imported leak transactions show their saved leak reason and optional note.
- `Analytics` and `Shame Card` reflect the imported data immediately.
- Home remains stable after import and keeps its three-period History selector.
- App stays responsive after the import completes.

### 35. Import a UTF-8 BOM CSV

**Preconditions**

- Test on a native device or simulator.
- `docs/qa-fixtures/valid-with-bom.csv` is available on the device.
- Local transaction data is empty, or the fixture IDs have not been imported yet.

**Steps**

1. Open `Settings`.
2. Tap `Import CSV`.
3. Pick `docs/qa-fixtures/valid-with-bom.csv`.
4. Wait for the import to finish.
5. Open `Analytics` and use `Choose date` to select `Jan 1, 2025`, then `Jan 2, 2025`.

**Expected result**

- Import succeeds without crashing.
- Settings shows `Imported 2 transactions. Skipped 0 rows.`
- The BOM at the start of the file does not create a header error or corrupt the first transaction ID.
- Both imported transactions appear in Analytics for the selected fixture dates.

### 36. Import a CRLF CSV

**Preconditions**

- Test on a native device or simulator.
- `docs/qa-fixtures/valid-crlf.csv` is available on the device.
- Local transaction data is empty, or the fixture IDs have not been imported yet.

**Steps**

1. Open `Settings`.
2. Tap `Import CSV`.
3. Pick `docs/qa-fixtures/valid-crlf.csv`.
4. Wait for the import to finish.
5. Open the imported leak transaction in `Home`.

**Expected result**

- Import succeeds without crashing.
- Settings shows `Imported 2 transactions. Skipped 0 rows.`
- CRLF row endings do not create malformed rows.
- The imported leak note keeps its embedded CRLF line break.

### 37. Import preserves quoted commas, quotes, LF, and embedded newlines

**Preconditions**

- Test on a native device or simulator.
- `docs/qa-fixtures/valid-money-leak.csv` has just been imported.

**Steps**

1. Open `Analytics`.
2. Confirm the shared period selector is still set to `Choose date: Jan 2`.
3. Review the imported leak transaction from `docs/qa-fixtures/valid-money-leak.csv` through the available imported-data QA path.

**Expected result**

- The imported note keeps the original comma, embedded double quotes, and LF newline.
- The note content appears in a single transaction instead of shifting later CSV columns into the UI.
- No extra transactions are created from the embedded newline.

### 38. Header-only CSV import

**Preconditions**

- Test on a native device or simulator.
- Prepare a CSV file containing only the header row: `id,amount,category,isLeak,leakReason,note,createdAt`.

**Steps**

1. Open `Settings`.
2. Tap `Import CSV`.
3. Pick the header-only CSV file.

**Expected result**

- Import completes without crashing.
- Settings shows `Imported 0 transactions. Skipped 0 rows.`
- Existing transaction data remains unchanged.

### 39. Duplicate IDs in one CSV file are skipped

**Preconditions**

- Test on a native device or simulator.
- `docs/qa-fixtures/duplicate-ids.csv` is available on the device.
- Local transaction data is empty, or the duplicate fixture ID has not been imported yet.

**Steps**

1. Open `Settings`.
2. Tap `Import CSV`.
3. Pick `docs/qa-fixtures/duplicate-ids.csv`.
4. Open `Analytics` with the shared period selector set to `Choose date: Jan 1`.

**Expected result**

- Import completes without crashing.
- Settings shows `Imported 1 transaction. Skipped 1 row.`
- Only one transaction appears for the duplicate ID.
- No duplicate transaction cards appear after the import completes.

### 40. Mixed valid and invalid rows skip bad rows only

**Preconditions**

- Test on a native device or simulator.
- `docs/qa-fixtures/mixed-valid-invalid.csv` is available on the device.
- Local transaction data is empty, or the valid fixture ID has not been imported yet.

**Steps**

1. Open `Settings`.
2. Tap `Import CSV`.
3. Pick `docs/qa-fixtures/mixed-valid-invalid.csv`.
4. Open `Analytics` with the shared period selector set to `Choose date: Jan 1`.

**Expected result**

- Import completes without crashing.
- Settings shows `Imported 1 transaction. Skipped 5 rows.`
- Only the valid transaction appears for the selected fixture date.
- The app does not partially render broken transaction data from invalid rows.

### 41. Empty file, wrong header, and malformed CSV show fatal inline errors

**Preconditions**

- Test on a native device or simulator.
- Prepare three files:
- An empty file with no content.
- `docs/qa-fixtures/wrong-header.csv`.
- `docs/qa-fixtures/malformed.csv`.

**Steps**

1. Open `Settings`.
2. Import the empty file.
3. Import `docs/qa-fixtures/wrong-header.csv`.
4. Import `docs/qa-fixtures/malformed.csv`.

**Expected result**

- Empty file shows `This CSV file is empty.`
- Wrong header shows `This CSV file doesn't match the Money Leak export format.`
- Malformed CSV shows `This CSV file is malformed.`
- The button returns to `Import CSV` after each failure.
- App does not crash and existing transaction data remains unchanged.

### 42. Import success and failure do not break export or reminders

**Preconditions**

- Test on a native device or simulator where sharing and notifications are available.
- `docs/qa-fixtures/valid-money-leak.csv` and `docs/qa-fixtures/wrong-header.csv` are available on the device.

**Steps**

1. Open `Settings`.
2. Import `docs/qa-fixtures/valid-money-leak.csv`.
3. Tap `Export CSV`.
4. Toggle the daily reminder.
5. Import `docs/qa-fixtures/wrong-header.csv`.
6. Tap `Export CSV` again.
7. Toggle the daily reminder again.

**Expected result**

- Export still opens the native share flow after both successful and failed imports.
- Reminder controls still work after both successful and failed imports.
- Import errors appear separately from export errors and reminder errors.
- The app remains responsive throughout the sequence.

## Onboarding

### 43. First-run onboarding can be skipped

**Preconditions**

- App is installed with no existing onboarding completion state.

**Steps**

1. Launch the app for the first time.
2. Wait for the onboarding screen to appear.
3. Tap `Skip`.
4. Let the redirect complete.
5. Fully close and relaunch the app.

**Expected result**

- Tapping `Skip` completes onboarding without crashing.
- App redirects to the main tab flow.
- On relaunch, the app opens the main tab flow instead of showing onboarding again.

### 44. First-run onboarding completes from the final step

**Preconditions**

- App is installed with no existing onboarding completion state.

**Steps**

1. Launch the app for the first time.
2. Tap `Next` until the final onboarding step appears.
3. Leave the reminder toggle unchanged.
4. Tap `Start tracking`.
5. Fully close and relaunch the app.

**Expected result**

- The final step appears without layout or state issues.
- Tapping `Start tracking` completes onboarding without crashing.
- App redirects to the main tab flow.
- On relaunch, the app opens the main tab flow instead of showing onboarding again.

### 45. Onboarding final-step reminder enable, deny, and disable flow

**Preconditions**

- App is installed with no existing onboarding completion state.
- Test on a native device or simulator where notifications are available.

**Steps**

1. Launch the app and advance to the final onboarding step.
2. Turn the daily reminder on.
3. If the system permission prompt appears, deny it once and verify the inline error state.
4. Turn the reminder on again and allow notifications.
5. Turn the reminder off.
6. Tap `Start tracking`.

**Expected result**

- The reminder card only appears on the final onboarding step.
- While reminder support is loading, the screen shows `Checking reminder support…` and the toggle is disabled.
- If notification permission is denied, the toggle returns to off and the screen shows `Notifications are off for Money Leak. Turn them on in system settings to get the daily check-in.`
- After notifications are allowed, the toggle stays on with no crash or stuck loading state.
- Turning the reminder off works on the onboarding screen before completing setup.
- Completing onboarding still succeeds after each reminder interaction.

## Settings / Reminders

### 46. Settings reminder enable and disable flow

**Preconditions**

- Test on a native device or simulator where notifications are available.
- App has already completed onboarding and is on the main tab flow.

**Steps**

1. Open `Settings`.
2. Wait for the reminder state to finish loading.
3. Turn the daily reminder on and allow notifications if prompted.
4. Turn the daily reminder off.

**Expected result**

- While reminder support is loading, the screen shows `Checking reminder support…` and the toggle is disabled.
- Turning the reminder on succeeds without crashing and leaves the toggle enabled.
- Turning the reminder off succeeds without crashing and leaves the toggle disabled.
- The reminder section stays responsive after the toggle is used more than once.

### 47. Settings reminder denied and unsupported states

**Preconditions**

- Use either:
- A native device or simulator where notification permission can be denied.
- Or a web runtime where reminders are unsupported.

**Steps**

1. Open `Settings`.
2. If notifications are available, try turning the reminder on and deny permission.
3. If reminders are unsupported, review the reminder section without toggling.

**Expected result**

- On native with denied permission, the toggle returns to off and the screen shows `Notifications are off for Money Leak. Turn them on in system settings to get the daily check-in.`
- On an unsupported platform, the toggle stays disabled and the screen shows `Daily reminders are not available on this platform.`
- The reminder section does not crash or block the rest of `Settings`.

## Web Fallback

### 48. Web Settings safely reflects native-only persistence limits

**Preconditions**

- Test in the web build.

**Steps**

1. Open the app on web.
2. Open `Settings`.
3. Wait for the `Data` section to finish its initial loading state.
4. Review the reminder and data sections.

**Expected result**

- App does not crash while `Settings` loads on web.
- The status text above the data actions shows `Your local transaction history could not be fully prepared on this platform.`
- The `Data` section shows `Import CSV is only available on native devices in this build.`
- The `Data` section shows an inline transaction error explaining that SQLite transaction persistence is only available on native platforms in this build.
- `Import CSV` stays disabled on web.
- `Export CSV` stays disabled when local transaction history could not be prepared on web.
- Reminder UI safely shows the unsupported platform state without affecting the rest of the screen.

## Retired Home Card Coverage

### 49. Daily Review helper coverage after ML-48

**Preconditions**

- Local transaction data is empty, then includes normal and leak transactions for today and yesterday.

**Steps**

1. Run the automated Home helper tests.
2. Open `Home`.
3. Review the visible Home sections.

**Expected result**

- `calculateDailyReviewSummary` tests still cover empty data, normal today data, leak today data, and yesterday exclusion.
- Home does not render the old `Today check-in` card.
- Home renders the ML-48 `Today summary` section instead.

### 50. Logging Streak helper coverage after ML-48

**Preconditions**

- Local data includes scenarios with empty history, today-only history, yesterday-only history, consecutive local days, and a gap.

**Steps**

1. Run the automated Logging Streak helper tests.
2. Open `Home`.

**Expected result**

- Logging Streak helper tests still pass.
- Home does not render the old Logging Streak card or its CTA.
- Add Transaction remains available from the ML-48 Today summary CTA.

### 51. Leak Risk helper coverage after ML-48

**Preconditions**

- Local data includes no-leak, low-risk, medium-risk, high-risk, and near-midnight risk-window scenarios.

**Steps**

1. Run the automated Leak Risk helper tests.
2. Open `Home`.

**Expected result**

- Leak Risk helper tests still pass.
- Home does not render the old `Leak risk today` card.
- Analytics and Shame Card continue to handle leak data without Home-specific changes.
